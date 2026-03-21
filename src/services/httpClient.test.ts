import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { STORAGE_KEYS } from "../lib/storage";

async function loadHttpClient() {
  vi.resetModules();
  vi.doMock("./config", () => ({
    API_BASE_URL: "https://api.example.test",
    apiBaseUrlConfigured: () => true,
    remoteApiEnabled: () => true,
  }));
  return import("./httpClient");
}

async function loadHttpClientWithoutApi() {
  vi.resetModules();
  vi.doMock("./config", () => ({
    API_BASE_URL: "",
    apiBaseUrlConfigured: () => false,
    remoteApiEnabled: () => false,
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

  test("normalizes missing-token 401 into a session recovery message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Brak tokenu autoryzacyjnego." }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest } = await loadHttpClient();

    await expect(apiRequest("/voice-profiles")).rejects.toMatchObject({
      message: "Sesja wygasla albo token nie zostal odtworzony. Odswiez sesje logowania.",
      status: 401,
    });
  });

  test("normalizes 502 plain-text upstream failures into a stable backend message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Application failed to respond", {
        status: 502,
        headers: { "content-type": "text/plain" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest } = await loadHttpClient();

    await expect(apiRequest("/state/bootstrap")).rejects.toMatchObject({
      message: "Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile.",
      status: 502,
    });
  });

  test("normalizes Vercel router proxy errors into a stable backend message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("ROUTER_EXTERNAL_TARGET_CONNECTION_ERROR_CD8", {
        status: 502,
        headers: { "content-type": "text/plain" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest } = await loadHttpClient();

    await expect(apiRequest("/media/recordings/rec1/audio")).rejects.toMatchObject({
      message: "Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile.",
      status: 502,
    });
  });

  test("normalizes network fetch rejections into a stable backend message", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest } = await loadHttpClient();

    await expect(apiRequest("/state/bootstrap")).rejects.toMatchObject({
      message: "Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile.",
    });
  });

  test("falls back to persisted workspace store session when legacy session is empty", async () => {
    localStorage.setItem(
      "voicelog_workspace_store",
      JSON.stringify({
        state: {
          session: { userId: "u1", workspaceId: "ws1", token: "workspace-token" },
        },
        version: 0,
      })
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest } = await loadHttpClient();

    await apiRequest("/state/bootstrap");

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/state/bootstrap", {
      headers: {
        Authorization: "Bearer workspace-token",
      },
    });
  });

  test("throws a clear error when backend api base url is missing", async () => {
    const { apiRequest } = await loadHttpClientWithoutApi();

    await expect(apiRequest("/voice-profiles")).rejects.toMatchObject({
      message: "Remote API is not configured. Set VITE_API_BASE_URL or REACT_APP_API_BASE_URL first.",
    });
  });
});
