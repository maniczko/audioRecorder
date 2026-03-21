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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execPromise = promisify(exec);

const OPENAI_API_KEY = config.VOICELOG_OPENAI_API_KEY || config.OPENAI_API_KEY || "";
const OPENAI_BASE_URL = config.VOICELOG_OPENAI_BASE_URL;

const VERIFICATION_MODEL = config.VERIFICATION_MODEL;
const AUDIO_LANGUAGE = config.AUDIO_LANGUAGE;
const MAX_FILE_SIZE_BYTES = 24 * 1024 * 1024; // 24 MB — 1 MB below API limit for safety
const CHUNK_DURATION_SECONDS = 1200; // 20-minute chunks for large-file splitting

const AUDIO_PREPROCESS = config.AUDIO_PREPROCESS;
const TRANSCRIPT_CORRECTION = config.TRANSCRIPT_CORRECTION;
const FFMPEG_BINARY = config.FFMPEG_BINARY;
const HF_TOKEN = config.HF_TOKEN || config.HUGGINGFACE_TOKEN || "";
const PYTHON_BINARY = config.PYTHON_BINARY;
const DIARIZE_SCRIPT = path.join(__dirname, "diarize.py");
const VAD_SCRIPT = path.join(__dirname, "vad.py");
const VAD_ENABLED = config.VAD_ENABLED;
// Whisper prompt primes the model toward Polish business vocabulary.
// Override with VOICELOG_WHISPER_PROMPT env var if needed.
const WHISPER_PROMPT = config.WHISPER_PROMPT
  || "Transkrypcja spotkania biznesowego w języku polskim.";


/**
 * Builds a context-aware Whisper initial_prompt from meeting metadata.
 * Falls back to the global WHISPER_PROMPT when no metadata is provided.
 * Stays within Whisper's ~224-token prompt limit (~900 safe chars).
 *
 * @param {{ meetingTitle?: string, participants?: string[], tags?: string[], vocabulary?: string }} opts
 */
function buildWhisperPrompt({ meetingTitle, participants, tags, vocabulary }: any = {}) {
  const parts = [WHISPER_PROMPT];
  if (meetingTitle) parts.push(`Spotkanie: ${String(meetingTitle).trim().slice(0, 80)}.`);
  if (Array.isArray(participants) && participants.length) {
    const names = participants.slice(0, 8).map((p) => String(p).trim()).filter(Boolean).join(", ");
    if (names) parts.push(`Uczestnicy: ${names}.`);
  }
  if (Array.isArray(tags) && tags.length) {
    const tagList = tags.slice(0, 6).map((t) => String(t).trim()).filter(Boolean).join(", ");
    if (tagList) parts.push(`Tematy: ${tagList}.`);
  }
  if (vocabulary) parts.push(String(vocabulary).trim().slice(0, 200));
  return parts.join(" ").slice(0, 900);
}
// Verification thresholds — tuned for Polish (lower than English defaults).
// Polish has heavier inflection which produces systematically lower logprob.
const VERIFY_CONFIDENCE_THRESHOLD = Number(process.env.VOICELOG_VERIFY_CONFIDENCE) || 0.52;
const VERIFY_SCORE_THRESHOLD = Number(process.env.VOICELOG_VERIFY_SCORE) || 0.65;
// Enable verbose pipeline logging with VOICELOG_DEBUG=true
const DEBUG = process.env.VOICELOG_DEBUG === "true";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clean(value) {
  return String(value || "").trim();
}

function normalizeText(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(" ")
    .map((item) => item.trim())
    .filter(Boolean);
}

function textSimilarity(left, right) {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  if (!leftTokens.length || !rightTokens.length) {
    return 0;
  }

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;
  const denominator = Math.max(leftSet.size, rightSet.size, 1);
  return clamp(intersection / denominator, 0, 1);
}

function hasRepeatedPhrase(text) {
  const tokens = tokenize(text);
  if (tokens.length < 4) {
    return false;
  }

  return new Set(tokens).size <= Math.ceil(tokens.length / 2.4);
}

// Common Whisper hallucinations produced on silence, music, or room noise.
// Whisper is often overconfident on these — they bypass logprob filtering.
const HALLUCINATION_PATTERNS = [
  // English filler phrases Whisper produces on silence for non-English audio
  /^(thank you\.?|thanks for watching\.?|thanks for watching!|please like and subscribe\.?|see you next time\.?|don't forget to like and subscribe\.?)$/i,
  /^(goodbye\.?|bye\.?|bye bye\.?|good bye\.?|see you\.?|ciao\.?)$/i,
  /^(okay\.?|ok\.?|alright\.?|all right\.?)$/i,
  /^(yes\.?|no\.?|sure\.?|right\.?|correct\.?)$/i,
  // Polish hallucinations
  /^(dziękuję\.?|dziękuję ci\.?|dziękuję za obejrzenie\.?|do widzenia\.?|na razie\.?|hej\.?)$/i,
  /^(tak\.?|nie\.?|dobrze\.?|okej\.?|okej\.?)$/i,
  // Music / non-speech markers
  /\[music\]|\[applause\]|\[laughter\]|\[noise\]|\[silence\]|\[inaudible\]/i,
  /^♪|♪$/,
  // Only punctuation / ellipsis
  /^[.…,;!?]+$/,
  // Very common Whisper repetition artifact on silence
  /^(mm+|hmm+|uhh+|ahh+|ehh+)\.?$/i,
];

/**
 * Returns true when the text matches a known Whisper hallucination pattern.
 * Used to remove confident-but-fabricated segments from the final output.
 */
function isHallucination(text) {
  const t = clean(text);
  if (!t || t.length < 2) return true;
  return HALLUCINATION_PATTERNS.some((pattern) => pattern.test(t));
}

/**
 * Merges consecutive segments that are too short to stand alone (< minDuration s)
 * with their same-speaker neighbour. Short segments are usually sentence fragments
 * produced when Whisper splits on very brief pauses — merging them produces
 * more natural, readable transcript blocks.
 *
 * @param {object[]} segments  — already verified segments with speakerId
 * @param {number}   minDuration  — min seconds a segment must cover (default 1.2)
 */
function mergeShortSegments(segments, minDuration = 1.2) {
  if (segments.length < 2) return segments;
  const result = [];
  let pending = null;

  for (const seg of segments) {
    const duration = (seg.endTimestamp || seg.timestamp) - seg.timestamp;
    if (!pending) {
      pending = { ...seg };
      continue;
    }
    // Merge if: current segment is short AND same speaker as pending
    if (duration < minDuration && seg.speakerId === pending.speakerId) {
      pending = {
        ...pending,
        text: `${pending.text} ${seg.text}`.trim(),
        endTimestamp: seg.endTimestamp,
        // Keep the lower verification score to preserve review flags
        verificationScore: Math.min(pending.verificationScore ?? 1, seg.verificationScore ?? 1),
        verificationStatus: [pending.verificationStatus, seg.verificationStatus].includes("review") ? "review" : "verified",
      };
    } else {
      result.push(pending);
      pending = { ...seg };
    }
  }
  if (pending) result.push(pending);
  return result;
}

function estimateQualityScore(text) {
  const normalizedText = clean(text);
  let score = 0.82;

  if (!normalizedText) {
    return 0.15;
  }

  if (normalizedText.length < 8) {
    score -= 0.16;
  }

  if (/^(yyy+|eee+|mmm+|hmm+|aaa+)$/i.test(normalizedText)) {
    score -= 0.2;
  }

  if (hasRepeatedPhrase(normalizedText)) {
    score -= 0.12;
  }

  if (/[?]{2,}/.test(normalizedText)) {
    score -= 0.08;
  }

  return clamp(score, 0, 1);
}

function parseJsonResponse(raw) {
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

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

function normalizeSpeakerLabel(label, index) {
  const safeLabel = clean(label);
  if (!safeLabel || /^[A-Z]$/i.test(safeLabel) || /^speaker[_ -]?\w*$/i.test(safeLabel)) {
    return `Speaker ${index + 1}`;
  }

  return safeLabel;
}

function getRawWords(payload) {
  if (Array.isArray(payload?.words)) return payload.words;
  if (Array.isArray(payload?.transcript?.words)) return payload.transcript.words;
  if (Array.isArray(payload?.results?.words)) return payload.results.words;
  return [];
}

function synthesizeSegmentsFromWords(payload) {
  const words = getRawWords(payload)
    .map((word, index) => {
      const text = clean(word?.word || word?.text || word?.token || word?.content);
      if (!text) return null;
      const start = Number(word?.start ?? word?.start_time ?? word?.offset ?? 0);
      const end = Number(word?.end ?? word?.end_time ?? word?.offset_end ?? start);
      return {
        text,
        start: Number.isFinite(start) ? start : 0,
        end: Number.isFinite(end) && end > start ? end : start + 0.45,
        index,
      };
    })
    .filter(Boolean);

  if (words.length) {
    const segments = [];
    let current = null;

    const flushCurrent = () => {
      if (!current || !current.words.length) return;
      const joinedText = current.words.map((word) => word.text).join(" ").trim();
      if (!joinedText) return;
      const start = current.words[0].start;
      const lastWord = current.words[current.words.length - 1];
      const end = Math.max(start + 0.8, lastWord.end);
      segments.push({
        id: `seg_${crypto.randomUUID().replace(/-/g, "")}`,
        text: joinedText,
        timestamp: start,
        endTimestamp: end,
        speakerId: 0,
        rawSpeakerLabel: "speaker_0",
      });
    };

    for (const word of words) {
      if (!current) {
        current = { words: [word] };
        continue;
      }

      const previousWord = current.words[current.words.length - 1];
      const gap = Math.max(0, word.start - previousWord.end);
      const punctuationBreak = /[.!?…:]$/.test(previousWord.text);
      const maxWordCount = current.words.length >= 18;
      const maxDuration = word.end - current.words[0].start >= 12;

      if (gap > 1.2 || punctuationBreak || maxWordCount || maxDuration) {
        flushCurrent();
        current = { words: [word] };
      } else {
        current.words.push(word);
      }
    }

    flushCurrent();

    return {
      segments,
      text: segments.map((segment) => segment.text).join(" ").trim(),
    };
  }

  const rawText = clean(payload?.text || payload?.transcript || payload?.results?.text);
  if (!rawText) {
    return { segments: [], text: "" };
  }

  const estimatedDuration = Math.max(1.5, tokenize(rawText).length * 0.42);
  return {
    segments: [
      {
        id: `seg_${crypto.randomUUID().replace(/-/g, "")}`,
        text: rawText,
        timestamp: 0,
        endTimestamp: estimatedDuration,
        speakerId: 0,
        rawSpeakerLabel: "speaker_0",
      },
    ],
    text: rawText,
  };
}

function normalizeDiarizedSegments(payload) {
  const rawSegments = Array.isArray(payload?.segments)
    ? payload.segments
    : Array.isArray(payload?.transcript?.segments)
      ? payload.transcript.segments
      : Array.isArray(payload?.utterances)
        ? payload.utterances
          : Array.isArray(payload?.transcript?.utterances)
            ? payload.transcript.utterances
            : [];
  const synthesized = !rawSegments.length ? synthesizeSegmentsFromWords(payload) : null;
  const speakerOrder = new Map();
  const speakerNames = {};

  const segments = (rawSegments.length ? rawSegments : (synthesized?.segments || []))
    .map((segment, index) => {
      const text = clean(segment.text || segment.transcript || segment.content);
      if (!text) {
        return null;
      }

      // NOTE: segment.speaker can be numeric 0 which is falsy — must use explicit null check
      const rawSpeakerLabel = clean(
        (segment.speaker !== undefined && segment.speaker !== null ? String(segment.speaker) : null)
        || (segment.speaker_label !== undefined && segment.speaker_label !== null ? String(segment.speaker_label) : null)
        || (segment.speakerId !== undefined && segment.speakerId !== null ? String(segment.speakerId) : null)
        || (segment.speaker_id !== undefined && segment.speaker_id !== null ? String(segment.speaker_id) : null)
        || `speaker_${index}`
      );

      if (!speakerOrder.has(rawSpeakerLabel)) {
        const nextSpeakerId = speakerOrder.size;
        speakerOrder.set(rawSpeakerLabel, nextSpeakerId);
        speakerNames[String(nextSpeakerId)] = normalizeSpeakerLabel(rawSpeakerLabel, nextSpeakerId);
      }

      const speakerId = speakerOrder.get(rawSpeakerLabel);
      const start = Number(segment.start ?? segment.start_time ?? segment.offset ?? 0) || 0;
      const providedEnd = Number(segment.end ?? segment.end_time ?? start) || start;
      const estimatedDuration = Math.max(1.5, tokenize(text).length * 0.42);
      const end = providedEnd > start ? providedEnd : start + estimatedDuration;

      return {
        id: clean(segment.id) || `seg_${crypto.randomUUID().replace(/-/g, "")}`,
        text,
        timestamp: start,
        endTimestamp: Math.max(start, end),
        speakerId,
        rawSpeakerLabel,
      };
    })
    .filter(Boolean);

  return {
    segments,
    speakerNames,
    speakerCount: Object.keys(speakerNames).length,
    text: clean(payload?.text || payload?.transcript || synthesized?.text || segments.map((segment) => segment.text).join(" ")),
  };
}

function normalizeVerificationSegments(payload: any) {
  const rawSegments = Array.isArray(payload?.segments) ? payload.segments : [];
  if (!rawSegments.length) {
    return (synthesizeSegmentsFromWords(payload)?.segments || []).map((segment) => ({
      text: segment.text,
      start: segment.timestamp,
      end: segment.endTimestamp,
      avgLogprob: null,
      noSpeechProb: null,
    }));
  }
  return rawSegments
    .map((segment) => ({
      text: clean(segment.text || segment.transcript),
      start: Number(segment.start ?? segment.start_time ?? 0) || 0,
      end: Number(segment.end ?? segment.end_time ?? 0) || 0,
      avgLogprob: Number.isFinite(Number(segment.avg_logprob)) ? Number(segment.avg_logprob) : null,
      noSpeechProb: Number.isFinite(Number(segment.no_speech_prob)) ? Number(segment.no_speech_prob) : null,
    }))
    .filter((segment) => segment.text);
}

function overlapSeconds(left, right) {
  return Math.max(0, Math.min(left.endTimestamp, right.end) - Math.max(left.timestamp, right.start));
}

function evaluateAgainstVerificationPass(segment, verificationSegments) {
  const overlaps = verificationSegments.filter((candidate) => overlapSeconds(segment, candidate) > 0.08);
  if (!overlaps.length) {
    return {
      whisperConfidence: 0.42,
      alignmentScore: 0.34,
      comparisonText: "",
      reasons: ["brak nakladajacego sie fragmentu w przebiegu weryfikujacym"],
    };
  }

  const weightedLogprobParts = overlaps
    .filter((candidate) => Number.isFinite(candidate.avgLogprob))
    .map((candidate) => {
      const overlap = overlapSeconds(segment, candidate) || 1;
      return {
        overlap,
        weighted: Math.exp(Math.min(0, candidate.avgLogprob)) * overlap,
      };
    });
  const totalOverlap = weightedLogprobParts.reduce((sum, item) => sum + item.overlap, 0);
  const whisperConfidence = totalOverlap
    ? clamp(weightedLogprobParts.reduce((sum, item) => sum + item.weighted, 0) / totalOverlap, 0, 1)
    : 0.68;
  const comparisonText = overlaps.map((candidate) => candidate.text).join(" ");
  const alignmentScore = textSimilarity(segment.text, comparisonText);
  const reasons = [];

  if (whisperConfidence < VERIFY_CONFIDENCE_THRESHOLD) {
    reasons.push("niska pewnosc ASR w przebiegu weryfikujacym");
  }
  if (alignmentScore < 0.45) {
    reasons.push("tekst rozni sie od przebiegu weryfikujacego");
  }
  if (overlaps.some((candidate) => Number(candidate.noSpeechProb || 0) > 0.55)) {
    reasons.push("fragment przypomina cisze lub szum");
  }

  return {
    whisperConfidence,
    alignmentScore,
    comparisonText,
    reasons,
  };
}

function buildVerificationResult(diarizedSegments: any[], verificationSegments: any[]) {
  const verifiedSegments = diarizedSegments.map((segment, index) => {
    const qualityScore = estimateQualityScore(segment.text);
    const verification = evaluateAgainstVerificationPass(segment, verificationSegments);
    const previousSegment = diarizedSegments[index - 1];
    const reasons = [...verification.reasons];

    if (previousSegment && normalizeText(previousSegment.text) === normalizeText(segment.text)) {
      reasons.push("duplikat poprzedniego fragmentu");
    }

    if (segment.text.length < 8) {
      reasons.push("bardzo krotki fragment");
    }

    if (hasRepeatedPhrase(segment.text)) {
      reasons.push("powtarzajace sie slowa");
    }

    const verificationScore = clamp(
      qualityScore * 0.22 + verification.whisperConfidence * 0.38 + verification.alignmentScore * 0.4,
      0,
      1
    );

    return {
      ...segment,
      rawConfidence: verification.whisperConfidence,
      verificationScore,
      verificationStatus: verificationScore >= VERIFY_SCORE_THRESHOLD ? "verified" : "review",
      verificationReasons: [...new Set(reasons)],
      verificationEvidence: {
        alignmentScore: verification.alignmentScore,
        whisperConfidence: verification.whisperConfidence,
        comparisonText: verification.comparisonText,
      },
    };
  });

  return {
    verifiedSegments,
    confidence: average(verifiedSegments.map((segment) => segment.verificationScore)),
  };
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
 */
function mergeChunkedPayloads(payloads: any[]) {
  const allSegments = payloads.flatMap(({ payload, offsetSeconds }) => {
    const segs = Array.isArray(payload?.segments) ? payload.segments : [];
    return segs.map((s) => ({
      ...s,
      start: Number(s.start || 0) + offsetSeconds,
      end: Number(s.end || 0) + offsetSeconds,
    }));
  });
  const allWords = payloads.flatMap(({ payload, offsetSeconds }) => {
    const words = getRawWords(payload);
    return words.map((word) => ({
      ...word,
      start: Number(word?.start ?? word?.start_time ?? word?.offset ?? 0) + offsetSeconds,
      end: Number(word?.end ?? word?.end_time ?? word?.offset_end ?? word?.start ?? 0) + offsetSeconds,
    }));
  });
  const fullText = payloads.map(({ payload }) => payload?.text || "").join(" ").trim();
  return { segments: allSegments, words: allWords, text: fullText };
}



/**
 * Transcribes a large audio file by virtually streaming chunks in-memory
 * and dispatching concurrent OpenAI fetch requests without disk segment tracking.
 */
async function transcribeInChunks(filePath: string, contentType: string, fields: any, options: any = {}) {
  if (DEBUG) console.log(`[audioPipeline] Starting in-memory concurrent chunking...`);

  const notify = (p: number, m: string) => { if (typeof options.onProgress === "function") options.onProgress({ progress: p, message: m }) };

  const payloads = [];
  const CONCURRENCY_LIMIT = 4;
  let offsetSeconds = 0;
  let hasMore = true;

  while (hasMore && !options.signal?.aborted) {
    const batchPromises = [];
    for (let i = 0; i < CONCURRENCY_LIMIT; i++) {
      const currentOffset = offsetSeconds;
      offsetSeconds += CHUNK_DURATION_SECONDS;
      
      batchPromises.push((async () => {
        // Wyciągnij chunk audio prosto do bufora RAM (z pominięciem zapisu dyskowego)
        const buffer = await extractAudioSegmentMemory(filePath, currentOffset, CHUNK_DURATION_SECONDS, options.signal);
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

        if (chunkSpeech && chunkSpeech.length === 0) {
          if (DEBUG) console.log(`[audioPipeline] Skipping silent chunk at offset: ${currentOffset}s`);
          return { payload: { segments: [], text: "" }, offsetSeconds: currentOffset };
        }

        const payload = await requestAudioTranscription({
          buffer,
          filename: `chunk_${currentOffset}.wav`,
          contentType: "audio/wav",
          fields,
          signal: options.signal,
        });
        return { payload, offsetSeconds: currentOffset };
      })());
    }

    const results = await Promise.all(batchPromises);
    const validResults = results.filter(r => r !== null);
    payloads.push(...validResults);
    
    notify(Math.min(60, 40 + payloads.length * 5), `OpenAI Batch AI — pobrano ${payloads.length} paczek audio (20 min każda)...`);

    // Jeśli FFmpeg zwrócił paczkę mniejszą od limitu (null), przerywamy pętlę.
    if (validResults.length < CONCURRENCY_LIMIT) {
      hasMore = false;
    }
  }
  
  return payloads;
}

async function preprocessAudio(filePath: string, signal: any) {
  if (!AUDIO_PREPROCESS) return null;
  const tmpPath = `${filePath}.prep.wav`;
  try {
    await execPromise(
      `"${FFMPEG_BINARY}" -y -i "${filePath}" -af "afftdn=nf=-20:nr=0.85,highpass=f=80,lowpass=f=16000,dynaudnorm=p=0.9:m=100:s=5,aresample=resampler=swr" -ar 16000 -ac 1 "${tmpPath}"`,
      { timeout: 180000, signal }
    );
    return tmpPath;
  } catch (err) {
    if (!signal?.aborted) console.warn("[audioPipeline] Audio pre-processing failed, using original file.", err.message);
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
async function diarizeFromTranscript(segments: any[]) {
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

  const userPrompt = [
    "Nagranie rozmowy między WIELOMA osobami (co najmniej 2). To NIE jest monolog.",
    "Każda zmiana osoby mówiącej musi być oznaczona inną literą (A, B, C…).",
    "",
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

async function transcribeRecording(asset: any, options: any = {}) {
  const notify = (p: number, m: string) => { if (typeof options.onProgress === "function") options.onProgress({ progress: p, message: m }) };

  notify(10, "Wyciąganie audio do pamięci podręcznej...");
  const prepPath = await preprocessAudio(asset.file_path, options.signal);
  const transcribeFilePath = prepPath || asset.file_path;
  const transcribeContentType = prepPath ? "audio/wav" : asset.content_type;

  notify(30, "Silero VAD - optymalizacja ciszy...");
  const speechSegments: any = await runSileroVAD(transcribeFilePath, options.signal);
  if (DEBUG && speechSegments) {
    console.log(`[audioPipeline] Silero VAD detected ${speechSegments.length} speech segment(s).`);
  }

  try {
  const fileSize = fs.statSync(transcribeFilePath).size;
  const isLargeFile = fileSize > MAX_FILE_SIZE_BYTES;
  if (isLargeFile) {
    console.log(`[audioPipeline] File size ${(fileSize / 1024 / 1024).toFixed(1)} MB > limit — will process in chunks.`);
  }

  const contextPrompt = buildWhisperPrompt({
    meetingTitle: options.meetingTitle,
    participants: options.participants,
    tags: options.tags,
    vocabulary: options.vocabulary,
  });

  const whisperFields = {
    model: VERIFICATION_MODEL,
    language: options.language || AUDIO_LANGUAGE,
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
    prompt: contextPrompt,
    temperature: 0,
  };

  notify(40, "Transkrypcja AI rozkłada pętle paczek...");

  // ── Whisper verbose_json (always run — needed for text + timestamps + verification) ──
  let whisperPayload: any = null;
  const modelsToTry = VERIFICATION_MODEL !== "whisper-1"
    ? [VERIFICATION_MODEL, "whisper-1"]
    : ["whisper-1"];

  const reqId = options.requestId || "internal-pipeline";
  const startTranscribe = performance.now();

  for (const model of modelsToTry) {
    const fields = { ...whisperFields, model };
    try {
      if (isLargeFile) {
        const chunkPayloads = await transcribeInChunks(transcribeFilePath, transcribeContentType, fields, options);
        whisperPayload = mergeChunkedPayloads(chunkPayloads);
      } else {
        whisperPayload = await requestAudioTranscription({
          filePath: transcribeFilePath,
          contentType: transcribeContentType,
          fields,
          signal: options.signal,
        });
      }
      if (DEBUG) console.log(`[audioPipeline] Transcription succeeded with model: ${model}`);
      break; // success — stop trying fallbacks
    } catch (error) {
      console.error(`[audioPipeline] Transcription failed with model ${model}:`, error.message);
      if (model === modelsToTry[modelsToTry.length - 1]) {
        console.error("[audioPipeline] All transcription models exhausted.");
      }
    }
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
      diarization = await diarizeFromTranscript(verificationSegments);
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
    throw new Error("Model STT nie zwrocil zadnych segmentow transkrypcji.");
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

  return {
    providerId: "openai-audio-pipeline",
    providerLabel: "OpenAI STT + diarization",
    pipelineStatus: "completed",
    diarization: {
      speakerNames: identifiedNames,
      speakerCount: diarization.speakerCount,
      confidence: verificationResult.confidence,
      text: diarization.text,
    },
    // Post-processing pipeline: hallucination removal → short-segment merging → LLM correction
    segments: await (async () => {
      notify(90, "Czyszczenie halucynacji AI za sprawą hybrydowej analizy WavLM...");
      const withoutHallucinations = verificationResult.verifiedSegments
        .filter((seg) => !isHallucination(seg.text));
      if (DEBUG && withoutHallucinations.length < verificationResult.verifiedSegments.length) {
        console.log(`[audioPipeline] Hallucination filter removed ${verificationResult.verifiedSegments.length - withoutHallucinations.length} segment(s).`);
      }
      const merged = mergeShortSegments(withoutHallucinations);
      return correctTranscriptWithLLM(merged, options);
    })(),
    speakerNames: identifiedNames,
    speakerCount: diarization.speakerCount,
    confidence: verificationResult.confidence,
    reviewSummary: {
      needsReview: verificationResult.verifiedSegments.filter((segment) => segment.verificationStatus === "review")
        .length,
      approved: verificationResult.verifiedSegments.filter((segment) => segment.verificationStatus === "verified")
        .length,
    },
  };
  } finally {
    if (prepPath) { try { fs.unlinkSync(prepPath); } catch (_) {} }
  }
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
        prompt: WHISPER_PROMPT,
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

  const schema = '{"speakerCount":2,"speakerLabels":{"0":"Adam","1":"Marcin"},"summary":"...","decisions":["..."],"actionItems":["..."],"tasks":[{"title":"...","owner":"...","sourceQuote":"...","priority":"medium","tags":[]}],"followUps":["..."],"answersToNeeds":[{"need":"...","answer":"..."}],"suggestedTags":["tag1"],"meetingType":"planning","energyLevel":"medium","openQuestions":[{"question":"...","askedBy":"Speaker X"}],"risks":[{"risk":"...","severity":"high"}],"blockers":["..."],"participantInsights":[{"speaker":"Adam","mainTopic":"...","stance":"proactive","talkRatio":0.6,"personality":{"D":70,"I":50,"S":40,"C":80},"needs":["..."],"concerns":["..."],"sentimentScore":85}],"keyQuotes":[{"quote":"...","speaker":"Adam","why":"..."}]}';

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
  normalizeRecording,
  extractSpeakerAudioClip,
  transcribeLiveChunk,
  generateVoiceCoaching,
  diarizeFromTranscript,
  analyzeMeetingWithOpenAI,
  embedTextChunks,
};
