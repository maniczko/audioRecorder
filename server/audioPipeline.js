const fs = require("node:fs");
const path = require("node:path");
const { File } = require("node:buffer");
const crypto = require("node:crypto");
const { matchSpeakerToProfile } = require("./speakerEmbedder");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.VOICELOG_OPENAI_API_KEY || "";
const OPENAI_BASE_URL = String(process.env.VOICELOG_OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
// DIARIZATION_MODEL is kept for reference only — OpenAI does not expose a public
// speaker-diarization model via the transcriptions API. Diarization is handled by
// pyannote (when HF_TOKEN is set) or GPT-4o-mini transcript analysis (see diarizeFromTranscript).
const DIARIZATION_MODEL = process.env.VOICELOG_AUDIO_DIARIZE_MODEL || "whisper-1";
// gpt-4o-transcribe is significantly more accurate than whisper-1 for Polish,
// especially for proper nouns, jargon, and mixed-language utterances.
// Falls back to whisper-1 if VOICELOG_AUDIO_VERIFY_MODEL is set to that.
const VERIFICATION_MODEL = process.env.VOICELOG_AUDIO_VERIFY_MODEL || "gpt-4o-transcribe";
const AUDIO_LANGUAGE = process.env.VOICELOG_AUDIO_LANGUAGE || "pl";
const MAX_FILE_SIZE_BYTES = 24 * 1024 * 1024; // 24 MB — 1 MB below API limit for safety
const CHUNK_DURATION_SECONDS = 1200; // 20-minute chunks for large-file splitting
const CHUNK_OVERLAP_SECONDS = 10;    // 10-second tail overlap to avoid cutting mid-sentence
const AUDIO_PREPROCESS = process.env.VOICELOG_AUDIO_PREPROCESS !== "false";
const TRANSCRIPT_CORRECTION = process.env.VOICELOG_TRANSCRIPT_CORRECTION === "true";
const FFMPEG_BINARY = process.env.FFMPEG_BINARY || "ffmpeg";
const HF_TOKEN = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN || "";
const PYTHON_BINARY = process.env.PYTHON_BINARY || "python";
const DIARIZE_SCRIPT = path.join(__dirname, "diarize.py");
// Whisper prompt primes the model toward Polish business vocabulary.
// Override with VOICELOG_WHISPER_PROMPT env var if needed.
const WHISPER_PROMPT = process.env.VOICELOG_WHISPER_PROMPT
  || "Transkrypcja spotkania biznesowego w języku polskim.";

/**
 * Builds a context-aware Whisper initial_prompt from meeting metadata.
 * Falls back to the global WHISPER_PROMPT when no metadata is provided.
 * Stays within Whisper's ~224-token prompt limit (~900 safe chars).
 *
 * @param {{ meetingTitle?: string, participants?: string[], tags?: string[], vocabulary?: string }} opts
 */
function buildWhisperPrompt({ meetingTitle, participants, tags, vocabulary } = {}) {
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

async function requestAudioTranscription({ filePath, contentType, fields }) {
  if (!OPENAI_API_KEY) {
    throw new Error("Brakuje OPENAI_API_KEY dla serwerowego pipeline audio.");
  }

  const buffer = fs.readFileSync(filePath);
  if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new Error("Plik audio przekracza limit 25 MB dla API transkrypcji.");
  }

  const form = new FormData();
  const filename = path.basename(filePath);
  form.append("file", new File([buffer], filename, { type: contentType || "application/octet-stream" }));

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

  const response = await fetch(`${OPENAI_BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: form,
    signal: AbortSignal.timeout(120000),
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
  const speakerOrder = new Map();
  const speakerNames = {};

  const segments = rawSegments
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
    text: clean(payload?.text || payload?.transcript || segments.map((segment) => segment.text).join(" ")),
  };
}

function normalizeVerificationSegments(payload) {
  const rawSegments = Array.isArray(payload?.segments) ? payload.segments : [];
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

function buildVerificationResult(diarizedSegments, verificationSegments) {
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
function runPyannoteDiarization(audioPath) {
  if (!HF_TOKEN) return null;
  if (!fs.existsSync(DIARIZE_SCRIPT)) {
    console.warn("[audioPipeline] diarize.py not found, skipping pyannote.");
    return null;
  }
  const { spawnSync } = require("node:child_process");
  console.log("[audioPipeline] Running pyannote diarization (may download ~1GB model on first run)...");
  const result = spawnSync(PYTHON_BINARY, [DIARIZE_SCRIPT, audioPath, HF_TOKEN], {
    timeout: 600000, // 10 minutes — first run downloads the model
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    console.warn("[audioPipeline] pyannote spawn error:", result.error.message);
    return null;
  }
  if (result.status !== 0) {
    console.warn("[audioPipeline] pyannote exited with status", result.status, result.stderr?.slice(0, 400));
    return null;
  }
  try {
    const parsed = JSON.parse((result.stdout || "").trim());
    if (parsed?.error) {
      console.warn("[audioPipeline] pyannote returned error:", parsed.error);
      return null;
    }
    if (!Array.isArray(parsed) || !parsed.length) return null;
    const speakers = [...new Set(parsed.map((s) => s.speaker))];
    console.log(`[audioPipeline] pyannote: ${parsed.length} segments, ${speakers.length} speakers: ${speakers.join(", ")}`);
    return parsed;
  } catch (e) {
    console.warn("[audioPipeline] pyannote JSON parse failed:", e.message, result.stdout?.slice(0, 200));
    return null;
  }
}

/**
 * Merges pyannote speaker assignments [{speaker, start, end}] with Whisper text segments.
 * For each Whisper segment, assigns the pyannote speaker with the greatest time overlap.
 */
function mergeWithPyannote(pyannoteSegments, whisperSegments) {
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
 * Splits an audio file into fixed-duration chunks using FFmpeg's segment muxer.
 * Returns [{filePath, offsetSeconds}] for each chunk, sorted by start time.
 * All chunks are 16kHz mono WAV so they can be sent directly to the transcription API.
 */
async function splitAudioIntoChunks(filePath) {
  const { execSync } = require("node:child_process");
  const dir = path.dirname(filePath);
  const base = `_chunk_${crypto.randomUUID().replace(/-/g, "")}_`;
  const chunkPattern = path.join(dir, `${base}%03d.wav`);
  execSync(
    `"${FFMPEG_BINARY}" -y -i "${filePath}" -f segment -segment_time ${CHUNK_DURATION_SECONDS} -reset_timestamps 1 -ar 16000 -ac 1 "${chunkPattern}"`,
    { stdio: "pipe", timeout: 300000 }
  );
  const chunks = fs.readdirSync(dir)
    .filter((f) => f.startsWith(base) && f.endsWith(".wav"))
    .sort()
    .map((f, index) => ({
      filePath: path.join(dir, f),
      offsetSeconds: index * CHUNK_DURATION_SECONDS,
    }));
  return chunks;
}

/**
 * Merges verbose_json payloads from multiple chunks into one,
 * adjusting segment timestamps by chunkOffset.
 */
function mergeChunkedPayloads(payloads) {
  const allSegments = payloads.flatMap(({ payload, offsetSeconds }) => {
    const segs = Array.isArray(payload?.segments) ? payload.segments : [];
    return segs.map((s) => ({
      ...s,
      start: Number(s.start || 0) + offsetSeconds,
      end: Number(s.end || 0) + offsetSeconds,
    }));
  });
  const fullText = payloads.map(({ payload }) => payload?.text || "").join(" ").trim();
  return { segments: allSegments, text: fullText };
}

/**
 * Merges diarized_json payloads from multiple chunks into one,
 * adjusting timestamps and offsetting speaker IDs to keep them globally unique.
 */
function mergeChunkedDiarizedPayloads(payloads) {
  // Collect global speaker order across chunks to produce consistent IDs
  const globalSpeakerOrder = new Map();
  const allSegments = payloads.flatMap(({ payload, offsetSeconds }) => {
    const segs = (
      Array.isArray(payload?.segments) ? payload.segments
      : Array.isArray(payload?.transcript?.segments) ? payload.transcript.segments
      : Array.isArray(payload?.utterances) ? payload.utterances
      : Array.isArray(payload?.transcript?.utterances) ? payload.transcript.utterances
      : []
    );
    return segs
      .map((s) => {
        const rawSpeaker = clean(
          (s.speaker !== undefined && s.speaker !== null ? String(s.speaker) : null)
          || s.speaker_label || s.speaker_id || null
        );
        // Prefix chunk index to create chunk-scoped speaker key so "A" from chunk 0
        // and "A" from chunk 1 may be different people if a new call started.
        // For consecutive chunks of the same recording they are the same speaker.
        // Use raw label without prefix so speaker IDs stay consistent across chunks.
        const speakerKey = rawSpeaker || "unknown";
        if (!globalSpeakerOrder.has(speakerKey)) {
          globalSpeakerOrder.set(speakerKey, globalSpeakerOrder.size);
        }
        return {
          ...s,
          speaker: rawSpeaker,
          start: Number(s.start ?? s.start_time ?? 0) + offsetSeconds,
          end: Number(s.end ?? s.end_time ?? 0) + offsetSeconds,
          text: clean(s.text || s.transcript || s.content),
        };
      })
      .filter((s) => s.text);
  });
  return { segments: allSegments, utterances: allSegments, text: allSegments.map((s) => s.text).join(" ") };
}

/**
 * Transcribes a large audio file by splitting it into chunks, transcribing
 * each chunk separately, and merging results with correct timestamp offsets.
 */
async function transcribeInChunks(filePath, contentType, fields) {
  const chunks = await splitAudioIntoChunks(filePath);
  if (DEBUG) console.log(`[audioPipeline] Split into ${chunks.length} chunks.`);

  const payloads = [];
  try {
    for (const chunk of chunks) {
      const payload = await requestAudioTranscription({
        filePath: chunk.filePath,
        contentType: "audio/wav",
        fields,
      });
      payloads.push({ payload, offsetSeconds: chunk.offsetSeconds });
    }
  } finally {
    // Clean up chunk files regardless of success/failure
    for (const chunk of chunks) {
      try { fs.unlinkSync(chunk.filePath); } catch (_) {}
    }
  }
  return payloads;
}

async function preprocessAudio(filePath) {
  if (!AUDIO_PREPROCESS) return null;
  const { execSync } = require("node:child_process");
  const tmpPath = `${filePath}.prep.wav`;
  try {
    // Filter chain rationale:
    //  afftdn=nf=-20:nr=0.85  — FFT denoiser; nr=0.85 reduces noise without smearing
    //                            consonant transients (s/sz/cz) that matter for Polish.
    //  highpass=f=80           — removes mic rumble / low-frequency handling noise.
    //  lowpass=f=16000         — keeps full 0-16 kHz speech band (Whisper mel filterbank goes to 8 kHz
    //                            but diarization model benefits from higher bandwidth).
    //  dynaudnorm=p=0.9:m=100:s=5 — dynamic loudness normalisation; 100ms RMS window, 5s smoothing.
    //                            Compensates for variable speaker distance without pumping artefacts.
    //                            More robust than loudnorm (no two-pass required) for arbitrary-length files.
    //  aresample=resampler=swr — forces high-quality SWR resampler for the 16 kHz conversion,
    //                            avoiding lower-quality defaults on some FFmpeg builds.
    execSync(
      `"${FFMPEG_BINARY}" -y -i "${filePath}" -af "afftdn=nf=-20:nr=0.85,highpass=f=80,lowpass=f=16000,dynaudnorm=p=0.9:m=100:s=5,aresample=resampler=swr" -ar 16000 -ac 1 "${tmpPath}"`,
      { stdio: "pipe", timeout: 180000 }
    );
    return tmpPath;
  } catch (err) {
    console.warn("[audioPipeline] Audio pre-processing failed, using original file.", err.message);
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
async function diarizeFromTranscript(segments) {
  if (!OPENAI_API_KEY || !segments.length) return null;

  const CHUNK_SIZE = 180;
  const chunk = segments.slice(0, CHUNK_SIZE);

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const lines = chunk
    .map((seg, i) => `[${i}] ${fmt(seg.start ?? 0)}: "${(seg.text || "").replace(/"/g, "'").slice(0, 240)}"`)
    .join("\n");

  const systemPrompt =
    "Jesteś ekspertem od analizy nagrań spotkań. Identyfikujesz mówców na podstawie struktury rozmowy.";

  const userPrompt = [
    "Poniżej transkrypt nagrania. Przypisz każdemu segmentowi mówcę (A, B, C…).",
    "Zmiana mówcy następuje gdy: ktoś odpowiada na pytanie, zmienia się styl mówienia, pojawia się nowa osoba.",
    "Jeśli to monolog jednej osoby — użyj tylko 'A'.",
    "",
    "Transkrypt:",
    lines,
    "",
    'Odpowiedź TYLKO w formacie JSON: {"segments": [{"i": 0, "s": "A"}, {"i": 1, "s": "B"}, ...]}',
    'Każdy segment musi mieć "i" (numer) i "s" (litera mówcy). Brak pomijanych segmentów.',
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
        temperature: 0,
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

async function transcribeRecording(asset, options = {}) {
  const prepPath = await preprocessAudio(asset.file_path);
  const transcribeFilePath = prepPath || asset.file_path;
  const transcribeContentType = prepPath ? "audio/wav" : asset.content_type;

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

  // ── Whisper verbose_json (always run — needed for text + timestamps + verification) ──
  let whisperPayload = null;
  try {
    if (isLargeFile) {
      const chunkPayloads = await transcribeInChunks(transcribeFilePath, transcribeContentType, whisperFields);
      whisperPayload = mergeChunkedPayloads(chunkPayloads);
    } else {
      whisperPayload = await requestAudioTranscription({
        filePath: transcribeFilePath,
        contentType: transcribeContentType,
        fields: whisperFields,
      });
    }
  } catch (error) {
    console.error("[audioPipeline] Whisper pass failed:", error.message);
  }
  const verificationSegments = normalizeVerificationSegments(whisperPayload || {});

  // ── Try pyannote diarization (best quality, requires HF_TOKEN) ──
  let diarization = null;
  if (HF_TOKEN) {
    const pyannoteSegments = runPyannoteDiarization(transcribeFilePath);
    if (pyannoteSegments && verificationSegments.length) {
      if (DEBUG) console.log("[audioPipeline] Using pyannote diarization merged with Whisper transcription.");
      diarization = mergeWithPyannote(pyannoteSegments, verificationSegments);
    }
  }

  // ── Fall back to GPT-4o-mini transcript-based diarization ──
  // NOTE: "gpt-4o-transcribe-diarize" and "diarized_json" do not exist in OpenAI public API.
  // Instead, we use GPT-4o-mini to infer speaker changes from conversation text + timing.
  if (!diarization) {
    if (DEBUG) console.log("[audioPipeline] Pyannote unavailable — using GPT-4o-mini transcript diarization.");
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

  if (!diarization.segments.length) {
    throw new Error("Model STT nie zwrocil zadnych segmentow transkrypcji.");
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
        const { execSync } = require("node:child_process");
        execSync(
          `"${FFMPEG_BINARY}" -y -i "${asset.file_path}" -af "aselect='${selectFilter}',asetpts=N/SR/TB" -ar 16000 -ac 1 "${clipPath}"`,
          { stdio: "pipe", timeout: 30000 }
        );
        const matchedName = await matchSpeakerToProfile(clipPath, voiceProfiles);
        if (matchedName) {
          identifiedNames[speakerId] = matchedName;
        }
      } catch (err) {
        console.warn(`[audioPipeline] Speaker clip extraction failed for speaker ${speakerId}:`, err.message);
      } finally {
        try { require("node:fs").unlinkSync(clipPath); } catch (_) {}
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

async function correctTranscriptWithLLM(segments, options = {}) {
  if (!TRANSCRIPT_CORRECTION && !options.transcriptCorrection) return segments;
  if (!OPENAI_API_KEY) return segments;
  const payload = segments.map((s) => ({ id: s.id, text: s.text }));
  const inputLen = payload.reduce((sum, s) => sum + (s.text?.length || 0), 0);
  try {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
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
    console.warn("[audioPipeline] LLM correction failed, using original segments.", err.message);
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
async function transcribeLiveChunk(filePath, contentType) {
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
    });
    return String(payload?.text || "").trim();
  } catch (err) {
    if (DEBUG) console.warn("[audioPipeline] Live chunk transcription failed:", err.message);
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
 */
async function generateVoiceCoaching(asset, speakerId, segments) {
  if (!OPENAI_API_KEY) throw new Error("Brak klucza OpenAI API.");

  const spkSegs = segments.filter(
    (s) => String(s.speakerId ?? s.speaker ?? "") === String(speakerId)
  );
  if (!spkSegs.length) throw new Error("Brak segmentów dla tego mówcy.");

  // Pick up to 15 segments that have valid numeric timestamps, to build a ≤60 s clip
  const validSegs = spkSegs
    .filter((s) => {
      const t = Number(s.timestamp ?? s.start ?? NaN);
      const e = Number(s.endTimestamp ?? s.end ?? NaN);
      return Number.isFinite(t) && Number.isFinite(e) && e > t && t >= 0;
    })
    .slice(0, 15);

  if (!validSegs.length) throw new Error("Brak segmentów z poprawnymi znacznikami czasu.");

  const clipPath = path.join(
    path.dirname(asset.file_path),
    `coaching_${asset.id}_${String(speakerId).replace(/[^a-zA-Z0-9_-]/g, "")}_clip.wav`
  );
  try {
    const { execSync } = require("node:child_process");
    // Build aselect filter from validated timestamps only (no shell injection risk)
    const selectFilter = validSegs
      .map(
        (s) =>
          `between(t,${Number(s.timestamp ?? s.start).toFixed(3)},${Number(s.endTimestamp ?? s.end).toFixed(3)})`
      )
      .join("+");

    execSync(
      `"${FFMPEG_BINARY}" -y -i "${asset.file_path}" -af "aselect='${selectFilter}',asetpts=N/SR/TB" -t 60 -ar 16000 -ac 1 "${clipPath}"`,
      { stdio: "pipe", timeout: 30000 }
    );

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

async function normalizeRecording(filePath) {
  const { execSync } = require("node:child_process");
  const tmpPath = `${filePath}.norm.tmp`;
  try {
    execSync(
      `"${FFMPEG_BINARY}" -y -i "${filePath}" -af loudnorm=I=-16:TP=-1.5:LRA=11 "${tmpPath}"`,
      { stdio: "pipe", timeout: 120000 }
    );
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
    throw err;
  }
}

module.exports = {
  transcribeRecording,
  normalizeRecording,
  transcribeLiveChunk,
  generateVoiceCoaching,
  diarizeFromTranscript,
};
