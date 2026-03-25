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
export function analyzeSpeakingStyle(transcript, displaySpeakerNames = {}) {
  if (!Array.isArray(transcript) || !transcript.length) return [];

  // Group segments by speaker
  const bySpeaker = new Map();
  for (const seg of transcript) {
    const sid = String(seg.speakerId ?? 'unknown');
    if (!bySpeaker.has(sid)) bySpeaker.set(sid, []);
    bySpeaker.get(sid).push(seg);
  }

  const results = [];

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
      speakerName: displaySpeakerNames?.[speakerId] || `Speaker ${speakerId}`,
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
