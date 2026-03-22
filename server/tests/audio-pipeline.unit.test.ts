import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadAudioPipeline({
  openAiKey = "",
  baseUrl = "https://api.example.test/v1",
} = {}) {
  vi.resetModules();

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
    const pipeline = await loadAudioPipeline();

    await expect(pipeline.diarizeFromTranscript([{ text: "Ala", start: 0, end: 1 }])).resolves.toBeNull();
    await expect(
      pipeline.analyzeMeetingWithOpenAI({ meeting: { title: "A" }, segments: [{ text: "x", timestamp: 0, speakerId: 0 }], speakerNames: {} })
    ).resolves.toBeNull();
    await expect(pipeline.embedTextChunks(["hello"])).resolves.toEqual([]);
    await expect(pipeline.transcribeLiveChunk("/tmp/live.webm", "audio/webm")).resolves.toBe("");
    await expect(
      pipeline.extractSpeakerAudioClip({ id: "rec1", file_path: "/tmp/audio.wav" }, "1", [{ speakerId: "2", timestamp: 0, endTimestamp: 1 }])
    ).rejects.toThrow(/Brak segment/);
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

  it("returns all_chunks_discarded_as_too_small when chunk extraction never yields a transcribable buffer", async () => {
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
      const spawn = vi.fn(() => {
        const child = new EventEmitter() as any;
        child.stdout = new EventEmitter();
        child.stdout.setEncoding = vi.fn();
        // Emit data first, then close synchronously
        setImmediate(() => {
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
  }, 15000);

  it("fails the pipeline when every chunked STT request fails instead of classifying it as empty transcript", async () => {
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
        // Emit events asynchronously to allow proper stream handling
        setImmediate(() => {
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
  }, 15000);

  it("still sends chunked audio to STT when chunk-level VAD reports silence", async () => {
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
        // Emit events asynchronously to allow proper stream handling
        setImmediate(() => {
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
  }, 15000);

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
});
