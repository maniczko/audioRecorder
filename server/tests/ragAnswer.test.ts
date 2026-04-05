import { describe, test, expect, vi, beforeEach } from 'vitest';
import { buildRagContext, buildFallbackRagAnswer } from '../lib/ragAnswer.ts';

describe('ragAnswer.ts — buildRagContext', () => {
  test('formats chunks with recording_id, speaker_name, and text', () => {
    const chunks = [
      { recording_id: 'r1', speaker_name: 'Alice', text: 'hello' },
      { recording_id: 'r2', speaker_name: 'Bob', text: 'world' },
    ];
    const result = buildRagContext(chunks);
    expect(result).toContain('[Spotkanie: r1] Alice: hello');
    expect(result).toContain('[Spotkanie: r2] Bob: world');
  });

  test('uses defaults for missing fields', () => {
    const chunks = [{ text: 'orphan text' }];
    const result = buildRagContext(chunks);
    expect(result).toBe('[Spotkanie: unknown] Nieznany: orphan text');
  });

  test('returns empty string for empty array', () => {
    expect(buildRagContext([])).toBe('');
  });

  test('returns empty string for non-array input', () => {
    expect((buildRagContext as any)(null)).toBe('');
    expect((buildRagContext as any)(undefined)).toBe('');
    expect((buildRagContext as any)('not array')).toBe('');
  });

  test('handles chunks with missing text', () => {
    const chunks = [{ recording_id: 'r1', speaker_name: 'Alice' }];
    const result = buildRagContext(chunks);
    expect(result).toBe('[Spotkanie: r1] Alice: ');
  });

  test('joins multiple chunks with newlines', () => {
    const chunks = [
      { recording_id: 'r1', speaker_name: 'A', text: 'one' },
      { recording_id: 'r2', speaker_name: 'B', text: 'two' },
      { recording_id: 'r3', speaker_name: 'C', text: 'three' },
    ];
    const result = buildRagContext(chunks);
    expect(result.split('\n')).toHaveLength(3);
  });
});

describe('ragAnswer.ts — buildFallbackRagAnswer', () => {
  test('returns fallback answer with bullet list of chunks', () => {
    const result = buildFallbackRagAnswer({
      question: 'What did Alice say?',
      chunks: [
        { recording_id: 'r1', speaker_name: 'Alice', text: 'We should ship by Friday' },
        { recording_id: 'r2', speaker_name: 'Bob', text: 'Agreed' },
      ],
    });
    expect(result).toContain('Fragment 1 (Alice)');
    expect(result).toContain('We should ship by Friday');
    expect(result).toContain('Fragment 2 (Bob)');
    expect(result).toContain('Agreed');
    expect(result).toContain('Pytanie: What did Alice say?');
  });

  test('returns message when no chunks provided', () => {
    const result = buildFallbackRagAnswer({
      question: 'test',
      chunks: [],
    });
    expect(result).toContain('Nie znalazlem trafnych fragmentow');
  });

  test('filters out chunks with empty text', () => {
    const result = buildFallbackRagAnswer({
      question: 'test',
      chunks: [
        { recording_id: 'r1', speaker_name: 'Alice', text: '' },
        { recording_id: 'r2', speaker_name: 'Bob', text: '   ' },
      ],
    });
    expect(result).toContain('Nie znalazlem trafnych fragmentow');
  });

  test('includes error hint when errorMessage is provided', () => {
    const result = buildFallbackRagAnswer({
      question: 'test',
      chunks: [{ recording_id: 'r1', speaker_name: 'Alice', text: 'some text' }],
      errorMessage: 'Model unavailable',
    });
    expect(result).toContain('Model AI jest chwilowo niedostepny');
  });

  test('uses success hint when no error message', () => {
    const result = buildFallbackRagAnswer({
      question: 'test',
      chunks: [{ recording_id: 'r1', speaker_name: 'Alice', text: 'some text' }],
    });
    expect(result).toContain('Na podstawie archiwalnych fragmentow znalazlem');
  });

  test('limits to first 3 chunks', () => {
    const result = buildFallbackRagAnswer({
      question: 'test',
      chunks: [
        { recording_id: 'r1', speaker_name: 'A', text: 'one' },
        { recording_id: 'r2', speaker_name: 'B', text: 'two' },
        { recording_id: 'r3', speaker_name: 'C', text: 'three' },
        { recording_id: 'r4', speaker_name: 'D', text: 'four' },
      ],
    });
    expect(result).toContain('Fragment 1 (A)');
    expect(result).toContain('Fragment 2 (B)');
    expect(result).toContain('Fragment 3 (C)');
    expect(result).not.toContain('Fragment 4 (D)');
    expect(result).not.toContain('four');
  });

  test('normalizes chunk text (whitespace)', () => {
    const result = buildFallbackRagAnswer({
      question: 'test',
      chunks: [{ recording_id: 'r1', speaker_name: 'Alice', text: '  lots   of   spaces  ' }],
    });
    expect(result).toContain('lots of spaces');
  });

  test('handles null chunks gracefully', () => {
    const result = buildFallbackRagAnswer({
      question: 'test',
      chunks: null as any,
    });
    expect(result).toContain('Nie znalazlem');
  });
});
