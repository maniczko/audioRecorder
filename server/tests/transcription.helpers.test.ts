/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  buildAudioPreprocessCacheKey,
  getPreprocessCachePath,
  getUploadDir,
  isPreprocessCacheFile,
  mergeChunkedPayloads,
  resolveStoredAudioQuality,
} from "../transcription";

describe("transcription helpers", () => {
  it("buildAudioPreprocessCacheKey is stable and sensitive to changes", () => {
    const asset = {
      id: "asset_1",
      file_path: "audio.wav",
      updated_at: "2026-03-01T10:00:00Z",
      size_bytes: 1234,
      content_type: "audio/wav",
    };

    const keyA = buildAudioPreprocessCacheKey(asset, "standard");
    const keyB = buildAudioPreprocessCacheKey({ ...asset }, "standard");
    const keyC = buildAudioPreprocessCacheKey({ ...asset, size_bytes: 9999 }, "standard");

    expect(keyA).toBe(keyB);
    expect(keyA).not.toBe(keyC);
    expect(keyA).toMatch(/^[a-f0-9]{64}$/);
  });

  it("getPreprocessCachePath builds paths under the preprocess cache folder", () => {
    const cacheKey = "abc123";
    const cachePath = getPreprocessCachePath(cacheKey, "standard");

    expect(path.basename(cachePath)).toBe(`${cacheKey}.standard.wav`);
    expect(path.normalize(cachePath)).toContain(
      path.normalize(path.join(".cache", "preprocessed"))
    );
  });

  it("isPreprocessCacheFile detects cache paths correctly", () => {
    const inside = getPreprocessCachePath("inside", "enhanced");
    const outside = path.join(getUploadDir(), "outside.wav");

    expect(isPreprocessCacheFile(inside)).toBe(true);
    expect(isPreprocessCacheFile(outside)).toBe(false);
  });

  it("resolveStoredAudioQuality parses audioQuality payload safely", () => {
    expect(
      resolveStoredAudioQuality({
        diarization_json: '{"audioQuality":{"qualityLabel":"good"}}',
      })
    ).toEqual({ qualityLabel: "good" });

    expect(
      resolveStoredAudioQuality({
        diarization_json: '{"audioQuality":"bad"}',
      })
    ).toBeNull();

    expect(resolveStoredAudioQuality({ diarization_json: "not-json" })).toBeNull();
  });

  it("mergeChunkedPayloads merges payloads and computes diagnostics", () => {
    const payloads = [
      {
        payload: {
          segments: [{ start: 0, end: 1, text: "Hello" }],
          words: [{ word: "Hello", start: 0, end: 1 }],
          text: "Hello",
        },
        offsetSeconds: 0,
        diagnostics: {
          extracted: true,
          discardedAsTooSmall: false,
          vadFlaggedSilent: false,
          sentToStt: true,
          sttFailed: false,
          sttErrorMessage: "",
          hasSegments: true,
          hasWords: true,
          hasText: true,
        },
        sttResult: {
          providerId: "openai",
          providerLabel: "OpenAI STT",
          model: "gpt-4o-transcribe",
          attempts: [
            {
              providerId: "openai",
              providerLabel: "OpenAI STT",
              model: "gpt-4o-transcribe",
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
          sttErrorMessage: "Too small",
          hasSegments: false,
          hasWords: false,
          hasText: false,
        },
      },
    ];

    const result = mergeChunkedPayloads(payloads, 123);

    expect(result.segments).toHaveLength(1);
    expect(result.words).toHaveLength(1);
    expect(result.text).toBe("Hello");
    expect(result.sttProviderInfo?.providerId).toBe("openai");
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
});
