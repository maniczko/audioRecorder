import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mergeChunkedPayloads,
  getMemoryAwareConcurrency,
  transcribeLiveChunk,
  calculateAdaptiveOverlap,
  getUploadDir,
  buildAudioPreprocessCacheKey,
  getPreprocessCachePath,
  isPreprocessCacheFile,
  resolveStoredAudioQuality,
} from '../transcription.ts';

// ── Typed mock helpers ────────────────────────────────────────────────────────

/** Creates a properly typed MemoryUsage mock object. */
function mockMemoryUsage(mb: {
  rssMB: number;
  heapUsedMB: number;
  heapTotalMB: number;
}): ReturnType<typeof vi.spyOn> {
  const BYTES = 1024 * 1024;
  return vi.spyOn(process, 'memoryUsage').mockReturnValue({
    rss: mb.rssMB * BYTES,
    heapUsed: mb.heapUsedMB * BYTES,
    heapTotal: mb.heapTotalMB * BYTES,
    external: 0,
    arrayBuffers: 0,
  } as NodeJS.MemoryUsage);
}

// ── Shared diagnostics fixtures for it.each ──────────────────────────────────

const DIAG_SUCCESS = {
  extracted: true,
  sentToStt: true,
  sttFailed: false,
  hasSegments: true,
  hasText: true,
};

const DIAG_FAILED = {
  extracted: true,
  sentToStt: true,
  sttFailed: true,
  sttErrorMessage: 'API error',
  hasSegments: false,
  hasText: false,
};

const DIAG_DISCARDED = {
  extracted: false,
  discardedAsTooSmall: true,
  sentToStt: false,
  sttFailed: false,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('transcription.ts — Additional Coverage Tests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── mergeChunkedPayloads ──────────────────────────────────────────────────

  describe('mergeChunkedPayloads', () => {
    it('merges multiple chunk payloads with segments', () => {
      const payloads = [
        {
          payload: {
            segments: [
              { text: 'Hello', start: 0, end: 1 },
              { text: 'World', start: 1, end: 2 },
            ],
            text: 'Hello World',
          },
          offsetSeconds: 0,
          diagnostics: {
            extracted: true,
            sentToStt: true,
            hasSegments: true,
            hasWords: false,
            hasText: true,
          },
        },
        {
          payload: {
            segments: [
              { text: 'Foo', start: 0, end: 1 },
              { text: 'Bar', start: 1, end: 2 },
            ],
            text: 'Foo Bar',
          },
          offsetSeconds: 30,
          diagnostics: {
            extracted: true,
            sentToStt: true,
            hasSegments: true,
            hasWords: false,
            hasText: true,
          },
        },
      ];

      const result = mergeChunkedPayloads(payloads, 1024);

      expect(result.segments).toHaveLength(4);
      expect(result.segments[0].start).toBe(0);
      expect(result.segments[0].end).toBe(1);
      expect(result.segments[2].start).toBe(30);
      expect(result.segments[2].end).toBe(31);
      expect(result.text).toBe('Hello World Foo Bar');
      expect(result.transcriptionDiagnostics.chunksAttempted).toBe(2);
      expect(result.transcriptionDiagnostics.chunksWithSegments).toBe(2);
      expect(result.transcriptionDiagnostics.fileSizeBytes).toBe(1024);
    });

    it.each`
      label              | payloads                                                                                                                                                                                        | expectSegLen | expectText
      ${'empty array'}   | ${[]}                                                                                                                                                                                           | ${0}         | ${''}
      ${'null filtered'} | ${[{ payload: null, offsetSeconds: 0, diagnostics: {} }, { payload: { segments: [{ text: 'Valid', start: 0, end: 1 }], text: 'Valid' }, offsetSeconds: 10, diagnostics: { extracted: true } }]} | ${1}         | ${'Valid'}
    `(
      'handles $label: $expectSegLen segment(s), text="$expectText"',
      ({ payloads: payloadsRaw, expectSegLen, expectText }) => {
        const result = mergeChunkedPayloads(payloadsRaw, 512);
        expect(result.segments).toHaveLength(expectSegLen);
        expect(result.text).toBe(expectText);
      }
    );

    it('deduplicates overlapping segments', () => {
      const payloads = [
        {
          payload: {
            segments: [
              { text: 'Segment 1', start: 0, end: 5 },
              { text: 'Segment 2', start: 4.9, end: 10 },
            ],
            text: 'Segment 1 Segment 2',
          },
          offsetSeconds: 0,
          diagnostics: { extracted: true, sentToStt: true, hasSegments: true },
        },
        {
          payload: {
            segments: [
              // After offset: start=5, end=10 — but highWater from chunk 1 is 10
              // so start=5 >= 10-0.1 is false → this segment gets filtered
              { text: 'Segment 3', start: 0, end: 5 },
              // After offset: start=10, end=15 — start=10 >= 10-0.1 is true → kept
              { text: 'Segment 4', start: 5, end: 10 },
            ],
            text: 'Segment 3 Segment 4',
          },
          offsetSeconds: 5,
          diagnostics: { extracted: true, sentToStt: true, hasSegments: true },
        },
      ];

      const result = mergeChunkedPayloads(payloads, 0);

      // Chunk 1: both segments kept (highWater reaches 10)
      // Chunk 2: Segment 3 filtered out (start=5 < 10-0.1), Segment 4 kept (start=10 >= 10-0.1)
      // Expected: 3 segments total
      expect(result.segments).toHaveLength(3);
      expect(result.segments[0].text).toBe('Segment 1');
      expect(result.segments[2].text).toBe('Segment 4');
    });

    it('extracts words from payload', () => {
      const payloads = [
        {
          payload: {
            segments: [],
            words: [
              { word: 'Hello', start: 0, end: 0.5 },
              { word: 'World', start: 0.5, end: 1 },
            ],
            text: 'Hello World',
          },
          offsetSeconds: 0,
          diagnostics: { extracted: true, sentToStt: true, hasWords: true },
        },
      ];

      const result = mergeChunkedPayloads(payloads, 0);

      expect(result.words).toHaveLength(2);
      expect(result.transcriptionDiagnostics.chunksWithWords).toBe(1);
    });

    it('merges word-level payloads without segments', () => {
      const payloads = [
        {
          payload: {
            segments: [],
            words: [
              { word: 'Pierwszy', start: 0, end: 0.8 },
              { word: 'drugi', start: 0.8, end: 1.5 },
            ],
            text: 'Pierwszy drugi',
          },
          offsetSeconds: 0,
          diagnostics: { extracted: true, sentToStt: true, hasWords: true, hasSegments: false },
        },
        {
          payload: {
            segments: [],
            words: [
              { word: 'Trzeci', start: 0, end: 0.6 },
              { word: 'czwarty', start: 0.6, end: 1.2 },
            ],
            text: 'Trzeci czwarty',
          },
          offsetSeconds: 15,
          diagnostics: { extracted: true, sentToStt: true, hasWords: true, hasSegments: false },
        },
      ];

      const result = mergeChunkedPayloads(payloads, 4096);

      // Both word lists merged with offsets applied
      expect(result.words).toHaveLength(4);
      expect(result.words[0].word).toBe('Pierwszy');
      expect(result.words[0].start).toBe(0);
      expect(result.words[2].word).toBe('Trzeci');
      expect(result.words[2].start).toBe(15); // offset applied
      expect(result.text).toBe('Pierwszy drugi Trzeci czwarty');
      expect(result.segments).toHaveLength(0);
      expect(result.transcriptionDiagnostics.chunksWithWords).toBe(2);
      expect(result.transcriptionDiagnostics.fileSizeBytes).toBe(4096);
    });

    it.each`
      label             | payloadEntry                                                                                                 | expectSentToStt | expectFailed | expectDiscarded | expectLastErr
      ${'success+fail'} | ${{ segs: [{ text: 'OK', start: 0, end: 1 }], diags: [DIAG_SUCCESS, DIAG_FAILED, DIAG_DISCARDED] }}          | ${2}            | ${1}         | ${1}            | ${'API error'}
      ${'zero size'}    | ${{ segs: [{ text: 'OK', start: 0, end: 1 }], diags: [DIAG_SUCCESS, DIAG_FAILED, DIAG_DISCARDED], size: 0 }} | ${2}            | ${1}         | ${1}            | ${'API error'}
    `(
      'tracks diagnostics for $label',
      ({ payloadEntry: p, expectSentToStt, expectFailed, expectDiscarded, expectLastErr }) => {
        const seg = p.segs[0];
        const payloads = p.diags.map((d: typeof DIAG_SUCCESS, i: number) =>
          i === 0
            ? {
                payload: { segments: [seg], text: seg.text },
                offsetSeconds: i * 10,
                diagnostics: d,
              }
            : { payload: null, offsetSeconds: i * 10, diagnostics: d }
        );
        const fileSize = p.size ?? 2048;
        const result = mergeChunkedPayloads(payloads, fileSize);

        expect(result.transcriptionDiagnostics.chunksSentToStt).toBe(expectSentToStt);
        expect(result.transcriptionDiagnostics.chunksFailedAtStt).toBe(expectFailed);
        expect(result.transcriptionDiagnostics.chunksDiscardedAsTooSmall).toBe(expectDiscarded);
        expect(result.transcriptionDiagnostics.lastChunkErrorMessage).toBe(expectLastErr);
        expect(result.transcriptionDiagnostics.fileSizeBytes).toBe(fileSize);
      }
    );

    it('handles payloads with sttResult attempts', () => {
      const payloads = [
        {
          payload: { segments: [], text: '' },
          offsetSeconds: 0,
          sttResult: {
            providerId: 'openai',
            attempts: [{ model: 'gpt-4o', status: 'success' }],
          },
          diagnostics: { extracted: true },
        },
      ];

      const result = mergeChunkedPayloads(payloads, 0);

      expect(result.transcriptionDiagnostics.sttAttempts).toEqual([
        { model: 'gpt-4o', status: 'success' },
      ]);
      expect(result.sttProviderInfo).toEqual(expect.objectContaining({ providerId: 'openai' }));
    });

    it('handles fileSizeBytes > 2GB without overflow', () => {
      const hugeSize = 3 * 1024 * 1024 * 1024; // 3 GB
      const payloads = [
        {
          payload: { segments: [{ text: 'Big', start: 0, end: 1 }], text: 'Big' },
          offsetSeconds: 0,
          diagnostics: { extracted: true, sentToStt: true, hasSegments: true },
        },
      ];

      const result = mergeChunkedPayloads(payloads, hugeSize);

      expect(result.transcriptionDiagnostics.fileSizeBytes).toBe(hugeSize);
      expect(result.transcriptionDiagnostics.fileSizeBytes).toBeGreaterThan(2147483647);
    });
  });

  // ── getMemoryAwareConcurrency ─────────────────────────────────────────────

  describe('getMemoryAwareConcurrency', () => {
    it.each`
      label                    | rssMB  | heapUsedMB | heapTotalMB | configLimit | expected
      ${'RSS > 500MB'}         | ${501} | ${100}     | ${200}      | ${4}        | ${1}
      ${'RSS > 350MB'}         | ${351} | ${100}     | ${200}      | ${4}        | ${2}
      ${'heap ratio > 0.75'}   | ${300} | ${160}     | ${200}      | ${4}        | ${1}
      ${'heap ratio > 0.6'}    | ${300} | ${125}     | ${200}      | ${4}        | ${2}
      ${'low memory, limit 4'} | ${100} | ${50}      | ${200}      | ${4}        | ${2}
      ${'low memory, limit 1'} | ${100} | ${50}      | ${200}      | ${1}        | ${1}
      ${'limit 0 → returns 0'} | ${100} | ${50}      | ${200}      | ${0}        | ${0}
    `(
      'returns $expected when $label',
      ({ rssMB, heapUsedMB, heapTotalMB, configLimit, expected }) => {
        mockMemoryUsage({ rssMB, heapUsedMB, heapTotalMB });

        const result = getMemoryAwareConcurrency(configLimit);

        expect(result).toBe(expected);
      }
    );
  });

  // ── calculateAdaptiveOverlap ──────────────────────────────────────────────

  describe('calculateAdaptiveOverlap', () => {
    const segEmpty: unknown[] = [];
    const segZero = [
      { start: 0, end: 0 },
      { start: 0, end: 0 },
    ];
    const segHigh = [
      { start: 0, end: 600 },
      { start: 400, end: 1000 },
    ];
    const segMed = [
      { start: 0, end: 200 },
      { start: 800, end: 1000 },
    ];
    const segLow = [
      { start: 0, end: 100 },
      { start: 900, end: 1000 },
    ];
    const segTs = [
      { startTimestamp: 0, endTimestamp: 600 },
      { startTimestamp: 400, endTimestamp: 1000 },
    ];

    it.each`
      label                         | segments    | expected
      ${'empty array'}              | ${segEmpty} | ${0.5}
      ${'null input'}               | ${null}     | ${0.5}
      ${'zero duration'}            | ${segZero}  | ${0.5}
      ${'high density (≥0.6)'}      | ${segHigh}  | ${2}
      ${'medium density (0.3–0.6)'} | ${segMed}   | ${1.25}
      ${'low density (<0.3)'}       | ${segLow}   | ${0.5}
      ${'timestamp properties'}     | ${segTs}    | ${2}
    `('returns $expected for $label', ({ segments, expected }) => {
      const result = calculateAdaptiveOverlap(segments, 1);
      expect(result).toBe(expected);
    });
  });

  // ── transcribeLiveChunk ───────────────────────────────────────────────────

  describe('transcribeLiveChunk', () => {
    it('is exported and callable', async () => {
      // transcribeLiveChunk depends on configured STT providers (real API calls).
      // Full behavioral coverage is in server/tests/routes/transcribe.test.ts and
      // server/tests/audio-pipeline.unit.test.ts. Here we verify the function is
      // properly exported and has the correct type.
      expect(typeof transcribeLiveChunk).toBe('function');
      expect(transcribeLiveChunk.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── getUploadDir ──────────────────────────────────────────────────────────

  describe('getUploadDir', () => {
    it('returns a string path', () => {
      const dir = getUploadDir();
      expect(typeof dir).toBe('string');
      expect(dir.length).toBeGreaterThan(0);
    });

    it('returns the same path on subsequent calls (memoization)', () => {
      const dir1 = getUploadDir();
      const dir2 = getUploadDir();
      expect(dir1).toBe(dir2); // Same reference due to module-level cache
    });
  });

  // ── buildAudioPreprocessCacheKey ──────────────────────────────────────────

  describe('buildAudioPreprocessCacheKey', () => {
    it('produces a consistent hash for the same asset', () => {
      const asset = {
        id: 'rec_123',
        file_path: '/tmp/audio.webm',
        updated_at: '2026-01-01T00:00:00Z',
        size_bytes: 1024,
        content_type: 'audio/webm',
      };

      const key1 = buildAudioPreprocessCacheKey(asset, 'standard');
      const key2 = buildAudioPreprocessCacheKey(asset, 'standard');

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    });

    it('produces different hashes for different profiles', () => {
      const asset = {
        id: 'rec_123',
        file_path: '/tmp/audio.webm',
        updated_at: '2026-01-01T00:00:00Z',
        size_bytes: 1024,
        content_type: 'audio/webm',
      };

      const keyStd = buildAudioPreprocessCacheKey(asset, 'standard');
      const keyEnh = buildAudioPreprocessCacheKey(asset, 'enhanced');

      expect(keyStd).not.toBe(keyEnh);
    });

    it('produces different hashes when asset changes', () => {
      const asset1 = {
        id: 'rec_123',
        file_path: '/tmp/audio.webm',
        updated_at: '2026-01-01T00:00:00Z',
        size_bytes: 1024,
        content_type: 'audio/webm',
      };
      const asset2 = { ...asset1, updated_at: '2026-01-02T00:00:00Z' };

      const key1 = buildAudioPreprocessCacheKey(asset1, 'standard');
      const key2 = buildAudioPreprocessCacheKey(asset2, 'standard');

      expect(key1).not.toBe(key2);
    });

    it('handles null/empty asset gracefully', () => {
      const key1 = buildAudioPreprocessCacheKey(null as any, 'standard');
      const key2 = buildAudioPreprocessCacheKey(undefined as any, 'standard');

      expect(typeof key1).toBe('string');
      expect(typeof key2).toBe('string');
      expect(key1).toMatch(/^[a-f0-9]{64}$/);
      expect(key2).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  // ── getPreprocessCachePath ────────────────────────────────────────────────

  describe('getPreprocessCachePath', () => {
    it('returns path with correct profile extension', () => {
      const cachePath = getPreprocessCachePath('abc123', 'standard');
      expect(cachePath).toMatch(/\.standard\.wav$/);
      expect(cachePath).toContain('abc123');
    });

    it('returns path with enhanced profile extension', () => {
      const cachePath = getPreprocessCachePath('abc123', 'enhanced');
      expect(cachePath).toMatch(/\.enhanced\.wav$/);
    });
  });

  // ── isPreprocessCacheFile ─────────────────────────────────────────────────

  describe('isPreprocessCacheFile', () => {
    it('returns true for files inside cache directory', () => {
      const uploadDir = getUploadDir();
      const cacheFile = `${uploadDir}/.cache/preprocessed/abc123.standard.wav`;
      expect(isPreprocessCacheFile(cacheFile)).toBe(true);
    });

    it('returns false for files outside cache directory', () => {
      expect(isPreprocessCacheFile('/tmp/some-other-file.wav')).toBe(false);
      expect(isPreprocessCacheFile('')).toBe(false);
    });
  });

  // ── resolveStoredAudioQuality ─────────────────────────────────────────────

  describe('resolveStoredAudioQuality', () => {
    it('returns audioQuality when present in diarization_json', () => {
      const asset = {
        diarization_json: JSON.stringify({
          audioQuality: { qualityScore: 85, qualityLabel: 'good' },
        }),
      };

      const result = resolveStoredAudioQuality(asset);
      expect(result).toEqual({ qualityScore: 85, qualityLabel: 'good' });
    });

    it('returns null when diarization_json is empty', () => {
      const asset = { diarization_json: '{}' };
      expect(resolveStoredAudioQuality(asset)).toBeNull();
    });

    it('returns null when diarization_json is null', () => {
      const asset = { diarization_json: null };
      expect(resolveStoredAudioQuality(asset)).toBeNull();
    });

    it('returns null when diarization_json is invalid JSON', () => {
      const asset = { diarization_json: 'not-json' };
      expect(resolveStoredAudioQuality(asset)).toBeNull();
    });

    it('returns null when audioQuality is not an object', () => {
      const asset = {
        diarization_json: JSON.stringify({ audioQuality: 'good' }),
      };
      expect(resolveStoredAudioQuality(asset)).toBeNull();
    });
  });
});
