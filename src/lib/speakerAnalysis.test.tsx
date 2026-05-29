import { describe, expect, it } from 'vitest';

import { analyzeSpeakingStyle } from './speakerAnalysis';

const segment = (speakerId: number | string, index: number) => ({
  id: `seg_${index}`,
  speakerId,
  text: `Test segment ${index}`,
  timestamp: index * 3,
  endTimestamp: index * 3 + 2,
});

describe('analyzeSpeakingStyle', () => {
  it('keeps normal small speaker sets intact', () => {
    const transcript = [segment(0, 0), segment(1, 1), segment(2, 2), segment(1, 3)];

    const result = analyzeSpeakingStyle(transcript);

    expect(result).toHaveLength(3);
    expect(result.map((speaker) => speaker.speakerId).sort()).toEqual(['0', '1', '2']);
  });

  // -----------------------------------------------------------------
  // Issue #0 - noisy diarization labels rendered hundreds of speakers
  // Date: 2026-05-29
  // Bug: per-segment numeric labels were treated as real participants.
  // Fix: collapse suspicious high-cardinality labels for analytics.
  // -----------------------------------------------------------------
  it('collapses high-cardinality segment-like speaker ids instead of showing hundreds of participants', () => {
    const transcript = Array.from({ length: 80 }, (_, index) => segment(300 + index, index));

    const result = analyzeSpeakingStyle(transcript);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      speakerId: 'unknown',
      speakerName: 'Speaker do weryfikacji',
      turnCount: 80,
    });
  });
});
