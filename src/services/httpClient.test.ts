import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { STORAGE_KEYS } from "../lib/storage";

async function loadHttpClient() {
  vi.resetModules();
  vi.doMock("./config", () => ({
    API_BASE_URL: "https://api.example.test",
    remoteApiEnabled: () => true,
  }));
  return import("./httpClient");
}

describe("httpClient", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.resetModules();
  });

  test("sends auth header and serializes json bodies", async () => {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ token: "token-1" }));
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest } = await loadHttpClient();

    const result = await apiRequest("/state/bootstrap", {
      method: "PUT",
      body: { hello: "world" },
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/state/bootstrap", {
      method: "PUT",
      headers: {
        Authorization: "Bearer token-1",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ hello: "world" }),
    });
  });

  test("does not add json content-type for blob body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("uploaded", {
        status: 200,
        headers: { "content-type": "text/plain" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest } = await loadHttpClient();
    const blob = new Blob(["audio"]);

    await apiRequest("/upload", { method: "POST", body: blob });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/upload", {
      method: "POST",
      headers: {},
      body: blob,
    });
  });

  test("notifies unauthorized handlers and throws parsed message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Session expired" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest, onUnauthorized } = await loadHttpClient();
    const unauthorized = vi.fn();
    onUnauthorized(unauthorized);

    await expect(apiRequest("/state/bootstrap")).rejects.toMatchObject({
      message: "Session expired",
      status: 401,
    });
    expect(unauthorized).toHaveBeenCalledTimes(1);
  });
});
