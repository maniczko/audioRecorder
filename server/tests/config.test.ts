import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Clear DATABASE_URL from .env to test defaults
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("loads default config when no env vars are set", async () => {
    process.env.NODE_ENV = "test";

    const { config } = await import("../config.ts");

    expect(config.NODE_ENV).toBe("test");
    expect(config.PORT).toBe(4000);
    // VOICELOG_ALLOWED_ORIGINS includes both localhost variants from .env
    expect(config.VOICELOG_ALLOWED_ORIGINS).toContain("http://localhost:3000");
    expect(config.VOICELOG_TRUST_PROXY).toBe(false);
    expect(config.VOICELOG_OPENAI_BASE_URL).toBe("https://api.openai.com/v1");
    expect(config.FFMPEG_BINARY).toBe("ffmpeg");
    expect(config.PYTHON_BINARY).toBe("python");
    expect(config.DIARIZATION_MODEL).toBe("pyannote/speaker-diarization-3.1");
    expect(config.SPEAKER_IDENTIFICATION_MODEL).toBe("microsoft/wavlm-base-plus-sv");
    expect(config.VERIFICATION_MODEL).toBe("gpt-4o-transcribe");
    expect(config.AUDIO_LANGUAGE).toBe("pl");
    expect(config.AUDIO_PREPROCESS).toBe(true);
    expect(config.TRANSCRIPT_CORRECTION).toBe(false);
    expect(config.VAD_ENABLED).toBe(true);
    expect(config.DEBUG).toBe(false);
  });

  it("overrides defaults with custom env vars", async () => {
    process.env.NODE_ENV = "production";
    process.env.PORT = "8080";
    process.env.VOICELOG_API_PORT = "9000";
    process.env.VOICELOG_API_HOST = "127.0.0.1";
    process.env.VOICELOG_ALLOWED_ORIGINS = "https://example.com";
    process.env.VOICELOG_TRUST_PROXY = "true";
    process.env.VOICELOG_OPENAI_BASE_URL = "https://custom.api.com/v1";
    process.env.FFMPEG_BINARY = "/usr/local/bin/ffmpeg";
    process.env.PYTHON_BINARY = "/usr/bin/python3";
    process.env.DEBUG = "true";
    process.env.AUDIO_PREPROCESS = "false";
    process.env.TRANSCRIPT_CORRECTION = "true";
    process.env.VAD_ENABLED = "false";

    const { config } = await import("../config.ts");

    expect(config.NODE_ENV).toBe("production");
    expect(config.PORT).toBe(8080);
    expect(config.VOICELOG_API_PORT).toBe(9000);
    expect(config.VOICELOG_API_HOST).toBe("127.0.0.1");
    expect(config.VOICELOG_ALLOWED_ORIGINS).toBe("https://example.com");
    expect(config.VOICELOG_TRUST_PROXY).toBe(true);
    expect(config.VOICELOG_OPENAI_BASE_URL).toBe("https://custom.api.com/v1");
    expect(config.FFMPEG_BINARY).toBe("/usr/local/bin/ffmpeg");
    expect(config.PYTHON_BINARY).toBe("/usr/bin/python3");
    expect(config.DEBUG).toBe(true);
    expect(config.AUDIO_PREPROCESS).toBe(false);
    expect(config.TRANSCRIPT_CORRECTION).toBe(true);
    expect(config.VAD_ENABLED).toBe(false);
  });

  it("uses optional env vars when provided", async () => {
    process.env.NODE_ENV = "test";
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    process.env.SENTRY_DSN = "https://test@sentry.io/123";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.VOICELOG_OPENAI_API_KEY = "test-voicelog-key";
    process.env.HF_TOKEN = "test-hf-token";
    process.env.WHISPER_PROMPT = "test prompt";

    const { config } = await import("../config.ts");

    expect(config.SUPABASE_URL).toBe("https://test.supabase.co");
    expect(config.SUPABASE_SERVICE_ROLE_KEY).toBe("test-key");
    expect(config.SENTRY_DSN).toBe("https://test@sentry.io/123");
    expect(config.OPENAI_API_KEY).toBe("test-openai-key");
    expect(config.VOICELOG_OPENAI_API_KEY).toBe("test-voicelog-key");
    expect(config.HF_TOKEN).toBe("test-hf-token");
    expect(config.WHISPER_PROMPT).toBe("test prompt");
  });

  it("supports HUGGINGFACE_TOKEN as alias for HF_TOKEN", async () => {
    process.env.NODE_ENV = "test";
    process.env.HUGGINGFACE_TOKEN = "test-hf-token-alias";

    const { config } = await import("../config.ts");

    expect(config.HUGGINGFACE_TOKEN).toBe("test-hf-token-alias");
  });

  it("exits with error on invalid NODE_ENV", async () => {
    const originalExit = process.exit;
    const originalError = console.error;
    process.env.NODE_ENV = "invalid";

    const exitMock = vi.fn((code) => {
      throw new Error(`process.exit(${code})`);
    });
    const errorMock = vi.fn();

    process.exit = exitMock as any;
    console.error = errorMock;

    await expect(import("../config.ts")).rejects.toThrow("process.exit");

    expect(errorMock).toHaveBeenCalledWith(
      "❌ Invalid environment variables:",
      expect.any(Object)
    );

    process.exit = originalExit;
    console.error = originalError;
  });
});
