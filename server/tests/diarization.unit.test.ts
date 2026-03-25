/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exec } from 'node:child_process';
import {
  applyPerSpeakerNorm,
  findPyannoteSpeakerAt,
  mergeWithPyannote,
  splitSegmentsByWordSpeaker,
} from '../diarization';

describe('diarization helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mergeWithPyannote', () => {
    it('assigns speakers based on best overlap and normalizes speaker map', () => {
      const pyannote = [
        { speaker: 'spk_1', start: 0, end: 2.5 },
        { speaker: 'spk_2', start: 2.5, end: 6 },
      ];
      const whisper = [
        { start: 0, end: 2, text: 'Hello there.' },
        { start: 2, end: 4, text: ' General Kenobi!' },
      ];

      const result = mergeWithPyannote(pyannote, whisper);

      expect(result.speakerCount).toBe(2);
      expect(result.speakerNames['0']).toBe('spk_1');
      expect(result.speakerNames['1']).toBe('spk_2');
      expect(result.segments).toHaveLength(2);
      expect(result.segments[0]?.rawSpeakerLabel).toBe('spk_1');
      expect(result.segments[1]?.rawSpeakerLabel).toBe('spk_2');
      expect(result.text).toContain('Hello');
    });

    it('falls back to estimated duration when end timestamp is missing', () => {
      const pyannote = [{ speaker: 'speaker_a', start: 0, end: 10 }];
      const whisper = [{ start: 5, end: 5, text: 'Short sentence' }];

      const result = mergeWithPyannote(pyannote, whisper);
      const segment = result.segments[0];

      expect(segment?.timestamp).toBe(5);
      expect(segment?.endTimestamp).toBeGreaterThan(5);
    });
  });

  describe('findPyannoteSpeakerAt', () => {
    it('returns active speaker when timestamp is inside segment', () => {
      const segments = [
        { speaker: 'A', start: 0, end: 1 },
        { speaker: 'B', start: 2, end: 3 },
      ];
      expect(findPyannoteSpeakerAt(0.5, segments)).toBe('A');
    });

    it('returns nearest speaker when timestamp is outside segments', () => {
      const segments = [
        { speaker: 'A', start: 0, end: 1 },
        { speaker: 'B', start: 3, end: 4 },
      ];
      expect(findPyannoteSpeakerAt(2.2, segments)).toBe('B');
    });

    it('returns speaker_unknown when no segments provided', () => {
      expect(findPyannoteSpeakerAt(1.5, [])).toBe('speaker_unknown');
    });
  });

  describe('splitSegmentsByWordSpeaker', () => {
    it('splits segments when word-level speakers change', () => {
      const whisper = [
        {
          text: 'Hello world',
          start: 0,
          end: 2,
          words: [
            { word: 'Hello ', start: 0, end: 0.5 },
            { word: 'world', start: 1.2, end: 1.6 },
          ],
        },
        { text: 'No words segment', start: 2, end: 3, words: [] },
      ];
      const pyannote = [
        { speaker: 'SPEAKER_1', start: 0, end: 1 },
        { speaker: 'SPEAKER_2', start: 1, end: 4 },
      ];

      const result = splitSegmentsByWordSpeaker(whisper, pyannote);

      expect(result).not.toBeNull();
      expect(result?.segments).toHaveLength(3);
      expect(result?.speakerCount).toBe(2);
      expect(result?.segments[0]?.rawSpeakerLabel).toBe('SPEAKER_1');
      expect(result?.segments[1]?.rawSpeakerLabel).toBe('SPEAKER_2');
      expect(result?.segments[2]?.rawSpeakerLabel).toBe('SPEAKER_2');
    });

    it('returns null when there are no word timestamps', () => {
      const whisper = [{ text: 'No words here', start: 0, end: 1 }];
      const pyannote = [{ speaker: 'A', start: 0, end: 2 }];
      expect(splitSegmentsByWordSpeaker(whisper, pyannote)).toBeNull();
    });
  });

  describe('applyPerSpeakerNorm', () => {
    it('returns null when only one speaker is present', async () => {
      const result = await applyPerSpeakerNorm('input.wav', [{ speaker: 'A', start: 0, end: 1 }]);
      expect(result).toBeNull();
    });

    it('returns null when gain cannot be computed', async () => {
      const execMock = vi.mocked(exec);
      execMock.mockImplementation((cmd: any, opts: any, callback: any) => {
        if (callback) callback(null, '', '');
        return { stdout: { on: vi.fn() }, on: vi.fn() } as any;
      });

      const result = await applyPerSpeakerNorm('input.wav', [
        { speaker: 'A', start: 0, end: 1 },
        { speaker: 'B', start: 1, end: 2 },
      ]);

      expect(result).toBeNull();
      expect(execMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
