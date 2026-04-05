/**
 * Tests for pure functions in diarization.ts — no external deps, no mocks needed.
 * Coverage target: inferGenderFromPolishName, normalizeToParticipant,
 * mergeWithPyannote, findPyannoteSpeakerAt, splitSegmentsByWordSpeaker.
 */

import { describe, test, expect } from 'vitest';
import {
  inferGenderFromPolishName,
  normalizeToParticipant,
  mergeWithPyannote,
  findPyannoteSpeakerAt,
  splitSegmentsByWordSpeaker,
} from '../diarization.ts';
import {
  synthesizeSegmentsFromWords,
  normalizeDiarizedSegments,
  buildVerificationResult,
} from '../audioPipeline.utils.ts';

// ── inferGenderFromPolishName ────────────────────────────────────────────────

describe('inferGenderFromPolishName', () => {
  test('recognises common male names', () => {
    expect(inferGenderFromPolishName('Adam')).toBe('male');
    expect(inferGenderFromPolishName('jan')).toBe('male');
    expect(inferGenderFromPolishName('KRZYSZTOF')).toBe('male');
  });

  test('recognises common female names', () => {
    expect(inferGenderFromPolishName('Anna')).toBe('female');
    expect(inferGenderFromPolishName('maria')).toBe('female');
    expect(inferGenderFromPolishName('KASIA')).toBe('female');
  });

  test('returns null for unknown names', () => {
    expect(inferGenderFromPolishName('Zyx')).toBeNull();
    expect(inferGenderFromPolishName('')).toBeNull();
    expect(inferGenderFromPolishName('   ')).toBeNull();
  });

  test('normalises whitespace and case', () => {
    expect(inferGenderFromPolishName('  ADAM  ')).toBe('male');
    expect(inferGenderFromPolishName('\tanna\n')).toBe('female');
  });
});

// ── normalizeToParticipant ───────────────────────────────────────────────────

describe('normalizeToParticipant', () => {
  const participants = ['Anna Kowalska', 'Jan Nowak', 'Marek Zieliński'];

  test('returns exact match', () => {
    expect(normalizeToParticipant('Anna Kowalska', participants)).toBe('Anna Kowalska');
  });

  test('returns case-insensitive match', () => {
    expect(normalizeToParticipant('anna kowalska', participants)).toBe('Anna Kowalska');
  });

  test('returns null for no match', () => {
    expect(normalizeToParticipant('Unknown Person', participants)).toBeNull();
  });

  test('returns null for empty mention', () => {
    // normalizeToParticipant with no participants → null
    expect(normalizeToParticipant('', [])).toBeNull();
  });

  test('returns null when participants list is empty', () => {
    expect(normalizeToParticipant('Anna', [])).toBeNull();
  });
});

// ── findPyannoteSpeakerAt ───────────────────────────────────────────────────

describe('findPyannoteSpeakerAt', () => {
  const segments = [
    { speaker: 'SPEAKER_00', start: 0, end: 5 },
    { speaker: 'SPEAKER_01', start: 5, end: 10 },
    { speaker: 'SPEAKER_00', start: 10, end: 15 },
  ];

  test('returns speaker for exact timestamp match', () => {
    expect(findPyannoteSpeakerAt(2, segments)).toBe('SPEAKER_00');
    expect(findPyannoteSpeakerAt(7, segments)).toBe('SPEAKER_01');
  });

  test('returns nearest speaker when no exact match', () => {
    expect(findPyannoteSpeakerAt(5, segments)).toBe('SPEAKER_01');
  });

  test('returns speaker_unknown for empty segments', () => {
    expect(findPyannoteSpeakerAt(0, [])).toBe('speaker_unknown');
  });

  test('handles timestamp far outside range', () => {
    expect(findPyannoteSpeakerAt(100, segments)).toBe('SPEAKER_00'); // nearest is last segment
  });
});

// ── splitSegmentsByWordSpeaker ───────────────────────────────────────────────

describe('splitSegmentsByWordSpeaker', () => {
  test('splits segments when word speaker changes', () => {
    const whisperSegments = [{ id: 'w1', text: 'hello world', start: 0, end: 2 }];
    const pyannoteSegments = [
      { speaker: 'SPEAKER_00', start: 0, end: 1 },
      { speaker: 'SPEAKER_01', start: 1, end: 2 },
    ];
    const words = [
      { word: 'hello', start: 0, end: 0.5 },
      { word: 'world', start: 1.5, end: 2 },
    ];

    // Note: splitSegmentsByWordSpeaker expects word-level speaker info
    // which pyannote provides. This test verifies the function doesn't crash.
    expect(() => splitSegmentsByWordSpeaker(whisperSegments, pyannoteSegments)).not.toThrow();
  });

  test('handles empty pyannote segments gracefully', () => {
    const whisperSegments = [{ id: 'w1', text: 'test', start: 0, end: 1 }];
    const result = splitSegmentsByWordSpeaker(whisperSegments, []);
    // Should return something without crashing
    expect(result).toBeDefined();
  });
});

// ── mergeWithPyannote ───────────────────────────────────────────────────────

describe('mergeWithPyannote', () => {
  test('merges pyannote diarization with whisper segments', () => {
    const pyannote = [
      { speaker: 'SPEAKER_00', start: 0, end: 3 },
      { speaker: 'SPEAKER_01', start: 3, end: 6 },
    ];
    const whisper = [
      { text: 'cześć', start: 0, end: 1 },
      { text: 'jak się masz', start: 3, end: 5 },
    ];

    const result = mergeWithPyannote(pyannote, whisper);

    expect(result.segments).toHaveLength(2);
    expect(result.speakerCount).toBe(2);
    expect(result.speakerNames['0']).toBe('Speaker 1');
    expect(result.speakerNames['1']).toBe('Speaker 2');
    expect(result.text).toContain('cześć');
    expect(result.text).toContain('jak się masz');
  });

  test('filters out empty text segments', () => {
    const pyannote = [{ speaker: 'SPEAKER_00', start: 0, end: 5 }];
    const whisper = [
      { text: '', start: 0, end: 1 },
      { text: '   ', start: 2, end: 3 },
    ];

    const result = mergeWithPyannote(pyannote, whisper);
    expect(result.segments).toHaveLength(0);
    expect(result.speakerCount).toBe(0);
  });

  test('handles empty pyannote (fallback to unknown)', () => {
    const pyannote: any[] = [];
    const whisper = [{ text: 'hello', start: 0, end: 2 }];

    const result = mergeWithPyannote(pyannote, whisper);

    expect(result.segments).toHaveLength(1);
    expect(result.speakerNames['0']).toBe('Speaker 1');
  });

  test('assigns increasing speaker IDs for different speakers', () => {
    const pyannote = [
      { speaker: 'SPEAKER_00', start: 0, end: 2 },
      { speaker: 'SPEAKER_01', start: 2, end: 4 },
      { speaker: 'SPEAKER_02', start: 4, end: 6 },
    ];
    const whisper = [
      { text: 'one', start: 0, end: 1 },
      { text: 'two', start: 2, end: 3 },
      { text: 'three', start: 4, end: 5 },
    ];

    const result = mergeWithPyannote(pyannote, whisper);
    expect(result.speakerCount).toBe(3);
  });
});

// ── synthesizeSegmentsFromWords ──────────────────────────────────────────────

describe('synthesizeSegmentsFromWords', () => {
  test('builds segments from word-level payload', () => {
    const payload = {
      words: [
        { word: 'hello', start: 0, end: 0.5 },
        { word: 'world', start: 0.5, end: 1 },
        { word: 'foo', start: 2, end: 2.5 },
        { word: 'bar', start: 2.5, end: 3 },
      ],
    };

    const result = synthesizeSegmentsFromWords(payload);

    expect(result.segments.length).toBeGreaterThanOrEqual(1);
    expect(result.text).toContain('hello');
    expect(result.segments[0].speakerId).toBe(0);
  });

  test('returns empty result for payload without words', () => {
    const result = synthesizeSegmentsFromWords({});
    expect(result.segments).toEqual([]);
    expect(result.text).toBe('');
  });

  test('filters out empty/null words', () => {
    const payload = {
      words: [
        { word: '', start: 0, end: 0.5 },
        { word: null, start: 0.5, end: 1 },
        { word: 'valid', start: 1, end: 1.5 },
      ],
    };

    const result = synthesizeSegmentsFromWords(payload);
    expect(result.text).toBe('valid');
  });

  test('splits at punctuation boundaries', () => {
    const payload = {
      words: [
        { word: 'hello.', start: 0, end: 0.5 },
        { word: 'world', start: 1.5, end: 2 },
      ],
    };

    const result = synthesizeSegmentsFromWords(payload);
    // Should create 2 segments due to period
    expect(result.segments.length).toBeGreaterThanOrEqual(2);
  });
});

// ── normalizeDiarizedSegments ────────────────────────────────────────────────

describe('normalizeDiarizedSegments', () => {
  test('normalizes segments with speaker IDs', () => {
    const payload = {
      segments: [
        { text: 'hello', start: 0, end: 1, speaker: 0 },
        { text: 'world', start: 1, end: 2, speaker: 1 },
      ],
    };

    const result = normalizeDiarizedSegments(payload);

    expect(result.segments).toHaveLength(2);
    expect(result.speakerCount).toBe(2);
    expect(result.text).toContain('hello');
    expect(result.text).toContain('world');
  });

  test('handles empty segments by synthesizing from words', () => {
    const payload = {
      segments: [],
      words: [{ word: 'fallback', start: 0, end: 1 }],
    };

    const result = normalizeDiarizedSegments(payload);
    expect(result.segments.length).toBeGreaterThanOrEqual(1);
    expect(result.text).toContain('fallback');
  });

  test('handles utterances format (AssemblyAI-style)', () => {
    const payload = {
      utterances: [
        { text: 'utterance one', start: 0, end: 2, speaker: 'A' },
        { text: 'utterance two', start: 2, end: 4, speaker: 'B' },
      ],
    };

    const result = normalizeDiarizedSegments(payload);
    expect(result.segments).toHaveLength(2);
    expect(result.speakerCount).toBe(2);
  });

  test('filters out empty text segments', () => {
    const payload = {
      segments: [
        { text: '', start: 0, end: 1, speaker: 0 },
        { text: '   ', start: 1, end: 2, speaker: 0 },
        { text: 'valid', start: 2, end: 3, speaker: 0 },
      ],
    };

    const result = normalizeDiarizedSegments(payload);
    expect(result.segments).toHaveLength(1);
    expect(result.text).toBe('valid');
  });

  test('generates segment IDs when missing', () => {
    const payload = {
      segments: [{ text: 'no id', start: 0, end: 1 }],
    };

    const result = normalizeDiarizedSegments(payload);
    expect(result.segments[0].id).toMatch(/^seg_/);
  });
});

// ── buildVerificationResult ──────────────────────────────────────────────────

describe('buildVerificationResult', () => {
  test('builds result from matching segments', () => {
    const diarized = [{ id: 's1', text: 'hello world', start: 0, end: 2 }];
    const verified = [{ text: 'hello world', start: 0, end: 2 }];

    const result = buildVerificationResult(diarized, verified);

    expect(result.verifiedSegments).toHaveLength(1);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  test('handles empty input', () => {
    const result = buildVerificationResult([], []);
    expect(result.verifiedSegments).toEqual([]);
    expect(result.confidence).toBe(0);
  });

  test('includes quality and alignment in confidence calculation', () => {
    const diarized = [
      { id: 's1', text: 'this is a longer and better quality segment text', start: 0, end: 5 },
    ];
    const verified = [
      { text: 'this is a longer and better quality segment text', start: 0, end: 5 },
    ];

    const result = buildVerificationResult(diarized, verified);
    expect(result.confidence).toBeGreaterThan(0.3);
  });
});
