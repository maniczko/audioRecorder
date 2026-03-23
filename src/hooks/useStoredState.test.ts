import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock storage before imports
vi.mock("../lib/storage", async () => {
  const actual = await vi.importActual("../lib/storage");
  return {
    ...actual,
    readStorage: vi.fn(),
    writeStorage: vi.fn(),
    readStorageAsync: vi.fn(),
    writeStorageAsync: vi.fn(),
  };
});

describe("useStoredState (dual-write sync engine with IndexedDB)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it("yields localStorage fallback value INSTANTLY on first render to prevent blank UI", async () => {
    const { readStorage } = await import("../lib/storage");
    vi.mocked(readStorage).mockReturnValueOnce("LOCAL_SESSION_TOKEN");

    const { useStoredState } = await import("./useStoredState");
    const { result } = renderHook(() => useStoredState("session.key", "default"));

    // Expected behavior: Must be available synchronously before any Promises resolve
    expect(result.current[0]).toBe("LOCAL_SESSION_TOKEN");
    expect(readStorage).toHaveBeenCalledWith("session.key", "default");
  });

  it("dual-writes to both synchronous localStorage and async IndexedDB on update", async () => {
    const { readStorage, writeStorage, writeStorageAsync } = await import("../lib/storage");
    vi.mocked(readStorage).mockReturnValueOnce("SYNC_VALUE");

    const { useStoredState } = await import("./useStoredState");
    const { result } = renderHook(() => useStoredState("session.key", "initial"));

    act(() => {
      const setState = result.current[1];
      setState("NEW_SESSION_DATA");
    });

    expect(result.current[0]).toBe("NEW_SESSION_DATA");
    expect(writeStorage).toHaveBeenCalledWith("session.key", "NEW_SESSION_DATA");
    expect(writeStorageAsync).toHaveBeenCalledWith("session.key", "NEW_SESSION_DATA");
  });
});
