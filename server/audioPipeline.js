const fs = require("node:fs");
const path = require("node:path");
const { File } = require("node:buffer");
const crypto = require("node:crypto");
const { matchSpeakerToProfile } = require("./speakerEmbedder");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.VOICELOG_OPENAI_API_KEY || "";
const OPENAI_BASE_URL = String(process.env.VOICELOG_OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const DIARIZATION_MODEL = process.env.VOICELOG_AUDIO_DIARIZE_MODEL || "gpt-4o-transcribe-diarize";
const VERIFICATION_MODEL = process.env.VOICELOG_AUDIO_VERIFY_MODEL || "whisper-1";
const AUDIO_LANGUAGE = process.env.VOICELOG_AUDIO_LANGUAGE || "pl";
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const AUDIO_PREPROCESS = process.env.VOICELOG_AUDIO_PREPROCESS !== "false";
const TRANSCRIPT_CORRECTION = process.env.VOICELOG_TRANSCRIPT_CORRECTION === "true";
const FFMPEG_BINARY = process.env.FFMPEG_BINARY || "ffmpeg";

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
      : [];
  const speakerOrder = new Map();
  const speakerNames = {};

  const segments = rawSegments
    .map((segment, index) => {
      const text = clean(segment.text || segment.transcript || segment.content);
      if (!text) {
        return null;
      }

      const rawSpeakerLabel = clean(
        segment.speaker || segment.speaker_label || segment.speakerId || segment.speaker_id || `speaker_${index}`
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

  if (whisperConfidence < 0.58) {
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
      verificationStatus: verificationScore >= 0.72 ? "verified" : "review",
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

async function preprocessAudio(filePath) {
  if (!AUDIO_PREPROCESS) return null;
  const { execSync } = require("node:child_process");
  const tmpPath = `${filePath}.prep.wav`;
  try {
    execSync(
      `"${FFMPEG_BINARY}" -y -i "${filePath}" -af "afftdn=nf=-25,highpass=f=80,lowpass=f=8000" -ar 16000 -ac 1 "${tmpPath}"`,
      { stdio: "pipe", timeout: 120000 }
    );
    return tmpPath;
  } catch (err) {
    console.warn("Audio pre-processing failed, using original file.", err.message);
    try { fs.unlinkSync(tmpPath); } catch (_) {}
    return null;
  }
}

async function transcribeRecording(asset, options = {}) {
  const prepPath = await preprocessAudio(asset.file_path);
  const transcribeFilePath = prepPath || asset.file_path;
  const transcribeContentType = prepPath ? "audio/wav" : asset.content_type;

  try {
  const diarizedPayload = await requestAudioTranscription({
    filePath: transcribeFilePath,
    contentType: transcribeContentType,
    fields: {
      model: DIARIZATION_MODEL,
      language: options.language || AUDIO_LANGUAGE,
      response_format: "diarized_json",
      chunking_strategy: "auto",
    },
  });

  const diarization = normalizeDiarizedSegments(diarizedPayload);
  if (!diarization.segments.length) {
    throw new Error("Model STT nie zwrocil zadnych segmentow transkrypcji.");
  }
  let verificationSegments = [];

  try {
    const verificationPayload = await requestAudioTranscription({
      filePath: transcribeFilePath,
      contentType: transcribeContentType,
      fields: {
        model: VERIFICATION_MODEL,
        language: options.language || AUDIO_LANGUAGE,
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
      },
    });
    verificationSegments = normalizeVerificationSegments(verificationPayload);
  } catch (error) {
    console.error("Verification pass failed, falling back to diarized segments only.", error);
  }

  const verificationResult = buildVerificationResult(diarization.segments, verificationSegments);

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
    segments: await correctTranscriptWithLLM(verificationResult.verifiedSegments, options),
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

async function normalizeRecording(filePath) {
  const { execSync } = require("node:child_process");
  const tmpPath = `${filePath}.norm.tmp`;
  try {
    execSync(
      `ffmpeg -y -i "${filePath}" -af loudnorm=I=-16:TP=-1.5:LRA=11 "${tmpPath}"`,
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
};
