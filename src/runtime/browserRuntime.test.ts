import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  isHostedPreviewHost,
  prepareHostedRuntime,
  shouldEnableServiceWorker,
} from "./browserRuntime";

describe("browserRuntime", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("identifies hosted vercel previews correctly", () => {
    expect(isHostedPreviewHost("preview.vercel.app")).toBe(true);
    expect(isHostedPreviewHost("localhost")).toBe(false);
  });

  test("enables service worker only on localhost", () => {
    expect(shouldEnableServiceWorker("localhost")).toBe(true);
    expect(shouldEnableServiceWorker("127.0.0.1")).toBe(true);
    expect(shouldEnableServiceWorker("preview.vercel.app")).toBe(false);
    expect(shouldEnableServiceWorker("app.example.com")).toBe(false);
  });

  test("cleans preview workers and reloads once when a stale controller exists", async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const getRegistrations = vi.fn().mockResolvedValue([{ unregister }]);
    const keys = vi.fn().mockResolvedValue(["voicelog-os-v3", "other-cache"]);
    const deleteCache = vi.fn().mockResolvedValue(true);
    const reload = vi.fn();
    const sessionStorageRef = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    } as any;

    const result = await prepareHostedRuntime({
      hostname: "preview.vercel.app",
      sessionStorageRef,
      serviceWorkerRef: {
        controller: {},
        getRegistrations,
      } as any,
      cachesRef: {
        keys,
        delete: deleteCache,
      } as any,
      reload,
    });

    expect(getRegistrations).toHaveBeenCalledTimes(1);
    expect(unregister).toHaveBeenCalledTimes(1);
    expect(deleteCache).toHaveBeenCalledWith("voicelog-os-v3");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ cleaned: true, reloaded: true });
  });

  test("skips cleanup on non-preview hosts", async () => {
    const result = await prepareHostedRuntime({
      hostname: "localhost",
      sessionStorageRef: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() } as any,
      serviceWorkerRef: { getRegistrations: vi.fn() } as any,
      cachesRef: { keys: vi.fn(), delete: vi.fn() } as any,
      reload: vi.fn(),
    });

    expect(result).toEqual({ cleaned: false, reloaded: false });
  });
});
