/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import path from 'node:path';
import {
  buildAudioPreprocessCacheKey,
  getPreprocessCachePath,
  getUploadDir,
  isPreprocessCacheFile,
  mergeChunkedPayloads,
  resolveStoredAudioQuality,
  getMemoryAwareConcurrency,
  VAD_ENABLED,
  _sttUseGroq,
  VERIFICATION_MODEL,
  STT_PROVIDER_CHAIN,
} from '../transcription';

describe('transcription helpers', () => {
  it('buildAudioPreprocessCacheKey is stable and sensitive to changes', () => {
    const asset = {
      id: 'asset_1',
      file_path: 'audio.wav',
      updated_at: '2026-03-01T10:00:00Z',
      size_bytes: 1234,
      content_type: 'audio/wav',
    };

    const keyA = buildAudioPreprocessCacheKey(asset, 'standard');
    const keyB = buildAudioPreprocessCacheKey({ ...asset }, 'standard');
    const keyC = buildAudioPreprocessCacheKey({ ...asset, size_bytes: 9999 }, 'standard');

    expect(keyA).toBe(keyB);
    expect(keyA).not.toBe(keyC);
    expect(keyA).toMatch(/^[a-f0-9]{64}$/);
  });

  it('getPreprocessCachePath builds paths under the preprocess cache folder', () => {
    const cacheKey = 'abc123';
    const cachePath = getPreprocessCachePath(cacheKey, 'standard');

    expect(path.basename(cachePath)).toBe(`${cacheKey}.standard.wav`);
    expect(path.normalize(cachePath)).toContain(
      path.normalize(path.join('.cache', 'preprocessed'))
    );
  });

  it('isPreprocessCacheFile detects cache paths correctly', () => {
    const inside = getPreprocessCachePath('inside', 'enhanced');
    const outside = path.join(getUploadDir(), 'outside.wav');

    expect(isPreprocessCacheFile(inside)).toBe(true);
    expect(isPreprocessCacheFile(outside)).toBe(false);
  });

  it('resolveStoredAudioQuality parses audioQuality payload safely', () => {
    expect(
      resolveStoredAudioQuality({
        diarization_json: '{"audioQuality":{"qualityLabel":"good"}}',
      })
    ).toEqual({ qualityLabel: 'good' });

    expect(
      resolveStoredAudioQuality({
        diarization_json: '{"audioQuality":"bad"}',
      })
    ).toBeNull();

    expect(resolveStoredAudioQuality({ diarization_json: 'not-json' })).toBeNull();
  });

  it('mergeChunkedPayloads merges payloads and computes diagnostics', () => {
    const payloads = [
      {
        payload: {
          segments: [{ start: 0, end: 1, text: 'Hello' }],
          words: [{ word: 'Hello', start: 0, end: 1 }],
          text: 'Hello',
        },
        offsetSeconds: 0,
        diagnostics: {
          extracted: true,
          discardedAsTooSmall: false,
          vadFlaggedSilent: false,
          sentToStt: true,
          sttFailed: false,
          sttErrorMessage: '',
          hasSegments: true,
          hasWords: true,
          hasText: true,
        },
        sttResult: {
          providerId: 'openai',
          providerLabel: 'OpenAI STT',
          model: 'gpt-4o-transcribe',
          attempts: [
            {
              providerId: 'openai',
              providerLabel: 'OpenAI STT',
              model: 'gpt-4o-transcribe',
              success: true,
              durationMs: 10,
            },
          ],
        },
      },
      {
        payload: null,
        offsetSeconds: 30,
        diagnostics: {
          extracted: false,
          discardedAsTooSmall: true,
          vadFlaggedSilent: true,
          sentToStt: false,
          sttFailed: false,
          sttErrorMessage: 'Too small',
          hasSegments: false,
          hasWords: false,
          hasText: false,
        },
      },
    ];

    const result = mergeChunkedPayloads(payloads, 123);

    expect(result.segments).toHaveLength(1);
    expect(result.words).toHaveLength(1);
    expect(result.text).toBe('Hello');
    expect(result.sttProviderInfo?.providerId).toBe('openai');
    expect(result.transcriptionDiagnostics).toMatchObject({
      usedChunking: true,
      fileSizeBytes: 123,
      chunksAttempted: 2,
      chunksDiscardedAsTooSmall: 1,
      chunksWithSegments: 1,
      chunksWithWords: 1,
      chunksWithText: 1,
    });
    expect(result.transcriptionDiagnostics?.sttAttempts?.length).toBe(1);
  });

  it('mergeChunkedPayloads handles empty payloads array', () => {
    const result = mergeChunkedPayloads([], 0);

    expect(result.segments).toEqual([]);
    expect(result.words).toEqual([]);
    expect(result.text).toBe('');
    expect(result.transcriptionDiagnostics.chunksAttempted).toBe(0);
  });

  it('mergeChunkedPayloads handles payloads with no segments or words', () => {
    const payloads = [
      {
        payload: { text: 'Just text, no segments' },
        offsetSeconds: 0,
        diagnostics: {
          extracted: true,
          discardedAsTooSmall: false,
          vadFlaggedSilent: false,
          sentToStt: true,
          sttFailed: false,
          sttErrorMessage: '',
          hasSegments: false,
          hasWords: false,
          hasText: true,
        },
      },
    ];

    const result = mergeChunkedPayloads(payloads, 50);

    expect(result.segments).toEqual([]);
    expect(result.words).toEqual([]);
    expect(result.text).toBe('Just text, no segments');
    expect(result.transcriptionDiagnostics.chunksWithText).toBe(1);
  });
});

describe('getMemoryAwareConcurrency', () => {
  const originalMemoryUsage = process.memoryUsage;

  afterEach(() => {
    process.memoryUsage = originalMemoryUsage;
  });

  it('returns 1 when RSS > 500MB', () => {
    process.memoryUsage = vi.fn().mockReturnValue({
      rss: 550 * 1024 * 1024,
      heapUsed: 200 * 1024 * 1024,
      heapTotal: 300 * 1024 * 1024,
    });

    expect(getMemoryAwareConcurrency(4)).toBe(1);
  });

  it('returns 1 when heapUsageRatio > 0.75', () => {
    process.memoryUsage = vi.fn().mockReturnValue({
      rss: 300 * 1024 * 1024,
      heapUsed: 230 * 1024 * 1024,
      heapTotal: 300 * 1024 * 1024, // 0.767 ratio
    });

    expect(getMemoryAwareConcurrency(4)).toBe(1);
  });

  it('returns max(1, min(configLimit, 2)) when RSS > 350MB', () => {
    process.memoryUsage = vi.fn().mockReturnValue({
      rss: 400 * 1024 * 1024,
      heapUsed: 150 * 1024 * 1024,
      heapTotal: 300 * 1024 * 1024, // 0.5 ratio
    });

    expect(getMemoryAwareConcurrency(4)).toBe(2);
    expect(getMemoryAwareConcurrency(1)).toBe(1);
  });

  it('returns max(1, min(configLimit, 2)) when heapUsageRatio > 0.6', () => {
    process.memoryUsage = vi.fn().mockReturnValue({
      rss: 300 * 1024 * 1024,
      heapUsed: 185 * 1024 * 1024,
      heapTotal: 300 * 1024 * 1024, // 0.617 ratio
    });

    expect(getMemoryAwareConcurrency(4)).toBe(2);
  });

  it('returns configLimit when memory usage is low', () => {
    process.memoryUsage = vi.fn().mockReturnValue({
      rss: 200 * 1024 * 1024,
      heapUsed: 100 * 1024 * 1024,
      heapTotal: 300 * 1024 * 1024, // 0.33 ratio
    });

    expect(getMemoryAwareConcurrency(4)).toBe(2); // capped at 2
    expect(getMemoryAwareConcurrency(1)).toBe(1);
  });
});

describe('transcription module constants', () => {
  it('VAD_ENABLED is a boolean', () => {
    expect(typeof VAD_ENABLED).toBe('boolean');
  });

  it('_sttUseGroq is a boolean', () => {
    expect(typeof _sttUseGroq).toBe('boolean');
  });

  it('VERIFICATION_MODEL is a non-empty string', () => {
    expect(typeof VERIFICATION_MODEL).toBe('string');
    expect(VERIFICATION_MODEL.length).toBeGreaterThan(0);
  });

  it('STT_PROVIDER_CHAIN is an array', () => {
    expect(Array.isArray(STT_PROVIDER_CHAIN)).toBe(true);
  });

  it('STT_PROVIDER_CHAIN contains provider objects with id and defaultModel', () => {
    for (const provider of STT_PROVIDER_CHAIN) {
      expect(provider).toHaveProperty('id');
      expect(provider).toHaveProperty('defaultModel');
      expect(typeof provider.id).toBe('string');
      expect(typeof provider.defaultModel).toBe('string');
    }
  });
});

describe('getUploadDir', () => {
  it('returns a string path', () => {
    const dir = getUploadDir();
    expect(typeof dir).toBe('string');
    expect(dir.length).toBeGreaterThan(0);
  });

  it('returns the same directory on subsequent calls (cached)', () => {
    const dir1 = getUploadDir();
    const dir2 = getUploadDir();
    expect(dir1).toBe(dir2);
  });
});

describe('mergeChunkedPayloads — additional edge cases', () => {
  it('handles payloads where all are discarded', () => {
    const payloads = [
      {
        payload: null,
        offsetSeconds: 0,
        diagnostics: {
          extracted: false,
          discardedAsTooSmall: true,
          vadFlaggedSilent: true,
          sentToStt: false,
          sttFailed: false,
          sttErrorMessage: 'Too small',
          hasSegments: false,
          hasWords: false,
          hasText: false,
        },
      },
    ];

    const result = mergeChunkedPayloads(payloads, 0);

    expect(result.segments).toEqual([]);
    expect(result.words).toEqual([]);
    expect(result.text).toBe('');
    expect(result.transcriptionDiagnostics.chunksDiscardedAsTooSmall).toBe(1);
    expect(result.transcriptionDiagnostics.chunksFlaggedSilentByVad).toBe(1);
  });

  it('handles multiple valid payloads with segment deduplication', () => {
    const payloads = [
      {
        payload: {
          segments: [{ start: 0, end: 5, text: 'Hello' }],
          words: [],
          text: 'Hello',
        },
        offsetSeconds: 0,
        diagnostics: {
          extracted: true,
          discardedAsTooSmall: false,
          vadFlaggedSilent: false,
          sentToStt: true,
          sttFailed: false,
          sttErrorMessage: '',
          hasSegments: true,
          hasWords: false,
          hasText: true,
        },
      },
      {
        payload: {
          segments: [{ start: 4.9, end: 10, text: 'world' }], // overlaps with previous
          words: [],
          text: 'world',
        },
        offsetSeconds: 5,
        diagnostics: {
          extracted: true,
          discardedAsTooSmall: false,
          vadFlaggedSilent: false,
          sentToStt: true,
          sttFailed: false,
          sttErrorMessage: '',
          hasSegments: true,
          hasWords: false,
          hasText: true,
        },
      },
    ];

    const result = mergeChunkedPayloads(payloads, 0);

    // Second segment starts at 9.9 (4.9 + 5) which is > 5 - 0.1 = 4.9, so it passes dedup
    expect(result.segments).toHaveLength(2);
    expect(result.text).toBe('Hello world');
  });

  it('extracts words using getRawWords from payload', () => {
    const payloads = [
      {
        payload: {
          segments: [],
          words: [{ word: 'hello', start: 0, end: 1 }],
          text: 'hello',
        },
        offsetSeconds: 0,
        diagnostics: {
          extracted: true,
          discardedAsTooSmall: false,
          vadFlaggedSilent: false,
          sentToStt: true,
          sttFailed: false,
          sttErrorMessage: '',
          hasSegments: false,
          hasWords: true,
          hasText: true,
        },
      },
    ];

    const result = mergeChunkedPayloads(payloads, 0);

    expect(result.words).toHaveLength(1);
    expect(result.words[0].word).toBe('hello');
  });

  it('handles chunksReturnedEmptyPayload diagnostic', () => {
    const payloads = [
      {
        payload: { segments: [], words: [], text: '' },
        offsetSeconds: 0,
        diagnostics: {
          extracted: true,
          discardedAsTooSmall: false,
          vadFlaggedSilent: false,
          sentToStt: true,
          sttFailed: false,
          sttErrorMessage: '',
          hasSegments: false,
          hasWords: false,
          hasText: false,
        },
      },
    ];

    const result = mergeChunkedPayloads(payloads, 0);

    expect(result.transcriptionDiagnostics.chunksReturnedEmptyPayload).toBe(1);
  });
});
