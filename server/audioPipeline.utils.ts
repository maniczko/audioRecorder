/**
 * audioPipeline.utils.ts
 *
 * Czyste funkcje pomocnicze dla audioPipeline.ts
 * Wszystkie funkcje są deterministyczne i łatwe do testowania
 *
 * Coverage target: 90%+
 */

import { config } from './config.ts';

// ==================== CONSTANTS ====================

/**
 * Common Whisper hallucinations produced on silence, music, or room noise.
 * Whisper is often overconfident on these — they bypass logprob filtering.
 */
export const HALLUCINATION_PATTERNS = [
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
] as const;

/**
 * Default Whisper prompt for Polish business meetings.
 * Override with VOICELOG_WHISPER_PROMPT env var if needed.
 */
// Intentionally a comma-separated keyword list, NOT a full sentence.
// Full sentences get echoed by Whisper on silence ("prompt bleeding").
export const DEFAULT_WHISPER_PROMPT = 'język polski, spotkanie, dyskusja, pytania, odpowiedzi,';

/**
 * Verification thresholds — tuned for Polish (lower than English defaults).
 * Polish has heavier inflection which produces systematically lower logprob.
 */
export const VERIFY_CONFIDENCE_THRESHOLD = 0.52;
export const VERIFY_SCORE_THRESHOLD = 0.65;

/**
 * Chunk duration in seconds for large audio files.
 * ~17.3 MB wav@16k mono, keeps chunks below the STT limit.
 */
export const CHUNK_DURATION_SECONDS = 540;

/**
 * Overlap between consecutive chunks in seconds.
 * Prevents word loss at chunk boundaries — Whisper sees full context
 * across the seam. Segments from the overlap zone of chunk N+1 are
 * dropped during merge (they were already transcribed by chunk N).
 */
export const CHUNK_OVERLAP_SECONDS = Math.max(
  0,
  Number(config.VOICELOG_CHUNK_OVERLAP_SECONDS || 5)
);

/**
 * Maximum file size for STT API (24 MB — 1 MB below API limit for safety).
 */
export const MAX_FILE_SIZE_BYTES = 24 * 1024 * 1024;

// ==================== TEXT UTILITIES ====================

/**
 * Cleans and trims a string value.
 * @param value - Value to clean
 * @returns Cleaned string or empty string
 */
export function clean(value: any): string {
  return String(value || '').trim();
}

/**
 * Normalizes text for comparison: lowercase, remove punctuation, normalize whitespace.
 * @param value - Text to normalize
 * @returns Normalized text
 */
export function normalizeText(value: string): string {
  return clean(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenizes text into words.
 * @param value - Text to tokenize
 * @returns Array of tokens
 */
export function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Calculates text similarity using Jaccard index on token sets.
 * @param left - First text
 * @param right - Second text
 * @returns Similarity score 0-1
 */
export function textSimilarity(left: string, right: string): number {
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

/**
 * Checks if text has repeated phrases (low lexical diversity).
 * @param text - Text to check
 * @returns True if text has repeated phrases
 */
export function hasRepeatedPhrase(text: string): boolean {
  const tokens = tokenize(text);
  if (tokens.length < 4) {
    return false;
  }
  return new Set(tokens).size <= Math.ceil(tokens.length / 2.4);
}

/**
 * Detects if text matches known Whisper hallucination patterns.
 * @param text - Text to check
 * @returns True if text is likely a hallucination
 */
export function isHallucination(text: string): boolean {
  const t = clean(text);
  if (!t || t.length < 2) return true;
  if (HALLUCINATION_PATTERNS.some((pattern) => pattern.test(t))) return true;
  // Whisper repetition loop: single word/phrase repeated many times (≥4 tokens, ≥58% duplicates)
  if (hasRepeatedPhrase(t)) return true;
  return false;
}

/**
 * Removes consecutive near-duplicate segments (Whisper prompt-bleed hallucinations).
 * When Whisper has nothing to transcribe it echoes the prompt text repeatedly —
 * each echo is a short unique-looking segment that passes per-segment checks.
 * This filter removes a segment whose text is ≥85% similar to any of the 3 preceding segments.
 */
export function removeConsecutiveDuplicates<T extends { text: string }>(segments: T[]): T[] {
  const result: T[] = [];
  for (const seg of segments) {
    const t = clean(seg.text);
    const isDup = result.slice(-3).some((prev) => textSimilarity(clean(prev.text), t) >= 0.85);
    if (!isDup) result.push(seg);
  }
  return result;
}

// ==================== MATH UTILITIES ====================

/**
 * Clamps a value between min and max.
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Calculates average of an array of numbers.
 * @param values - Array of numbers
 * @returns Average value (0 for empty array)
 */
export function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Calculates Levenshtein distance between token arrays.
 */
export function tokenEditDistance(left: string[], right: string[]): number {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
  for (let col = 0; col < cols; col += 1) matrix[0][col] = col;

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const substitutionCost = left[row - 1] === right[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + substitutionCost
      );
    }
  }

  return matrix[left.length][right.length];
}

/**
 * Lightweight WER proxy based on token edit distance.
 * Uses the longer token sequence as denominator to avoid over-optimistic scores.
 */
export function computeWerProxy(referenceText: string, hypothesisText: string): number | null {
  const referenceTokens = tokenize(referenceText);
  const hypothesisTokens = tokenize(hypothesisText);
  const denominator = Math.max(referenceTokens.length, hypothesisTokens.length, 1);

  if (!referenceTokens.length && !hypothesisTokens.length) {
    return 0;
  }

  const distance = tokenEditDistance(referenceTokens, hypothesisTokens);
  return clamp(distance / denominator, 0, 1);
}

/**
 * Parses a number from a string or returns fallback.
 * @param raw - Raw value to parse
 * @param fallback - Fallback value if parsing fails
 * @returns Parsed number or fallback
 */
export function parseDbNumber(raw: any, fallback: number = 0): number {
  if (raw == null || raw === '') return fallback;
  const match = String(raw).match(/-?\d+(?:\.\d+)?/);
  if (!match) return fallback;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// ==================== SEGMENT UTILITIES ====================

/**
 * Merges consecutive short segments from the same speaker.
 * Short segments (< minDuration) are usually sentence fragments.
 *
 * @param segments - Segments to merge
 * @param minDuration - Minimum duration in seconds (default: 1.2)
 * @returns Merged segments
 */
export function mergeShortSegments<
  T extends {
    text: string;
    timestamp: number;
    endTimestamp: number;
    speakerId: string | number;
    verificationScore?: number;
    verificationStatus?: string;
  },
>(segments: T[], minDuration: number = 1.2): T[] {
  if (segments.length < 2) return segments;

  const result: T[] = [];
  let pending: T | null = null;

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
        verificationStatus: [pending.verificationStatus, seg.verificationStatus].includes('review')
          ? 'review'
          : 'verified',
      } as T;
    } else {
      result.push(pending);
      pending = { ...seg };
    }
  }

  if (pending) result.push(pending);
  return result;
}

/**
 * Estimates quality score for transcript text.
 * @param text - Text to evaluate
 * @returns Quality score 0-1
 */
export function estimateQualityScore(text: string): number {
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

/**
 * Parses JSON response safely.
 * @param raw - Raw JSON string
 * @returns Parsed object or empty object
 */
export function parseJsonResponse(raw: string | null | undefined): Record<string, any> {
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// ==================== DIARIZATION UTILITIES ====================

/**
 * Normalizes speaker label to human-readable format.
 * @param label - Raw speaker label
 * @param index - Speaker index
 * @returns Normalized speaker name
 */
export function normalizeSpeakerLabel(label: string, index: number): string {
  const safeLabel = clean(label);
  if (!safeLabel || /^[A-Z]$/i.test(safeLabel) || /^speaker[_ -]?\w*$/i.test(safeLabel)) {
    return `Speaker ${index + 1}`;
  }
  return safeLabel;
}

/**
 * Extracts raw words from STT payload.
 * @param payload - STT response payload
 * @returns Array of word objects
 */
export function getRawWords(payload: any): any[] {
  if (Array.isArray(payload?.words)) return payload.words;
  if (Array.isArray(payload?.transcript?.words)) return payload.transcript.words;
  if (Array.isArray(payload?.results?.words)) return payload.results.words;
  return [];
}

/**
 * Synthesizes transcript segments from word-level timestamps.
 * @param payload - STT response with words
 * @returns Segments and full text
 */
export function synthesizeSegmentsFromWords(payload: any): {
  segments: any[];
  text: string;
} {
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
    const segments: any[] = [];
    let current: { words: any[] } | null = null;

    const flushCurrent = () => {
      if (!current || !current.words.length) return;
      const joinedText = current.words
        .map((word: any) => word.text)
        .join(' ')
        .trim();
      if (!joinedText) return;
      const start = current.words[0].start;
      const lastWord = current.words[current.words.length - 1];
      const end = Math.max(start + 0.8, lastWord.end);
      segments.push({
        id: `seg_${cryptoRandomId()}`,
        text: joinedText,
        timestamp: start,
        endTimestamp: end,
        speakerId: 0,
        rawSpeakerLabel: 'speaker_0',
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
      text: segments
        .map((segment) => segment.text)
        .join(' ')
        .trim(),
    };
  }

  const rawText = clean(payload?.text || payload?.transcript || payload?.results?.text);
  if (!rawText) {
    return { segments: [], text: '' };
  }

  const estimatedDuration = Math.max(1.5, tokenize(rawText).length * 0.42);
  return {
    segments: [
      {
        id: `seg_${cryptoRandomId()}`,
        text: rawText,
        timestamp: 0,
        endTimestamp: estimatedDuration,
        speakerId: 0,
        rawSpeakerLabel: 'speaker_0',
      },
    ],
    text: rawText,
  };
}

/**
 * Normalizes diarized segments from various STT formats.
 * @param payload - STT response with segments
 * @returns Normalized segments with speaker info
 */
export function normalizeDiarizedSegments(payload: any): {
  segments: any[];
  speakerNames: Record<string, string>;
  speakerCount: number;
  text: string;
} {
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
  const speakerOrder = new Map<string, number>();
  const speakerNames: Record<string, string> = {};

  const segments = (rawSegments.length ? rawSegments : synthesized?.segments || [])
    .map((segment: any, index: number) => {
      const text = clean(segment.text || segment.transcript || segment.content);
      if (!text) {
        return null;
      }

      // NOTE: segment.speaker can be numeric 0 which is falsy — must use explicit null check
      const rawSpeakerLabel = clean(
        (segment.speaker !== undefined && segment.speaker !== null
          ? String(segment.speaker)
          : null) ||
          (segment.speaker_label !== undefined && segment.speaker_label !== null
            ? String(segment.speaker_label)
            : null) ||
          (segment.speakerId !== undefined && segment.speakerId !== null
            ? String(segment.speakerId)
            : null) ||
          (segment.speaker_id !== undefined && segment.speaker_id !== null
            ? String(segment.speaker_id)
            : null) ||
          `speaker_${index}`
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
        id: clean(segment.id) || `seg_${cryptoRandomId()}`,
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
    text: clean(
      payload?.text ||
        payload?.transcript ||
        synthesized?.text ||
        segments.map((segment: any) => segment.text).join(' ')
    ),
  };
}

/**
 * Normalizes verification segments with timestamps and probabilities.
 * @param payload - Verification response payload
 * @returns Normalized verification segments
 */
export function normalizeVerificationSegments(payload: any): any[] {
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
    .map((segment: any) => ({
      text: clean(segment.text || segment.transcript),
      start: Number(segment.start ?? segment.start_time ?? 0) || 0,
      end: Number(segment.end ?? segment.end_time ?? 0) || 0,
      avgLogprob: Number.isFinite(Number(segment.avg_logprob)) ? Number(segment.avg_logprob) : null,
      noSpeechProb: Number.isFinite(Number(segment.no_speech_prob))
        ? Number(segment.no_speech_prob)
        : null,
    }))
    .filter((segment: any) => segment.text);
}

/**
 * Calculates overlap in seconds between two time segments.
 * @param left - First segment
 * @param right - Second segment
 * @returns Overlap in seconds (0 if no overlap)
 */
export function overlapSeconds(left: any, right: any): number {
  return Math.max(
    0,
    Math.min(left.endTimestamp, right.end) - Math.max(left.timestamp, right.start)
  );
}

/**
 * Evaluates a segment against verification pass segments.
 * @param segment - Segment to evaluate
 * @param verificationSegments - Verification segments to compare against
 * @returns Verification result with scores and reasons
 */
export function evaluateAgainstVerificationPass(
  segment: any,
  verificationSegments: any[]
): {
  whisperConfidence: number;
  alignmentScore: number;
  comparisonText: string;
  reasons: string[];
} {
  const overlaps = verificationSegments.filter(
    (candidate) => overlapSeconds(segment, candidate) > 0.08
  );

  if (!overlaps.length) {
    return {
      whisperConfidence: 0.42,
      alignmentScore: 0.34,
      comparisonText: '',
      reasons: ['brak nakladajacego sie fragmentu w przebiegu weryfikujacym'],
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

  const totalOverlap = weightedLogprobParts.reduce(
    (sum: number, item: any) => sum + item.overlap,
    0
  );
  const whisperConfidence = totalOverlap
    ? clamp(
        weightedLogprobParts.reduce((sum: number, item: any) => sum + item.weighted, 0) /
          totalOverlap,
        0,
        1
      )
    : 0.68;

  const comparisonText = overlaps.map((candidate) => candidate.text).join(' ');
  const alignmentScore = textSimilarity(segment.text, comparisonText);
  const reasons: string[] = [];

  if (whisperConfidence < VERIFY_CONFIDENCE_THRESHOLD) {
    reasons.push('niska pewnosc ASR w przebiegu weryfikujacym');
  }
  if (alignmentScore < 0.45) {
    reasons.push('tekst rozni sie od przebiegu weryfikujacego');
  }
  if (overlaps.some((candidate) => Number(candidate.noSpeechProb || 0) > 0.55)) {
    reasons.push('fragment przypomina cisze lub szum');
  }

  return {
    whisperConfidence,
    alignmentScore,
    comparisonText,
    reasons,
  };
}

/**
 * Builds verification result with scored segments.
 * @param diarizedSegments - Segments from diarization
 * @param verificationSegments - Segments from verification pass
 * @returns Verified segments with scores and overall confidence
 */
export function buildVerificationResult(
  diarizedSegments: any[],
  verificationSegments: any[]
): {
  verifiedSegments: any[];
  confidence: number;
} {
  const verifiedSegments = diarizedSegments.map((segment, index) => {
    const qualityScore = estimateQualityScore(segment.text);
    const verification = evaluateAgainstVerificationPass(segment, verificationSegments);
    const previousSegment = diarizedSegments[index - 1];
    const reasons = [...verification.reasons];

    if (previousSegment && normalizeText(previousSegment.text) === normalizeText(segment.text)) {
      reasons.push('duplikat poprzedniego fragmentu');
    }

    if (segment.text.length < 8) {
      reasons.push('bardzo krotki fragment');
    }

    if (hasRepeatedPhrase(segment.text)) {
      reasons.push('powtarzajace sie slowa');
    }

    const verificationScore = clamp(
      qualityScore * 0.22 +
        verification.whisperConfidence * 0.38 +
        verification.alignmentScore * 0.4,
      0,
      1
    );

    return {
      ...segment,
      rawConfidence: verification.whisperConfidence,
      verificationScore,
      verificationStatus: verificationScore >= VERIFY_SCORE_THRESHOLD ? 'verified' : 'review',
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
 * Builds empty transcript result with diagnostics.
 * @param reason - Reason for empty transcript
 * @param transcriptionDiagnostics - Diagnostic information
 * @param audioQuality - Audio quality metrics
 * @returns Empty transcript result object
 */
export function buildEmptyTranscriptResult(
  reason:
    | 'no_segments_from_stt'
    | 'segments_removed_by_vad'
    | 'segments_removed_as_hallucinations'
    | 'all_chunks_discarded_as_too_small',
  transcriptionDiagnostics: any = {},
  audioQuality: any = null
): any {
  // Szczegółowe komunikaty błędów
  const errorMessages: Record<string, { user: string; detailed: string }> = {
    no_segments_from_stt: {
      user: 'API transkrypcji nie zwróciło żadnych segmentów.',
      detailed: 'Sprawdź jakość audio lub spróbuj innego formatu.',
    },
    segments_removed_by_vad: {
      user: 'Wykryto ciszę - segmenty zostały usunięte.',
      detailed: 'VAD usunął wszystkie segmenty jako ciszę.',
    },
    segments_removed_as_hallucinations: {
      user: 'Wykryto zniekształcenia - transkrypcja odrzucona.',
      detailed: `WER: ${transcriptionDiagnostics?.wer || 'N/A'}.`,
    },
    all_chunks_discarded_as_too_small: {
      user: 'Plik jest za krótki do przetworzenia.',
      detailed: 'Wszystkie chunki zostały odrzucone jako za małe.',
    },
  };

  const messages = errorMessages[reason] || {
    user: 'Nie wykryto wypowiedzi w nagraniu.',
    detailed: 'Nieznany błąd przetwarzania.',
  };

  return {
    providerId: 'stt-pipeline',
    providerLabel: 'STT + diarization',
    pipelineStatus: 'completed',
    transcriptOutcome: 'empty' as const,
    emptyReason: reason,
    userMessage: messages.user,
    audioQuality,
    transcriptionDiagnostics: {
      ...transcriptionDiagnostics,
      detailedReason: messages.detailed,
      timestamp: new Date().toISOString(),
      suggestions: [
        'Sprawdź jakość nagrania (głośność, szumy tła)',
        'Upewnij się że plik jest w obsługiwanym formacie (WAV, MP3, FLAC, WebM)',
        'Jeśli używasz API, sprawdź czy klucz jest poprawny i masz dostępne środki',
        'Spróbuj nagrać ponownie z lepszym mikrofonem',
        'Dla cichych nagrań zwiększ gain w ustawieniach mikrofonu',
      ].filter((_, i) => i < 3),
    },
    diarization: {
      speakerNames: {},
      speakerCount: 0,
      confidence: 0,
      text: '',
      transcriptOutcome: 'empty',
      emptyReason: reason,
      userMessage: messages.user,
      audioQuality,
      transcriptionDiagnostics,
    },
    segments: [],
    speakerNames: {},
    speakerCount: 0,
    confidence: 0,
    reviewSummary: {
      needsReview: 0,
      approved: 0,
    },
  };
}

// ==================== PROMPT BUILDING ====================

/**
 * Builds a context-aware Whisper initial_prompt from meeting metadata.
 * Falls back to the default prompt when no metadata is provided.
 * Stays within Whisper's ~224-token prompt limit (~900 safe chars).
 *
 * @param options - Meeting metadata
 * @param options.meetingTitle - Meeting title
 * @param options.participants - List of participants
 * @param options.tags - Meeting tags/topics
 * @param options.vocabulary - Custom vocabulary
 * @param options.basePrompt - Base prompt to use (default: DEFAULT_WHISPER_PROMPT)
 * @returns Context-aware prompt for Whisper
 */
export function buildWhisperPrompt(
  options: {
    meetingTitle?: string;
    participants?: string[];
    tags?: string[];
    vocabulary?: string;
    basePrompt?: string;
  } = {}
): string {
  const {
    meetingTitle,
    participants,
    tags,
    vocabulary,
    basePrompt = DEFAULT_WHISPER_PROMPT,
  } = options || {};

  const parts = [basePrompt];

  if (meetingTitle) {
    parts.push(`Spotkanie: ${String(meetingTitle).trim().slice(0, 80)}.`);
  }

  if (Array.isArray(participants) && participants.length) {
    const names = participants
      .slice(0, 8)
      .map((p) => String(p).trim())
      .filter(Boolean)
      .join(', ');
    if (names) parts.push(`Uczestnicy: ${names}.`);
  }

  if (Array.isArray(tags) && tags.length) {
    const tagList = tags
      .slice(0, 6)
      .map((t) => String(t).trim())
      .filter(Boolean)
      .join(', ');
    if (tagList) parts.push(`Tematy: ${tagList}.`);
  }

  if (vocabulary) {
    parts.push(String(vocabulary).trim().slice(0, 200));
  }

  return parts.join(' ').slice(0, 900);
}

// ==================== HELPERS ====================

/**
 * Generates a random ID for segments (crypto-safe alternative to crypto.randomUUID).
 * This is a pure function for testing purposes.
 * @returns Random segment ID
 */
export function cryptoRandomId(): string {
  // In production, use crypto.randomUUID() from Node.js
  // For testing, this provides deterministic behavior
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  // Fallback for tests
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Derives ffprobe binary name from ffmpeg binary.
 * @param ffmpegBinary - FFmpeg binary name/path
 * @returns FFprobe binary name/path
 */
export function deriveFfprobeBinary(ffmpegBinary: string): string {
  if (/ffmpeg(?:\.exe)?$/i.test(String(ffmpegBinary || ''))) {
    return String(ffmpegBinary).replace(/ffmpeg((?:\.exe)?)$/i, 'ffprobe$1');
  }
  return 'ffprobe';
}
