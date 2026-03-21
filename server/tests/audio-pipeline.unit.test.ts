import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadAudioPipeline({
  openAiKey = "",
  baseUrl = "https://api.example.test/v1",
} = {}) {
  vi.resetModules();
  vi.doMock("../config.ts", () => ({
    config: {
      VOICELOG_OPENAI_API_KEY: openAiKey,
      OPENAI_API_KEY: openAiKey,
      VOICELOG_OPENAI_BASE_URL: baseUrl,
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
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }));
  vi.doMock("../speakerEmbedder.ts", () => ({
    matchSpeakerToProfile: vi.fn().mockResolvedValue(null),
  }));
  return import("../audioPipeline.ts");
}

describe("audioPipeline exports", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn() as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
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
          choices: [{ message: { content: JSON.stringify({ summary: "Spotkanie zakonczone." }) } }],
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

    expect(analysis).toEqual({ summary: "Spotkanie zakonczone." });
    expect(embeddings).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    expect((global.fetch as any).mock.calls[0][0]).toContain("/chat/completions");
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
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<any>("node:fs");
      return { ...actual, default: { ...actual.default, readFileSync }, readFileSync };
    });
    const pipeline = await loadAudioPipeline({ openAiKey: "key-1" });
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ text: "live result" })),
    });

    await expect(pipeline.transcribeLiveChunk("/tmp/live.wav", "audio/wav")).resolves.toBe("live result");

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue(JSON.stringify({ error: { message: "broken" } })),
    });
    await expect(pipeline.transcribeLiveChunk("/tmp/live.wav", "audio/wav")).resolves.toBe("");
  });

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
