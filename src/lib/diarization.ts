import { clamp } from './storage';

// ── Diarization tuning constants ────────────────────────────────────────────
// Maximum number of distinct speaker clusters the browser-side diarizer will create.
// Increase if you expect meetings with more than 4 participants.
const MAX_SPEAKER_CLUSTERS = 4;

// Distance threshold above which a new cluster is created for a signature-bearing segment.
// Lower = more sensitive to voice differences (more clusters). Higher = fewer clusters.
const CLUSTER_CREATE_DISTANCE = 0.17;

// Minimum gap (seconds) between segments before a new speaker cluster may be opened
// when the spectral distance is above CLUSTER_CREATE_DISTANCE.
const CLUSTER_GAP_THRESHOLD_SECONDS = 1.2;

// Smoothing: single-segment speaker change is reverted if both neighbours are the same
// speaker AND both gaps are below this threshold (seconds).
const SMOOTH_GAP_THRESHOLD_SECONDS = 2.5;

// Gap-based fallback: if a no-signature segment is more than this many seconds after
// the previous segment, try the next speaker ID (capped at MAX_SPEAKER_CLUSTERS - 1).
const GAP_NEW_SPEAKER_SECONDS = 2.5;

// Verification score below which a segment is flagged for review (browser-side pipeline).
const VERIFY_SCORE_THRESHOLD = 0.7;

// Minimum acoustic energy below which a segment is penalised in quality scoring.
const MIN_ENERGY_THRESHOLD = 0.035;

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageSignature(signatures) {
  if (!signatures.length) {
    return null;
  }

  const keys = Object.keys(signatures[0]);
  return keys.reduce((result, key) => {
    result[key] = average(signatures.map((signature) => signature[key] || 0));
    return result;
  }, {});
}

function distance(left, right) {
  if (!left || !right) {
    return Number.POSITIVE_INFINITY;
  }

  const weights = {
    energy: 0.18,
    centroid: 0.28,
    spread: 0.2,
    lowBand: 0.14,
    midBand: 0.12,
    highBand: 0.08,
  };

  return Math.sqrt(
    Object.entries(weights).reduce((sum, [key, weight]) => {
      const delta = (left[key] || 0) - (right[key] || 0);
      return sum + delta * delta * weight;
    }, 0)
  );
}

export function summarizeSpectrum(data: any) {
  const values = Array.from(data || []) as number[];
  if (!values.length) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + (value as number), 0) || 1;
  const normalized = values.map((value) => (value as number) / 255);
  const centroid =
    normalized.reduce((sum, value, index) => sum + value * index, 0) /
    (normalized.reduce((sum, value) => sum + (value as number), 0) || 1);
  const centroidNorm = centroid / normalized.length;

  const spread = Math.sqrt(
    normalized.reduce(
      (sum, value, index) => sum + value * (index - centroid) * (index - centroid),
      0
    ) / (normalized.reduce((sum, value) => sum + (value as number), 0) || 1)
  );

  const bandSize = Math.max(1, Math.floor(values.length / 3));
  const lowBand =
    values.slice(0, bandSize).reduce((sum, value) => sum + (value as number), 0) / total;
  const midBand =
    values.slice(bandSize, bandSize * 2).reduce((sum, value) => sum + (value as number), 0) / total;
  const highBand =
    values.slice(bandSize * 2).reduce((sum, value) => sum + (value as number), 0) / total;

  return {
    energy: average(normalized),
    centroid: clamp(centroidNorm, 0, 1),
    spread: clamp(spread / normalized.length, 0, 1),
    lowBand: clamp(lowBand, 0, 1),
    midBand: clamp(midBand, 0, 1),
    highBand: clamp(highBand, 0, 1),
  };
}

export function signatureAroundTimestamp(timeline, timestamp) {
  const safeTimestamp = Number(timestamp || 0);
  const relevant = timeline.filter(
    (frame) =>
      frame.timestamp >= Math.max(0, safeTimestamp - 2.25) &&
      frame.timestamp <= safeTimestamp + 0.35
  );

  if (!relevant.length) {
    return null;
  }

  return averageSignature(relevant.map((frame) => frame.signature).filter(Boolean));
}

function smoothAssignments(segments) {
  return segments.map((segment, index, collection) => {
    const previous = collection[index - 1];
    const next = collection[index + 1];

    if (!previous || !next) {
      return segment;
    }

    if (previous.speakerId === next.speakerId && previous.speakerId !== segment.speakerId) {
      const gapToPrevious = segment.timestamp - previous.timestamp;
      const gapToNext = next.timestamp - segment.timestamp;
      if (
        gapToPrevious < SMOOTH_GAP_THRESHOLD_SECONDS &&
        gapToNext < SMOOTH_GAP_THRESHOLD_SECONDS
      ) {
        return { ...segment, speakerId: previous.speakerId };
      }
    }

    return segment;
  });
}

function repeatedPhrase(text) {
  const words = String(text || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length < 4) {
    return false;
  }

  const uniqueWords = new Set(words);
  return uniqueWords.size <= Math.ceil(words.length / 2.4);
}

function verifySegment(segment, previousSegment) {
  let score =
    typeof segment.rawConfidence === 'number' && segment.rawConfidence > 0
      ? segment.rawConfidence
      : 0.76;
  const reasons: string[] = [];
  const cleanText = String(segment.text || '').trim();

  if (!cleanText) {
    score -= 0.5;
    reasons.push('brak rozpoznanego tekstu');
  }

  if (cleanText.length < 8) {
    score -= 0.12;
    reasons.push('bardzo krotki fragment');
  }

  if (/^(yyy+|eee+|hmm+|mmm+)$/i.test(cleanText)) {
    score -= 0.22;
    reasons.push('brzmi jak wypelnienie lub szum');
  }

  if (repeatedPhrase(cleanText)) {
    score -= 0.16;
    reasons.push('powtarzajace sie slowa');
  }

  if (!segment.signature) {
    score -= 0.1;
    reasons.push('brak sygnatury akustycznej');
  }

  if (segment.signature?.energy < MIN_ENERGY_THRESHOLD) {
    score -= 0.12;
    reasons.push('niska energia dzwieku');
  }

  if (previousSegment && previousSegment.text?.trim().toLowerCase() === cleanText.toLowerCase()) {
    score -= 0.14;
    reasons.push('duplikat poprzedniego fragmentu');
  }

  const verificationScore = clamp(score, 0, 1);
  return {
    ...segment,
    verificationScore,
    verificationStatus: verificationScore >= VERIFY_SCORE_THRESHOLD ? 'verified' : 'review',
    verificationReasons: reasons,
  };
}

export function diarizeSegments(segments) {
  if (!segments.length) {
    return { segments: [], speakerCount: 0, speakerNames: {}, confidence: 0 };
  }

  const clusters: { id: number; centroid: any; sampleCount: number }[] = [];
  const annotated = segments.map((segment, index) => {
    const previous = segments[index - 1];
    const signature = segment.signature || null;
    let clusterId = 0;

    if (!clusters.length) {
      clusters.push({ id: 0, centroid: signature, sampleCount: signature ? 1 : 0 });
    } else if (!signature) {
      const previousGap = previous ? segment.timestamp - previous.timestamp : 0;
      clusterId =
        previousGap > CLUSTER_GAP_THRESHOLD_SECONDS && clusters.length < MAX_SPEAKER_CLUSTERS
          ? clusters.length
          : clusters[Math.max(0, clusters.length - 1)].id;
      if (clusterId === clusters.length) {
        clusters.push({ id: clusterId, centroid: null, sampleCount: 0 });
      }
    } else {
      const ranked = clusters
        .map((cluster) => ({ cluster, score: distance(signature, cluster.centroid) }))
        .sort((left, right) => left.score - right.score);
      const best = ranked[0];
      const previousGap = previous ? segment.timestamp - previous.timestamp : 0;
      const shouldCreateCluster =
        (!best || best.score > CLUSTER_CREATE_DISTANCE) &&
        previousGap > CLUSTER_GAP_THRESHOLD_SECONDS &&
        clusters.length < MAX_SPEAKER_CLUSTERS;

      if (shouldCreateCluster) {
        clusterId = clusters.length;
        clusters.push({ id: clusterId, centroid: signature, sampleCount: 1 });
      } else {
        clusterId = best?.cluster.id ?? 0;
        const cluster = clusters.find((item) => item.id === clusterId);
        if (cluster) {
          const safeCount = Math.max(1, cluster.sampleCount);
          cluster.centroid =
            averageSignature(
              [cluster.centroid, signature]
                .filter(Boolean)
                .flatMap((item) => Array(safeCount).fill(item).slice(0, 1))
            ) || signature;
          cluster.sampleCount += 1;
        }
      }
    }

    return {
      ...segment,
      speakerId: clusterId,
    };
  });

  const smoothed = smoothAssignments(annotated);
  const speakerOrder: number[] = [];
  const relabelled = smoothed.map((segment) => {
    if (!speakerOrder.includes(segment.speakerId)) {
      speakerOrder.push(segment.speakerId);
    }

    return {
      ...segment,
      speakerId: speakerOrder.indexOf(segment.speakerId),
    };
  });

  const speakerNames = speakerOrder.reduce((result, _speakerId, index) => {
    result[String(index)] = `Speaker ${index + 1}`;
    return result;
  }, {});

  const withFallbackGaps = relabelled.map((segment, index, collection) => {
    if (segment.signature || index === 0) {
      return segment;
    }

    const previous = collection[index - 1];
    return {
      ...segment,
      speakerId:
        segment.timestamp - previous.timestamp > GAP_NEW_SPEAKER_SECONDS
          ? Math.min(previous.speakerId + 1, MAX_SPEAKER_CLUSTERS - 1)
          : previous.speakerId,
    };
  });

  const confidence = average(withFallbackGaps.map((segment) => (segment.signature ? 0.82 : 0.48)));

  return {
    segments: withFallbackGaps,
    speakerCount: new Set(withFallbackGaps.map((segment) => segment.speakerId)).size,
    speakerNames,
    confidence,
  };
}

export function verifyRecognizedSegments(segments) {
  return (Array.isArray(segments) ? segments : []).map((segment, index, collection) =>
    verifySegment(segment, collection[index - 1])
  );
}
