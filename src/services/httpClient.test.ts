import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { STORAGE_KEYS } from "../lib/storage";

describe("httpClient", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.resetModules();
  });

  test("sends auth header and serializes json bodies", async () => {
    vi.resetModules();
    vi.doMock("./config", () => ({
      API_BASE_URL: "https://api.example.test",
      apiBaseUrlConfigured: () => true,
      remoteApiEnabled: () => true,
      BACKEND_API_BASE_URL: "https://api.example.test",
    }));
    vi.doMock("../runtime/browserRuntime", () => ({
      isHostedPreviewHost: (hostname: string) => /\.vercel\.app$/i.test(String(hostname || "")),
      getHostedRuntimeBuildId: () => "",
    }));

    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ token: "token-1" }));
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest } = await import("./httpClient");

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
    vi.resetModules();
    vi.doMock("./config", () => ({
      API_BASE_URL: "https://api.example.test",
      apiBaseUrlConfigured: () => true,
      remoteApiEnabled: () => true,
      BACKEND_API_BASE_URL: "https://api.example.test",
    }));
    vi.doMock("../runtime/browserRuntime", () => ({
      isHostedPreviewHost: (hostname: string) => /\.vercel\.app$/i.test(String(hostname || "")),
      getHostedRuntimeBuildId: () => "",
    }));

    const fetchMock = vi.fn().mockResolvedValue(
      new Response("uploaded", {
        status: 200,
        headers: { "content-type": "text/plain" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest } = await import("./httpClient");
    const blob = new Blob(["audio"]);

    await apiRequest("/upload", { method: "POST", body: blob });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/upload", {
      method: "POST",
      headers: {},
      body: blob,
    });
  });

  test("falls back to persisted workspace store session when legacy session is empty", async () => {
    vi.resetModules();
    vi.doMock("./config", () => ({
      API_BASE_URL: "https://api.example.test",
      apiBaseUrlConfigured: () => true,
      remoteApiEnabled: () => true,
      BACKEND_API_BASE_URL: "https://api.example.test",
    }));
    vi.doMock("../runtime/browserRuntime", () => ({
      isHostedPreviewHost: (hostname: string) => /\.vercel\.app$/i.test(String(hostname || "")),
      getHostedRuntimeBuildId: () => "",
    }));

    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({}));
    localStorage.setItem(STORAGE_KEYS.workspaceSession, JSON.stringify({ token: "workspace-token" }));

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest } = await import("./httpClient");

    await apiRequest("/state/bootstrap");

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/state/bootstrap", {
      headers: {
        Authorization: "Bearer workspace-token",
      },
    });
  });

  test("throws a clear error when backend api base url is missing", async () => {
    vi.resetModules();
    vi.doMock("./config", () => ({
      API_BASE_URL: "",
      apiBaseUrlConfigured: () => false,
      remoteApiEnabled: () => false,
      BACKEND_API_BASE_URL: "",
    }));
    vi.doMock("../runtime/browserRuntime", () => ({
      isHostedPreviewHost: (hostname: string) => /\.vercel\.app$/i.test(String(hostname || "")),
      getHostedRuntimeBuildId: () => "",
    }));

    const { apiRequest } = await import("./httpClient");

    await expect(apiRequest("/test")).rejects.toThrow(
      "Remote API is not configured. Set VITE_API_BASE_URL or REACT_APP_API_BASE_URL first."
    );
  });
});
