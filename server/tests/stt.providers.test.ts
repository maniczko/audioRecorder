import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveConfiguredSttProviders, transcribeWithProviders } from "../stt/providers.ts";

describe("stt providers", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("builds provider chain with explicit fallback", () => {
    const providers = resolveConfiguredSttProviders({
      preferredProvider: "groq",
      fallbackProvider: "openai",
      groqApiKey: "groq-key",
      openAiApiKey: "openai-key",
      openAiBaseUrl: "https://api.openai.test/v1",
    });

    expect(providers.map((provider) => provider.id)).toEqual(["groq", "openai"]);
  });

  it("returns successful provider metadata after fallback", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue(JSON.stringify({ error: { message: "groq down" } })),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ text: "transcript ok" })),
      } as any);

    const providers = resolveConfiguredSttProviders({
      preferredProvider: "groq",
      fallbackProvider: "openai",
      groqApiKey: "groq-key",
      openAiApiKey: "openai-key",
      openAiBaseUrl: "https://api.openai.test/v1",
    });

    const result = await transcribeWithProviders(providers, (provider) => ({
      buffer: Buffer.from("audio"),
      filename: "sample.wav",
      contentType: "audio/wav",
      fields: {
        model: provider.defaultModel,
      },
    }));

    expect(result.providerId).toBe("openai");
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]).toMatchObject({ providerId: "groq", success: false });
    expect(result.attempts[1]).toMatchObject({ providerId: "openai", success: true });
  });
});
