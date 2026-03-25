import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveConfiguredSttProviders, transcribeWithProviders } from "../stt/providers.ts";
import * as httpClientModule from "../lib/httpClient.ts";

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

describe("stt providers — HTTP behavior", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeProvider(overrides: Partial<{ apiKey: string; baseUrl: string }> = {}) {
    const [provider] = resolveConfiguredSttProviders({
      preferredProvider: "openai",
      openAiApiKey: overrides.apiKey ?? "test-key",
      openAiBaseUrl: overrides.baseUrl ?? "https://api.openai.test/v1",
    });
    return provider;
  }

  function makeRequest(signal?: AbortSignal) {
    return {
      buffer: Buffer.from("fake-audio"),
      filename: "chunk.wav",
      contentType: "audio/wav",
      fields: { model: "gpt-4o-transcribe", language: "pl" },
      signal,
    };
  }

  it("makes POST to correct URL with Authorization header", async () => {
    const httpClientSpy = vi.spyOn(httpClientModule, "httpClient").mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers(),
      text: async () => '{"text":"Hello world"}',
      json: async () => ({ text: "Hello world" }),
    } as any);

    const provider = makeProvider();
    await provider.transcribeAudio(makeRequest());

    expect(httpClientSpy).toHaveBeenCalledOnce();
    const [url, opts] = httpClientSpy.mock.calls[0];
    expect(url).toBe("https://api.openai.test/v1/audio/transcriptions");
    expect(opts?.method).toBe("POST");
    expect((opts?.headers as any)?.Authorization).toBe("Bearer test-key");
  });

  it("passes request.signal to httpClient", async () => {
    const httpClientSpy = vi.spyOn(httpClientModule, "httpClient").mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers(),
      text: async () => '{"text":"Hello"}',
      json: async () => ({ text: "Hello" }),
    } as any);

    const controller = new AbortController();
    const provider = makeProvider();
    await provider.transcribeAudio(makeRequest(controller.signal));

    const [, opts] = httpClientSpy.mock.calls[0];
    expect(opts?.signal).toBe(controller.signal);
  });

  it("throws with API error message on HTTP 401", async () => {
    vi.spyOn(httpClientModule, "httpClient").mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      headers: new Headers(),
      text: async () => '{"error":{"message":"Invalid API key provided."}}',
      json: async () => ({ error: { message: "Invalid API key provided." } }),
    } as any);

    const provider = makeProvider();
    await expect(provider.transcribeAudio(makeRequest())).rejects.toThrow("Invalid API key provided.");
  });

  it("throws with fallback message on HTTP 400 with non-JSON body", async () => {
    vi.spyOn(httpClientModule, "httpClient").mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      headers: new Headers(),
      text: async () => "bad request",
      json: async () => { throw new Error("not json"); },
    } as any);

    const provider = makeProvider();
    await expect(provider.transcribeAudio(makeRequest())).rejects.toThrow(
      "STT audio request failed with status 400."
    );
  });

  it("transcribeWithProviders falls through to second provider on first failure", async () => {
    const providers = resolveConfiguredSttProviders({
      preferredProvider: "groq",
      fallbackProvider: "openai",
      groqApiKey: "groq-key",
      openAiApiKey: "openai-key",
      openAiBaseUrl: "https://api.openai.test/v1",
    });

    let callIndex = 0;
    vi.spyOn(httpClientModule, "httpClient").mockImplementation(async () => {
      callIndex++;
      if (callIndex === 1) {
        throw new Error("Groq network error");
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        text: async () => '{"text":"Fallback result"}',
        json: async () => ({ text: "Fallback result" }),
      } as any;
    });

    const result = await transcribeWithProviders(providers, (_provider) => makeRequest());
    expect(result.providerId).toBe("openai");
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0].success).toBe(false);
    expect(result.attempts[1].success).toBe(true);
  });

  it("createFormData appends file with correct name", async () => {
    const httpClientSpy = vi.spyOn(httpClientModule, "httpClient").mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers(),
      text: async () => '{"text":"ok"}',
      json: async () => ({ text: "ok" }),
    } as any);

    const provider = makeProvider();
    await provider.transcribeAudio(makeRequest());

    const [, opts] = httpClientSpy.mock.calls[0];
    const body = opts?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    const file = body.get("file") as File;
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("chunk.wav");
    expect(file.type).toBe("audio/wav");
  });

  it("createFormData appends array fields with [] suffix", async () => {
    const httpClientSpy = vi.spyOn(httpClientModule, "httpClient").mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers(),
      text: async () => '{"text":"ok"}',
      json: async () => ({ text: "ok" }),
    } as any);

    const provider = makeProvider();
    await provider.transcribeAudio({
      buffer: Buffer.from("fake-audio"),
      filename: "chunk.wav",
      contentType: "audio/wav",
      fields: { model: "gpt-4o-transcribe", timestamp_granularities: ["segment", "word"] },
    });

    const [, opts] = httpClientSpy.mock.calls[0];
    const body = opts?.body as FormData;
    expect(body.getAll("timestamp_granularities[]")).toEqual(["segment", "word"]);
  });
});
