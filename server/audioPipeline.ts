/**
 * audioPipeline.ts
 *
 * Główny pipeline transkrypcji audio z wykorzystaniem Whisper API.
 * Ten plik zawiera funkcje nieczyste (IO, network, filesystem).
 * Czyste funkcje zostały wydzielone do audioPipeline.utils.ts
 */

import fs from "node:fs";
import path from "node:path";
import { File } from "node:buffer";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { spawn, exec } from "node:child_process";
import { matchSpeakerToProfile } from "./speakerEmbedder.ts";
import { config } from "./config.ts";
import { logger } from "./logger.ts";

// Import czystych funkcji z audioPipeline.utils.ts
import {
  // Text utilities
  clean,
  tokenize,
  isHallucination,

  // Math utilities
  clamp,
  parseDbNumber,

  // Segment utilities
  mergeShortSegments,
  parseJsonResponse,
  normalizeSpeakerLabel,
  getRawWords,
  normalizeDiarizedSegments,
  normalizeVerificationSegments,
  buildVerificationResult,
  buildEmptyTranscriptResult,

  // Prompt building
  buildWhisperPrompt,

  // Constants
  CHUNK_DURATION_SECONDS,
  CHUNK_OVERLAP_SECONDS,
  MAX_FILE_SIZE_BYTES,

  // Helpers
  deriveFfprobeBinary,
} from "./audioPipeline.utils.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execPromise = promisify(exec);

// Konfiguracja API
const OPENAI_API_KEY = config.VOICELOG_OPENAI_API_KEY || config.OPENAI_API_KEY || "";
const OPENAI_BASE_URL = config.VOICELOG_OPENAI_BASE_URL;
const VERIFICATION_MODEL = config.VERIFICATION_MODEL;
const AUDIO_LANGUAGE = config.AUDIO_LANGUAGE;

// Konfiguracja preprocessingu
const AUDIO_PREPROCESS = config.AUDIO_PREPROCESS;
const TRANSCRIPT_CORRECTION = config.TRANSCRIPT_CORRECTION;
const FFMPEG_BINARY = config.FFMPEG_BINARY;
const HF_TOKEN = config.HF_TOKEN || config.HUGGINGFACE_TOKEN || "";
const PYTHON_BINARY = config.PYTHON_BINARY;
const DIARIZE_SCRIPT = path.join(__dirname, "diarize.py");
const VAD_SCRIPT = path.join(__dirname, "vad.py");
const VAD_ENABLED = config.VAD_ENABLED;

// Enable verbose pipeline logging with VOICELOG_DEBUG=true
const DEBUG = process.env.VOICELOG_DEBUG === "true";

async function requestAudioTranscription({ filePath, buffer, filename, contentType, fields, signal }: any) {
  if (!OPENAI_API_KEY) {
    throw new Error("Brakuje OPENAI_API_KEY dla serwerowego pipeline audio.");
  }

  const audioBuffer = buffer || fs.readFileSync(filePath);
  if (audioBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new Error("Plik audio przekracza limit 25 MB dla API transkrypcji.");
  }

  const form = new FormData();
  const safeFilename = filename || (filePath ? path.basename(filePath) : "audio.wav");
  form.append("file", new File([audioBuffer], safeFilename, { type: contentType || "application/octet-stream" }) as any);

  Object.entries(fields || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        form.append(`${key}[]`, String(entry));
      });
      return;
    }

    form.append(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  });

  const abortSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000);

  const response = await fetch(`${OPENAI_BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: form,
    signal: abortSignal,
  });

  const rawBody = await response.text();
  if (!response.ok) {
    const payload = parseJsonResponse(rawBody);
    throw new Error(payload?.error?.message || `OpenAI audio request failed with status ${response.status}.`);
  }

  return parseJsonResponse(rawBody);
}













/**
 * Runs pyannote.audio speaker diarization via Python subprocess.
 * Returns [{speaker, start, end}] or null if unavailable/failed.
 */
async function runPyannoteDiarization(audioPath: string, signal: any) {
  if (!HF_TOKEN) return null;
  if (!fs.existsSync(DIARIZE_SCRIPT)) {
    console.warn("[audioPipeline] diarize.py not found, skipping pyannote.");
    return null;
  }
  console.log("[audioPipeline] Running pyannote diarization (may download ~1GB model on first run)...");
  
  return new Promise((resolve) => {
    const child = spawn(PYTHON_BINARY, [DIARIZE_SCRIPT, audioPath, HF_TOKEN], {
      signal,
      timeout: 600000,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (data) => { stdout += data; });
    
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (data) => { stderr += data; });

    child.on("error", (error) => {
      console.warn("[audioPipeline] pyannote spawn error:", error.message);
      resolve(null);
    });

    child.on("close", (code) => {
      if (code !== 0 && (!signal || !signal.aborted)) {
        console.warn("[audioPipeline] pyannote exited with status", code, stderr.slice(0, 400));
        resolve(null);
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed?.error) {
          console.warn("[audioPipeline] pyannote returned error:", parsed.error);
          resolve(null);
          return;
        }
        if (!Array.isArray(parsed) || !parsed.length) return resolve(null);
        const speakers = [...new Set(parsed.map((s) => s.speaker))];
        console.log(`[audioPipeline] pyannote: ${parsed.length} segments, ${speakers.length} speakers: ${speakers.join(", ")}`);
        resolve(parsed);
      } catch (e) {
        console.warn("[audioPipeline] pyannote JSON parse failed:", e.message, stdout.slice(0, 200));
        resolve(null);
      }
    });
  });
}

/**
 * Runs Silero VAD via Python subprocess.
 * Returns [{start, end}] timestamps of speech segments.
 */
async function runSileroVAD(audioPath: string, signal: any) {
  if (!VAD_ENABLED) return null;
  if (!fs.existsSync(VAD_SCRIPT)) {
    console.warn("[audioPipeline] vad.py not found, skipping Silero VAD.");
    return null;
  }

  return new Promise((resolve) => {
    const child = spawn(PYTHON_BINARY, [VAD_SCRIPT, audioPath], {
      signal,
      timeout: 120000,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (data) => { stdout += data; });

    child.on("error", (error) => {
      console.warn("[audioPipeline] Silero VAD spawn error:", error.message);
      resolve(null);
    });

    child.on("close", () => {
      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed?.error) {
          console.warn("[audioPipeline] Silero VAD returned error:", parsed.error);
          resolve(null);
          return;
        }
        resolve(Array.isArray(parsed) ? parsed : null);
      } catch (e) {
        if (!signal || !signal.aborted) {
          console.warn("[audioPipeline] Silero VAD JSON parse failed:", e.message);
        }
        resolve(null);
      }
    });
  });
}

/**
 * Merges pyannote speaker assignments [{speaker, start, end}] with Whisper text segments.
 * For each Whisper segment, assigns the pyannote speaker with the greatest time overlap.
 */
function mergeWithPyannote(pyannoteSegments: any[], whisperSegments: any[]) {
  const speakerOrder = new Map();
  const speakerNames = {};

  const segments = whisperSegments
    .map((wseg) => {
      const wStart = Number(wseg.start ?? 0);
      const wEnd = Number(wseg.end ?? wStart);
      const text = clean(wseg.text || wseg.transcript || "");
      if (!text) return null;

      let bestSpeaker = null;
      let bestOverlap = 0;
      for (const pseg of pyannoteSegments) {
        const overlap = Math.max(0, Math.min(wEnd, pseg.end) - Math.max(wStart, pseg.start));
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestSpeaker = pseg.speaker;
        }
      }
      const rawSpeakerLabel = bestSpeaker || "speaker_unknown";

      if (!speakerOrder.has(rawSpeakerLabel)) {
        const nextId = speakerOrder.size;
        speakerOrder.set(rawSpeakerLabel, nextId);
        speakerNames[String(nextId)] = normalizeSpeakerLabel(rawSpeakerLabel, nextId);
      }

      const speakerId = speakerOrder.get(rawSpeakerLabel);
      const estimatedDuration = Math.max(1.5, tokenize(text).length * 0.42);
      const endTimestamp = wEnd > wStart ? wEnd : wStart + estimatedDuration;

      return {
        id: `seg_${crypto.randomUUID().replace(/-/g, "")}`,
        text,
        timestamp: wStart,
        endTimestamp,
        speakerId,
        rawSpeakerLabel,
      };
    })
    .filter(Boolean);

  return {
    segments,
    speakerNames,
    speakerCount: Object.keys(speakerNames).length,
    text: segments.map((s) => s.text).join(" "),
  };
}

/**
 * Pipy strumienia FFmpeg prosto do pamięci RAM V8 (Node.js Buffer)
 * zamiast zapisów dyskowych (zero I/O bottleneck).
 */
function extractAudioSegmentMemory(filePath: string, start: number, duration: number, signal: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG_BINARY, [
      "-y", "-i", filePath,
      "-ss", String(start),
      "-t", String(duration),
      "-ar", "16000", "-ac", "1",
      "-f", "wav", "pipe:1"
    ], { stdio: ["ignore", "pipe", "ignore"], signal });

    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    
    child.on("close", () => {
      resolve(Buffer.concat(chunks));
    });
    
    child.on("error", (e) => {
      if (signal?.aborted) return resolve(Buffer.alloc(0));
      reject(e);
    });
  });
}

/**
 * Merges verbose_json payloads from multiple chunks into one,
 * adjusting segment timestamps by chunkOffset.
 *
 * Chunks overlap by CHUNK_OVERLAP_SECONDS seconds to give Whisper context
 * across boundaries. To avoid duplicate segments, we track the highest
 * absolute end-time already committed and skip any segment that starts
 * before it (i.e., falls entirely within a previously processed region).
 */
function mergeChunkedPayloads(payloads: any[], fileSizeBytes = 0) {
  const attempts = Array.isArray(payloads) ? payloads.filter(Boolean) : [];
  const safePayloads = attempts.filter(({ payload }) => payload);

  // High-water mark: absolute end-time of the last committed segment.
  // Segments from overlap zones (start < highWater) are skipped.
  let highWater = 0;

  const allSegments = safePayloads.flatMap(({ payload, offsetSeconds }) => {
    const segs = Array.isArray(payload?.segments) ? payload.segments : [];
    const adjusted = segs.map((s) => ({
      ...s,
      start: Number(s.start || 0) + offsetSeconds,
      end: Number(s.end || 0) + offsetSeconds,
    }));
    // Keep only segments that start at or after the high-water mark
    const deduped = adjusted.filter((s) => s.start >= highWater - 0.1);
    if (deduped.length > 0) {
      highWater = Math.max(highWater, deduped[deduped.length - 1].end);
    }
    return deduped;
  });

  // Same deduplication for words — reset and replay
  let wordHighWater = 0;
  const allWords = safePayloads.flatMap(({ payload, offsetSeconds }) => {
    const words = getRawWords(payload);
    const adjusted = words.map((word) => ({
      ...word,
      start: Number(word?.start ?? word?.start_time ?? word?.offset ?? 0) + offsetSeconds,
      end: Number(word?.end ?? word?.end_time ?? word?.offset_end ?? word?.start ?? 0) + offsetSeconds,
    }));
    const deduped = adjusted.filter((w) => w.start >= wordHighWater - 0.1);
    if (deduped.length > 0) {
      wordHighWater = Math.max(wordHighWater, deduped[deduped.length - 1].end);
    }
    return deduped;
  });
  const fullText = safePayloads.map(({ payload }) => payload?.text || "").join(" ").trim();
  return {
    segments: allSegments,
    words: allWords,
    text: fullText,
    transcriptionDiagnostics: {
      usedChunking: true,
      fileSizeBytes,
      chunksAttempted: attempts.length,
      chunksExtracted: attempts.filter(({ diagnostics }) => diagnostics?.extracted).length,
      chunksDiscardedAsTooSmall: attempts.filter(({ diagnostics }) => diagnostics?.discardedAsTooSmall).length,
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
      chunksFlaggedSilentByVad: attempts.filter(({ diagnostics }) => diagnostics?.vadFlaggedSilent).length,
      mergedSegmentsCount: allSegments.length,
      mergedWordsCount: allWords.length,
      mergedTextLength: fullText.length,
      lastChunkErrorMessage:
        [...attempts]
          .reverse()
          .map(({ diagnostics }) => clean(diagnostics?.sttErrorMessage || ""))
          .find(Boolean) || "",
    },
  };
}



/**
 * Transcribes a large audio file by virtually streaming chunks in-memory
 * and dispatching concurrent OpenAI fetch requests without disk segment tracking.
 */
async function transcribeInChunks(filePath: string, contentType: string, fields: any, options: any = {}) {
  if (DEBUG) console.log(`[audioPipeline] Starting in-memory concurrent chunking...`);

  const notify = (p: number, m: string) => { if (typeof options.onProgress === "function") options.onProgress({ progress: p, message: m }) };

  const payloads = [];
  const CONCURRENCY_LIMIT = 2;
  let offsetSeconds = 0;
  let hasMore = true;

  while (hasMore && !options.signal?.aborted) {
    const batchPromises = [];
    for (let i = 0; i < CONCURRENCY_LIMIT; i++) {
      const currentOffset = offsetSeconds;
      const isFirstChunk = currentOffset === 0;
      // Advance by duration minus overlap so consecutive chunks share CHUNK_OVERLAP_SECONDS of audio.
      // The overlap gives Whisper context across boundaries; segments from the overlap zone
      // are stripped during mergeChunkedPayloads to avoid duplication.
      offsetSeconds += CHUNK_DURATION_SECONDS - CHUNK_OVERLAP_SECONDS;

      batchPromises.push((async () => {
        const diagnostics = {
          extracted: false,
          discardedAsTooSmall: false,
          vadFlaggedSilent: false,
          sentToStt: false,
          sttFailed: false,
          sttErrorMessage: "",
          hasSegments: false,
          hasWords: false,
          hasText: false,
        };
        // Wyciągnij chunk audio prosto do bufora RAM (z pominięciem zapisu dyskowego)
        const buffer = await extractAudioSegmentMemory(filePath, currentOffset, CHUNK_DURATION_SECONDS, options.signal);
        diagnostics.extracted = true;
        if (buffer.byteLength < 500) {
          diagnostics.extracted = false;
          diagnostics.discardedAsTooSmall = true;
          return { payload: null, offsetSeconds: currentOffset, diagnostics };
        }
        if (buffer.byteLength < 500) return null; // Dotarto do końca pliku (brak istotnego audio)

        // Silero VAD. Python nadal wymaga testowej ścieżki więc zrzucamy bufor jako temp file, 
        // system operacyjny przechwyci to w locie pamięci cache RAM-u (tmpfs).
        let chunkSpeech: any = null;
        if (VAD_ENABLED) {
          const os = await import("os");
          const tmpVad = path.join(os.tmpdir(), `vadsilero_${crypto.randomUUID()}.wav`);
          fs.writeFileSync(tmpVad, buffer);
          chunkSpeech = await runSileroVAD(tmpVad, options.signal);
          try { fs.unlinkSync(tmpVad); } catch (_) {}
        }
        diagnostics.vadFlaggedSilent = Boolean(chunkSpeech && chunkSpeech.length === 0);

        try {
          diagnostics.sentToStt = true;
          const payload = await requestAudioTranscription({
            buffer,
            filename: `chunk_${currentOffset}.wav`,
            contentType: "audio/wav",
            fields,
            signal: options.signal,
          });
          diagnostics.hasSegments = Array.isArray(payload?.segments) && payload.segments.length > 0;
          diagnostics.hasWords = getRawWords(payload).length > 0;
          diagnostics.hasText = Boolean(clean(payload?.text || payload?.transcript || payload?.results?.text));
          return {
            payload,
            offsetSeconds: currentOffset,
            diagnostics,
          };
        } catch (error: any) {
          diagnostics.sentToStt = true;
          diagnostics.sttFailed = true;
          diagnostics.sttErrorMessage = clean(error?.message || "STT request failed");
          return {
            payload: null,
            offsetSeconds: currentOffset,
            diagnostics,
          };
        }
      })());
    }

    const results = await Promise.all(batchPromises);
    payloads.push(...results.filter(Boolean));
    
    notify(
      Math.min(60, 40 + payloads.length * 5),
      `OpenAI Batch AI — pobrano ${payloads.length} paczek audio (${Math.round(CHUNK_DURATION_SECONDS / 60)} min każda)...`
    );

    // Jeśli FFmpeg zwrócił paczkę mniejszą od limitu (null), przerywamy pętlę.
    if (results.some((result) => result?.diagnostics?.discardedAsTooSmall)) {
      hasMore = false;
    }
  }
  
  return payloads;
}

function resolveStoredAudioQuality(asset: any) {
  try {
    const payload = JSON.parse(asset?.diarization_json || "{}");
    return payload?.audioQuality && typeof payload.audioQuality === "object" ? payload.audioQuality : null;
  } catch (_) {
    return null;
  }
}

async function analyzeAudioQuality(filePath: string, options: any = {}) {
  if (options.signal?.aborted) return { error: "Aborted" };

  let tempFilePath = "";
  try {
    // If filePath is a Supabase Storage path (no path separators), download to temp
    if (filePath && !filePath.includes(path.sep) && !filePath.includes("/")) {
      const { downloadAudioFromStorage } = await import("./lib/supabaseStorage");
      const buffer = await downloadAudioFromStorage(filePath);
      const ext = { "audio/webm": ".webm", "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/wav": ".wav" }[String(options.contentType || "").toLowerCase()] || ".bin";
      const uploadDir = config.VOICELOG_UPLOAD_DIR || path.join(__dirname, "data", "uploads");
      tempFilePath = path.join(uploadDir, `temp_analyze_${crypto.randomUUID()}${ext}`);
      fs.mkdirSync(path.dirname(tempFilePath), { recursive: true });
      fs.writeFileSync(tempFilePath, Buffer.from(buffer));
      filePath = tempFilePath;
    }

    if (!fs.existsSync(filePath)) return { error: "File not found" };

  const ffprobeBinary = deriveFfprobeBinary();
  let codec = "";
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
    const parsed = JSON.parse(String(stdout || "{}"));
    const audioStream =
      (Array.isArray(parsed?.streams) ? parsed.streams : []).find((stream) => stream?.codec_type === "audio")
      || (Array.isArray(parsed?.streams) ? parsed.streams[0] : null)
      || {};
    codec = clean(audioStream?.codec_name || parsed?.format?.format_name || "");
    sampleRateHz = parseDbNumber(audioStream?.sample_rate, 0);
    channels = parseDbNumber(audioStream?.channels, 0);
    bitrateKbps = Math.round(parseDbNumber(audioStream?.bit_rate || parsed?.format?.bit_rate, 0) / 1000);
    durationSeconds = parseDbNumber(audioStream?.duration || parsed?.format?.duration, 0);
  } catch (error: any) {
    if (!options.signal?.aborted) {
      console.warn("[audioPipeline] ffprobe audio analysis failed:", error?.message || error);
    }
  }

  try {
    const { stderr } = await execPromise(
      `"${FFMPEG_BINARY}" -i "${filePath}" -af "volumedetect" -f null -`,
      { timeout: 45000, signal: options.signal }
    );
    meanVolumeDb = parseDbNumber(String(stderr || "").match(/mean_volume:\s*([-\d.]+)\s*dB/i)?.[1], meanVolumeDb);
    maxVolumeDb = parseDbNumber(String(stderr || "").match(/max_volume:\s*([-\d.]+)\s*dB/i)?.[1], maxVolumeDb);
  } catch (error: any) {
    if (!options.signal?.aborted) {
      console.warn("[audioPipeline] volumedetect analysis failed:", error?.message || error);
    }
  }

  try {
    const { stderr } = await execPromise(
      `"${FFMPEG_BINARY}" -i "${filePath}" -af "silencedetect=noise=-35dB:d=0.5" -f null -`,
      { timeout: 45000, signal: options.signal }
    );
    const silenceDurations = String(stderr || "").match(/silence_duration:\s*([0-9.]+)/gi) || [];
    const totalSilence = silenceDurations.reduce((sum: number, entry: string) => sum + parseDbNumber(entry, 0), 0);
    silenceRatio =
      durationSeconds > 0
        ? clamp(totalSilence / durationSeconds, 0, 1)
        : silenceRatio;
  } catch (error: any) {
    if (!options.signal?.aborted) {
      console.warn("[audioPipeline] silencedetect analysis failed:", error?.message || error);
    }
  }

  let qualityScore = 100;
  if (sampleRateHz > 0 && sampleRateHz < 16000) qualityScore -= 25;
  if (meanVolumeDb < -32) qualityScore -= 25;
  else if (meanVolumeDb < -24) qualityScore -= 15;
  if (silenceRatio > 0.75) qualityScore -= 25;
  else if (silenceRatio > 0.5) qualityScore -= 15;
  qualityScore = clamp(Math.round(qualityScore), 0, 100);

  let qualityLabel: "good" | "fair" | "poor" = "good";
  if ((sampleRateHz > 0 && sampleRateHz < 12000) || meanVolumeDb < -32 || silenceRatio > 0.75) {
    qualityLabel = "poor";
  } else if ((sampleRateHz > 0 && sampleRateHz < 16000) || meanVolumeDb < -24 || silenceRatio > 0.5) {
    qualityLabel = "fair";
  }

  const contentType = String(options.contentType || "").toLowerCase();
  const enhancementRecommended =
    qualityLabel !== "good" ||
    ["audio/mpeg", "audio/mp4", "audio/ogg"].includes(contentType);

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
    enhancementProfile: "none",
  };
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (_) {}
    }
  }
}

async function preprocessAudio(filePath: string, signal: any, profile: "standard" | "enhanced" = "standard") {
  if (!AUDIO_PREPROCESS) return null;
  const tmpPath = `${filePath}.prep.wav`;
  const filter =
    profile === "enhanced"
      ? "highpass=f=80,lowpass=f=10000,afftdn=nf=-28:nr=0.95,dynaudnorm=p=1.0:m=30:s=12,acompressor=threshold=-21dB:ratio=3:attack=5:release=80:makeup=4,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=16000,pan=mono|c0=0.5*c0+0.5*c1"
      : "afftdn=nf=-20:nr=0.85,highpass=f=80,lowpass=f=16000,dynaudnorm=p=0.9:m=100:s=5,aresample=resampler=swr";
  try {
    await execPromise(
      `"${FFMPEG_BINARY}" -y -i "${filePath}" -af "${filter}" -ar 16000 -ac 1 "${tmpPath}"`,
      { timeout: 180000, signal }
    );
    return tmpPath;
  } catch (err) {
    if (!signal?.aborted) console.warn(`[audioPipeline] Audio pre-processing failed for profile ${profile}, using original file.`, err.message);
    try { fs.unlinkSync(tmpPath); } catch (_) {}
    return null;
  }
}

/**
 * GPT-4o-mini based speaker diarization derived from transcript text.
 *
 * Uses conversational patterns (question/answer, topic shifts, different phrasing
 * styles, explicit pronoun switches) to identify distinct speakers.  Works best
 * for meetings and dialogs; a true monologue will correctly return 1 speaker.
 * Processes up to 180 segments per call to stay well within token limits.
 *
 * @param {Array<{text: string, start: number, end: number}>} segments  verbose_json segments
 * @returns {Promise<object|null>}  diarization result ({segments, speakerNames, speakerCount, text})
 */
async function diarizeFromTranscript(segments: any[], options: { participants?: string[] } = {}) {
  if (!OPENAI_API_KEY || !segments.length) return null;

  const CHUNK_SIZE = 180;
  const chunk = segments.slice(0, CHUNK_SIZE);

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  // Compute actual silence gap between end of previous segment and start of current
  const lines = chunk
    .map((seg, i) => {
      const prev = chunk[i - 1];
      const silenceGap = prev != null
        ? Math.max(0, Number((seg.start ?? 0) - (prev.end ?? prev.start ?? 0))).toFixed(1)
        : null;
      const gapStr = silenceGap !== null ? ` [cisza ${silenceGap}s]` : "";
      return `[${i}]${gapStr} ${fmt(seg.start ?? 0)}: "${(seg.text || "").replace(/"/g, "'").slice(0, 240)}"`;
    })
    .join("\n");

  const systemPrompt =
    "You are a speaker diarization engine. Your ONLY job is to assign a speaker label (A, B, C…) " +
    "to each segment of a transcript from a multi-speaker recording. " +
    "You MUST produce output for every segment — no skipping. " +
    "Return ONLY valid JSON, no explanation.";

  const knownParticipants = (options.participants || []).filter(Boolean);
  const participantHint = knownParticipants.length >= 2
    ? `\nZnani uczestnicy spotkania: ${knownParticipants.slice(0, 8).join(", ")}.\nLitery A, B, C… odpowiadają kolejnym mówcom w kolejności ich pierwszego wystąpienia. Spróbuj przypisać tyle różnych liter ile jest znanych uczestników.\n`
    : "";

  const userPrompt = [
    "Nagranie rozmowy między WIELOMA osobami (co najmniej 2). To NIE jest monolog.",
    "Każda zmiana osoby mówiącej musi być oznaczona inną literą (A, B, C…).",
    participantHint,
    "SILNE SYGNAŁY ZMIANY MÓWCY:",
    "• [cisza ≥ 0.5s] przed segmentem → prawie zawsze zmiana mówcy",
    "• [cisza ≥ 2s] → na pewno zmiana mówcy — ZAWSZE przypisz inną literę",
    "• Krótka odpowiedź ('tak', 'mhm', 'dobra', 'jasne', ≤5 słów) po dłuższej wypowiedzi → inna osoba",
    "• Pytanie → odpowiedź → inna osoba dla odpowiedzi",
    "• 'Ja…' po długim segmencie innej treści → zmiana",
    "",
    "NIGDY nie przypisuj wszystkim segmentom tej samej litery jeśli są przerwy.",
    "Minimum 2 różnych mówców musi być użytych, chyba że transkrypt jest krótszy niż 3 segmenty.",
    "",
    "Transkrypt ([numer] [cisza przed] czas: \"tekst\"):",
    lines,
    "",
    `Przypisz mówców dla ${chunk.length} segmentów.`,
    'Format: {"segments": [{"i": 0, "s": "A"}, {"i": 1, "s": "B"}, ...]}',
    "Każdy indeks od 0 do " + (chunk.length - 1) + " musi być obecny.",
  ].join("\n");

  try {
    const resp = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: Math.min(4096, chunk.length * 14 + 60),
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) throw new Error(`OpenAI chat completions HTTP ${resp.status}`);

    const json = await resp.json();
    const content = json.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    const assignments = Array.isArray(parsed?.segments) ? parsed.segments : [];

    if (!assignments.length) {
      if (DEBUG) console.warn("[audioPipeline] Transcript diarization: GPT returned empty assignments.");
      return null;
    }

    // Build index→speaker map; segments beyond CHUNK_SIZE inherit last known speaker
    const indexToSpeaker = new Map(
      assignments.map((a) => [Number(a.i), String(a.s || "A").toUpperCase().slice(0, 1)])
    );
    const lastKnown = indexToSpeaker.get(chunk.length - 1) || "A";

    const speakerOrder = new Map();
    const speakerNames = {};

    const resultSegments = segments
      .map((wseg, i) => {
        const text = clean(wseg.text || "");
        if (!text) return null;

        const rawLabel = indexToSpeaker.has(i) ? indexToSpeaker.get(i) : lastKnown;

        if (!speakerOrder.has(rawLabel)) {
          const nextId = speakerOrder.size;
          speakerOrder.set(rawLabel, nextId);
          speakerNames[String(nextId)] = `Speaker ${nextId + 1}`;
        }

        const speakerId = speakerOrder.get(rawLabel);
        const start = Number(wseg.start ?? 0);
        const end = Number(wseg.end ?? start);
        const estimatedDuration = Math.max(1.5, tokenize(text).length * 0.42);
        const endTimestamp = end > start ? end : start + estimatedDuration;

        return {
          id: `seg_${crypto.randomUUID().replace(/-/g, "")}`,
          text,
          timestamp: start,
          endTimestamp,
          speakerId,
          rawSpeakerLabel: rawLabel,
        };
      })
      .filter(Boolean);

    if (DEBUG) {
      const dist = resultSegments.reduce((acc, s) => {
        const k = `${s.speakerId}(${s.rawSpeakerLabel})`;
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
      console.log(`[audioPipeline] Transcript-diarize result: ${resultSegments.length} segs, dist: ${JSON.stringify(dist)}`);
    }

    return {
      segments: resultSegments,
      speakerNames,
      speakerCount: Object.keys(speakerNames).length,
      text: resultSegments.map((s) => s.text).join(" "),
    };
  } catch (err) {
    if (DEBUG) console.warn("[audioPipeline] diarizeFromTranscript failed:", err.message);
    return null;
  }
}

function buildAudioQualityForAttempt(audioQuality: any, profile: "standard" | "enhanced", enhancementApplied = false) {
  if (!audioQuality || typeof audioQuality !== "object") {
    return null;
  }

  return {
    ...audioQuality,
    enhancementApplied,
    enhancementProfile: enhancementApplied ? profile : "none",
  };
}

function shouldRetryWithEnhancedProfile(profile: "standard" | "enhanced", attemptCount: number, outcome: any) {
  if (profile !== "standard" || attemptCount >= 2) {
    return false;
  }

  if (outcome?.transcriptOutcome === "empty") {
    return true;
  }

  return Number(outcome?.transcriptionDiagnostics?.chunksFailedAtStt || 0) > 0;
}

async function runTranscriptionAttempt(
  asset: any,
  options: any = {},
  baseAudioQuality: any = null,
  profile: "standard" | "enhanced" = "standard",
  attemptCount: 1 | 2 = 1
) {
  const notify = (p: number, m: string) => { if (typeof options.onProgress === "function") options.onProgress({ progress: p, message: m }) };

  let tempFilePath = "";
  let workingFilePath = asset.file_path;
  
  try {
    // If file_path is a Supabase Storage path (no path separators), download to temp
    if (asset.file_path && !asset.file_path.includes(path.sep) && !asset.file_path.includes("/")) {
      notify(10, "Pobieranie nagrania z bazy danych...");
      const { downloadAudioFromStorage } = await import("./lib/supabaseStorage");
      const buffer = await downloadAudioFromStorage(asset.file_path);
      
      const ext = { "audio/webm": ".webm", "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/wav": ".wav" }[String(asset.content_type || "").toLowerCase()] || ".bin";
      const uploadDir = config.VOICELOG_UPLOAD_DIR || path.join(__dirname, "data", "uploads");
      tempFilePath = path.join(uploadDir, `temp_transcribe_${crypto.randomUUID()}${ext}`);
      fs.mkdirSync(path.dirname(tempFilePath), { recursive: true });
      fs.writeFileSync(tempFilePath, Buffer.from(buffer));
      workingFilePath = tempFilePath;
    }

    if (!fs.existsSync(workingFilePath)) {
      throw new Error("Lokalny plik audio nie istnieje i nie mogl byc pobrany.");
    }
  
    notify(10, "Wyciąganie audio do pamięci podręcznej...");
    const prepPath = await preprocessAudio(workingFilePath, options.signal, profile);
    const transcribeFilePath = prepPath || workingFilePath;
    const transcribeContentType = prepPath ? "audio/wav" : asset.content_type;
  const attemptAudioQuality = buildAudioQualityForAttempt(baseAudioQuality, profile, Boolean(prepPath));

  notify(30, "Silero VAD - optymalizacja ciszy...");
  const speechSegments: any = await runSileroVAD(transcribeFilePath, options.signal);
  if (DEBUG && speechSegments) {
    console.log(`[audioPipeline] Silero VAD detected ${speechSegments.length} speech segment(s).`);
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
    lastChunkErrorMessage: "",
    transcriptionProfileUsed: profile,
    transcriptionAttemptCount: attemptCount,
  };

  try {
  const fileSize = fs.statSync(transcribeFilePath).size;
  const isLargeFile = fileSize > MAX_FILE_SIZE_BYTES;
  transcriptionDiagnostics = {
    usedChunking: isLargeFile,
    fileSizeBytes: fileSize,
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
    lastChunkErrorMessage: "",
    transcriptionProfileUsed: profile,
    transcriptionAttemptCount: attemptCount,
  };
  if (isLargeFile) {
    console.log(`[audioPipeline] File size ${(fileSize / 1024 / 1024).toFixed(1)} MB > limit — will process in chunks.`);
  }

  const contextPrompt = buildWhisperPrompt({
    meetingTitle: options.meetingTitle,
    participants: options.participants,
    tags: options.tags,
    vocabulary: options.vocabulary,
  });

  // temperature=0 maximises determinism for poor/noisy audio (prevents hallucination loops).
  // For clean audio a slight temperature allows more natural transcription.
  const whisperTemperature = attemptAudioQuality?.qualityLabel === "poor" ? 0 : 0.1;

  const whisperFields = {
    model: VERIFICATION_MODEL,
    language: options.language || AUDIO_LANGUAGE,
    response_format: "verbose_json",
    timestamp_granularities: ["segment", "word"],
    prompt: contextPrompt,
    temperature: whisperTemperature,
  };

  notify(40, "Transkrypcja AI rozkłada pętle paczek...");

  // ── Whisper verbose_json (always run — needed for text + timestamps + verification) ──
  let whisperPayload: any = null;
  const modelsToTry = VERIFICATION_MODEL !== "whisper-1"
    ? [VERIFICATION_MODEL, "whisper-1"]
    : ["whisper-1"];

  const reqId = options.requestId || "internal-pipeline";
  const startTranscribe = performance.now();
  let lastTranscriptionError: any = null;

  for (const model of modelsToTry) {
    const fields = { ...whisperFields, model };
    try {
      if (isLargeFile) {
        const chunkPayloads = await transcribeInChunks(transcribeFilePath, transcribeContentType, fields, options);
        whisperPayload = mergeChunkedPayloads(chunkPayloads, fileSize);
        transcriptionDiagnostics = {
          ...transcriptionDiagnostics,
          ...(whisperPayload?.transcriptionDiagnostics || {}),
        };
        const sentToStt = Number(transcriptionDiagnostics.chunksSentToStt || 0);
        const failedAtStt = Number(transcriptionDiagnostics.chunksFailedAtStt || 0);
        if (sentToStt > 0 && failedAtStt === sentToStt) {
          const error: any = new Error("Transkrypcja STT nie powiodla sie dla zadnego modelu.");
          error.transcriptionDiagnostics = transcriptionDiagnostics;
          error.audioQuality = attemptAudioQuality;
          throw error;
        }
      } else {
        whisperPayload = await requestAudioTranscription({
          filePath: transcribeFilePath,
          contentType: transcribeContentType,
          fields,
          signal: options.signal,
        });
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
                : clean(whisperPayload?.text || whisperPayload?.transcript || whisperPayload?.results?.text)
                  ? 0
                  : 1,
          chunksWithSegments: Array.isArray(whisperPayload?.segments) && whisperPayload.segments.length > 0 ? 1 : 0,
          chunksWithWords: getRawWords(whisperPayload).length > 0 ? 1 : 0,
          chunksWithText: clean(whisperPayload?.text || whisperPayload?.transcript || whisperPayload?.results?.text) ? 1 : 0,
          mergedSegmentsCount: Array.isArray(whisperPayload?.segments) ? whisperPayload.segments.length : 0,
          mergedWordsCount: getRawWords(whisperPayload).length,
          mergedTextLength: clean(whisperPayload?.text || whisperPayload?.transcript || whisperPayload?.results?.text).length,
          lastChunkErrorMessage: "",
        };
      }
      if (DEBUG) console.log(`[audioPipeline] Transcription succeeded with model: ${model}`);
      break; // success — stop trying fallbacks
    } catch (error: any) {
      whisperPayload = null;
      lastTranscriptionError = error;
      transcriptionDiagnostics = {
        ...transcriptionDiagnostics,
        lastChunkErrorMessage: clean(error?.transcriptionDiagnostics?.lastChunkErrorMessage || error?.message || ""),
        ...(error?.transcriptionDiagnostics && typeof error.transcriptionDiagnostics === "object"
          ? error.transcriptionDiagnostics
          : {}),
      };
      console.error(`[audioPipeline] Transcription failed with model ${model}:`, error.message);
      if (model === modelsToTry[modelsToTry.length - 1]) {
        console.error("[audioPipeline] All transcription models exhausted.");
      }
    }
  }

  if (!whisperPayload) {
    const error: any =
      lastTranscriptionError instanceof Error
        ? lastTranscriptionError
        : new Error("Transkrypcja STT nie powiodla sie dla zadnego modelu.");
    error.transcriptionDiagnostics = transcriptionDiagnostics;
    error.audioQuality = attemptAudioQuality;
    throw error;
  }
  
  logger.info(`[Metrics] STT Transcription Stage Complete`, {
    requestId: reqId,
    recordingId: asset.id,
    durationMs: (performance.now() - startTranscribe).toFixed(2),
  });

  const verificationSegments = normalizeVerificationSegments(whisperPayload || {});

  // ── Try pyannote diarization (best quality, requires HF_TOKEN) ──
  let diarization = null;
  const startDiarize = performance.now();
  if (HF_TOKEN) {
    notify(80, "Pyannote - rozpoznawanie i segregacja głosu po wektorach wieloosiowych!");
    const pyannoteSegments = await runPyannoteDiarization(transcribeFilePath, options.signal);
    if (pyannoteSegments && verificationSegments.length) {
      if (DEBUG) console.log("[audioPipeline] Using pyannote diarization merged with Whisper transcription.");
      diarization = mergeWithPyannote(pyannoteSegments as any[], verificationSegments as any[]);
    }
  }

  // ── Fall back to GPT-4o-mini transcript-based diarization ──
  // NOTE: "gpt-4o-transcribe-diarize" and "diarized_json" do not exist in OpenAI public API.
  // Instead, we use GPT-4o-mini to infer speaker changes from conversation text + timing.
  if (!diarization) {
    if (DEBUG) console.log("[audioPipeline] Pyannote unavailable — using GPT-4o-mini transcript diarization.");
    notify(80, "Analiza semantyczna GPT-4o-mini celem wyizolowania rozmówców...");
    try {
      diarization = await diarizeFromTranscript(verificationSegments, { participants: options.participants });
      if (DEBUG && diarization) {
        console.log(`[audioPipeline] Transcript diarization: ${diarization.segments.length} segs, ${diarization.speakerCount} speaker(s): ${JSON.stringify(diarization.speakerNames)}`);
      }
    } catch (err) {
      console.warn("[audioPipeline] Transcript diarization error:", err.message);
      diarization = null;
    }
  }

  // ── Final fallback: normalize whisper verbose_json as single-speaker ──
  if (!diarization || !diarization.segments.length) {
    if (DEBUG) console.log("[audioPipeline] Using whisper segments as single-speaker fallback.");
    diarization = normalizeDiarizedSegments(whisperPayload || {});
  }
  
  logger.info(`[Metrics] Diarization Stage Complete`, {
    requestId: reqId,
    recordingId: asset.id,
    durationMs: (performance.now() - startDiarize).toFixed(2),
    speakersIdentified: diarization.speakerCount
  });

  if (!diarization.segments.length) {
    if (
      isLargeFile &&
      Number(transcriptionDiagnostics.chunksExtracted || 0) === 0 &&
      Number(transcriptionDiagnostics.chunksDiscardedAsTooSmall || 0) > 0 &&
      Number(transcriptionDiagnostics.chunksSentToStt || 0) === 0
    ) {
      return buildEmptyTranscriptResult("all_chunks_discarded_as_too_small", transcriptionDiagnostics, attemptAudioQuality);
    }
    return buildEmptyTranscriptResult("no_segments_from_stt", transcriptionDiagnostics, attemptAudioQuality);
  }

  // ── Hallucination Filter (VAD-based) ──
  if (speechSegments) {
    const originalCount = diarization.segments.length;
    diarization.segments = diarization.segments.filter((seg) => {
      // If a segment has 0% overlap with VAD-detected speech, it's likely a hallucination
      const hasSpeech = speechSegments.some((v) => {
        const overlap = Math.max(0, Math.min(seg.endTimestamp, v.end) - Math.max(seg.timestamp, v.start));
        return overlap > 0.1 || (overlap / (seg.endTimestamp - seg.timestamp)) > 0.2;
      });
      return hasSpeech;
    });
    if (DEBUG && diarization.segments.length < originalCount) {
      console.log(`[audioPipeline] VAD filter removed ${originalCount - diarization.segments.length} hallucinated segment(s).`);
    }
    if (!diarization.segments.length) {
      return buildEmptyTranscriptResult("segments_removed_by_vad", transcriptionDiagnostics, attemptAudioQuality);
    }
  }

  const verificationResult = buildVerificationResult(diarization.segments, verificationSegments);

  if (DEBUG) {
    const spkDist = verificationResult.verifiedSegments.reduce((acc, s) => {
      acc[s.speakerId] = (acc[s.speakerId] || 0) + 1; return acc;
    }, {});
    console.log(`[audioPipeline] After verification: ${verificationResult.verifiedSegments.length} segs, speakers: ${JSON.stringify(spkDist)}`);
    verificationResult.verifiedSegments.forEach((s) => {
      console.log(`  spkId=${s.speakerId} raw=${s.rawSpeakerLabel} | ${s.text?.slice(0, 50)}`);
    });
  }

  // Speaker identification against enrolled voice profiles
  const identifiedNames = { ...diarization.speakerNames };
  const voiceProfiles = options.voiceProfiles || [];
  if (voiceProfiles.length && diarization.speakerCount > 0) {
    // For each unique speaker, find the time range of their segments and match
    const speakerSegmentMap = new Map();
    for (const seg of diarization.segments) {
      const sid = String(seg.speakerId);
      if (!speakerSegmentMap.has(sid)) speakerSegmentMap.set(sid, []);
      speakerSegmentMap.get(sid).push(seg);
    }

    for (const [speakerId, segments] of speakerSegmentMap.entries()) {
      // Extract audio clip for this speaker (first 20s of their segments) using ffmpeg
      const totalSpeakerTime = segments.reduce((sum, s) => sum + (s.endTimestamp - s.timestamp), 0);
      if (totalSpeakerTime < 2) continue; // not enough audio to identify

      const clipPath = path.join(path.dirname(asset.file_path), `spk_${asset.id}_${speakerId}_clip.wav`);
      try {
        // Build ffmpeg filter — sanitize timestamps to prevent command injection
        const safeSegments = segments.slice(0, 8).filter((s) => {
          const t = Number(s.timestamp);
          const e = Number(s.endTimestamp);
          return Number.isFinite(t) && Number.isFinite(e) && e > t && t >= 0;
        });
        if (!safeSegments.length) continue;
        const selectFilter = safeSegments
          .map((s) => `between(t,${Number(s.timestamp).toFixed(3)},${Number(s.endTimestamp).toFixed(3)})`)
          .join("+");
        await execPromise(
          `"${FFMPEG_BINARY}" -y -i "${asset.file_path}" -af "aselect='${selectFilter}',asetpts=N/SR/TB" -ar 16000 -ac 1 "${clipPath}"`,
          { timeout: 30000, signal: options.signal }
        );
        const matchedName = await matchSpeakerToProfile(clipPath, voiceProfiles);
        if (matchedName) {
          identifiedNames[speakerId] = matchedName;
        }
      } catch (err) {
        console.warn(`[audioPipeline] Speaker clip extraction failed for speaker ${speakerId}:`, err.message);
      } finally {
        try { fs.unlinkSync(clipPath); } catch (_) {}
      }
    }
  }

  const processedSegments = await (async () => {
    notify(90, "Czyszczenie halucynacji AI za sprawą hybrydowej analizy WavLM...");
    const withoutHallucinations = verificationResult.verifiedSegments
      .filter((seg) => !isHallucination(seg.text));
    if (DEBUG && withoutHallucinations.length < verificationResult.verifiedSegments.length) {
      console.log(`[audioPipeline] Hallucination filter removed ${verificationResult.verifiedSegments.length - withoutHallucinations.length} segment(s).`);
    }
    if (!withoutHallucinations.length) {
      return buildEmptyTranscriptResult("segments_removed_as_hallucinations", transcriptionDiagnostics, attemptAudioQuality).segments;
    }
    const merged = mergeShortSegments(withoutHallucinations);
    const corrected = await correctTranscriptWithLLM(merged, options);
    return corrected;
  })();

  if (!processedSegments.length) {
    return buildEmptyTranscriptResult("segments_removed_as_hallucinations", transcriptionDiagnostics, attemptAudioQuality);
  }

  return {
    providerId: "openai-audio-pipeline",
    providerLabel: "OpenAI STT + diarization",
    pipelineStatus: "completed",
    transcriptOutcome: "normal",
    emptyReason: "",
    userMessage: "",
    audioQuality: attemptAudioQuality,
    transcriptionDiagnostics,
    diarization: {
      speakerNames: identifiedNames,
      speakerCount: diarization.speakerCount,
      confidence: verificationResult.confidence,
      text: diarization.text,
      transcriptOutcome: "normal",
      emptyReason: "",
      userMessage: "",
      audioQuality: attemptAudioQuality,
      transcriptionDiagnostics,
    },
    // Post-processing pipeline: hallucination removal → short-segment merging → LLM correction
    segments: processedSegments,
    speakerNames: identifiedNames,
    speakerCount: diarization.speakerCount,
    confidence: verificationResult.confidence,
    reviewSummary: {
      needsReview: processedSegments.filter((segment) => segment.verificationStatus === "review").length,
      approved: processedSegments.filter((segment) => segment.verificationStatus === "verified").length,
    },
  };
  } catch (error: any) {
    error.audioQuality = error?.audioQuality || attemptAudioQuality;
    error.transcriptionDiagnostics = {
      ...(transcriptionDiagnostics || {}),
      ...(error?.transcriptionDiagnostics && typeof error.transcriptionDiagnostics === "object"
        ? error.transcriptionDiagnostics
        : {}),
      transcriptionProfileUsed: profile,
      transcriptionAttemptCount: attemptCount,
    };
    throw error;
  } finally {
    if (prepPath) { try { fs.unlinkSync(prepPath); } catch (_) {} }
  }
  } finally {
    // Clean up temp file downloaded from Supabase Storage
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (_) {}
    }
  }
}

async function transcribeRecording(asset: any, options: any = {}) {
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
        console.warn("[audioPipeline] Audio quality analysis fallback failed:", error?.message || error);
      }
      audioQuality = null;
    }
  }

  const initialProfile: "standard" | "enhanced" =
    audioQuality?.enhancementRecommended ? "enhanced" : "standard";
  const attemptProfiles: Array<"standard" | "enhanced"> =
    initialProfile === "standard" ? ["standard", "enhanced"] : ["enhanced"];

  let lastError: any = null;
  let lastResult: any = null;

  for (let index = 0; index < attemptProfiles.length; index += 1) {
    const profile = attemptProfiles[index];
    const attemptCount = Math.min(index + 1, 2) as 1 | 2;

    try {
      const result = await runTranscriptionAttempt(asset, options, audioQuality, profile, attemptCount);
      lastResult = result;
      if (shouldRetryWithEnhancedProfile(profile, attemptCount, result) && attemptProfiles[index + 1] === "enhanced") {
        if (DEBUG) {
          console.log("[audioPipeline] Retrying transcription with enhanced preprocessing profile.");
        }
        continue;
      }
      return result;
    } catch (error: any) {
      lastError = error;
      if (shouldRetryWithEnhancedProfile(profile, attemptCount, error) && attemptProfiles[index + 1] === "enhanced") {
        if (DEBUG) {
          console.warn("[audioPipeline] STT failed on standard profile, retrying with enhanced preprocessing.");
        }
        continue;
      }
      throw error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return (
    lastResult ||
    buildEmptyTranscriptResult(
      "no_segments_from_stt",
      {
        transcriptionProfileUsed: initialProfile,
        transcriptionAttemptCount: Math.min(attemptProfiles.length, 2) as 1 | 2,
      },
      buildAudioQualityForAttempt(audioQuality, initialProfile, false)
    )
  );
}

async function correctTranscriptWithLLM(segments: any[], options: any = {}) {
  if (!TRANSCRIPT_CORRECTION && !options.transcriptCorrection) return segments;
  if (!OPENAI_API_KEY) return segments;
  const payload = segments.map((s) => ({ id: s.id, text: s.text }));
  const inputLen = payload.reduce((sum, s) => sum + (s.text?.length || 0), 0);
  const abortSignal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(60000)]) : undefined;
  try {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      signal: abortSignal,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: Math.min(4000, inputLen * 2 + 200),
        messages: [{
          role: "user",
          content: `Popraw interpunkcję i pisownię w poniższych segmentach transkrypcji. Zachowaj dokładne słowa i znaczenie. Zwróć wyłącznie tablicę JSON z polami id i text.\n\n${JSON.stringify(payload)}`,
        }],
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    const corrected = JSON.parse(json.choices[0].message.content);
    const map = new Map(corrected.map((s) => [s.id, s.text]));
    return segments.map((s) => ({ ...s, text: map.has(s.id) ? map.get(s.id) : s.text }));
  } catch (err) {
    if (!options.signal?.aborted) console.warn("[audioPipeline] LLM correction failed, using original segments.", err.message);
    return segments;
  }
}

/**
 * Quickly transcribes a small audio chunk (no diarization, no preprocessing).
 * Used for live captioning during recording — optimised for low latency.
 *
 * @param {string} filePath  Path to the audio file (temp, caller must clean up)
 * @param {string} contentType  MIME type of the audio file
 * @returns {Promise<string>}  Transcribed text or empty string on failure
 */
async function transcribeLiveChunk(filePath: string, contentType: string, options: any = {}) {
  if (!OPENAI_API_KEY) return "";
  try {
    const payload = await requestAudioTranscription({
      filePath,
      contentType: contentType || "audio/webm",
      fields: {
        model: VERIFICATION_MODEL,
        language: AUDIO_LANGUAGE,
        response_format: "json",
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
    return String(payload?.text || "").trim();
  } catch (err) {
    if (!options.signal?.aborted) {
      if (DEBUG) console.warn("[audioPipeline] Live chunk transcription failed:", err.message);
    }
    return "";
  }
}

/**
 * Extracts a speaker's audio clip and asks GPT-4o audio-preview for
 * detailed Polish coaching on tone, tempo, pronunciation, and filler words.
 *
 * @param {{ id: string, file_path: string }} asset
 * @param {string} speakerId
 * @param {Array<{speakerId: string, timestamp: number, endTimestamp: number}>} segments  all transcript segments
 * @returns {Promise<string>}  Polish coaching text (~200–300 words)
 * Extracts a speaker's audio clip from an asset based on transcript segments.
 *
 * @param {{ id: string, file_path: string }} asset
 * @param {string | number} speakerId
 * @param {Array<{speakerId: string, timestamp: number, endTimestamp: number}>} segments  all transcript segments
 * @param {object} options
 * @returns {Promise<string>}  Path to the generated audio clip (temp, caller must clean up)
 */
async function extractSpeakerAudioClip(asset: any, speakerId: string | number, segments: any[], options: any = {}) {
  const validSegs = segments
    .filter((s: any) => {
      if (String(s.speakerId) !== String(speakerId)) return false;
      const t = Number(s.timestamp ?? s.start ?? NaN);
      const e = Number(s.endTimestamp ?? s.end ?? NaN);
      return Number.isFinite(t) && Number.isFinite(e) && e > t && t >= 0;
    })
    .slice(0, 15);

  if (!validSegs.length) throw new Error("Brak segmentów z poprawnymi znacznikami czasu.");

  const clipPath = path.join(
    path.dirname(asset.file_path),
    `speaker_${asset.id}_${String(speakerId).replace(/[^a-zA-Z0-9_-]/g, "")}_${crypto.randomUUID().slice(0,8)}.wav`
  );

  const selectFilter = validSegs
    .map(
      (s: any) =>
        `between(t,${Number(s.timestamp ?? s.start).toFixed(3)},${Number(s.endTimestamp ?? s.end).toFixed(3)})`
    )
    .join("+");

  await execPromise(
    `"${FFMPEG_BINARY}" -y -i "${asset.file_path}" -af "aselect='${selectFilter}',asetpts=N/SR/TB" -t 60 -ar 16000 -ac 1 "${clipPath}"`,
    { timeout: 30000, signal: options.signal }
  );

  return clipPath;
}

/**
 * Extracts a speaker's audio clip and asks GPT-4o audio-preview for
 * detailed Polish coaching on tone, tempo, pronunciation, and filler words.
 *
 * @param {{ id: string, file_path: string }} asset
 * @param {string} speakerId
 * @param {Array<{speakerId: string, timestamp: number, endTimestamp: number}>} segments  all transcript segments
 * @returns {Promise<string>}  Polish coaching text (~200–300 words)
 */
async function generateVoiceCoaching(asset: any, speakerId: any, segments: any[], options: any = {}) {
  if (!OPENAI_API_KEY) throw new Error("Brak klucza OpenAI API.");

  const clipPath = await extractSpeakerAudioClip(asset, speakerId, segments, options);
  
  try {
    const audioBase64 = fs.readFileSync(clipPath).toString("base64");

    const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-audio-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "input_audio",
                input_audio: { data: audioBase64, format: "wav" },
              },
              {
                type: "text",
                text: [
                  "Przeanalizuj mowę tej osoby dokładnie — bazując wyłącznie na dźwięku, nie na tekście.",
                  "Oceń poniższe aspekty i daj konkretne, praktyczne wskazówki do poprawy:",
                  "1. Ton głosu i emocje (pewność siebie, energia, monotonia, zaangażowanie).",
                  "2. Tempo mówienia i rytm (za szybko, za wolno, dobre zmiany tempa).",
                  "3. Wymowa polskich głosek (sz/cz/rz, miękkie spółgłoski, akcent wyrazowy).",
                  "4. Pauzy — czy naturalne i budują napięcie, czy wynikają z niepewności.",
                  "5. Wypełniacze głosowe (ee, yyy, yyy, znaczy) — częstotliwość i jak je redukować.",
                  "6. Dykcja i wyrazistość — czy słowa są wyraźne i zrozumiałe.",
                  "Odpowiedź po polsku, ok. 200–300 słów. Zacznij bezpośrednio od oceny.",
                ].join(" "),
              },
            ],
          },
        ],
        max_tokens: 700,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`OpenAI API ${res.status}: ${errText.slice(0, 120)}`);
    }

    const json = await res.json();
    const coaching = String(json.choices?.[0]?.message?.content || "").trim();
    if (!coaching) throw new Error("Pusta odpowiedź z modelu audio.");
    return coaching;
  } finally {
    try { fs.unlinkSync(clipPath); } catch (_) {}
  }
}

async function normalizeRecording(filePath: string, options: any = {}) {
  const tmpPath = `${filePath}.norm.tmp`;
  try {
    await execPromise(
      `"${FFMPEG_BINARY}" -y -i "${filePath}" -af "highpass=f=80,afftdn,loudnorm=I=-16:TP=-1.5:LRA=11" "${tmpPath}"`,
      { timeout: 120000, signal: options.signal }
    );
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
    throw err;
  }
}

/**
 * Analyze a meeting transcript using GPT-4o-mini and return structured JSON.
 * Returns null if OPENAI_API_KEY is not set or an error occurs.
 */
async function analyzeMeetingWithOpenAI({ meeting, segments, speakerNames }: any) {
  if (!OPENAI_API_KEY || !segments.length) return null;

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const transcriptText = segments.map((seg) => {
    const speaker = speakerNames?.[String(seg.speakerId)] || `Speaker ${(seg.speakerId || 0) + 1}`;
    return `[${fmt(seg.timestamp ?? 0)}] ${speaker}: ${seg.text}`;
  }).join("\n");

  const schema = '{"speakerCount":2,"speakerLabels":{"0":"Adam","1":"Marcin"},"summary":"...","decisions":["..."],"actionItems":["..."],"tasks":[{"title":"...","owner":"...","sourceQuote":"...","priority":"medium","tags":[]}],"followUps":["..."],"answersToNeeds":[{"need":"...","answer":"..."}],"suggestedTags":["tag1"],"meetingType":"planning","energyLevel":"medium","risks":[{"risk":"...","severity":"high"}],"blockers":["..."],"participantInsights":[{"speaker":"Adam","mainTopic":"...","stance":"proactive","talkRatio":0.6,"personality":{"D":70,"I":50,"S":40,"C":80},"needs":["..."],"concerns":["..."],"sentimentScore":85}],"keyQuotes":[{"quote":"...","speaker":"Adam","why":"..."}]}';

  const prompt = [
    "Jesteś analitykiem spotkań biznesowych. Analizuj transkrypt i zwróć JSON.",
    "Return valid JSON only — no prose outside the JSON object.",
    "BARDZO WAŻNE: Twoim krytycznym zadaniem jest przypisywanie zadań (Action Items / Tasks) konkretnym mówcom. Właściwość 'owner' w tablicy 'tasks' MUSI zawierać dokładne imię (speakerLabels) osoby, która podjęła się zadania w transkryptach, zamiast ogólników.",
    "ZADANIE A: Zidentyfikuj i uzupełnij prawdziwe imiona we właściwości 'speakerLabels' (np. gdy ktoś mówi 'Cześć Adam', zamień 'Speaker 1' na 'Adam') i używaj tylko tych konkretnych imion wokół całego pliku (szczególnie klucza 'owner' przy zadaniach).",
    "ZADANIE B: Dla każdej rozpoznanej osoby w sekcji 'participantInsights' wypełnij obiekt 'personality' oszacowując od 0 do 100 psychologię DISC.",
    "ZADANIE C: Dla każdej osoby oszacuj jej 'sentimentScore' od 1 (niedostępny/zły/wycofany/zimny) do 100 (gorący/entuzjastyczny/bardzo zaangażowany w relację).",
    "",
    `Tytuł spotkania: ${meeting?.title || "Nieznany"}`,
    `Kontekst: ${meeting?.context || "Brak"}`,
    `Potrzeby: ${Array.isArray(meeting?.needs) ? meeting.needs.join(" | ") : (meeting?.needs || "Brak")}`,
    "",
    "Zwróć JSON w tym formacie (wszystkie pola w języku polskim):",
    schema,
    "",
    "Transkrypt:",
    transcriptText,
  ].join("\n");

  const startAnalyze = performance.now();
  const reqId = meeting?.requestId || "internal-analysis";

  try {
    const resp = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2400,
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) throw new Error(`OpenAI analyze HTTP ${resp.status}`);
    const json = await resp.json();
    const content = json.choices?.[0]?.message?.content || "{}";
    
    logger.info(`[Metrics] LLM Meeting Analysis Complete`, {
      requestId: reqId,
      durationMs: (performance.now() - startAnalyze).toFixed(2),
      transcriptLength: transcriptText.length
    });
    
    return JSON.parse(content);
  } catch (err) {
    console.warn("[audioPipeline] analyzeMeetingWithOpenAI failed:", err.message);
    return null;
  }
}

async function embedTextChunks(texts: string[]) {
  if (!OPENAI_API_KEY || !texts.length) return [];
  try {
    const res = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: texts,
      }),
    });
    if (!res.ok) throw new Error("Embeddings API error");
    const json = await res.json();
    return json.data.map((d: any) => d.embedding);
  } catch (err) {
    console.error("embedTextChunks failed:", err);
    return [];
  }
}

export {
  transcribeRecording,
  analyzeAudioQuality,
  normalizeRecording,
  extractSpeakerAudioClip,
  transcribeLiveChunk,
  generateVoiceCoaching,
  diarizeFromTranscript,
  analyzeMeetingWithOpenAI,
  embedTextChunks,
};
