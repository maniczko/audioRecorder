import { afterEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "../lib/httpClient.ts";

function makeOkResponse(body = "{}") {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers(),
    text: async () => body,
    json: async () => JSON.parse(body),
  };
}

describe("httpClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends FormData without Content-Type header so browser sets boundary", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(makeOkResponse() as any);

    const form = new FormData();
    form.append("model", "whisper-1");
    await httpClient("https://api.test/audio/transcriptions", {
      method: "POST",
      body: form,
    });

    const [, init] = fetchSpy.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("does not JSON.stringify FormData body", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(makeOkResponse() as any);

    const form = new FormData();
    form.append("model", "whisper-1");
    await httpClient("https://api.test/audio/transcriptions", {
      method: "POST",
      body: form,
    });

    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.body).toBe(form);
  });

  it("sets Content-Type application/json for plain object body", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(makeOkResponse() as any);

    await httpClient("https://api.test/endpoint", {
      method: "POST",
      body: { key: "value" },
    });

    const [, init] = fetchSpy.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(init?.body).toBe('{"key":"value"}');
  });

  it("retries on network error up to MAX_RETRIES times", async () => {

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new TypeError("Failed to fetch"));

    // timeout large enough to not interfere; backoffs are ~300ms total
    await expect(httpClient("https://api.test/endpoint", { timeout: 60000 })).rejects.toThrow(
      "Failed to fetch"
    );
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("does not retry when internal timeout fires (controller.signal.aborted)", async () => {

    let resolveAbort!: () => void;
    const abortPromise = new Promise<void>((r) => { resolveAbort = r; });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        const sig = init?.signal as AbortSignal | undefined;
        if (sig) {
          sig.addEventListener("abort", () => {
            resolveAbort();
            const err = new DOMException("The operation was aborted.", "AbortError");
            reject(err);
          });
        }
      });
    });

    const promise = httpClient("https://api.test/endpoint", { timeout: 50 });

    await abortPromise;
    await expect(promise).rejects.toThrow();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not retry when external abort signal is already aborted", async () => {

    const controller = new AbortController();
    controller.abort();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new DOMException("The operation was aborted.", "AbortError")
    );

    await expect(
      httpClient("https://api.test/endpoint", { signal: controller.signal })
    ).rejects.toThrow("The operation was aborted.");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns response for non-2xx status without retrying", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      headers: new Headers(),
      text: async () => '{"error":{"message":"Invalid API key"}}',
      json: async () => ({ error: { message: "Invalid API key" } }),
    } as any);

    const response = await httpClient("https://api.test/endpoint");
    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);
    // Only one attempt — HTTP errors are not retried
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
