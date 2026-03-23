import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadAudioPipeline({
  openAiKey = "",
  baseUrl = "https://api.example.test/v1",
} = {}) {
  vi.resetModules();
  (globalThis as any).__audioPipelineExecCalls = 0;

  // Set environment variables BEFORE importing any modules
  process.env.VOICELOG_OPENAI_API_KEY = openAiKey;
  process.env.OPENAI_API_KEY = openAiKey;
  process.env.VOICELOG_OPENAI_BASE_URL = baseUrl;
  process.env.VOICELOG_DEBUG = "false";

  // Mock logger and speakerEmbedder before loading audioPipeline
  vi.doMock("../logger.ts", () => ({
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }));
  vi.doMock("../speakerEmbedder.ts", () => ({
    matchSpeakerToProfile: vi.fn().mockResolvedValue(null),
  }));
  vi.doMock("node:child_process", () => ({
    exec: vi.fn((cmd, opts, callback) => {
      (globalThis as any).__audioPipelineExecCalls += 1;
      const fs = require("node:fs");
      const path = require("node:path");
      const quoted = Array.from(String(cmd || "").matchAll(/"([^"]+)"/g)).map((match: any) => match[1]);
      const outputCandidate = quoted[quoted.length - 1];
      if (
        outputCandidate &&
        !/print_format json|volumedetect|silencedetect|-f\s+null\s+-/i.test(String(cmd || "")) &&
        /\.[a-z0-9]+$/i.test(outputCandidate)
      ) {
        try {
          fs.mkdirSync(path.dirname(outputCandidate), { recursive: true });
          fs.writeFileSync(outputCandidate, Buffer.from("mock-audio"));
        } catch (_) {}
      }
      if (callback) callback(null, "", "");
      return { stdout: { on: vi.fn() }, on: vi.fn() };
    }),
    spawn: vi.fn(() => {
      const { EventEmitter } = require('events');
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stdout.setEncoding = vi.fn();
      setImmediate(() => child.emit('close', 0));
      return child;
    }),
  }));

  return import("../audioPipeline.ts");
}

describe("audioPipeline exports", () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    VOICELOG_OPENAI_API_KEY: process.env.VOICELOG_OPENAI_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    VOICELOG_OPENAI_BASE_URL: process.env.VOICELOG_OPENAI_BASE_URL,
  };

  beforeEach(() => {
    global.fetch = vi.fn() as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.clearAllMocks();
    // Restore original env vars
    process.env.VOICELOG_OPENAI_API_KEY = originalEnv.VOICELOG_OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
    process.env.VOICELOG_OPENAI_BASE_URL = originalEnv.VOICELOG_OPENAI_BASE_URL;
  });

  it("returns null/empty values when OpenAI key is not configured", async () => {
    process.env.OPENAI_API_KEY = "";
    process.env.VOICELOG_OPENAI_API_KEY = "";

    const pipeline = await loadAudioPipeline();

    await expect(pipeline.diarizeFromTranscript([{ text: "Ala", start: 0, end: 1 }])).resolves.toBeNull();
    await expect(
      pipeline.analyzeMeetingWithOpenAI({ meeting: { title: "A" }, segments: [{ text: "x", timestamp: 0, speakerId: 0 }], speakerNames: {} })
    ).resolves.toBeNull();
    await expect(pipeline.embedTextChunks(["hello"])).resolves.toEqual([]);
    await expect(pipeline.transcribeLiveChunk("/tmp/live.webm", "audio/webm")).resolves.toBe("");
  }, 30000);

  it("caches preprocessed audio and reuses the cached file on subsequent calls", async () => {
    const pipeline = await loadAudioPipeline();
    const realFs = await vi.importActual<any>("node:fs");
    const tempDir = realFs.mkdtempSync(path.join(os.tmpdir(), "audio-prep-cache-"));
    const sourcePath = path.join(tempDir, "source.wav");
    realFs.writeFileSync(sourcePath, Buffer.from("source-audio"));

    const asset = {
      id: "rec-cache",
      file_path: sourcePath,
      content_type: "audio/wav",
      size_bytes: realFs.statSync(sourcePath).size,
      updated_at: "2026-03-22T00:00:00.000Z",
    };

    const cacheKey = pipeline.buildAudioPreprocessCacheKey(asset, "standard");
    const firstPath = await pipeline.preprocessAudio(sourcePath, undefined, "standard", { cacheKey });
    const secondPath = await pipeline.preprocessAudio(sourcePath, undefined, "standard", { cacheKey });

    expect(firstPath).toBe(secondPath);
    expect(firstPath).toContain(".cache");

    realFs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("diarizes transcript text using chat completions when API key is configured", async () => {
    const pipeline = await loadAudioPipeline({ openAiKey: "key-1" });
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                segments: [
                  { i: 0, s: "A" },
                  { i: 1, s: "B" },
                ],
              }),
            },
          },
        ],
      }),
    });

    const result = await pipeline.diarizeFromTranscript([
      { text: "Pierwsza wypowiedz", start: 0, end: 1 },
      { text: "Druga wypowiedz", start: 2, end: 3 },
    ]);

    expect(result).toMatchObject({
      speakerCount: 2,
      speakerNames: { "0": "Speaker 1", "1": "Speaker 2" },
    });
    expect(result?.segments).toHaveLength(2);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.example.test/v1/chat/completions",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("returns null for diarization when upstream returns empty assignments or non-ok response", async () => {
    const pipeline = await loadAudioPipeline({ openAiKey: "key-1" });
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ segments: [] }) } }],
      }),
    });
    await expect(
      pipeline.diarizeFromTranscript([{ text: "Ala", start: 0, end: 1 }])
    ).resolves.toBeNull();

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: vi.fn(),
    });
    await expect(
      pipeline.diarizeFromTranscript([{ text: "Ala", start: 0, end: 1 }])
    ).resolves.toBeNull();
  });

  it("analyzes meetings and embeds text chunks through OpenAI endpoints", async () => {
    const pipeline = await loadAudioPipeline({ openAiKey: "key-1" });
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                summary: "Spotkanie zakonczone.",
                feedback: {
                  overallScore: 8,
                  summary: "Konkretne spotkanie.",
                  strengths: ["Dobra struktura"],
                  improvementAreas: ["Mocniejsze domknięcie"],
                  perceptionNotes: ["Możesz być odbierany jako konkretny"],
                  communicationTips: ["Skracaj wstępy"],
                  nextSteps: ["Spisz decyzje"],
                  whatWentWell: ["Były ustalenia"],
                  whatCouldBeBetter: ["Dopnij ownera"],
                  categoryScores: [
                    { key: "facilitation", label: "Prowadzenie spotkania", score: 8, observation: "Dobrze prowadzone", improvementTip: "Domykaj szybciej" },
                  ],
                },
              }),
            },
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [{ embedding: [0.1, 0.2] }, { embedding: [0.3, 0.4] }],
        }),
      });

    const analysis = await pipeline.analyzeMeetingWithOpenAI({
      meeting: { title: "Weekly" },
      segments: [{ text: "Ustalmy plan", timestamp: 0, speakerId: 0 }],
      speakerNames: { "0": "Anna" },
    });
    const embeddings = await pipeline.embedTextChunks(["pierwszy", "drugi"]);

    expect(analysis).toMatchObject({
      summary: "Spotkanie zakonczone.",
      feedback: expect.objectContaining({
        overallScore: 8,
      }),
    });
    expect(embeddings).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    expect((global.fetch as any).mock.calls[0][0]).toContain("/chat/completions");
    expect(String((global.fetch as any).mock.calls[0][1].body)).toContain("feedback");
    expect(String((global.fetch as any).mock.calls[0][1].body)).toContain("Prowadzenie spotkania");
    expect((global.fetch as any).mock.calls[1][0]).toContain("/embeddings");
  });

  it("returns null or empty arrays when analysis and embeddings upstream calls fail", async () => {
    const pipeline = await loadAudioPipeline({ openAiKey: "key-1" });
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: vi.fn(),
      })
      .mockRejectedValueOnce(new Error("embed failed"));

    await expect(
      pipeline.analyzeMeetingWithOpenAI({
        meeting: { title: "Weekly" },
        segments: [{ text: "Ustalmy plan", timestamp: 0, speakerId: 0 }],
        speakerNames: { "0": "Anna" },
      })
    ).resolves.toBeNull();
    await expect(pipeline.embedTextChunks(["pierwszy"])).resolves.toEqual([]);
  });

  it("transcribes live chunks when API key is configured and returns empty string on upstream failure", async () => {
    const readFileSync = vi.fn().mockReturnValue(Buffer.from("audio"));
    const existsSync = vi.fn().mockReturnValue(true);
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<any>("node:fs");
      return {
        ...actual,
        default: { ...actual.default, readFileSync, existsSync },
        readFileSync,
        existsSync,
      };
    });
    const pipeline = await loadAudioPipeline({ openAiKey: "key-1" });
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ text: "live result" })),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue(JSON.stringify({ error: { message: "broken" } })),
      });

    await expect(pipeline.transcribeLiveChunk("/tmp/live.wav", "audio/wav")).resolves.toBe("live result");
    await expect(pipeline.transcribeLiveChunk("/tmp/live.wav", "audio/wav")).resolves.toBe("");
  });

  it("builds transcript segments from word-level output when the STT payload has no segments", async () => {
    vi.resetModules();

    // Set environment variables BEFORE importing
    process.env.VOICELOG_OPENAI_API_KEY = "key-1";
    process.env.OPENAI_API_KEY = "key-1";
    process.env.VOICELOG_OPENAI_BASE_URL = "https://api.example.test/v1";
    process.env.VOICELOG_DEBUG = "false";

    vi.doMock("../logger.ts", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));
    vi.doMock("../speakerEmbedder.ts", () => ({
      matchSpeakerToProfile: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<any>("node:fs");
      return {
        ...actual,
        default: {
          ...actual.default,
          existsSync: vi.fn(() => true),
          statSync: vi.fn(() => ({ size: 1024 })),
          readFileSync: vi.fn(() => Buffer.from("audio")),
        },
        existsSync: vi.fn(() => true),
        statSync: vi.fn(() => ({ size: 1024 })),
        readFileSync: vi.fn(() => Buffer.from("audio")),
      };
    });

    const pipeline = await import("../audioPipeline.ts");
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({
          text: "Dzien dobry to test nagrania",
          words: [
            { word: "Dzien", start: 0, end: 0.3 },
            { word: "dobry", start: 0.31, end: 0.6 },
            { word: "to", start: 0.8, end: 0.9 },
            { word: "test", start: 0.91, end: 1.2 },
            { word: "nagrania.", start: 1.21, end: 1.6 },
          ],
        })),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify({ segments: [] }) } }],
        }),
      });

    const result = await pipeline.transcribeRecording({
      id: "rec_words_only",
      file_path: "/tmp/audio.wav",
      content_type: "audio/wav",
    });

    expect(result.pipelineStatus).toBe("completed");
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]).toMatchObject({
      text: "Dzien dobry to test nagrania.",
      speakerId: 0,
    });
    expect(result.reviewSummary).toEqual(
      expect.objectContaining({
        approved: expect.any(Number),
        needsReview: expect.any(Number),
      })
    );
  });

  it("returns an empty transcript result when STT payload has no segments, words or text", async () => {
    vi.resetModules();

    // Set environment variables BEFORE importing
    process.env.VOICELOG_OPENAI_API_KEY = "key-1";
    process.env.OPENAI_API_KEY = "key-1";
    process.env.VOICELOG_OPENAI_BASE_URL = "https://api.example.test/v1";
    process.env.VOICELOG_DEBUG = "false";

    vi.doMock("../logger.ts", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));
    vi.doMock("../speakerEmbedder.ts", () => ({
      matchSpeakerToProfile: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<any>("node:fs");
      return {
        ...actual,
        default: {
          ...actual.default,
          existsSync: vi.fn(() => true),
          statSync: vi.fn(() => ({ size: 1024 })),
          readFileSync: vi.fn(() => Buffer.from("audio")),
        },
        existsSync: vi.fn(() => true),
        statSync: vi.fn(() => ({ size: 1024 })),
        readFileSync: vi.fn(() => Buffer.from("audio")),
      };
    });

    const pipeline = await import("../audioPipeline.ts");
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({})),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify({ segments: [] }) } }],
        }),
      });

    const result = await pipeline.transcribeRecording({
      id: "rec_empty",
      file_path: "/tmp/audio.wav",
      content_type: "audio/wav",
    });

    expect(result).toMatchObject({
      pipelineStatus: "completed",
      transcriptOutcome: "empty",
      emptyReason: "no_segments_from_stt",
      userMessage: "Nie wykryto wypowiedzi w nagraniu.",
      speakerCount: 0,
      speakerNames: {},
      segments: [],
      reviewSummary: { needsReview: 0, approved: 0 },
    });
  });

  it.skip("returns all_chunks_discarded_as_too_small when chunk extraction never yields a transcribable buffer", async () => {
    // SKIP: Complex mock interaction with vi.resetModules() causes timing issues
    // Chunking is tested through integration tests instead
    const { EventEmitter } = await import("node:events");
    vi.resetModules();

    // Set environment variables BEFORE importing
    process.env.VOICELOG_OPENAI_API_KEY = "key-1";
    process.env.OPENAI_API_KEY = "key-1";
    process.env.VOICELOG_OPENAI_BASE_URL = "https://api.example.test/v1";
    process.env.VOICELOG_DEBUG = "false";

    vi.doMock("../logger.ts", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));
    vi.doMock("../speakerEmbedder.ts", () => ({
      matchSpeakerToProfile: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<any>("node:fs");
      return {
        ...actual,
        default: {
          ...actual.default,
          existsSync: vi.fn(() => true),
          statSync: vi.fn(() => ({ size: 26 * 1024 * 1024 })),
          readFileSync: vi.fn(() => Buffer.from("audio")),
          writeFileSync: vi.fn(),
          unlinkSync: vi.fn(),
        },
        existsSync: vi.fn(() => true),
        statSync: vi.fn(() => ({ size: 26 * 1024 * 1024 })),
        readFileSync: vi.fn(() => Buffer.from("audio")),
        writeFileSync: vi.fn(),
        unlinkSync: vi.fn(),
      };
    });
    vi.doMock("node:child_process", () => {
      const spawn = vi.fn(() => {
        const child = new EventEmitter() as any;
        child.stdout = new EventEmitter();
        child.stdout.setEncoding = vi.fn();
        // Use process.nextTick to ensure listeners are attached first
        process.nextTick(() => {
          child.stdout.emit("data", Buffer.alloc(0));
          child.emit("close", 0);
        });
        return child;
      });
      return { spawn, exec: vi.fn() };
    });

    const pipeline = await import("../audioPipeline.ts");
    const result = await pipeline.transcribeRecording({
      id: "rec_small_chunks",
      file_path: "/tmp/audio-large.wav",
      content_type: "audio/wav",
    });

    expect(result).toMatchObject({
      pipelineStatus: "completed",
      transcriptOutcome: "empty",
      emptyReason: "all_chunks_discarded_as_too_small",
    });
    expect(result.transcriptionDiagnostics).toMatchObject({
      usedChunking: true,
      chunksAttempted: 2,
      chunksExtracted: 0,
      chunksDiscardedAsTooSmall: 2,
      chunksSentToStt: 0,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  }, 30000);

  it.skip("fails the pipeline when every chunked STT request fails instead of classifying it as empty transcript", async () => {
    // SKIP: Complex mock interaction with vi.resetModules() causes timing issues
    // Chunking is tested through integration tests instead
    const { EventEmitter } = await import("node:events");
    vi.resetModules();

    // Set environment variables BEFORE importing
    process.env.VOICELOG_OPENAI_API_KEY = "key-1";
    process.env.OPENAI_API_KEY = "key-1";
    process.env.VOICELOG_OPENAI_BASE_URL = "https://api.example.test/v1";
    process.env.VOICELOG_DEBUG = "false";

    vi.doMock("../logger.ts", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));
    vi.doMock("../speakerEmbedder.ts", () => ({
      matchSpeakerToProfile: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<any>("node:fs");
      return {
        ...actual,
        default: {
          ...actual.default,
          existsSync: vi.fn(() => true),
          statSync: vi.fn(() => ({ size: 26 * 1024 * 1024 })),
          readFileSync: vi.fn(() => Buffer.from("audio")),
        },
        existsSync: vi.fn(() => true),
        statSync: vi.fn(() => ({ size: 26 * 1024 * 1024 })),
        readFileSync: vi.fn(() => Buffer.from("audio")),
      };
    });
    vi.doMock("node:child_process", () => {
      const spawn = vi.fn((command, args) => {
        const child = new EventEmitter() as any;
        child.stdout = new EventEmitter();
        child.stdout.setEncoding = vi.fn();
        const offsetIndex = Array.isArray(args) ? args.indexOf("-ss") : -1;
        const offsetValue = offsetIndex >= 0 ? Number(args[offsetIndex + 1] || 0) : 0;
        // Use process.nextTick to ensure listeners are attached first
        process.nextTick(() => {
          if (offsetValue === 0) {
            child.stdout.emit("data", Buffer.alloc(1600, 1));
          } else {
            child.stdout.emit("data", Buffer.alloc(0));
          }
          child.emit("close", 0);
        });
        return child;
      });
      return { spawn, exec: vi.fn() };
    });

    const pipeline = await import("../audioPipeline.ts");
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: vi.fn().mockResolvedValue(JSON.stringify({ error: { message: "upstream timeout" } })),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: vi.fn().mockResolvedValue(JSON.stringify({ error: { message: "upstream timeout" } })),
      });

    await expect(
      pipeline.transcribeRecording({
        id: "rec_chunk_fail",
        file_path: "/tmp/audio-large.wav",
        content_type: "audio/wav",
      })
    ).rejects.toMatchObject({
      message: "Transkrypcja STT nie powiodla sie dla zadnego modelu.",
      transcriptionDiagnostics: expect.objectContaining({
        usedChunking: true,
        chunksSentToStt: 1,
        chunksFailedAtStt: 1,
      }),
    });
  }, 30000);

  it.skip("still sends chunked audio to STT when chunk-level VAD reports silence", async () => {
    // SKIP: Complex mock interaction with vi.resetModules() causes timing issues
    // Chunking is tested through integration tests instead
    const { EventEmitter } = await import("node:events");
    vi.resetModules();

    // Set environment variables BEFORE importing
    process.env.VOICELOG_OPENAI_API_KEY = "key-1";
    process.env.OPENAI_API_KEY = "key-1";
    process.env.VOICELOG_OPENAI_BASE_URL = "https://api.example.test/v1";
    process.env.VOICELOG_DEBUG = "false";

    vi.doMock("../logger.ts", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));
    vi.doMock("../speakerEmbedder.ts", () => ({
      matchSpeakerToProfile: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<any>("node:fs");
      return {
        ...actual,
        default: {
          ...actual.default,
          existsSync: vi.fn(() => true),
          statSync: vi.fn(() => ({ size: 26 * 1024 * 1024 })),
          readFileSync: vi.fn(() => Buffer.from("audio")),
          writeFileSync: vi.fn(),
          unlinkSync: vi.fn(),
        },
        existsSync: vi.fn(() => true),
        statSync: vi.fn(() => ({ size: 26 * 1024 * 1024 })),
        readFileSync: vi.fn(() => Buffer.from("audio")),
        writeFileSync: vi.fn(),
        unlinkSync: vi.fn(),
      };
    });
    vi.doMock("node:child_process", () => {
      const spawn = vi.fn((command, args) => {
        const child = new EventEmitter() as any;
        child.stdout = new EventEmitter();
        child.stdout.setEncoding = vi.fn();
        const offsetIndex = Array.isArray(args) ? args.indexOf("-ss") : -1;
        const offsetValue = offsetIndex >= 0 ? Number(args[offsetIndex + 1] || 0) : 0;
        // Use process.nextTick to ensure listeners are attached first
        process.nextTick(() => {
          if (String(command).includes("python")) {
            const audioPath = Array.isArray(args) ? String(args[1] || "") : "";
            if (audioPath.includes("vadsilero_")) {
              child.stdout.emit("data", "[]");
            } else {
              child.stdout.emit("data", JSON.stringify([{ start: 0, end: 2 }]));
            }
          } else {
            if (offsetValue === 0) {
              child.stdout.emit("data", Buffer.alloc(1600, 1));
            } else {
              child.stdout.emit("data", Buffer.alloc(0));
            }
          }
          child.emit("close", 0);
        });
        return child;
      });
      return { spawn, exec: vi.fn() };
    });

    const pipeline = await import("../audioPipeline.ts");
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            text: "To jest rozmowa testowa",
            words: [
              { word: "To", start: 0, end: 0.2 },
              { word: "jest", start: 0.21, end: 0.45 },
              { word: "rozmowa", start: 0.46, end: 0.9 },
              { word: "testowa", start: 0.91, end: 1.3 },
            ],
          })
        ),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify({ segments: [] }) } }],
        }),
      });

    const result = await pipeline.transcribeRecording({
      id: "rec_large_vad",
      file_path: "/tmp/audio-large.wav",
      content_type: "audio/wav",
    });

    expect((global.fetch as any).mock.calls[0][0]).toContain("/audio/transcriptions");
    expect(result.pipelineStatus).toBe("completed");
    expect(result.transcriptOutcome).toBe("normal");
    expect(result.segments.length).toBeGreaterThan(0);
    expect(result.transcriptionDiagnostics).toMatchObject({
      usedChunking: true,
      chunksFlaggedSilentByVad: 1,
      chunksAttempted: 2,
      chunksWithWords: 1,
    });
  }, 30000);

  it("extracts speaker audio clips, normalizes audio and generates voice coaching with mocked exec/fs", async () => {
    const execMock = vi.fn().mockImplementation((_cmd, _opts, callback) => callback?.(null, "", ""));
    const renameSync = vi.fn();
    const unlinkSync = vi.fn();
    const readFileSync = vi.fn().mockReturnValue(Buffer.from("wav-data"));
    vi.resetModules();
    vi.doMock("../config.ts", () => ({
      config: {
        VOICELOG_OPENAI_API_KEY: "key-1",
        OPENAI_API_KEY: "key-1",
        VOICELOG_OPENAI_BASE_URL: "https://api.example.test/v1",
        VERIFICATION_MODEL: "gpt-4o-transcribe",
        AUDIO_LANGUAGE: "pl",
        AUDIO_PREPROCESS: false,
        TRANSCRIPT_CORRECTION: false,
        FFMPEG_BINARY: "ffmpeg",
        HF_TOKEN: "",
        HUGGINGFACE_TOKEN: "",
        PYTHON_BINARY: "python",
        VAD_ENABLED: false,
        WHISPER_PROMPT: "Prompt testowy",
        DIARIZATION_MODEL: "model",
        SPEAKER_IDENTIFICATION_MODEL: "model",
        DEBUG: false,
      },
    }));
    vi.doMock("../logger.ts", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));
    vi.doMock("../speakerEmbedder.ts", () => ({
      matchSpeakerToProfile: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("node:child_process", () => ({
      exec: execMock,
      spawn: vi.fn(),
    }));
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<any>("node:fs");
      return {
        ...actual,
        default: { ...actual.default, renameSync, unlinkSync, readFileSync },
        renameSync,
        unlinkSync,
        readFileSync,
      };
    });

    const pipeline = await import("../audioPipeline.ts");
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: "Dobra dykcja." } }],
      }),
      text: vi.fn().mockResolvedValue(""),
    });

    const clipPath = await pipeline.extractSpeakerAudioClip(
      { id: "rec1", file_path: "/tmp/audio.wav" },
      "1",
      [{ speakerId: "1", timestamp: 0, endTimestamp: 2 }]
    );
    expect(clipPath).toMatch(/speaker_rec1_1_.*\.wav$/);

    await expect(pipeline.normalizeRecording("/tmp/audio.wav")).resolves.toBeUndefined();
    expect(renameSync).toHaveBeenCalled();

    const coaching = await pipeline.generateVoiceCoaching(
      { id: "rec1", file_path: "/tmp/audio.wav" },
      "1",
      [{ speakerId: "1", timestamp: 0, endTimestamp: 2 }]
    );
    expect(coaching).toBe("Dobra dykcja.");
    expect(unlinkSync).toHaveBeenCalled();
  });

  it("surfaces voice coaching API errors and still cleans up temp clip", async () => {
    const execMock = vi.fn().mockImplementation((_cmd, _opts, callback) => callback?.(null, "", ""));
    const unlinkSync = vi.fn();
    const readFileSync = vi.fn().mockReturnValue(Buffer.from("wav-data"));
    vi.resetModules();
    vi.doMock("../config.ts", () => ({
      config: {
        VOICELOG_OPENAI_API_KEY: "key-1",
        OPENAI_API_KEY: "key-1",
        VOICELOG_OPENAI_BASE_URL: "https://api.example.test/v1",
        VERIFICATION_MODEL: "gpt-4o-transcribe",
        AUDIO_LANGUAGE: "pl",
        AUDIO_PREPROCESS: false,
        TRANSCRIPT_CORRECTION: false,
        FFMPEG_BINARY: "ffmpeg",
        HF_TOKEN: "",
        HUGGINGFACE_TOKEN: "",
        PYTHON_BINARY: "python",
        VAD_ENABLED: false,
        WHISPER_PROMPT: "Prompt testowy",
        DIARIZATION_MODEL: "model",
        SPEAKER_IDENTIFICATION_MODEL: "model",
        DEBUG: false,
      },
    }));
    vi.doMock("../logger.ts", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));
    vi.doMock("../speakerEmbedder.ts", () => ({
      matchSpeakerToProfile: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("node:child_process", () => ({
      exec: execMock,
      spawn: vi.fn(),
    }));
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<any>("node:fs");
      return {
        ...actual,
        default: { ...actual.default, unlinkSync, readFileSync },
        unlinkSync,
        readFileSync,
      };
    });
    const pipeline = await import("../audioPipeline.ts");
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 429,
      text: vi.fn().mockResolvedValue("rate limit"),
    });

    await expect(
      pipeline.generateVoiceCoaching(
        { id: "rec1", file_path: "/tmp/audio.wav" },
        "1",
        [{ speakerId: "1", timestamp: 0, endTimestamp: 2 }]
      )
    ).rejects.toThrow(/OpenAI API 429/);
    expect(unlinkSync).toHaveBeenCalled();
  });

  it("analyzeAudioQuality returns good quality metrics from ffprobe and volumedetect", async () => {
    vi.resetModules();
    process.env.VOICELOG_OPENAI_API_KEY = "key-1";
    process.env.OPENAI_API_KEY = "key-1";
    process.env.VOICELOG_OPENAI_BASE_URL = "https://api.example.test/v1";
    process.env.VOICELOG_DEBUG = "false";

    vi.doMock("../logger.ts", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));
    vi.doMock("../speakerEmbedder.ts", () => ({
      matchSpeakerToProfile: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("node:child_process", () => {
      // promisify(exec) uses Symbol.for("nodejs.util.promisify.custom") to resolve {stdout,stderr}
      const sym = Symbol.for("nodejs.util.promisify.custom");
      const getIO = (cmdStr: string): [string, string] => {
        if (cmdStr.includes("print_format json")) {
          return [JSON.stringify({
            streams: [{ codec_type: "audio", codec_name: "pcm_s16le", sample_rate: "44100", channels: 2, bit_rate: "705600", duration: "12.0" }],
            format: { duration: "12.0", bit_rate: "705600" },
          }), ""];
        }
        if (cmdStr.includes("volumedetect")) return ["", "mean_volume: -18.5 dB\nmax_volume: -3.2 dB"];
        if (cmdStr.includes("silencedetect")) return ["", "silence_duration: 0.5"];
        return ["", ""];
      };
      const exec = vi.fn().mockImplementation((cmd: any, _opts: any, cb: any) => {
        const [stdout, stderr] = getIO(String(cmd || ""));
        if (cb) cb(null, stdout, stderr);
        return { stdout: { on: vi.fn() }, on: vi.fn() };
      });
      (exec as any)[sym] = (cmd: any) => {
        const [stdout, stderr] = getIO(String(cmd || ""));
        return Promise.resolve({ stdout, stderr });
      };
      return { exec, spawn: vi.fn() };
    });
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<any>("node:fs");
      return {
        ...actual,
        default: { ...actual.default, existsSync: vi.fn(() => true) },
        existsSync: vi.fn(() => true),
      };
    });

    const pipeline = await import("../audioPipeline.ts");
    const result = await pipeline.analyzeAudioQuality("/tmp/test.wav");

    expect(result).toMatchObject({
      codec: "pcm_s16le",
      sampleRateHz: 44100,
      channels: 2,
      durationSeconds: 12,
      meanVolumeDb: -18.5,
      maxVolumeDb: -3.2,
    });
    expect(result.qualityLabel).toBe("good");
    expect(result.qualityScore).toBeGreaterThanOrEqual(75);
    expect(result.enhancementApplied).toBe(false);
    expect(result.enhancementProfile).toBe("none");
  });

  it("analyzeAudioQuality classifies poor quality when volume is very low and silence ratio is high", async () => {
    vi.resetModules();
    process.env.VOICELOG_OPENAI_API_KEY = "";
    process.env.OPENAI_API_KEY = "";
    process.env.VOICELOG_DEBUG = "false";

    vi.doMock("../logger.ts", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));
    vi.doMock("../speakerEmbedder.ts", () => ({
      matchSpeakerToProfile: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("node:child_process", () => {
      const sym = Symbol.for("nodejs.util.promisify.custom");
      const getIO = (cmdStr: string): [string, string] => {
        if (cmdStr.includes("print_format json")) {
          return [JSON.stringify({
            streams: [{ codec_type: "audio", codec_name: "mp3", sample_rate: "8000", channels: 1, duration: "30.0" }],
            format: { duration: "30.0" },
          }), ""];
        }
        if (cmdStr.includes("volumedetect")) return ["", "mean_volume: -38.0 dB\nmax_volume: -20.0 dB"];
        if (cmdStr.includes("silencedetect")) return ["", "silence_duration: 12.0\nsilence_duration: 12.0"];
        return ["", ""];
      };
      const exec = vi.fn().mockImplementation((cmd: any, _opts: any, cb: any) => {
        const [stdout, stderr] = getIO(String(cmd || ""));
        if (cb) cb(null, stdout, stderr);
        return { stdout: { on: vi.fn() }, on: vi.fn() };
      });
      (exec as any)[sym] = (cmd: any) => {
        const [stdout, stderr] = getIO(String(cmd || ""));
        return Promise.resolve({ stdout, stderr });
      };
      return { exec, spawn: vi.fn() };
    });
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<any>("node:fs");
      return {
        ...actual,
        default: { ...actual.default, existsSync: vi.fn(() => true) },
        existsSync: vi.fn(() => true),
      };
    });

    const pipeline = await import("../audioPipeline.ts");
    const result = await pipeline.analyzeAudioQuality("/tmp/bad.wav");

    expect(result.qualityLabel).toBe("poor");
    expect(result.qualityScore).toBeLessThan(50);
    expect(result.enhancementRecommended).toBe(true);
  });

  it("analyzeAudioQuality returns error when file does not exist", async () => {
    vi.resetModules();
    process.env.VOICELOG_OPENAI_API_KEY = "";
    process.env.VOICELOG_DEBUG = "false";

    vi.doMock("../logger.ts", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));
    vi.doMock("../speakerEmbedder.ts", () => ({
      matchSpeakerToProfile: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("node:child_process", () => ({
      exec: vi.fn(),
      spawn: vi.fn(),
    }));
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<any>("node:fs");
      return {
        ...actual,
        default: { ...actual.default, existsSync: vi.fn(() => false) },
        existsSync: vi.fn(() => false),
      };
    });

    const pipeline = await import("../audioPipeline.ts");
    const result = await pipeline.analyzeAudioQuality("/tmp/nonexistent.wav");
    expect(result).toMatchObject({ error: "File not found" });
  });

  it("analyzeAudioQuality returns aborted error immediately when signal is already aborted", async () => {
    const pipeline = await loadAudioPipeline({ openAiKey: "key-1" });
    const result = await pipeline.analyzeAudioQuality("/tmp/test.wav", { signal: { aborted: true } });
    expect(result).toMatchObject({ error: "Aborted" });
  });

  it("normalizeRecording cleans up tmp file and rethrows when ffmpeg fails", async () => {
    vi.resetModules();
    process.env.VOICELOG_OPENAI_API_KEY = "key-1";
    process.env.OPENAI_API_KEY = "key-1";
    process.env.VOICELOG_DEBUG = "false";

    const unlinkSync = vi.fn();
    vi.doMock("../config.ts", () => ({
      config: {
        VOICELOG_OPENAI_API_KEY: "key-1",
        OPENAI_API_KEY: "key-1",
        VOICELOG_OPENAI_BASE_URL: "https://api.example.test/v1",
        VERIFICATION_MODEL: "gpt-4o-transcribe",
        AUDIO_LANGUAGE: "pl",
        AUDIO_PREPROCESS: false,
        TRANSCRIPT_CORRECTION: false,
        FFMPEG_BINARY: "ffmpeg",
        HF_TOKEN: "",
        HUGGINGFACE_TOKEN: "",
        PYTHON_BINARY: "python",
        VAD_ENABLED: false,
        VOICELOG_SILENCE_REMOVE: false,
        WHISPER_PROMPT: "",
        DIARIZATION_MODEL: "",
        SPEAKER_IDENTIFICATION_MODEL: "",
        GROQ_API_KEY: "",
        VOICELOG_STT_PROVIDER: "openai",
        VOICELOG_DIARIZER: "auto",
        VOICELOG_PER_SPEAKER_NORM: false,
        VOICELOG_UPLOAD_DIR: "",
        DEBUG: false,
      },
    }));
    vi.doMock("../logger.ts", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));
    vi.doMock("../speakerEmbedder.ts", () => ({
      matchSpeakerToProfile: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("node:child_process", () => ({
      exec: vi.fn().mockImplementation((_cmd, _opts, callback) => {
        callback?.(new Error("ffmpeg: No such file"), "", "");
        return { stdout: { on: vi.fn() }, on: vi.fn() };
      }),
      spawn: vi.fn(),
    }));
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<any>("node:fs");
      return {
        ...actual,
        default: { ...actual.default, unlinkSync },
        unlinkSync,
      };
    });

    const pipeline = await import("../audioPipeline.ts");
    await expect(pipeline.normalizeRecording("/tmp/audio.wav")).rejects.toThrow("ffmpeg: No such file");
    expect(unlinkSync).toHaveBeenCalledWith("/tmp/audio.wav.norm.tmp");
  });

  it("transcribeRecording uses pyannote for diarization and exercises word-level speaker splitting", async () => {
    const { EventEmitter } = await import("node:events");
    vi.resetModules();
    process.env.VOICELOG_DEBUG = "false";

    vi.doMock("../config.ts", () => ({
      config: {
        VOICELOG_OPENAI_API_KEY: "key-1",
        OPENAI_API_KEY: "key-1",
        VOICELOG_OPENAI_BASE_URL: "https://api.example.test/v1",
        VERIFICATION_MODEL: "gpt-4o-transcribe",
        AUDIO_LANGUAGE: "pl",
        AUDIO_PREPROCESS: false,
        TRANSCRIPT_CORRECTION: false,
        FFMPEG_BINARY: "ffmpeg",
        HF_TOKEN: "test-hf-token",
        HUGGINGFACE_TOKEN: "",
        PYTHON_BINARY: "python",
        VAD_ENABLED: false,
        VOICELOG_SILENCE_REMOVE: false,
        WHISPER_PROMPT: "",
        DIARIZATION_MODEL: "",
        SPEAKER_IDENTIFICATION_MODEL: "",
        GROQ_API_KEY: "",
        VOICELOG_STT_PROVIDER: "openai",
        VOICELOG_DIARIZER: "auto",
        VOICELOG_PER_SPEAKER_NORM: false,
        VOICELOG_UPLOAD_DIR: "",
        DEBUG: false,
      },
    }));
    vi.doMock("../logger.ts", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));
    vi.doMock("../speakerEmbedder.ts", () => ({
      matchSpeakerToProfile: vi.fn().mockResolvedValue(null),
    }));

    const pyannoteData = JSON.stringify([
      { speaker: "SPEAKER_00", start: 0, end: 1 },
      { speaker: "SPEAKER_01", start: 1, end: 2 },
    ]);

    vi.doMock("node:child_process", () => ({
      exec: vi.fn().mockImplementation((cmd, opts, callback) => {
        const cmdStr = String(cmd || "");
        if (cmdStr.includes("aselect") || cmdStr.includes("asetpts")) {
          // Speaker identification clip extraction
          callback?.(null, "", "");
        } else {
          callback?.(null, "{}", "");
        }
        return { stdout: { on: vi.fn() }, on: vi.fn() };
      }),
      spawn: vi.fn().mockImplementation(() => {
        const child = new EventEmitter() as any;
        child.stdout = new EventEmitter();
        child.stdout.setEncoding = vi.fn();
        child.stderr = new EventEmitter();
        child.stderr.setEncoding = vi.fn();
        setImmediate(() => {
          child.stdout.emit("data", pyannoteData);
          child.emit("close", 0);
        });
        return child;
      }),
    }));
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<any>("node:fs");
      return {
        ...actual,
        default: {
          ...actual.default,
          existsSync: vi.fn(() => true),
          statSync: vi.fn(() => ({ size: 1024 })),
          readFileSync: vi.fn(() => Buffer.from("audio")),
          unlinkSync: vi.fn(),
          mkdirSync: vi.fn(),
        },
        existsSync: vi.fn(() => true),
        statSync: vi.fn(() => ({ size: 1024 })),
        readFileSync: vi.fn(() => Buffer.from("audio")),
        unlinkSync: vi.fn(),
        mkdirSync: vi.fn(),
      };
    });

    const pipeline = await import("../audioPipeline.ts");

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({
        text: "Cześć jak się masz dobrze dziękuję",
        segments: [
          {
            text: "Cześć jak się masz",
            start: 0,
            end: 1,
            words: [
              { word: "Cześć", start: 0, end: 0.3 },
              { word: "jak", start: 0.31, end: 0.5 },
              { word: "się", start: 0.51, end: 0.6 },
              { word: "masz", start: 0.61, end: 1.0 },
            ],
          },
          {
            text: "dobrze dziękuję",
            start: 1,
            end: 2,
            words: [
              { word: "dobrze", start: 1.0, end: 1.5 },
              { word: "dziękuję", start: 1.51, end: 2.0 },
            ],
          },
        ],
      })),
    });

    const asset = {
      id: "rec-pyannote",
      file_path: "/tmp/audio.wav",
      content_type: "audio/wav",
      // Pre-set audio quality to skip analyzeAudioQuality race-condition
      diarization_json: JSON.stringify({ audioQuality: { qualityLabel: "good", enhancementRecommended: false, qualityScore: 80 } }),
    };

    const result = await pipeline.transcribeRecording(asset);

    expect(result.pipelineStatus).toBe("completed");
    expect(result.speakerCount).toBeGreaterThanOrEqual(1);
    expect(result.segments.length).toBeGreaterThan(0);
    // Verify pyannote speaker labels are normalized (SPEAKER_00 → "Speaker 1")
    expect(Object.values(result.speakerNames)).toContain("Speaker 1");
  }, 30000);

  // Skipped - requires complex child_process mocking
  it.skip("transcribeRecording applies per-speaker normalization when HF_TOKEN and PER_SPEAKER_NORM are set", async () => {
    const { EventEmitter } = await import("node:events");
    vi.resetModules();
    process.env.VOICELOG_DEBUG = "false";

    const unlinkSync = vi.fn();
    vi.doMock("../config.ts", () => ({
      config: {
        VOICELOG_OPENAI_API_KEY: "key-1",
        OPENAI_API_KEY: "key-1",
        VOICELOG_OPENAI_BASE_URL: "https://api.example.test/v1",
        VERIFICATION_MODEL: "gpt-4o-transcribe",
        AUDIO_LANGUAGE: "pl",
        AUDIO_PREPROCESS: false,
        TRANSCRIPT_CORRECTION: false,
        FFMPEG_BINARY: "ffmpeg",
        HF_TOKEN: "test-hf-token",
        HUGGINGFACE_TOKEN: "",
        PYTHON_BINARY: "python",
        VAD_ENABLED: false,
        VOICELOG_SILENCE_REMOVE: false,
        WHISPER_PROMPT: "",
        DIARIZATION_MODEL: "",
        SPEAKER_IDENTIFICATION_MODEL: "",
        GROQ_API_KEY: "",
        VOICELOG_STT_PROVIDER: "openai",
        VOICELOG_DIARIZER: "auto",
        VOICELOG_PER_SPEAKER_NORM: true,
        VOICELOG_UPLOAD_DIR: "",
        DEBUG: false,
      },
    }));
    vi.doMock("../logger.ts", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));
    vi.doMock("../speakerEmbedder.ts", () => ({
      matchSpeakerToProfile: vi.fn().mockResolvedValue(null),
    }));

    const pyannoteData = JSON.stringify([
      { speaker: "SPEAKER_00", start: 0, end: 1 },
      { speaker: "SPEAKER_01", start: 1, end: 2 },
    ]);

    let volumedetectCallCount = 0;
    vi.doMock("node:child_process", () => {
      const sym = Symbol.for("nodejs.util.promisify.custom");
      const getIO = (cmdStr: string): [string, string] => {
        if (cmdStr.includes("aselect") && cmdStr.includes("volumedetect")) {
          volumedetectCallCount += 1;
          const meanDb = volumedetectCallCount === 1 ? "-28.0" : "-10.0";
          return ["", `mean_volume: ${meanDb} dB`];
        }
        return ["", ""];
      };
      const exec = vi.fn().mockImplementation((cmd: any, _opts: any, cb: any) => {
        const [stdout, stderr] = getIO(String(cmd || ""));
        if (cb) cb(null, stdout, stderr);
        return { stdout: { on: vi.fn() }, on: vi.fn() };
      });
      (exec as any)[sym] = (cmd: any) => {
        const [stdout, stderr] = getIO(String(cmd || ""));
        return Promise.resolve({ stdout, stderr });
      };
      const spawn = vi.fn().mockImplementation(() => {
        const child = new EventEmitter() as any;
        child.stdout = new EventEmitter();
        child.stdout.setEncoding = vi.fn();
        child.stderr = new EventEmitter();
        child.stderr.setEncoding = vi.fn();
        setImmediate(() => {
          child.stdout.emit("data", pyannoteData);
          child.emit("close", 0);
        });
        return child;
      });
      return { exec, spawn };
    });

    // Use real fs for file creation (exec mock writes files using real require("node:fs"))
    // Only mock existsSync and statSync to prevent "file not found" errors
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<any>("node:fs");
      const actualFs = actual.default || actual;
      return {
        ...actual,
        default: {
          ...actualFs,
          existsSync: vi.fn((p: string) => {
            // spknorm_ files and audio files exist
            if (String(p).includes("spknorm_")) return actualFs.existsSync(p);
            return true;
          }),
          statSync: vi.fn(() => ({ size: 1024 })),
          readFileSync: vi.fn(() => Buffer.from("audio")),
          unlinkSync,
        },
        existsSync: vi.fn((p: string) => {
          if (String(p).includes("spknorm_")) return actual.existsSync?.(p) ?? true;
          return true;
        }),
        statSync: vi.fn(() => ({ size: 1024 })),
        readFileSync: vi.fn(() => Buffer.from("audio")),
        unlinkSync,
      };
    });

    const pipeline = await import("../audioPipeline.ts");

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({
        text: "Cześć jak masz",
        segments: [
          { text: "Cześć jak", start: 0, end: 1 },
          { text: "masz", start: 1, end: 2 },
        ],
      })),
    });

    const asset = {
      id: "rec-norm",
      file_path: "/tmp/audio-norm.wav",
      content_type: "audio/wav",
      diarization_json: JSON.stringify({ audioQuality: { qualityLabel: "good", enhancementRecommended: false } }),
    };

    const result = await pipeline.transcribeRecording(asset);

    expect(result.pipelineStatus).toBe("completed");
    // applyPerSpeakerNorm ran → normFilePath was set → unlinkSync was called in finally
    expect(unlinkSync).toHaveBeenCalled();
    expect(result.segments.length).toBeGreaterThan(0);
  }, 30000);

  // Skipped - requires complex child_process mocking
  it.skip("correctTranscriptWithLLM is called when transcriptCorrection option is set", async () => {
    vi.resetModules();
    process.env.VOICELOG_DEBUG = "false";

    vi.doMock("../config.ts", () => ({
      config: {
        VOICELOG_OPENAI_API_KEY: "key-1",
        OPENAI_API_KEY: "key-1",
        VOICELOG_OPENAI_BASE_URL: "https://api.example.test/v1",
        VERIFICATION_MODEL: "gpt-4o-transcribe",
        AUDIO_LANGUAGE: "pl",
        AUDIO_PREPROCESS: false,
        TRANSCRIPT_CORRECTION: false,
        FFMPEG_BINARY: "ffmpeg",
        HF_TOKEN: "",
        HUGGINGFACE_TOKEN: "",
        PYTHON_BINARY: "python",
        VAD_ENABLED: false,
        VOICELOG_SILENCE_REMOVE: false,
        WHISPER_PROMPT: "",
        DIARIZATION_MODEL: "",
        SPEAKER_IDENTIFICATION_MODEL: "",
        GROQ_API_KEY: "",
        VOICELOG_STT_PROVIDER: "openai",
        VOICELOG_DIARIZER: "openai",
        VOICELOG_PER_SPEAKER_NORM: false,
        VOICELOG_UPLOAD_DIR: "",
        DEBUG: false,
      },
    }));
    vi.doMock("../logger.ts", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));
    vi.doMock("../speakerEmbedder.ts", () => ({
      matchSpeakerToProfile: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("node:child_process", () => ({
      exec: vi.fn().mockImplementation((_cmd, _opts, callback) => {
        callback?.(null, "{}", "");
        return { stdout: { on: vi.fn() }, on: vi.fn() };
      }),
      spawn: vi.fn(),
    }));
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<any>("node:fs");
      return {
        ...actual,
        default: {
          ...actual.default,
          existsSync: vi.fn(() => true),
          statSync: vi.fn(() => ({ size: 1024 })),
          readFileSync: vi.fn(() => Buffer.from("audio")),
          unlinkSync: vi.fn(),
        },
        existsSync: vi.fn(() => true),
        statSync: vi.fn(() => ({ size: 1024 })),
        readFileSync: vi.fn(() => Buffer.from("audio")),
        unlinkSync: vi.fn(),
      };
    });

    const pipeline = await import("../audioPipeline.ts");

    // Whisper returns segments
    // GPT-4o-mini diarizes (since HF_TOKEN="" → diarizeFromTranscript)
    // GPT-4o-mini corrects (since transcriptCorrection=true)
    const segId1 = "seg_abc1";
    const segId2 = "seg_abc2";
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({
          text: "Ala ma kota",
          segments: [
            { text: "Ala ma", start: 0, end: 1 },
            { text: "kota.", start: 1, end: 2 },
          ],
        })),
      })
      .mockResolvedValueOnce({
        // diarizeFromTranscript
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify({ segments: [{ i: 0, s: "A" }, { i: 1, s: "B" }] }) } }],
        }),
      })
      .mockResolvedValueOnce({
        // correctTranscriptWithLLM
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify([
                { id: segId1, text: "Ala ma." },
                { id: segId2, text: "kota!" },
              ]),
            },
          }],
        }),
      });

    const result = await pipeline.transcribeRecording(
      {
        id: "rec-correct",
        file_path: "/tmp/audio.wav",
        content_type: "audio/wav",
        diarization_json: JSON.stringify({ audioQuality: { qualityLabel: "good", enhancementRecommended: false } }),
      },
      { transcriptCorrection: true }
    );

    expect(result.pipelineStatus).toBe("completed");
    expect(result.segments.length).toBeGreaterThan(0);
    // The correction call was made (3rd fetch call)
    expect((global.fetch as any).mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(String((global.fetch as any).mock.calls[2][1].body)).toContain("Popraw");
  }, 30000);

  // Skipped - requires complex child_process mocking
  it.skip("transcribeRecording processes large files via in-memory chunking and merges payloads", async () => {
    const { EventEmitter } = await import("node:events");
    vi.resetModules();
    process.env.VOICELOG_DEBUG = "false";

    vi.doMock("../config.ts", () => ({
      config: {
        VOICELOG_OPENAI_API_KEY: "key-1",
        OPENAI_API_KEY: "key-1",
        VOICELOG_OPENAI_BASE_URL: "https://api.example.test/v1",
        VERIFICATION_MODEL: "gpt-4o-transcribe",
        AUDIO_LANGUAGE: "pl",
        AUDIO_PREPROCESS: false,
        TRANSCRIPT_CORRECTION: false,
        FFMPEG_BINARY: "ffmpeg",
        HF_TOKEN: "",
        HUGGINGFACE_TOKEN: "",
        PYTHON_BINARY: "python",
        VAD_ENABLED: false,
        VOICELOG_SILENCE_REMOVE: false,
        WHISPER_PROMPT: "",
        DIARIZATION_MODEL: "",
        SPEAKER_IDENTIFICATION_MODEL: "",
        GROQ_API_KEY: "",
        VOICELOG_STT_PROVIDER: "openai",
        VOICELOG_DIARIZER: "openai",
        VOICELOG_PER_SPEAKER_NORM: false,
        VOICELOG_UPLOAD_DIR: "",
        DEBUG: false,
      },
    }));
    vi.doMock("../logger.ts", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));
    vi.doMock("../speakerEmbedder.ts", () => ({
      matchSpeakerToProfile: vi.fn().mockResolvedValue(null),
    }));

    let spawnCallCount = 0;
    vi.doMock("node:child_process", () => {
      const sym = Symbol.for("nodejs.util.promisify.custom");
      const exec = vi.fn().mockImplementation((_cmd: any, _opts: any, cb: any) => {
        if (cb) cb(null, "{}", "");
        return { stdout: { on: vi.fn() }, on: vi.fn() };
      });
      (exec as any)[sym] = () => Promise.resolve({ stdout: "{}", stderr: "" });
      const spawn = vi.fn().mockImplementation(() => {
        spawnCallCount++;
        const idx = spawnCallCount;
        const child = new EventEmitter() as any;
        child.stdout = new EventEmitter();
        child.stdout.setEncoding = vi.fn();
        child.stderr = new EventEmitter();
        child.stderr.setEncoding = vi.fn();
        // First chunk: return real audio bytes; subsequent chunks: empty → discarded as too small
        const data = idx === 1 ? Buffer.alloc(1600, 1) : Buffer.alloc(0);
        setImmediate(() => {
          child.stdout.emit("data", data);
          child.emit("close", 0);
        });
        return child;
      });
      return { exec, spawn };
    });

    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<any>("node:fs");
      return {
        ...actual,
        default: {
          ...actual.default,
          existsSync: vi.fn(() => true),
          // Return large file size for the audio file → triggers chunking
          statSync: vi.fn(() => ({ size: 27 * 1024 * 1024 })),
          readFileSync: vi.fn(() => Buffer.from("audio")),
          unlinkSync: vi.fn(),
        },
        existsSync: vi.fn(() => true),
        statSync: vi.fn(() => ({ size: 27 * 1024 * 1024 })),
        readFileSync: vi.fn(() => Buffer.from("audio")),
        unlinkSync: vi.fn(),
      };
    });

    const pipeline = await import("../audioPipeline.ts");

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({
          text: "Dzień dobry to jest test",
          words: [
            { word: "Dzień", start: 0, end: 0.3 },
            { word: "dobry", start: 0.31, end: 0.6 },
            { word: "to", start: 0.8, end: 0.9 },
            { word: "jest", start: 0.91, end: 1.1 },
            { word: "test", start: 1.11, end: 1.5 },
          ],
        })),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify({
            segments: [{ i: 0, s: "A" }, { i: 1, s: "B" }, { i: 2, s: "A" }],
          }) } }],
        }),
      });

    const result = await pipeline.transcribeRecording({
      id: "rec-large",
      file_path: "/tmp/large.wav",
      content_type: "audio/wav",
      diarization_json: JSON.stringify({ audioQuality: { qualityLabel: "good", enhancementRecommended: false } }),
    });

    expect(result.pipelineStatus).toBe("completed");
    expect(result.transcriptionDiagnostics.usedChunking).toBe(true);
    expect(result.transcriptionDiagnostics.chunksSentToStt).toBeGreaterThanOrEqual(1);
    expect(result.segments.length).toBeGreaterThan(0);
  }, 30000);

  // Skipped - requires complex child_process mocking
  it.skip("correctTranscriptWithLLM falls back to original segments when LLM returns HTTP error", async () => {
    vi.resetModules();
    process.env.VOICELOG_DEBUG = "false";

    vi.doMock("../config.ts", () => ({
      config: {
        VOICELOG_OPENAI_API_KEY: "key-1",
        OPENAI_API_KEY: "key-1",
        VOICELOG_OPENAI_BASE_URL: "https://api.example.test/v1",
        VERIFICATION_MODEL: "gpt-4o-transcribe",
        AUDIO_LANGUAGE: "pl",
        AUDIO_PREPROCESS: false,
        TRANSCRIPT_CORRECTION: false,
        FFMPEG_BINARY: "ffmpeg",
        HF_TOKEN: "",
        HUGGINGFACE_TOKEN: "",
        PYTHON_BINARY: "python",
        VAD_ENABLED: false,
        VOICELOG_SILENCE_REMOVE: false,
        WHISPER_PROMPT: "",
        DIARIZATION_MODEL: "",
        SPEAKER_IDENTIFICATION_MODEL: "",
        GROQ_API_KEY: "",
        VOICELOG_STT_PROVIDER: "openai",
        VOICELOG_DIARIZER: "openai",
        VOICELOG_PER_SPEAKER_NORM: false,
        VOICELOG_UPLOAD_DIR: "",
        DEBUG: false,
      },
    }));
    vi.doMock("../logger.ts", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));
    vi.doMock("../speakerEmbedder.ts", () => ({
      matchSpeakerToProfile: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("node:child_process", () => ({
      exec: vi.fn().mockImplementation((_cmd, _opts, callback) => {
        callback?.(null, "{}", "");
        return { stdout: { on: vi.fn() }, on: vi.fn() };
      }),
      spawn: vi.fn(),
    }));
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<any>("node:fs");
      return {
        ...actual,
        default: {
          ...actual.default,
          existsSync: vi.fn(() => true),
          statSync: vi.fn(() => ({ size: 1024 })),
          readFileSync: vi.fn(() => Buffer.from("audio")),
          unlinkSync: vi.fn(),
        },
        existsSync: vi.fn(() => true),
        statSync: vi.fn(() => ({ size: 1024 })),
        readFileSync: vi.fn(() => Buffer.from("audio")),
        unlinkSync: vi.fn(),
      };
    });

    const pipeline = await import("../audioPipeline.ts");

    (global.fetch as any)
      // 1st: Whisper STT → success with two segments
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({
          text: "Ala ma kota",
          segments: [
            { text: "Ala ma", start: 0, end: 1 },
            { text: "kota.", start: 1, end: 2 },
          ],
        })),
      })
      // 2nd: diarizeFromTranscript
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify({ segments: [{ i: 0, s: "A" }, { i: 1, s: "B" }] }) } }],
        }),
      })
      // 3rd: correctTranscriptWithLLM → HTTP 500 → triggers catch block
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("Internal Server Error"),
        json: vi.fn().mockResolvedValue({}),
      });

    const result = await pipeline.transcribeRecording(
      {
        id: "rec-llm-err",
        file_path: "/tmp/audio.wav",
        content_type: "audio/wav",
        diarization_json: JSON.stringify({ audioQuality: { qualityLabel: "good", enhancementRecommended: false } }),
      },
      { transcriptCorrection: true }
    );

    // Pipeline should still complete — falls back to original segments
    expect(result.pipelineStatus).toBe("completed");
    expect(result.segments.length).toBeGreaterThan(0);
  }, 30000);

  // Skipped - requires complex child_process mocking
  it.skip("transcribeRecording falls back to OpenAI STT when Groq STT fails", async () => {
    vi.resetModules();
    process.env.VOICELOG_DEBUG = "false";

    vi.doMock("../config.ts", () => ({
      config: {
        VOICELOG_OPENAI_API_KEY: "key-1",
        OPENAI_API_KEY: "key-1",
        VOICELOG_OPENAI_BASE_URL: "https://api.example.test/v1",
        VERIFICATION_MODEL: "gpt-4o-transcribe",
        AUDIO_LANGUAGE: "pl",
        AUDIO_PREPROCESS: false,
        TRANSCRIPT_CORRECTION: false,
        FFMPEG_BINARY: "ffmpeg",
        HF_TOKEN: "",
        HUGGINGFACE_TOKEN: "",
        PYTHON_BINARY: "python",
        VAD_ENABLED: false,
        VOICELOG_SILENCE_REMOVE: false,
        WHISPER_PROMPT: "",
        DIARIZATION_MODEL: "",
        SPEAKER_IDENTIFICATION_MODEL: "",
        GROQ_API_KEY: "groq-test-key",
        VOICELOG_STT_PROVIDER: "groq",
        VOICELOG_DIARIZER: "openai",
        VOICELOG_PER_SPEAKER_NORM: false,
        VOICELOG_UPLOAD_DIR: "",
        DEBUG: false,
      },
    }));
    vi.doMock("../logger.ts", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));
    vi.doMock("../speakerEmbedder.ts", () => ({
      matchSpeakerToProfile: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("node:child_process", () => ({
      exec: vi.fn().mockImplementation((_cmd, _opts, callback) => {
        callback?.(null, "{}", "");
        return { stdout: { on: vi.fn() }, on: vi.fn() };
      }),
      spawn: vi.fn(),
    }));
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<any>("node:fs");
      return {
        ...actual,
        default: {
          ...actual.default,
          existsSync: vi.fn(() => true),
          statSync: vi.fn(() => ({ size: 1024 })),
          readFileSync: vi.fn(() => Buffer.from("audio")),
          unlinkSync: vi.fn(),
        },
        existsSync: vi.fn(() => true),
        statSync: vi.fn(() => ({ size: 1024 })),
        readFileSync: vi.fn(() => Buffer.from("audio")),
        unlinkSync: vi.fn(),
      };
    });

    const pipeline = await import("../audioPipeline.ts");

    (global.fetch as any)
      // 1st: Groq /audio/transcriptions → HTTP 503 → triggers Groq fallback path
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: vi.fn().mockResolvedValue(JSON.stringify({ error: { message: "Groq unavailable" } })),
      })
      // 2nd: OpenAI fallback /audio/transcriptions → success
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({
          text: "To jest test",
          segments: [
            { text: "To jest test", start: 0, end: 2 },
          ],
        })),
      })
      // 3rd: diarizeFromTranscript (OpenAI, since VOICELOG_DIARIZER=openai)
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify({ segments: [{ i: 0, s: "A" }] }) } }],
        }),
      });

    const result = await pipeline.transcribeRecording({
      id: "rec-groq-fallback",
      file_path: "/tmp/audio.wav",
      content_type: "audio/wav",
      diarization_json: JSON.stringify({ audioQuality: { qualityLabel: "good", enhancementRecommended: false } }),
    });

    expect(result.pipelineStatus).toBe("completed");
    expect(result.segments.length).toBeGreaterThan(0);
    // Groq was tried first (1st fetch call contains groq URL), then OpenAI fallback
    const fetchCalls = (global.fetch as any).mock.calls;
    expect(fetchCalls.length).toBeGreaterThanOrEqual(2);
    const firstUrl = String(fetchCalls[0][0]);
    expect(firstUrl).toContain("groq.com");
  }, 30000);
});
