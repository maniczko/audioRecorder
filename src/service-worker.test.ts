import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, test, vi } from "vitest";

function loadServiceWorkerHarness() {
  const listeners: Record<string, (event: any) => void> = {};
  const cachePut = vi.fn().mockResolvedValue(undefined);
  const cachesMock = {
    open: vi.fn().mockResolvedValue({ addAll: vi.fn().mockResolvedValue(undefined), put: cachePut }),
    keys: vi.fn().mockResolvedValue(["voicelog-os-v1", "voicelog-os-v2"]),
    delete: vi.fn().mockResolvedValue(true),
    match: vi.fn().mockResolvedValue(null),
  };
  const networkResponse = {
    ok: true,
    bodyUsed: false,
    type: "basic",
    clone: vi.fn(function clone() {
      return this;
    }),
  };
  const fetchMock = vi.fn().mockResolvedValue(networkResponse);
  const selfMock = {
    addEventListener: vi.fn((type: string, handler: (event: any) => void) => {
      listeners[type] = handler;
    }),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn().mockResolvedValue(undefined) },
  };
  const source = fs.readFileSync(path.resolve("public/service-worker.js"), "utf8");

  vm.runInNewContext(source, {
    self: selfMock,
    caches: cachesMock,
    fetch: fetchMock,
    URL,
    Promise,
    Response,
    console,
  });

  return { listeners, cachePut, selfMock, networkResponse };
}

describe("service-worker", () => {
  test("reacts to skip waiting messages", () => {
    const { listeners, selfMock } = loadServiceWorkerHarness();

    listeners.message({ data: { type: "SKIP_WAITING" } });

    expect(selfMock.skipWaiting).toHaveBeenCalledTimes(1);
  });

  test("skips api fetches and caches regular asset responses", async () => {
    const { listeners, cachePut, networkResponse } = loadServiceWorkerHarness();
    const skippedRespondWith = vi.fn();
    listeners.fetch({
      request: { method: "GET", url: "http://localhost:4000/api/state", mode: "cors" },
      respondWith: skippedRespondWith,
    });

    expect(skippedRespondWith).not.toHaveBeenCalled();

    const respondWith = vi.fn();
    listeners.fetch({
      request: { method: "GET", url: "https://app.example.test/assets/main.js", mode: "cors" },
      respondWith,
    });

    const response = await respondWith.mock.calls[0][0];
    expect(response).toBe(networkResponse);
    expect(cachePut).toHaveBeenCalledTimes(1);
  });
});
