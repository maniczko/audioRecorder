/**
 * pipeline.ts
 *
 * Main transcription pipeline orchestrator.
 * Coordinates transcription, diarization, and post-processing modules.
 * Owns retry logic (standard → enhanced profile) and remote source materialization.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { config } from './config.ts';
import { logger } from './logger.ts';
import { matchSpeakerToProfile } from './speakerEmbedder.ts';
import { MetricsService } from './services/MetricsService.ts';
import { getSttModelForProcessingMode } from './stt/modelSelector.ts';

// ── Sub-module imports ────────────────────────────────────────────────────────
import {
  getUploadDir,
  buildAudioPreprocessCacheKey,
  getPreprocessCachePath,
  isPreprocessCacheFile,
  resolveStoredAudioQuality,
  analyzeAudioQuality,
  preprocessAudio,
  requestAudioTranscription,
  runSileroVAD,
  transcribeInChunks,
  mergeChunkedPayloads,
  transcribeLiveChunk,
  _sttUseGroq,
  VERIFICATION_MODEL,
  STT_PROVIDER_CHAIN,
  SILENCE_REMOVE,
  MAX_FILE_SIZE_BYTES,
  VAD_ENABLED,
} from './transcription.ts';

import {
  runPyannoteDiarization,
  mergeWithPyannote,
  splitSegmentsByWordSpeaker,
  diarizeFromTranscript,
  applyPerSpeakerNorm,
  VOICELOG_DIARIZER,
  HF_TOKEN_SET,
} from './diarization.ts';

import {
  correctTranscriptWithLLM,
  analyzeMeetingWithOpenAI,
  embedTextChunks,
  extractSpeakerAudioClip,
  generateVoiceCoaching,
  analyzeAcousticFeatures,
  normalizeRecording,
} from './postProcessing.ts';

import {
  buildWhisperPrompt,
  buildVerificationResult,
  buildEmptyTranscriptResult,
  normalizeVerificationSegments,
  normalizeDiarizedSegments,
  computeWerProxy,
  isHallucination,
  removeConsecutiveDuplicates,
  mergeShortSegments,
  clean,
  getRawWords,
} from './audioPipeline.utils.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Memory diagnostics ────────────────────────────────────────────────────────
function logMemory(stage: string) {
  const mem = process.memoryUsage();
  const fmt = (b: number) => (b / 1024 / 1024).toFixed(1);
  console.log(
    `[pipeline:memory] stage=${stage} rss=${fmt(mem.rss)}MB heap=${fmt(mem.heapUsed)}/${fmt(mem.heapTotal)}MB external=${fmt(mem.external)}MB arrayBuffers=${fmt(mem.arrayBuffers)}MB`
  );
}

// ── Config ────────────────────────────────────────────────────────────────────
const OPENAI_API_KEY = config.VOICELOG_OPENAI_API_KEY || config.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = config.VOICELOG_OPENAI_BASE_URL;
const AUDIO_LANGUAGE = config.AUDIO_LANGUAGE;
const PER_SPEAKER_NORM = config.VOICELOG_PER_SPEAKER_NORM;
const DEBUG = process.env.VOICELOG_DEBUG === 'true';

// ── Internal helpers ──────────────────────────────────────────────────────────

function isRemoteAudioPath(filePath: string) {
  return Boolean(filePath && !filePath.includes(path.sep) && !filePath.includes('/'));
}

function buildAudioQualityForAttempt(
  audioQuality: any,
  profile: 'standard' | 'enhanced',
  enhancementApplied = false
) {
  if (!audioQuality || typeof audioQuality !== 'object') return null;
  return {
    ...audioQuality,
    enhancementApplied,
    enhancementProfile: enhancementApplied ? profile : 'none',
  };
}

function shouldRetryWithEnhancedProfile(
  profile: 'standard' | 'enhanced',
  attemptCount: number,
  outcome: any
) {
  if (profile !== 'standard' || attemptCount >= 2) return false;
  if (outcome?.transcriptOutcome === 'empty') return true;
  return Number(outcome?.transcriptionDiagnostics?.chunksFailedAtStt || 0) > 0;
}

// ── Single transcription attempt ──────────────────────────────────────────────

async function runTranscriptionAttempt(
  asset: any,
  options: any = {},
  baseAudioQuality: any = null,
  profile: 'standard' | 'enhanced' = 'standard',
  attemptCount: 1 | 2 = 1
) {
  const notify = (p: number, m: string) => {
    if (typeof options.onProgress === 'function') options.onProgress({ progress: p, message: m });
  };

  let tempFilePath = '';
  let workingFilePath = options.workingFilePath || asset.file_path;
  let prepPath = options.preprocessedFilePath || '';
  const preprocessCacheKey = options.preprocessCacheKey || '';

  // Performance metrics tracking (#340) — declared outside try so finally can access it
  const pipelineMetrics = {
    requestId: options.requestId || 'internal-pipeline',
    stages: {} as Record<string, number>,
    total: 0,
  };

  try {
    logMemory('pipeline-start');
    if (!workingFilePath) throw new Error('Brak ścieżki do pliku audio.');

    if (!options.workingFilePath && isRemoteAudioPath(workingFilePath)) {
      notify(10, 'Pobieranie nagrania z bazy danych...');
      const { downloadAudioToFile } = await import('./lib/supabaseStorage.js');
      const baseMime = String(asset.content_type || '')
        .toLowerCase()
        .split(';')[0]
        .trim();
      const ext =
        {
          'audio/webm': '.webm',
          'audio/mpeg': '.mp3',
          'audio/mp4': '.m4a',
          'audio/wav': '.wav',
          'audio/ogg': '.ogg',
          'audio/flac': '.flac',
        }[baseMime] || '.webm';
      const uploadDir = getUploadDir();
      tempFilePath = path.join(uploadDir, `temp_transcribe_${crypto.randomUUID()}${ext}`);
      fs.mkdirSync(path.dirname(tempFilePath), { recursive: true });
      await downloadAudioToFile(workingFilePath, tempFilePath);
      workingFilePath = tempFilePath;
      logMemory('after-download');
    }

    if (!fs.existsSync(workingFilePath)) {
      throw new Error('Lokalny plik audio nie istnieje i nie mogl byc pobrany.');
    }

    notify(10, 'Wyciąganie audio do pamięci podręcznej...');
    if (!prepPath) {
      prepPath = await preprocessAudio(workingFilePath, options.signal, profile, {
        cacheKey: preprocessCacheKey,
        silenceRemove: SILENCE_REMOVE && !HF_TOKEN_SET,
      });
    }
    let transcribeFilePath = prepPath || workingFilePath;
    const transcribeContentType = prepPath
      ? 'audio/wav'
      : options.workingContentType || asset.content_type;
    const attemptAudioQuality = buildAudioQualityForAttempt(
      baseAudioQuality,
      profile,
      Boolean(prepPath)
    );

    // ── PARALLEL: VAD + diarization (run concurrently to save time) ──
    // Run VAD and pyannote in parallel, then do STT
    notify(30, 'Równoległe przetwarzanie: VAD + diaryzacja...');

    const usePyannote = VOICELOG_DIARIZER !== 'openai' && HF_TOKEN_SET;

    const [speechSegments, earlyPyannoteSegments] = await Promise.all([
      // 1. Silero VAD - silence detection
      (async () => {
        if (!VAD_ENABLED) return null;
        notify(30, 'Silero VAD - optymalizacja ciszy...');
        return await runSileroVAD(transcribeFilePath, options.signal);
      })(),

      // 2. Pyannote diarization (for per-speaker norm)
      (async () => {
        if (!usePyannote || !PER_SPEAKER_NORM) return null;
        notify(25, 'Wstępna diaryzacja mówców (normalizacja głośności)...');
        return await runPyannoteDiarization(transcribeFilePath, options.signal);
      })(),
    ]);

    // ── Process diarization results ────────────────────────────────────────────
    let normFilePath = '';
    if (
      earlyPyannoteSegments &&
      Array.isArray(earlyPyannoteSegments) &&
      earlyPyannoteSegments.length > 0
    ) {
      const uniqueSpeakers = new Set((earlyPyannoteSegments as any[]).map((s) => s.speaker));
      if (uniqueSpeakers.size > 1) {
        notify(28, `Normalizacja głośności per mówca (${uniqueSpeakers.size} mówców)...`);
        const normalized = await applyPerSpeakerNorm(
          transcribeFilePath,
          earlyPyannoteSegments as any[]
        );
        if (normalized) {
          normFilePath = normalized;
          transcribeFilePath = normalized;
          if (DEBUG) console.log(`[pipeline] Per-speaker norm applied: ${normalized}`);
        }
      }
    }

    if (DEBUG && Array.isArray(speechSegments)) {
      console.log(`[pipeline] Silero VAD detected ${speechSegments.length} speech segment(s).`);
    }

    let transcriptionDiagnostics: any = {
      usedChunking: false,
      fileSizeBytes: 0,
      chunksAttempted: 0,
      chunksExtracted: 0,
      chunksDiscardedAsTooSmall: 0,
      chunksSentToStt: 0,
      chunksFailedAtStt: 0,
      chunksReturnedEmptyPayload: 0,
      chunksWithSegments: 0,
      chunksWithWords: 0,
      chunksWithText: 0,
      chunksFlaggedSilentByVad: 0,
      mergedSegmentsCount: 0,
      mergedWordsCount: 0,
      mergedTextLength: 0,
      lastChunkErrorMessage: '',
      transcriptionProfileUsed: profile,
      transcriptionAttemptCount: attemptCount,
    };

    try {
      const fileSize = fs.statSync(transcribeFilePath).size;
      const isLargeFile = fileSize > MAX_FILE_SIZE_BYTES;
      transcriptionDiagnostics = {
        ...transcriptionDiagnostics,
        usedChunking: isLargeFile,
        fileSizeBytes: fileSize,
      };
      if (isLargeFile) {
        console.log(
          `[pipeline] File size ${(fileSize / 1024 / 1024).toFixed(1)} MB > limit — will process in chunks.`
        );
      }

      const contextPrompt = buildWhisperPrompt({
        meetingTitle: options.meetingTitle,
        participants: options.participants,
        tags: options.tags,
        vocabulary: options.vocabulary,
      });

      // gpt-4o-transcribe works best with temperature=0; older whisper models use 0.1
      const selectedModel = getSttModelForProcessingMode(options.processingMode || 'full');
      const isGpt4oTranscribe = selectedModel.includes('gpt-4o');
      const whisperTemperature =
        isGpt4oTranscribe || attemptAudioQuality?.qualityLabel === 'poor' ? 0 : 0.1;

      const whisperFields = {
        model: selectedModel,
        language: options.language || AUDIO_LANGUAGE,
        response_format: 'verbose_json',
        timestamp_granularities: ['segment', 'word'],
        prompt: contextPrompt,
        temperature: whisperTemperature,
      };

      logMemory('before-transcription');
      notify(40, 'Transkrypcja AI rozkłada pętle paczek...');

      let whisperPayload: any = null;
      let sttProviderInfo: any = null;
      const modelsToTry = _sttUseGroq
        ? ['whisper-large-v3']
        : selectedModel !== 'whisper-1'
          ? [selectedModel, 'whisper-1']
          : ['whisper-1'];

      const reqId = options.requestId || 'internal-pipeline';

      pipelineMetrics.requestId = reqId;
      const stageStart = (name: string) => performance.now();
      const stageEnd = (name: string, start: number) => {
        const duration = performance.now() - start;
        pipelineMetrics.stages[name] = parseFloat(duration.toFixed(2));
        pipelineMetrics.total += duration;
        MetricsService.observeStageDuration(name, pipelineMetrics.stages[name]);
        logger.info(`[Metrics] Pipeline Stage Complete`, {
          requestId: reqId,
          stage: name,
          durationMs: pipelineMetrics.stages[name],
        });
      };

      const startTranscribe = stageStart('transcription');
      let lastTranscriptionError: any = null;

      for (const model of modelsToTry) {
        const fields = { ...whisperFields, model };
        try {
          if (isLargeFile) {
            const chunkPayloads = await transcribeInChunks(
              transcribeFilePath,
              transcribeContentType,
              fields,
              options
            );
            logMemory('after-chunked-transcription');
            whisperPayload = mergeChunkedPayloads(chunkPayloads, fileSize);
            sttProviderInfo = whisperPayload?.sttProviderInfo || null;
            transcriptionDiagnostics = {
              ...transcriptionDiagnostics,
              ...(whisperPayload?.transcriptionDiagnostics || {}),
            };
            const sentToStt = Number(transcriptionDiagnostics.chunksSentToStt || 0);
            const failedAtStt = Number(transcriptionDiagnostics.chunksFailedAtStt || 0);
            if (sentToStt > 0 && failedAtStt === sentToStt) {
              const error: any = new Error('Transkrypcja STT nie powiodla sie dla zadnego modelu.');
              error.transcriptionDiagnostics = transcriptionDiagnostics;
              error.audioQuality = attemptAudioQuality;
              throw error;
            }
          } else {
            const sttResult = await requestAudioTranscription({
              filePath: transcribeFilePath,
              contentType: transcribeContentType,
              fields,
              signal: options.signal,
            });
            whisperPayload = sttResult?.payload || null;
            sttProviderInfo = sttResult;
            transcriptionDiagnostics = {
              ...transcriptionDiagnostics,
              chunksAttempted: 1,
              chunksExtracted: 1,
              chunksDiscardedAsTooSmall: 0,
              chunksSentToStt: 1,
              chunksFailedAtStt: 0,
              chunksReturnedEmptyPayload:
                Array.isArray(whisperPayload?.segments) && whisperPayload.segments.length > 0
                  ? 0
                  : getRawWords(whisperPayload).length > 0
                    ? 0
                    : clean(
                          whisperPayload?.text ||
                            whisperPayload?.transcript ||
                            whisperPayload?.results?.text
                        )
                      ? 0
                      : 1,
              chunksWithSegments:
                Array.isArray(whisperPayload?.segments) && whisperPayload.segments.length > 0
                  ? 1
                  : 0,
              chunksWithWords: getRawWords(whisperPayload).length > 0 ? 1 : 0,
              chunksWithText: clean(
                whisperPayload?.text || whisperPayload?.transcript || whisperPayload?.results?.text
              )
                ? 1
                : 0,
              mergedSegmentsCount: Array.isArray(whisperPayload?.segments)
                ? whisperPayload.segments.length
                : 0,
              mergedWordsCount: getRawWords(whisperPayload).length,
              mergedTextLength: clean(
                whisperPayload?.text || whisperPayload?.transcript || whisperPayload?.results?.text
              ).length,
              lastChunkErrorMessage: '',
              sttAttempts: Array.isArray(sttResult?.attempts) ? sttResult.attempts : [],
            };
          }
          if (DEBUG) console.log(`[pipeline] Transcription succeeded with model: ${model}`);
          break;
        } catch (error: any) {
          whisperPayload = null;
          lastTranscriptionError = error;
          transcriptionDiagnostics = {
            ...transcriptionDiagnostics,
            lastChunkErrorMessage: clean(
              error?.transcriptionDiagnostics?.lastChunkErrorMessage || error?.message || ''
            ),
            ...(error?.transcriptionDiagnostics &&
            typeof error.transcriptionDiagnostics === 'object'
              ? error.transcriptionDiagnostics
              : {}),
          };
          console.error(`[pipeline] Transcription failed with model ${model}:`, error.message);
          if (model === modelsToTry[modelsToTry.length - 1]) {
            console.error('[pipeline] All transcription models exhausted.');
          }
        }
      }

      // Provider-level fallback: Groq primary failed → retry with OpenAI
      if (!whisperPayload && _sttUseGroq && OPENAI_API_KEY) {
        const openaiModels =
          config.VERIFICATION_MODEL !== 'whisper-1'
            ? [config.VERIFICATION_MODEL, 'whisper-1']
            : ['whisper-1'];
        for (const model of openaiModels) {
          const fallbackFields = { ...whisperFields, model };
          try {
            console.log(`[pipeline] Groq STT failed — retrying with OpenAI model ${model}`);
            if (isLargeFile) {
              const chunkPayloads = await transcribeInChunks(
                transcribeFilePath,
                transcribeContentType,
                fallbackFields,
                {
                  ...options,
                  sttApiKey: OPENAI_API_KEY,
                  sttBaseUrl: OPENAI_BASE_URL,
                }
              );
              whisperPayload = mergeChunkedPayloads(chunkPayloads, fileSize);
              transcriptionDiagnostics = {
                ...transcriptionDiagnostics,
                ...(whisperPayload?.transcriptionDiagnostics || {}),
              };
            } else {
              whisperPayload = await requestAudioTranscription({
                filePath: transcribeFilePath,
                contentType: transcribeContentType,
                fields: fallbackFields,
                signal: options.signal,
                apiKey: OPENAI_API_KEY,
                baseUrl: OPENAI_BASE_URL,
              });
            }
            if (whisperPayload) {
              lastTranscriptionError = null;
              if (DEBUG) console.log(`[pipeline] OpenAI fallback succeeded with model: ${model}`);
              break;
            }
          } catch (e: any) {
            lastTranscriptionError = e;
            console.error(`[pipeline] OpenAI fallback failed for model ${model}:`, e.message);
          }
        }
      }

      if (!whisperPayload) {
        const error: any =
          lastTranscriptionError instanceof Error
            ? lastTranscriptionError
            : new Error('Transkrypcja STT nie powiodla sie dla zadnego modelu.');
        error.transcriptionDiagnostics = transcriptionDiagnostics;
        error.audioQuality = attemptAudioQuality;
        throw error;
      }

      stageEnd('transcription', startTranscribe);

      const verificationSegments = normalizeVerificationSegments(whisperPayload || {});

      // ── Diarization ────────────────────────────────────────────────────────
      let diarization: any = null;
      const startDiarize = stageStart('diarization');

      if (usePyannote) {
        notify(80, 'Pyannote - rozpoznawanie i segregacja głosu po wektorach wieloosiowych!');
        const pyannoteSegments =
          earlyPyannoteSegments ??
          (await runPyannoteDiarization(transcribeFilePath, options.signal));
        if (pyannoteSegments && verificationSegments.length) {
          const rawWhisperSegments = Array.isArray(whisperPayload?.segments)
            ? whisperPayload.segments
            : [];
          const wordDiarization = rawWhisperSegments.length
            ? splitSegmentsByWordSpeaker(rawWhisperSegments, pyannoteSegments as any[])
            : null;
          if (wordDiarization) {
            if (DEBUG)
              console.log(
                '[pipeline] Using word-level pyannote diarization (finer speaker splits).'
              );
            diarization = wordDiarization;
          } else {
            if (DEBUG)
              console.log(
                '[pipeline] Using segment-level pyannote diarization merged with Whisper.'
              );
            diarization = mergeWithPyannote(
              pyannoteSegments as any[],
              verificationSegments as any[]
            );
          }
        }
      }

      if (!diarization) {
        if (DEBUG)
          console.log(
            '[pipeline] Pyannote unavailable — using GPT-4o-mini transcript diarization.'
          );
        notify(80, 'Analiza semantyczna GPT-4o-mini celem wyizolowania rozmówców...');
        try {
          diarization = await diarizeFromTranscript(verificationSegments, {
            participants: options.participants,
          });
          if (DEBUG && diarization) {
            console.log(
              `[pipeline] Transcript diarization: ${diarization.segments.length} segs, ${diarization.speakerCount} speaker(s): ${JSON.stringify(diarization.speakerNames)}`
            );
          }
        } catch (err: any) {
          console.warn('[pipeline] Transcript diarization error:', err.message);
          diarization = null;
        }
      }

      if (!diarization || !diarization.segments.length) {
        if (DEBUG) console.log('[pipeline] Using whisper segments as single-speaker fallback.');
        diarization = normalizeDiarizedSegments(whisperPayload || {});
      }

      stageEnd('diarization', startDiarize);

      if (!diarization.segments.length) {
        if (
          isLargeFile &&
          Number(transcriptionDiagnostics.chunksExtracted || 0) === 0 &&
          Number(transcriptionDiagnostics.chunksDiscardedAsTooSmall || 0) > 0 &&
          Number(transcriptionDiagnostics.chunksSentToStt || 0) === 0
        ) {
          return buildEmptyTranscriptResult(
            'all_chunks_discarded_as_too_small',
            transcriptionDiagnostics,
            attemptAudioQuality
          );
        }
        return buildEmptyTranscriptResult(
          'no_segments_from_stt',
          transcriptionDiagnostics,
          attemptAudioQuality
        );
      }

      // ── VAD hallucination filter ───────────────────────────────────────────
      if (speechSegments) {
        const originalCount = diarization.segments.length;
        diarization.segments = diarization.segments.filter((seg: any) => {
          const hasSpeech =
            Array.isArray(speechSegments) &&
            speechSegments.some((v: any) => {
              const overlap = Math.max(
                0,
                Math.min(seg.endTimestamp, v.end) - Math.max(seg.timestamp, v.start)
              );
              return overlap > 0.1 || overlap / (seg.endTimestamp - seg.timestamp) > 0.2;
            });
          return hasSpeech;
        });
        if (DEBUG && diarization.segments.length < originalCount) {
          console.log(
            `[pipeline] VAD filter removed ${originalCount - diarization.segments.length} hallucinated segment(s).`
          );
        }
        if (!diarization.segments.length) {
          return buildEmptyTranscriptResult(
            'segments_removed_by_vad',
            transcriptionDiagnostics,
            attemptAudioQuality
          );
        }
      }

      const verificationResult = buildVerificationResult(
        diarization.segments,
        verificationSegments
      );

      if (DEBUG) {
        const spkDist = verificationResult.verifiedSegments.reduce((acc: any, s: any) => {
          acc[s.speakerId] = (acc[s.speakerId] || 0) + 1;
          return acc;
        }, {});
        console.log(
          `[pipeline] After verification: ${verificationResult.verifiedSegments.length} segs, speakers: ${JSON.stringify(spkDist)}`
        );
      }

      // ── Speaker identification ────────────────────────────────────────────
      const identifiedNames = { ...diarization.speakerNames };
      const voiceProfiles = options.voiceProfiles || [];
      if (voiceProfiles.length && diarization.speakerCount > 0) {
        const speakerSegmentMap = new Map<string, any[]>();
        for (const seg of diarization.segments) {
          const sid = String(seg.speakerId);
          if (!speakerSegmentMap.has(sid)) speakerSegmentMap.set(sid, []);
          speakerSegmentMap.get(sid)!.push(seg);
        }

        for (const [speakerId, segs] of speakerSegmentMap.entries()) {
          const totalSpeakerTime = segs.reduce((sum, s) => sum + (s.endTimestamp - s.timestamp), 0);
          if (totalSpeakerTime < 2) continue;

          const clipPath = path.join(
            path.dirname(asset.file_path),
            `spk_${asset.id}_${speakerId}_clip.wav`
          );
          try {
            const safeSegments = segs.slice(0, 8).filter((s) => {
              const t = Number(s.timestamp);
              const e = Number(s.endTimestamp);
              return Number.isFinite(t) && Number.isFinite(e) && e > t && t >= 0;
            });
            if (!safeSegments.length) continue;
            const selectFilter = safeSegments
              .map(
                (s) =>
                  `between(t,${Number(s.timestamp).toFixed(3)},${Number(s.endTimestamp).toFixed(3)})`
              )
              .join('+');
            const { exec: execFn } = await import('node:child_process');
            const { promisify } = await import('node:util');
            const execP = promisify(execFn);
            const FFMPEG_BINARY = config.FFMPEG_BINARY;
            await execP(
              `"${FFMPEG_BINARY}" -y -i "${asset.file_path}" -af "aselect='${selectFilter}',asetpts=N/SR/TB" -threads 4 -ar 16000 -ac 1 "${clipPath}"`,
              { timeout: 30000, signal: options.signal }
            );
            const matchResult = await matchSpeakerToProfile(clipPath, voiceProfiles);
            if (matchResult) {
              identifiedNames[speakerId] = matchResult.name;
            }
          } catch (err: any) {
            console.warn(
              `[pipeline] Speaker clip extraction failed for speaker ${speakerId}:`,
              err.message
            );
          } finally {
            try {
              fs.unlinkSync(clipPath);
            } catch (_) {}
          }
        }
      }

      // ── Post-processing: hallucination removal → dedup → merge → LLM ─────
      const startPostProcess = stageStart('post-processing');
      const processedSegments = await (async () => {
        notify(90, 'Czyszczenie halucynacji AI za sprawą hybrydowej analizy WavLM...');
        const withoutHallucinations = verificationResult.verifiedSegments.filter(
          (seg: any) => !isHallucination(seg.text)
        );
        if (DEBUG && withoutHallucinations.length < verificationResult.verifiedSegments.length) {
          console.log(
            `[pipeline] Hallucination filter removed ${verificationResult.verifiedSegments.length - withoutHallucinations.length} segment(s).`
          );
        }
        if (!withoutHallucinations.length) {
          return buildEmptyTranscriptResult(
            'segments_removed_as_hallucinations',
            transcriptionDiagnostics,
            attemptAudioQuality
          ).segments;
        }
        const deduplicated = removeConsecutiveDuplicates(withoutHallucinations);
        if (DEBUG && deduplicated.length < withoutHallucinations.length) {
          console.log(
            `[pipeline] Cross-segment dedup removed ${withoutHallucinations.length - deduplicated.length} repeated segment(s).`
          );
        }
        if (!deduplicated.length) {
          return buildEmptyTranscriptResult(
            'segments_removed_as_hallucinations',
            transcriptionDiagnostics,
            attemptAudioQuality
          ).segments;
        }
        const merged = mergeShortSegments(deduplicated);
        const corrected = await correctTranscriptWithLLM(merged, options);
        return corrected;
      })();
      stageEnd('post-processing', startPostProcess);

      if (!processedSegments.length) {
        return buildEmptyTranscriptResult(
          'segments_removed_as_hallucinations',
          transcriptionDiagnostics,
          attemptAudioQuality
        );
      }

      const referenceTranscript = verificationSegments
        .map((segment: any) => clean(segment?.text || ''))
        .filter(Boolean)
        .join(' ');
      const hypothesisTranscript = processedSegments
        .map((segment: any) => clean(segment?.text || ''))
        .filter(Boolean)
        .join(' ');
      const qualityMetrics = {
        sttProviderId: sttProviderInfo?.providerId || '',
        sttProviderLabel: sttProviderInfo?.providerLabel || '',
        sttModel: sttProviderInfo?.model || '',
        sttAttempts: Array.isArray(sttProviderInfo?.attempts)
          ? sttProviderInfo.attempts
          : Array.isArray(transcriptionDiagnostics?.sttAttempts)
            ? transcriptionDiagnostics.sttAttempts
            : [],
        werProxy: computeWerProxy(referenceTranscript, hypothesisTranscript),
        diarizationConfidence: verificationResult.confidence,
      };

      return {
        providerId: sttProviderInfo?.providerId || 'stt-pipeline',
        providerLabel: sttProviderInfo?.providerLabel || 'STT + diarization',
        pipelineStatus: 'completed',
        transcriptOutcome: 'normal',
        emptyReason: '',
        userMessage: '',
        audioQuality: attemptAudioQuality,
        transcriptionDiagnostics,
        qualityMetrics,
        diarization: {
          speakerNames: identifiedNames,
          speakerCount: diarization.speakerCount,
          confidence: verificationResult.confidence,
          text: diarization.text,
          transcriptOutcome: 'normal',
          emptyReason: '',
          userMessage: '',
          audioQuality: attemptAudioQuality,
          transcriptionDiagnostics,
          qualityMetrics,
        },
        segments: processedSegments,
        speakerNames: identifiedNames,
        speakerCount: diarization.speakerCount,
        confidence: verificationResult.confidence,
        reviewSummary: {
          needsReview: processedSegments.filter(
            (segment: any) => segment.verificationStatus === 'review'
          ).length,
          approved: processedSegments.filter(
            (segment: any) => segment.verificationStatus === 'verified'
          ).length,
        },
      };
    } catch (error: any) {
      error.audioQuality = error?.audioQuality || attemptAudioQuality;
      error.transcriptionDiagnostics = {
        ...(transcriptionDiagnostics || {}),
        ...(error?.transcriptionDiagnostics && typeof error.transcriptionDiagnostics === 'object'
          ? error.transcriptionDiagnostics
          : {}),
        transcriptionProfileUsed: profile,
        transcriptionAttemptCount: attemptCount,
      };
      throw error;
    } finally {
      // Log total pipeline metrics (#340)
      if (pipelineMetrics && pipelineMetrics.total > 0) {
        logger.info(`[Metrics] Pipeline Total Duration`, {
          requestId: pipelineMetrics.requestId,
          recordingId: asset.id,
          totalDurationMs: parseFloat(pipelineMetrics.total.toFixed(2)),
          stages: pipelineMetrics.stages,
          p50:
            Object.values(pipelineMetrics.stages).sort((a, b) => a - b)[
              Math.floor(Object.keys(pipelineMetrics.stages).length / 2)
            ] || 0,
          p95:
            Object.values(pipelineMetrics.stages).sort((a, b) => a - b)[
              Math.floor(Object.keys(pipelineMetrics.stages).length * 0.95)
            ] || 0,
          p99:
            Object.values(pipelineMetrics.stages).sort((a, b) => a - b)[
              Math.floor(Object.keys(pipelineMetrics.stages).length * 0.99)
            ] || 0,
        });
      }

      if (prepPath && !isPreprocessCacheFile(prepPath)) {
        try {
          fs.unlinkSync(prepPath);
        } catch (_) {}
      }
      if (normFilePath) {
        try {
          fs.unlinkSync(normFilePath);
        } catch (_) {}
      }
    }
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (_) {}
    }
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function transcribeRecording(asset: any, options: any = {}) {
  let audioQuality = resolveStoredAudioQuality(asset);

  if (!audioQuality) {
    try {
      audioQuality = await Promise.race([
        analyzeAudioQuality(asset.file_path, {
          contentType: asset.content_type,
          signal: options.signal,
        }),
        new Promise((resolve) => setTimeout(() => resolve(null), 250)),
      ]);
    } catch (error: any) {
      if (!options.signal?.aborted) {
        console.warn('[pipeline] Audio quality analysis fallback failed:', error?.message || error);
      }
      audioQuality = null;
    }
  }

  const initialProfile: 'standard' | 'enhanced' = (audioQuality as any)?.enhancementRecommended
    ? 'enhanced'
    : 'standard';
  const attemptProfiles: Array<'standard' | 'enhanced'> =
    initialProfile === 'standard' ? ['standard', 'enhanced'] : ['enhanced'];
  const preprocessPlan = new Map(
    attemptProfiles.map((profile) => {
      const cacheKey = buildAudioPreprocessCacheKey(asset, profile);
      return [profile, { cacheKey, cachePath: getPreprocessCachePath(cacheKey, profile) }];
    })
  );

  let sourceTempPath = '';
  let sourceFilePath = asset.file_path;
  const remoteSource = isRemoteAudioPath(asset.file_path);
  const needsSourceMaterialization =
    remoteSource &&
    (!config.AUDIO_PREPROCESS ||
      !attemptProfiles.every((profile) =>
        fs.existsSync(preprocessPlan.get(profile)?.cachePath || '')
      ));

  if (needsSourceMaterialization && remoteSource) {
    try {
      const { downloadAudioToFile } = await import('./lib/supabaseStorage.js');
      const baseMime = String(asset.content_type || '')
        .toLowerCase()
        .split(';')[0]
        .trim();
      const ext =
        {
          'audio/webm': '.webm',
          'audio/mpeg': '.mp3',
          'audio/mp4': '.m4a',
          'audio/wav': '.wav',
          'audio/ogg': '.ogg',
          'audio/flac': '.flac',
        }[baseMime] || '.webm';
      const uploadDir = getUploadDir();
      sourceTempPath = path.join(uploadDir, `temp_transcribe_${crypto.randomUUID()}${ext}`);
      fs.mkdirSync(path.dirname(sourceTempPath), { recursive: true });
      await downloadAudioToFile(asset.file_path, sourceTempPath);
      sourceFilePath = sourceTempPath;
    } catch (error: any) {
      if (!options.signal?.aborted) {
        console.warn(
          '[pipeline] Failed to materialize remote audio source:',
          error?.message || error
        );
      }
      throw error;
    }
  }

  let lastError: any = null;
  let lastResult: any = null;

  try {
    for (let index = 0; index < attemptProfiles.length; index += 1) {
      const profile = attemptProfiles[index];
      const attemptCount = Math.min(index + 1, 2) as 1 | 2;
      const plan = preprocessPlan.get(profile);
      const profileWorkingFilePath =
        plan?.cachePath && fs.existsSync(plan.cachePath) ? plan.cachePath : sourceFilePath;
      const profileOptions = {
        ...options,
        workingFilePath: profileWorkingFilePath,
        workingContentType:
          profileWorkingFilePath === plan?.cachePath ? 'audio/wav' : asset.content_type,
        preprocessedFilePath: profileWorkingFilePath === plan?.cachePath ? plan.cachePath : '',
        preprocessCacheKey: plan?.cacheKey || '',
      };

      try {
        const result = await runTranscriptionAttempt(
          asset,
          profileOptions,
          audioQuality,
          profile,
          attemptCount
        );
        lastResult = result;
        if (
          shouldRetryWithEnhancedProfile(profile, attemptCount, result) &&
          attemptProfiles[index + 1] === 'enhanced'
        ) {
          if (DEBUG) {
            console.log('[pipeline] Retrying transcription with enhanced preprocessing profile.');
          }
          continue;
        }
        return result;
      } catch (error: any) {
        lastError = error;
        if (
          shouldRetryWithEnhancedProfile(profile, attemptCount, error) &&
          attemptProfiles[index + 1] === 'enhanced'
        ) {
          if (DEBUG) {
            console.warn(
              '[pipeline] STT failed on standard profile, retrying with enhanced preprocessing.'
            );
          }
          continue;
        }
        throw error;
      }
    }

    if (lastError) throw lastError;

    return (
      lastResult ||
      buildEmptyTranscriptResult(
        'no_segments_from_stt',
        {
          transcriptionProfileUsed: initialProfile,
          transcriptionAttemptCount: Math.min(attemptProfiles.length, 2) as 1 | 2,
        },
        buildAudioQualityForAttempt(audioQuality, initialProfile, false)
      )
    );
  } finally {
    if (sourceTempPath && fs.existsSync(sourceTempPath)) {
      try {
        fs.unlinkSync(sourceTempPath);
      } catch (_) {}
    }
    // Trigger GC to release native memory held by ffmpeg/audio buffers
    if (typeof global.gc === 'function') global.gc();
  }
}

// ── Re-exports (full public API surface) ─────────────────────────────────────

export {
  // transcription.ts
  analyzeAudioQuality,
  preprocessAudio,
  transcribeLiveChunk,
  buildAudioPreprocessCacheKey,
  getPreprocessCachePath,
  isPreprocessCacheFile,
  // postProcessing.ts
  normalizeRecording,
  extractSpeakerAudioClip,
  generateVoiceCoaching,
  analyzeAcousticFeatures,
  diarizeFromTranscript,
  analyzeMeetingWithOpenAI,
  embedTextChunks,
};
