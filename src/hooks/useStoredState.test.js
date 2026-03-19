import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import useStoredState from "./useStoredState";
import { readStorage, writeStorage, readStorageAsync, writeStorageAsync } from "../lib/storage";

vi.mock("../lib/storage", () => ({
  readStorage: vi.fn(),
  writeStorage: vi.fn(),
  readStorageAsync: vi.fn(),
  writeStorageAsync: vi.fn(),
}));

describe("useStoredState (dual-write sync engine with IndexedDB)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("yields localStorage fallback value INSTANTLY on first render to prevent blank UI", () => {
    readStorage.mockReturnValueOnce("LOCAL_SESSION_TOKEN");
    readStorageAsync.mockResolvedValueOnce("INDEXED_DB_TOKEN_UPGRADE");

    const { result } = renderHook(() => useStoredState("session.key", "default"));

    // Expected behavior: Must be available synchronously before any Promises resolve
    expect(result.current[0]).toBe("LOCAL_SESSION_TOKEN");
    expect(readStorage).toHaveBeenCalledWith("session.key", "default");
  });

  it("dual-writes to both synchronous localStorage and async IndexedDB on update", () => {
    readStorage.mockReturnValueOnce("SYNC_VALUE");
    readStorageAsync.mockResolvedValueOnce("SYNC_VALUE");

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
