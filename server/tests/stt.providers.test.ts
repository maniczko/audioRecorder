import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveConfiguredSttProviders } from "../stt/providers.ts";

describe("stt providers", () => {
  afterEach(() => {
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

  it("skips unavailable providers in chain", () => {
    // Clear environment variables for this test
    const originalGroqKey = process.env.GROQ_API_KEY;
    const originalOpenAiKey = process.env.OPENAI_API_KEY;

    delete process.env.GROQ_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const providers = resolveConfiguredSttProviders({
      preferredProvider: "groq",
      fallbackProvider: "openai",
      groqApiKey: undefined, // No Groq key
      openAiApiKey: "openai-key", // But we have OpenAI key
      openAiBaseUrl: "https://api.openai.test/v1",
    });

    // Restore environment
    if (originalGroqKey) process.env.GROQ_API_KEY = originalGroqKey;
    if (originalOpenAiKey) process.env.OPENAI_API_KEY = originalOpenAiKey;

    // Both providers are in the chain, but only OpenAI is available
    // The isAvailable() check happens at transcribe time, not at configuration time
    expect(providers).toHaveLength(2);
    expect(providers[0].id).toBe("groq");
    expect(providers[0].isAvailable()).toBe(false); // Groq not available
    expect(providers[1].id).toBe("openai");
    expect(providers[1].isAvailable()).toBe(true); // OpenAI available
  });

  it("handles missing fallback provider", () => {
    const providers = resolveConfiguredSttProviders({
      preferredProvider: "openai",
      fallbackProvider: "none",
      openAiApiKey: "openai-key",
      openAiBaseUrl: "https://api.openai.test/v1",
    });

    expect(providers).toHaveLength(1);
    expect(providers[0].id).toBe("openai");
  });
});
