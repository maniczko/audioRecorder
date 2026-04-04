import { describe, test, expect, vi, beforeEach } from 'vitest';
import { buildRagContext } from '../lib/ragAnswer.ts';

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
