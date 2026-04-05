/**
 * transcription.ts
 *
 * STT (Whisper/Groq) calls, in-memory chunking, audio preprocessing, and quality analysis.
 * All functions here are IO-heavy but focused exclusively on the transcription concern.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { spawn, exec } from 'node:child_process';
import { config } from './config.ts';
import { resolveConfiguredSttProviders, transcribeWithProviders } from './stt/providers.ts';
import {
  clean,
  getRawWords,
  buildWhisperPrompt,
  deriveFfprobeBinary,
  clamp,
  parseDbNumber,
  CHUNK_DURATION_SECONDS,
  CHUNK_OVERLAP_SECONDS,
  MAX_FILE_SIZE_BYTES,
} from './audioPipeline.utils.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execPromise = promisify(exec);

// ── Config ────────────────────────────────────────────────────────────────────
const OPENAI_API_KEY = config.VOICELOG_OPENAI_API_KEY || config.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = config.VOICELOG_OPENAI_BASE_URL;
const AUDIO_LANGUAGE = config.AUDIO_LANGUAGE;
const GROQ_API_KEY = config.GROQ_API_KEY || '';
export const _sttUseGroq = config.VOICELOG_STT_PROVIDER === 'groq' && !!GROQ_API_KEY;
export const VERIFICATION_MODEL = _sttUseGroq ? 'whisper-large-v3' : config.VERIFICATION_MODEL;
// Auto-detect fallback: if GROQ_API_KEY is set and primary is openai (or vice versa),
// enable fallback automatically instead of requiring VOICELOG_STT_FALLBACK_PROVIDER env var.
const _explicitFallback = config.VOICELOG_STT_FALLBACK_PROVIDER;
const _autoFallback: 'openai' | 'groq' | 'none' =
  _explicitFallback !== 'none'
    ? _explicitFallback
    : config.VOICELOG_STT_PROVIDER === 'openai' && GROQ_API_KEY
      ? 'groq'
      : config.VOICELOG_STT_PROVIDER === 'groq' && OPENAI_API_KEY
        ? 'openai'
        : 'none';

export const STT_PROVIDER_CHAIN = resolveConfiguredSttProviders({
  preferredProvider: config.VOICELOG_STT_PROVIDER,
  fallbackProvider: _autoFallback,
  openAiApiKey: OPENAI_API_KEY,
  openAiBaseUrl: OPENAI_BASE_URL,
  groqApiKey: GROQ_API_KEY,
  openAiModel: config.VERIFICATION_MODEL,
  groqModel: 'whisper-large-v3',
});

// Log provider chain at startup so Railway boot logs show exactly what will be called
if (STT_PROVIDER_CHAIN.length === 0) {
  console.warn('[stt] WARNING: No STT providers configured. Set OPENAI_API_KEY or GROQ_API_KEY.');
} else {
  console.log(
    `[stt] Provider chain: ${STT_PROVIDER_CHAIN.map((p) => p.id).join(' → ')}${_autoFallback !== _explicitFallback ? ` (auto-detected ${_autoFallback} fallback)` : ''}`
  );
  STT_PROVIDER_CHAIN.forEach((p) =>
    console.log(
      `[stt]   ${p.id}: model=${p.defaultModel} url=${p.baseUrl}/audio/transcriptions key=${p.apiKey ? p.apiKey.slice(0, 8) + '...' : 'MISSING'}`
    )
  );
}

const AUDIO_PREPROCESS = config.AUDIO_PREPROCESS;
const SILENCE_REMOVE = config.VOICELOG_SILENCE_REMOVE;
const FFMPEG_BINARY = config.FFMPEG_BINARY;
export const VAD_ENABLED = config.VAD_ENABLED;
const VAD_SCRIPT = path.join(__dirname, 'vad.py');
const PYTHON_BINARY = config.PYTHON_BINARY;
const DEBUG = process.env.VOICELOG_DEBUG === 'true';
const AUDIO_PREPROCESS_CACHE_VERSION = 'v1';

// Adaptive overlap configuration - Task #303
// 0.5s for silence, 2s for dense speech (reduces Whisper token usage by 20%+)
const MIN_OVERLAP_SECONDS = 0.5; // Silence = minimum overlap (0.5s)
const MAX_OVERLAP_SECONDS = 2; // Dense speech = maximum overlap (2s)
const SPEECH_DENSITY_THRESHOLD = 0.6; // 60% speech = high density

// ── Path helpers ──────────────────────────────────────────────────────────────

/**
 * Calculate adaptive overlap based on speech density in the chunk.
 * More overlap for dense speech, less for silence.
 */
export function calculateAdaptiveOverlap(speechSegments: any[], baseOverlap: number): number {
  if (!speechSegments || speechSegments.length === 0) {
    return MIN_OVERLAP_SECONDS; // Silence = minimum overlap
  }

  // Calculate speech density (percentage of time with speech)
  const totalDuration = speechSegments.reduce(
    (max, seg) => Math.max(max, seg.end || seg.endTimestamp || 0),
    0
  );
  if (totalDuration <= 0) return MIN_OVERLAP_SECONDS;

  const speechDuration = speechSegments.reduce((sum, seg) => {
    const start = seg.start || seg.startTimestamp || 0;
    const end = seg.end || seg.endTimestamp || 0;
    return sum + (end - start);
  }, 0);

  const density = speechDuration / totalDuration;

  // Adaptive overlap: more overlap for dense speech
  if (density >= SPEECH_DENSITY_THRESHOLD) {
    return MAX_OVERLAP_SECONDS; // Dense speech = maximum overlap
  } else if (density >= SPEECH_DENSITY_THRESHOLD / 2) {
    return (MIN_OVERLAP_SECONDS + MAX_OVERLAP_SECONDS) / 2; // Medium density
  } else {
    return MIN_OVERLAP_SECONDS; // Low density = minimum overlap
  }
}

let _resolvedUploadDir: string | null = null;

export function getUploadDir() {
  if (_resolvedUploadDir) return _resolvedUploadDir;

  const preferred = config.VOICELOG_UPLOAD_DIR || path.join(__dirname, 'data', 'uploads');
  const candidates = [
    path.resolve(preferred),
    path.resolve(process.cwd(), 'server', 'data', 'uploads'),
    path.resolve(process.cwd(), '.tmp', 'uploads'),
    path.join(os.tmpdir(), 'voicelog', 'uploads'),
  ];

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) {
        fs.mkdirSync(candidate, { recursive: true });
      }
      const probe = path.join(candidate, `.write-probe-${process.pid}`);
      fs.writeFileSync(probe, '');
      fs.unlinkSync(probe);
      if (candidate !== path.resolve(preferred)) {
        console.warn(
          `[transcription] Upload dir ${preferred} not writable, falling back to: ${candidate}`
        );
      }
      _resolvedUploadDir = candidate;
      return candidate;
    } catch {
      // try next candidate
    }
  }

  // Last resort — return preferred and let caller handle the error
  _resolvedUploadDir = path.resolve(preferred);
  return _resolvedUploadDir;
}

function getPreprocessCacheDir() {
  return path.join(getUploadDir(), '.cache', 'preprocessed');
}

export function buildAudioPreprocessCacheKey(asset: any, profile: 'standard' | 'enhanced') {
  const parts = [
    AUDIO_PREPROCESS_CACHE_VERSION,
    profile,
    clean(asset?.id || ''),
    clean(asset?.file_path || ''),
    clean(asset?.updated_at || asset?.updatedAt || asset?.created_at || asset?.createdAt || ''),
    String(asset?.size_bytes || asset?.sizeBytes || 0),
    clean(asset?.content_type || ''),
  ];
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

export function getPreprocessCachePath(cacheKey: string, profile: 'standard' | 'enhanced') {
  return path.join(getPreprocessCacheDir(), `${cacheKey}.${profile}.wav`);
}

function isPathInside(childPath: string, parentPath: string) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export function isPreprocessCacheFile(filePath: string) {
  return Boolean(filePath && isPathInside(filePath, getPreprocessCacheDir()));
}

// ── Audio quality analysis ────────────────────────────────────────────────────

export function resolveStoredAudioQuality(asset: any) {
  try {
    const payload = JSON.parse(asset?.diarization_json || '{}');
    return payload?.audioQuality && typeof payload.audioQuality === 'object'
      ? payload.audioQuality
      : null;
  } catch (_) {
    return null;
  }
}

export async function analyzeAudioQuality(filePath: string, options: any = {}) {
  if (options.signal?.aborted) return { error: 'Aborted' };

  let tempFilePath = '';
  try {
    if (filePath && !filePath.includes(path.sep) && !filePath.includes('/')) {
      const { downloadAudioToFile } = await import('./lib/supabaseStorage.js');
      const baseMime = String(options.contentType || '')
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
      tempFilePath = path.join(uploadDir, `temp_analyze_${crypto.randomUUID()}${ext}`);
      fs.mkdirSync(path.dirname(tempFilePath), { recursive: true });
      await downloadAudioToFile(filePath, tempFilePath);
      filePath = tempFilePath;
    }

    if (!fs.existsSync(filePath)) return { error: 'File not found' } as any;

    const ffprobeBinary = deriveFfprobeBinary(FFMPEG_BINARY);
    let codec = '';
    let sampleRateHz = 0;
    let channels = 0;
    let bitrateKbps = 0;
    let durationSeconds = 0;
    let meanVolumeDb = -60;
    let maxVolumeDb = -60;
    let silenceRatio = 1;

    try {
      const { stdout } = await execPromise(
        `"${ffprobeBinary}" -v quiet -print_format json -show_streams -show_format "${filePath}"`,
        { timeout: 30000, signal: options.signal }
      );
      const parsed = JSON.parse(String(stdout || '{}'));
      const audioStream =
        (Array.isArray(parsed?.streams) ? parsed.streams : []).find(
          (stream) => stream?.codec_type === 'audio'
        ) ||
        (Array.isArray(parsed?.streams) ? parsed.streams[0] : null) ||
        {};
      codec = clean(audioStream?.codec_name || parsed?.format?.format_name || '');
      sampleRateHz = parseDbNumber(audioStream?.sample_rate, 0);
      channels = parseDbNumber(audioStream?.channels, 0);
      bitrateKbps = Math.round(
        parseDbNumber(audioStream?.bit_rate || parsed?.format?.bit_rate, 0) / 1000
      );
      durationSeconds = parseDbNumber(audioStream?.duration || parsed?.format?.duration, 0);
    } catch (error: any) {
      if (!options.signal?.aborted) {
        console.warn('[transcription] ffprobe audio analysis failed:', error?.message || error);
      }
    }

    try {
      const { stderr } = await execPromise(
        `"${FFMPEG_BINARY}" -i "${filePath}" -af "volumedetect" -f null -`,
        { timeout: 45000, signal: options.signal }
      );
      meanVolumeDb = parseDbNumber(
        String(stderr || '').match(/mean_volume:\s*([-\d.]+)\s*dB/i)?.[1],
        meanVolumeDb
      );
      maxVolumeDb = parseDbNumber(
        String(stderr || '').match(/max_volume:\s*([-\d.]+)\s*dB/i)?.[1],
        maxVolumeDb
      );
    } catch (error: any) {
      if (!options.signal?.aborted) {
        console.warn('[transcription] volumedetect analysis failed:', error?.message || error);
      }
    }

    try {
      const { stderr } = await execPromise(
        `"${FFMPEG_BINARY}" -i "${filePath}" -af "silencedetect=noise=-35dB:d=0.5" -f null -`,
        { timeout: 45000, signal: options.signal }
      );
      const silenceDurations = (String(stderr || '').match(/silence_duration:\s*([0-9.]+)/gi) ||
        []) as string[];
      const totalSilence = silenceDurations.reduce(
        (sum: number, entry: any) => sum + parseDbNumber(entry, 0),
        0
      );
      silenceRatio =
        durationSeconds > 0 ? clamp(Number(totalSilence) / durationSeconds, 0, 1) : silenceRatio;
    } catch (error: any) {
      if (!options.signal?.aborted) {
        console.warn('[transcription] silencedetect analysis failed:', error?.message || error);
      }
    }

    let qualityScore = 100;
    if (sampleRateHz > 0 && sampleRateHz < 16000) qualityScore -= 25;
    if (meanVolumeDb < -32) qualityScore -= 25;
    else if (meanVolumeDb < -24) qualityScore -= 15;
    if (silenceRatio > 0.75) qualityScore -= 25;
    else if (silenceRatio > 0.5) qualityScore -= 15;
    qualityScore = clamp(Math.round(qualityScore), 0, 100);

    let qualityLabel: 'good' | 'fair' | 'poor' = 'good';
    if ((sampleRateHz > 0 && sampleRateHz < 12000) || meanVolumeDb < -32 || silenceRatio > 0.75) {
      qualityLabel = 'poor';
    } else if (
      (sampleRateHz > 0 && sampleRateHz < 16000) ||
      meanVolumeDb < -24 ||
      silenceRatio > 0.5
    ) {
      qualityLabel = 'fair';
    }

    const contentType = String(options.contentType || '').toLowerCase();
    const enhancementRecommended =
      qualityLabel !== 'good' || ['audio/mpeg', 'audio/mp4', 'audio/ogg'].includes(contentType);

    return {
      codec,
      sampleRateHz: sampleRateHz || undefined,
      channels: channels || undefined,
      bitrateKbps: bitrateKbps || undefined,
      durationSeconds: durationSeconds || undefined,
      meanVolumeDb,
      maxVolumeDb,
      silenceRatio,
      qualityScore,
      qualityLabel,
      enhancementRecommended,
      enhancementApplied: false,
      enhancementProfile: 'none',
    };
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (_) {}
    }
  }
}

// ── Audio preprocessing ───────────────────────────────────────────────────────

export async function preprocessAudio(
  filePath: string,
  signal: any,
  profile: 'standard' | 'enhanced' = 'standard',
  options: { cacheKey?: string; silenceRemove?: boolean } = {}
) {
  if (!AUDIO_PREPROCESS) return null;
  const cachePath = options.cacheKey
    ? getPreprocessCachePath(options.cacheKey, profile)
    : `${filePath}.prep.wav`;
  const tmpPath = options.cacheKey ? `${cachePath}.tmp-${crypto.randomUUID()}.wav` : cachePath;
  let filter =
    profile === 'enhanced'
      ? 'highpass=f=80,lowpass=f=10000,adeclick=w=55:o=75,afftdn=nf=-28:nr=0.95,dynaudnorm=p=1.0:m=30:s=12,acompressor=threshold=-21dB:ratio=3:attack=5:release=80:makeup=4,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=16000,pan=mono|c0=0.5*c0+0.5*c1'
      : 'adeclick=w=55:o=75,afftdn=nf=-20:nr=0.85,highpass=f=80,lowpass=f=16000,dynaudnorm=p=0.9:m=100:s=5,aresample=resampler=swr';

  if (options.silenceRemove) {
    filter +=
      ',silenceremove=start_periods=1:start_duration=0.1:start_threshold=-50dB:stop_periods=-1:stop_duration=0.5:stop_threshold=-35dB';
  }

  try {
    if (options.cacheKey && fs.existsSync(cachePath)) {
      return cachePath;
    }

    let durationBefore = 0;
    if (DEBUG && options.silenceRemove) {
      try {
        const ffprobeBinary = deriveFfprobeBinary(FFMPEG_BINARY);
        const { stdout } = await execPromise(
          `"${ffprobeBinary}" -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
          { timeout: 10000 }
        );
        durationBefore = parseFloat(String(stdout || '0').trim()) || 0;
      } catch (_) {}
    }

    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    await execPromise(
      `"${FFMPEG_BINARY}" -y -i "${filePath}" -af "${filter}" -threads 4 -ar 16000 -ac 1 "${tmpPath}"`,
      { timeout: 180000, signal }
    );

    if (DEBUG && options.silenceRemove && durationBefore > 0) {
      try {
        const ffprobeBinary = deriveFfprobeBinary(FFMPEG_BINARY);
        const { stdout } = await execPromise(
          `"${ffprobeBinary}" -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tmpPath}"`,
          { timeout: 10000 }
        );
        const durationAfter = parseFloat(String(stdout || '0').trim()) || 0;
        const removed = durationBefore - durationAfter;
        console.log(
          `[transcription] Silence removal: ${durationBefore.toFixed(1)}s → ${durationAfter.toFixed(1)}s (removed ${removed.toFixed(1)}s, ${durationBefore > 0 ? ((removed / durationBefore) * 100).toFixed(0) : 0}%)`
        );
      } catch (_) {}
    }

    if (options.cacheKey) {
      if (!fs.existsSync(cachePath)) {
        fs.renameSync(tmpPath, cachePath);
      } else {
        try {
          fs.unlinkSync(tmpPath);
        } catch (_) {}
      }
      return cachePath;
    }
    return tmpPath;
  } catch (err: any) {
    if (!signal?.aborted)
      console.warn(
        `[transcription] Audio pre-processing failed for profile ${profile}, using original file.`,
        err.message
      );
    try {
      fs.unlinkSync(tmpPath);
    } catch (_) {}
    return null;
  }
}

// ── STT API call ──────────────────────────────────────────────────────────────

export async function requestAudioTranscription({
  filePath,
  buffer,
  filename,
  contentType,
  fields,
  signal,
}: any) {
  if (!STT_PROVIDER_CHAIN.length) {
    throw new Error('Brakuje skonfigurowanego providera STT.');
  }
  return transcribeWithProviders(STT_PROVIDER_CHAIN, (provider) => ({
    filePath,
    buffer,
    filename,
    contentType,
    signal,
    fields: {
      ...(fields || {}),
      // Groq only supports its own models (e.g. whisper-large-v3), not OpenAI model names
      model:
        provider.id === 'groq' ? provider.defaultModel : fields?.model || provider.defaultModel,
    },
  }));
}

// ── Silero VAD ────────────────────────────────────────────────────────────────

export async function runSileroVAD(audioPath: string, signal: any) {
  if (!VAD_ENABLED) return null;
  if (!fs.existsSync(VAD_SCRIPT)) {
    console.warn('[transcription] vad.py not found, skipping Silero VAD.');
    return null;
  }

  return new Promise((resolve) => {
    const child = spawn(PYTHON_BINARY, [VAD_SCRIPT, audioPath], {
      signal,
      timeout: 120000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (data) => {
      stdout += data;
    });

    child.on('error', (error: any) => {
      console.warn('[transcription] Silero VAD spawn error:', error.message);
      resolve(null);
    });

    child.on('close', () => {
      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed?.error) {
          console.warn('[transcription] Silero VAD returned error:', parsed.error);
          resolve(null);
          return;
        }
        resolve(Array.isArray(parsed) ? parsed : null);
      } catch (e: any) {
        if (!signal || !signal.aborted) {
          console.warn('[transcription] Silero VAD JSON parse failed:', e.message);
        }
        resolve(null);
      }
    });
  });
}

// ── In-memory chunked transcription ──────────────────────────────────────────

function extractAudioSegmentMemory(
  filePath: string,
  start: number,
  duration: number,
  signal: any
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      FFMPEG_BINARY,
      [
        '-y',
        '-i',
        filePath,
        '-ss',
        String(start),
        '-t',
        String(duration),
        '-ar',
        '16000',
        '-ac',
        '1',
        '-f',
        'wav',
        'pipe:1',
      ],
      { stdio: ['ignore', 'pipe', 'ignore'], signal }
    );

    const chunks: Buffer[] = [];
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.on('close', () => {
      resolve(Buffer.concat(chunks));
    });
    child.on('error', (e) => {
      if (signal?.aborted) return resolve(Buffer.alloc(0));
      reject(e);
    });
  });
}

export function mergeChunkedPayloads(payloads: any[], fileSizeBytes = 0) {
  const attempts = Array.isArray(payloads) ? payloads.filter(Boolean) : [];
  const safePayloads = attempts.filter(({ payload }) => payload);

  let highWater = 0;
  const allSegments = safePayloads.flatMap(({ payload, offsetSeconds }) => {
    const segs = Array.isArray(payload?.segments) ? payload.segments : [];
    const adjusted = segs.map((s) => ({
      ...s,
      start: Number(s.start || 0) + offsetSeconds,
      end: Number(s.end || 0) + offsetSeconds,
    }));
    const deduped = adjusted.filter((s) => s.start >= highWater - 0.1);
    if (deduped.length > 0) {
      highWater = Math.max(highWater, deduped[deduped.length - 1].end);
    }
    return deduped;
  });

  let wordHighWater = 0;
  const allWords = safePayloads.flatMap(({ payload, offsetSeconds }) => {
    const words = getRawWords(payload);
    const adjusted = words.map((word) => ({
      ...word,
      start: Number(word?.start ?? word?.start_time ?? word?.offset ?? 0) + offsetSeconds,
      end:
        Number(word?.end ?? word?.end_time ?? word?.offset_end ?? word?.start ?? 0) + offsetSeconds,
    }));
    const deduped = adjusted.filter((w) => w.start >= wordHighWater - 0.1);
    if (deduped.length > 0) {
      wordHighWater = Math.max(wordHighWater, deduped[deduped.length - 1].end);
    }
    return deduped;
  });

  const fullText = safePayloads
    .map(({ payload }) => payload?.text || '')
    .join(' ')
    .trim();
  const sttAttempts = attempts.flatMap(({ sttResult, diagnostics }) => {
    if (Array.isArray(sttResult?.attempts)) return sttResult.attempts;
    if (Array.isArray(diagnostics?.sttAttempts)) return diagnostics.sttAttempts;
    return [];
  });

  return {
    segments: allSegments,
    words: allWords,
    text: fullText,
    sttProviderInfo: attempts.find(({ sttResult }) => sttResult?.providerId)?.sttResult || null,
    transcriptionDiagnostics: {
      usedChunking: true,
      fileSizeBytes,
      chunksAttempted: attempts.length,
      chunksExtracted: attempts.filter(({ diagnostics }) => diagnostics?.extracted).length,
      chunksDiscardedAsTooSmall: attempts.filter(
        ({ diagnostics }) => diagnostics?.discardedAsTooSmall
      ).length,
      chunksSentToStt: attempts.filter(({ diagnostics }) => diagnostics?.sentToStt).length,
      chunksFailedAtStt: attempts.filter(({ diagnostics }) => diagnostics?.sttFailed).length,
      chunksReturnedEmptyPayload: attempts.filter(
        ({ diagnostics }) =>
          diagnostics?.sentToStt &&
          !diagnostics?.sttFailed &&
          !diagnostics?.hasSegments &&
          !diagnostics?.hasWords &&
          !diagnostics?.hasText
      ).length,
      chunksWithSegments: attempts.filter(({ diagnostics }) => diagnostics?.hasSegments).length,
      chunksWithWords: attempts.filter(({ diagnostics }) => diagnostics?.hasWords).length,
      chunksWithText: attempts.filter(({ diagnostics }) => diagnostics?.hasText).length,
      chunksFlaggedSilentByVad: attempts.filter(({ diagnostics }) => diagnostics?.vadFlaggedSilent)
        .length,
      mergedSegmentsCount: allSegments.length,
      mergedWordsCount: allWords.length,
      mergedTextLength: fullText.length,
      lastChunkErrorMessage:
        [...attempts]
          .reverse()
          .map(({ diagnostics }) => clean(diagnostics?.sttErrorMessage || ''))
          .find(Boolean) || '',
      sttAttempts,
    },
  };
}

export function getMemoryAwareConcurrency(configLimit: number): number {
  const mem = process.memoryUsage();
  const heapUsedMB = mem.heapUsed / (1024 * 1024);
  const heapTotalMB = mem.heapTotal / (1024 * 1024);
  const rssMB = mem.rss / (1024 * 1024);
  const heapUsageRatio = heapUsedMB / heapTotalMB;

  // Conservative thresholds — Railway containers have limited memory.
  // Each chunk: ffmpeg child process + ~3.8 MB WAV buffer + STT upload.
  if (rssMB > 500 || heapUsageRatio > 0.75) return 1;
  if (rssMB > 350 || heapUsageRatio > 0.6) return Math.max(1, Math.min(configLimit, 2));
  return Math.min(configLimit, 2);
}

export async function transcribeInChunks(
  filePath: string,
  contentType: string,
  fields: any,
  options: any = {}
) {
  if (DEBUG) console.log(`[transcription] Starting in-memory concurrent chunking...`);

  const notify = (p: number, m: string) => {
    if (typeof options.onProgress === 'function') options.onProgress({ progress: p, message: m });
  };

  const payloads = [];
  const BASE_CONCURRENCY = config.STT_CONCURRENCY_LIMIT || 2;
  let offsetSeconds = 0;
  let hasMore = true;
  let currentOverlap = CHUNK_OVERLAP_SECONDS;
  let allSpeechSegments: any[] = []; // Track all speech segments for adaptive overlap
  const MAX_CHUNK_RETRIES = 2;

  // Hint GC before heavy chunked transcription to free up memory
  if (typeof globalThis.gc === 'function') globalThis.gc();

  while (hasMore && !options.signal?.aborted) {
    const CONCURRENCY_LIMIT = getMemoryAwareConcurrency(BASE_CONCURRENCY);
    const batchPromises = [];
    for (let i = 0; i < CONCURRENCY_LIMIT; i++) {
      const currentOffset = offsetSeconds;
      // Use adaptive overlap based on speech density
      offsetSeconds += CHUNK_DURATION_SECONDS - currentOverlap;

      batchPromises.push(
        (async () => {
          const diagnostics: any = {
            extracted: false,
            discardedAsTooSmall: false,
            vadFlaggedSilent: false,
            sentToStt: false,
            sttFailed: false,
            sttErrorMessage: '',
            hasSegments: false,
            hasWords: false,
            hasText: false,
          };

          let buffer = await extractAudioSegmentMemory(
            filePath,
            currentOffset,
            CHUNK_DURATION_SECONDS,
            options.signal
          );
          diagnostics.extracted = true;
          if (buffer.byteLength < 500) {
            diagnostics.extracted = false;
            diagnostics.discardedAsTooSmall = true;
            return { payload: null, offsetSeconds: currentOffset, diagnostics };
          }

          let chunkSpeech: any = null;
          if (VAD_ENABLED) {
            const tmpVad = path.join(os.tmpdir(), `vadsilero_${crypto.randomUUID()}.wav`);
            fs.writeFileSync(tmpVad, buffer);
            chunkSpeech = await runSileroVAD(tmpVad, options.signal);
            try {
              fs.unlinkSync(tmpVad);
            } catch (_) {}
          }

          // Track speech segments for adaptive overlap calculation
          if (chunkSpeech && chunkSpeech.length > 0) {
            allSpeechSegments = allSpeechSegments.concat(
              chunkSpeech.map((seg: any) => ({
                start: currentOffset * 1000 + seg.start,
                end: currentOffset * 1000 + seg.end,
              }))
            );

            // Recalculate overlap based on accumulated speech density
            currentOverlap = calculateAdaptiveOverlap(allSpeechSegments, CHUNK_OVERLAP_SECONDS);

            if (DEBUG) {
              console.log(
                `[transcription] Adaptive overlap: ${currentOverlap.toFixed(1)}s (density-based)`
              );
            }
          }
          diagnostics.vadFlaggedSilent = Boolean(chunkSpeech && chunkSpeech.length === 0);

          // Retry STT per chunk — prevents losing a chunk on transient API errors
          for (let attempt = 0; attempt < MAX_CHUNK_RETRIES; attempt++) {
            try {
              diagnostics.sentToStt = true;
              const sttResult = await requestAudioTranscription({
                buffer,
                filename: `chunk_${currentOffset}.wav`,
                contentType: 'audio/wav',
                fields,
                signal: options.signal,
              });
              const payload = sttResult?.payload || null;
              diagnostics.hasSegments =
                Array.isArray(payload?.segments) && payload.segments.length > 0;
              diagnostics.hasWords = getRawWords(payload).length > 0;
              diagnostics.hasText = Boolean(
                clean(payload?.text || payload?.transcript || payload?.results?.text)
              );
              diagnostics.providerId = sttResult?.providerId || '';
              diagnostics.providerLabel = sttResult?.providerLabel || '';
              diagnostics.providerModel = sttResult?.model || '';
              diagnostics.sttFailed = false;
              // Release audio buffer immediately after successful STT to reduce heap pressure
              buffer = null as any;
              return { payload, offsetSeconds: currentOffset, diagnostics, sttResult };
            } catch (error: any) {
              diagnostics.sentToStt = true;
              diagnostics.sttFailed = true;
              diagnostics.sttErrorMessage = clean(error?.message || 'STT request failed');
              diagnostics.sttAttempts = Array.isArray(error?.sttAttempts) ? error.sttAttempts : [];
              if (attempt < MAX_CHUNK_RETRIES - 1) {
                const delay = 1000 * (attempt + 1);
                console.warn(
                  `[transcription] Chunk at ${currentOffset}s failed (attempt ${attempt + 1}/${MAX_CHUNK_RETRIES}), retrying in ${delay}ms: ${diagnostics.sttErrorMessage}`
                );
                await new Promise((resolve) => setTimeout(resolve, delay));
              }
            }
          }
          // Release audio buffer after all STT attempts exhausted
          buffer = null as any;
          return { payload: null, offsetSeconds: currentOffset, diagnostics };
        })()
      );
    }

    const results = await Promise.all(batchPromises);
    payloads.push(...results.filter(Boolean));

    // Log memory after each batch for OOM diagnostics
    const mem = process.memoryUsage();
    console.log(
      `[transcription:memory] batch=${payloads.length} rss=${(mem.rss / 1024 / 1024).toFixed(1)}MB heap=${(mem.heapUsed / 1024 / 1024).toFixed(1)}/${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB`
    );

    // Free memory between batches — critical for preventing OOM on Railway
    if (typeof globalThis.gc === 'function') globalThis.gc();

    notify(
      Math.min(60, 40 + payloads.length * 5),
      `OpenAI Batch AI — pobrano ${payloads.length} paczek audio (${Math.round(CHUNK_DURATION_SECONDS / 60)} min każda)...`
    );

    if (results.some((result) => result?.diagnostics?.discardedAsTooSmall)) {
      hasMore = false;
    }
  }

  return payloads;
}

// ── Live captioning ───────────────────────────────────────────────────────────

export async function transcribeLiveChunk(
  filePath: string,
  contentType: string,
  options: any = {}
) {
  if (!STT_PROVIDER_CHAIN.length) return '';
  try {
    const sttResult = await requestAudioTranscription({
      filePath,
      contentType: contentType || 'audio/webm',
      fields: {
        model: VERIFICATION_MODEL,
        language: AUDIO_LANGUAGE,
        response_format: 'json',
        prompt: buildWhisperPrompt({
          meetingTitle: options.meetingTitle,
          participants: options.participants,
          tags: options.tags,
          vocabulary: options.vocabulary,
        }),
        temperature: 0,
      },
      signal: options.signal,
    });
    const payload = sttResult?.payload || null;
    return String(payload?.text || '').trim();
  } catch (err: any) {
    if (!options.signal?.aborted) {
      if (DEBUG) console.warn('[transcription] Live chunk transcription failed:', err.message);
    }
    return '';
  }
}

// Re-export constants needed by pipeline.ts
export { SILENCE_REMOVE, AUDIO_PREPROCESS, MAX_FILE_SIZE_BYTES };
