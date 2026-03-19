import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  readStorage,
  writeStorage,
  readStorageAsync,
  writeStorageAsync,
  idbJSONStorage,
  STORAGE_KEYS,
  createId,
  formatDuration,
  formatDateTime,
} from "./storage";

describe("storage module", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe("STORAGE_KEYS", () => {
    it("exports all required storage keys", () => {
      expect(STORAGE_KEYS.users).toBeDefined();
      expect(STORAGE_KEYS.session).toBeDefined();
      expect(STORAGE_KEYS.meetings).toBeDefined();
      expect(STORAGE_KEYS.taskState).toBeDefined();
      expect(STORAGE_KEYS.recordingQueue).toBeDefined();
      expect(STORAGE_KEYS.vocabulary).toBeDefined();
    });
  });

  describe("readStorage / writeStorage (sync localStorage)", () => {
    it("returns fallback when key is missing", () => {
      expect(readStorage("nonexistent.key", 42)).toBe(42);
    });

    it("writes and reads a string value", () => {
      writeStorage("test.key", "hello");
      expect(readStorage("test.key", "")).toBe("hello");
    });

    it("writes and reads an object value", () => {
      const obj = { foo: "bar", count: 7 };
      writeStorage("test.obj", obj);
      expect(readStorage("test.obj", null)).toEqual(obj);
    });

    it("writes and reads an array value", () => {
      const arr = [1, 2, 3];
      writeStorage("test.arr", arr);
      expect(readStorage("test.arr", [])).toEqual(arr);
    });

    it("handles corrupted JSON gracefully", () => {
      window.localStorage.setItem("broken.key", "not-valid-json{{{");
      expect(readStorage("broken.key", "default")).toBe("default");
    });
  });

  describe("readStorageAsync / writeStorageAsync (IndexedDB with fallback)", () => {
    it("falls back to localStorage when indexedDB is unavailable", async () => {
      writeStorage("async.test", { value: 123 });
      const result = await readStorageAsync("async.test", null);
      expect(result).toEqual({ value: 123 });
    });

    it("returns fallback when key does not exist anywhere", async () => {
      const result = await readStorageAsync("missing.async.key", "fallback");
      expect(result).toBe("fallback");
    });

    it("writeStorageAsync writes data readable by readStorageAsync", async () => {
      const data = { tasks: [1, 2, 3], title: "Test" };
      await writeStorageAsync("async.write", data);
      const result = await readStorageAsync("async.write", null);
      expect(result).toEqual(data);
    });
  });

  describe("idbJSONStorage (Zustand persist adapter)", () => {
    it("returns null for missing keys", async () => {
      const result = await idbJSONStorage.getItem("zustand.missing");
      expect(result).toBeNull();
    });

    it("setItem + getItem round-trips JSON", async () => {
      const payload = JSON.stringify({ queue: [{ id: "r1" }] });
      await idbJSONStorage.setItem("zustand.test", payload);
      const result = await idbJSONStorage.getItem("zustand.test");
      expect(JSON.parse(result)).toEqual({ queue: [{ id: "r1" }] });
    });

    it("removeItem clears the stored value", async () => {
      await idbJSONStorage.setItem("zustand.rm", JSON.stringify({ a: 1 }));
      await idbJSONStorage.removeItem("zustand.rm");
      const result = await idbJSONStorage.getItem("zustand.rm");
      expect(result).toBeNull();
    });
  });

  describe("createId", () => {
    it("generates unique IDs with prefix", () => {
      const id1 = createId("task");
      const id2 = createId("task");
      expect(id1).not.toBe(id2);
      expect(id1.startsWith("task_")).toBe(true);
    });
  });

  describe("formatDuration", () => {
    it("formats 0 seconds", () => {
      expect(formatDuration(0)).toBe("00:00");
    });
    it("formats 90 seconds", () => {
      expect(formatDuration(90)).toBe("01:30");
    });
    it("handles undefined", () => {
      expect(formatDuration(undefined)).toBe("00:00");
    });
  });

  describe("formatDateTime", () => {
    it("returns 'No date' for falsy input", () => {
      expect(formatDateTime(null)).toBe("No date");
      expect(formatDateTime("")).toBe("No date");
    });
    it("formats a valid ISO date", () => {
      const result = formatDateTime("2026-01-15T10:30:00Z");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(5);
    });
  });
});
