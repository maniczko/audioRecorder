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
    const providers = resolveConfiguredSttProviders({
      preferredProvider: "groq",
      fallbackProvider: "openai",
      groqApiKey: "", // No Groq key
      openAiApiKey: "openai-key",
      openAiBaseUrl: "https://api.openai.test/v1",
    });

    // Only OpenAI should be available
    expect(providers.map((provider) => provider.id)).toEqual(["openai"]);
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
