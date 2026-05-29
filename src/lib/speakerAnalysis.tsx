/**
 * Text-based speaking style analysis derived from transcript segments.
 * Complements audio-based coaching (task 078) with metrics computable
 * without an API call — WPM, talk time, turn count, filler word rate.
 */

// Common Polish filler words / hesitation markers
const FILLER_WORDS_PL = new Set([
  'ee',
  'eee',
  'yyy',
  'yyyy',
  'yy',
  'um',
  'uh',
  'hmm',
  'hm',
  'znaczy',
  'jakby',
  'właśnie',
  'tego',
  'wiesz',
  'rozumiesz',
  'no',
  'tak',
  'okej',
  'okay',
  'niee',
  'właśnie',
]);

/**
 * Computes per-speaker speaking style metrics from transcript segments.
 *
 * @param {Array<{speakerId: string|number, text: string, timestamp: number, endTimestamp: number}>} transcript
 * @param {Object} displaySpeakerNames  map speakerId → human name
 * @returns {Array<SpeakerStats>}
 */
interface SpeakerStat {
  speakerId: string;
  speakerName: string;
  totalWords: number;
  speakingSeconds: number;
  wpm: number;
  turnCount: number;
  fillerCount: number;
  fillerRate: number;
  avgTurnSeconds: number;
}

const MAX_REASONABLE_SPEAKERS = 16;
const SUSPICIOUS_NUMERIC_SPEAKER_ID = 32;
const NOISY_SINGLE_TURN_RATIO = 0.7;

function isSuspiciousNumericSpeakerId(raw: string) {
  if (!/^\d+$/.test(raw)) return false;
  return Number(raw) >= SUSPICIOUS_NUMERIC_SPEAKER_ID;
}

function shouldCollapseNoisySpeakerIds(bySpeaker: Map<string, any[]>) {
  if (bySpeaker.size <= MAX_REASONABLE_SPEAKERS) return false;

  const ids = [...bySpeaker.keys()];
  const suspiciousIds = ids.filter(isSuspiciousNumericSpeakerId).length;
  const singleTurnIds = ids.filter((id) => (bySpeaker.get(id)?.length || 0) <= 1).length;

  return (
    suspiciousIds / ids.length >= NOISY_SINGLE_TURN_RATIO ||
    singleTurnIds / ids.length >= NOISY_SINGLE_TURN_RATIO
  );
}

function displayNameForSpeaker(speakerId: string, displaySpeakerNames: Record<string, string>) {
  return (
    displaySpeakerNames?.[speakerId] ||
    (speakerId === 'unknown' ? 'Speaker do weryfikacji' : `Speaker ${speakerId}`)
  );
}

export function analyzeSpeakingStyle(
  transcript: any,
  displaySpeakerNames: Record<string, string> = {}
): SpeakerStat[] {
  if (!Array.isArray(transcript) || !transcript.length) return [];

  // Group segments by speaker
  const bySpeaker = new Map<string, any[]>();
  for (const seg of transcript) {
    const sid = String(seg.speakerId ?? 'unknown');
    if (!bySpeaker.has(sid)) bySpeaker.set(sid, []);
    bySpeaker.get(sid)!.push(seg);
  }

  if (shouldCollapseNoisySpeakerIds(bySpeaker)) {
    const collapsed = new Map<string, any[]>();
    for (const [speakerId, segs] of bySpeaker) {
      const normalizedId = displaySpeakerNames?.[speakerId] ? speakerId : 'unknown';
      collapsed.set(normalizedId, [...(collapsed.get(normalizedId) || []), ...segs]);
    }
    bySpeaker.clear();
    for (const [speakerId, segs] of collapsed) bySpeaker.set(speakerId, segs);
  }

  const results: SpeakerStat[] = [];

  for (const [speakerId, segs] of bySpeaker) {
    // Total word count
    const totalWords = segs.reduce(
      (n, s) => n + (s.text || '').split(/\s+/).filter(Boolean).length,
      0
    );

    // Speaking time (sum of segment durations that have valid timestamps)
    let speakingSeconds = 0;
    for (const s of segs) {
      const dur = Number(s.endTimestamp ?? 0) - Number(s.timestamp ?? 0);
      if (dur > 0 && dur < 600) speakingSeconds += dur; // sanity cap at 10 min per segment
    }

    const wpm = speakingSeconds > 0 ? Math.round((totalWords / speakingSeconds) * 60) : 0;

    // Filler word count
    const allWords = segs
      .map((s) => s.text || '')
      .join(' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.replace(/[.,!?;:…"«»„"]/g, ''));

    const fillerCount = allWords.filter((w) => FILLER_WORDS_PL.has(w)).length;
    const fillerRate = totalWords > 0 ? Math.round((fillerCount / totalWords) * 100) : 0;

    // Average segment (turn) length in seconds
    const validDurs = segs
      .map((s) => Number(s.endTimestamp ?? 0) - Number(s.timestamp ?? 0))
      .filter((d) => d > 0 && d < 600);
    const avgTurnSeconds = validDurs.length
      ? Math.round(validDurs.reduce((a, b) => a + b, 0) / validDurs.length)
      : 0;

    results.push({
      speakerId,
      speakerName: displayNameForSpeaker(speakerId, displaySpeakerNames),
      totalWords,
      speakingSeconds: Math.round(speakingSeconds),
      wpm,
      turnCount: segs.length,
      fillerCount,
      fillerRate,
      avgTurnSeconds,
    });
  }

  // Sort by total speaking time descending
  results.sort((a, b) => b.speakingSeconds - a.speakingSeconds);
  return results;
}
