/**
 * @vitest-environment jsdom
 * stateService service tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("stateService", () => {
  let stateService: any;
  let originalFetch: any;

  beforeEach(async () => {
    vi.resetModules();
    originalFetch = global.fetch;
    global.fetch = vi.fn();
    stateService = await import("./services/stateService");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("getState", () => {
    it("fetches workspace state", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ state: { key: "value" } }),
      });

      const result = await stateService.getState("ws1");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ state: { key: "value" } });
    });

    it("includes workspace ID in URL", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await stateService.getState("ws1");
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("ws1"),
        expect.any(Object)
      );
    });

    it("handles fetch error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(stateService.getState("ws1")).rejects.toThrow();
    });
  });

  describe("setState", () => {
    it("sets workspace state", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await stateService.setState("ws1", { key: "value" });
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("includes state in request body", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await stateService.setState("ws1", { key: "value" });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ state: { key: "value" } }),
        })
      );
    });

    it("handles set error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(stateService.setState("ws1", {})).rejects.toThrow();
    });
  });

  describe("syncState", () => {
    it("syncs local state with server", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ synced: true }),
      });

      const localState = { key: "local" };
      const result = await stateService.syncState("ws1", localState);
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ synced: true });
    });

    it("includes local state in sync", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await stateService.syncState("ws1", { key: "value" });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ state: { key: "value" } }),
        })
      );
    });

    it("handles sync error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(stateService.syncState("ws1", {})).rejects.toThrow();
    });
  });

  describe("mergeStates", () => {
    it("merges two states", () => {
      const local = { a: 1, b: 2 };
      const remote = { b: 3, c: 4 };
      
      const result = stateService.mergeStates(local, remote);
      
      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it("handles empty local state", () => {
      const local = {};
      const remote = { a: 1 };
      
      const result = stateService.mergeStates(local, remote);
      
      expect(result).toEqual({ a: 1 });
    });

    it("handles empty remote state", () => {
      const local = { a: 1 };
      const remote = {};
      
      const result = stateService.mergeStates(local, remote);
      
      expect(result).toEqual({ a: 1 });
    });

    it("handles null states", () => {
      const result = stateService.mergeStates(null, null);
      expect(result).toEqual({});
    });
  });

  describe("compareStates", () => {
    it("returns true for identical states", () => {
      const state1 = { a: 1, b: 2 };
      const state2 = { a: 1, b: 2 };
      
      expect(stateService.compareStates(state1, state2)).toBe(true);
    });

    it("returns false for different states", () => {
      const state1 = { a: 1 };
      const state2 = { a: 2 };
      
      expect(stateService.compareStates(state1, state2)).toBe(false);
    });

    it("handles nested objects", () => {
      const state1 = { a: { b: 1 } };
      const state2 = { a: { b: 1 } };
      
      expect(stateService.compareStates(state1, state2)).toBe(true);
    });

    it("handles arrays", () => {
      const state1 = { a: [1, 2] };
      const state2 = { a: [1, 2] };
      
      expect(stateService.compareStates(state1, state2)).toBe(true);
    });
  });

  describe("getLocalState", () => {
    it("returns local state from storage", () => {
      localStorage.setItem("workspace_state_ws1", JSON.stringify({ key: "value" }));
      
      const result = stateService.getLocalState("ws1");
      
      expect(result).toEqual({ key: "value" });
    });

    it("returns empty object when no state", () => {
      localStorage.removeItem("workspace_state_ws1");
      
      const result = stateService.getLocalState("ws1");
      
      expect(result).toEqual({});
    });

    it("handles invalid JSON", () => {
      localStorage.setItem("workspace_state_ws1", "invalid");
      
      const result = stateService.getLocalState("ws1");
      
      expect(result).toEqual({});
    });
  });

  describe("setLocalState", () => {
    it("saves state to local storage", () => {
      stateService.setLocalState("ws1", { key: "value" });
      
      const stored = localStorage.getItem("workspace_state_ws1");
      expect(stored).toBeDefined();
      expect(JSON.parse(stored!)).toEqual({ key: "value" });
    });

    it("overwrites existing state", () => {
      localStorage.setItem("workspace_state_ws1", JSON.stringify({ old: "value" }));
      
      stateService.setLocalState("ws1", { new: "value" });
      
      const stored = localStorage.getItem("workspace_state_ws1");
      expect(JSON.parse(stored!)).toEqual({ new: "value" });
    });
  });

  describe("clearLocalState", () => {
    it("clears local state", () => {
      localStorage.setItem("workspace_state_ws1", JSON.stringify({ key: "value" }));
      
      stateService.clearLocalState("ws1");
      
      expect(localStorage.getItem("workspace_state_ws1")).toBeNull();
    });
  });

  describe("getRemoteState", () => {
    it("returns cached remote state", () => {
      stateService.setRemoteState("ws1", { key: "value" });
      
      const result = stateService.getRemoteState("ws1");
      
      expect(result).toEqual({ key: "value" });
    });

    it("returns null when no cached state", () => {
      const result = stateService.getRemoteState("ws1");
      
      expect(result).toBeNull();
    });
  });

  describe("setRemoteState", () => {
    it("caches remote state", () => {
      stateService.setRemoteState("ws1", { key: "value" });
      
      const result = stateService.getRemoteState("ws1");
      expect(result).toEqual({ key: "value" });
    });

    it("overwrites existing cache", () => {
      stateService.setRemoteState("ws1", { old: "value" });
      stateService.setRemoteState("ws1", { new: "value" });
      
      const result = stateService.getRemoteState("ws1");
      expect(result).toEqual({ new: "value" });
    });
  });

  describe("clearRemoteState", () => {
    it("clears remote state cache", () => {
      stateService.setRemoteState("ws1", { key: "value" });
      stateService.clearRemoteState("ws1");
      
      const result = stateService.getRemoteState("ws1");
      expect(result).toBeNull();
    });
  });

  describe("hasLocalChanges", () => {
    it("returns true when local differs from remote", () => {
      stateService.setLocalState("ws1", { a: 1 });
      stateService.setRemoteState("ws1", { a: 2 });
      
      expect(stateService.hasLocalChanges("ws1")).toBe(true);
    });

    it("returns false when states match", () => {
      stateService.setLocalState("ws1", { a: 1 });
      stateService.setRemoteState("ws1", { a: 1 });
      
      expect(stateService.hasLocalChanges("ws1")).toBe(false);
    });

    it("returns true when no remote state", () => {
      stateService.setLocalState("ws1", { a: 1 });
      
      expect(stateService.hasLocalChanges("ws1")).toBe(true);
    });
  });

  describe("hasRemoteChanges", () => {
    it("returns true when remote differs from local", () => {
      stateService.setLocalState("ws1", { a: 1 });
      stateService.setRemoteState("ws1", { a: 2 });
      
      expect(stateService.hasRemoteChanges("ws1")).toBe(true);
    });

    it("returns false when states match", () => {
      stateService.setLocalState("ws1", { a: 1 });
      stateService.setRemoteState("ws1", { a: 1 });
      
      expect(stateService.hasRemoteChanges("ws1")).toBe(false);
    });

    it("returns true when no local state", () => {
      stateService.setRemoteState("ws1", { a: 1 });
      
      expect(stateService.hasRemoteChanges("ws1")).toBe(true);
    });
  });

  describe("resolveConflict", () => {
    it("resolves with local state", () => {
      stateService.setLocalState("ws1", { local: "value" });
      stateService.setRemoteState("ws1", { remote: "value" });
      
      stateService.resolveConflict("ws1", "local");
      
      const result = stateService.getLocalState("ws1");
      expect(result).toEqual({ local: "value" });
    });

    it("resolves with remote state", () => {
      stateService.setLocalState("ws1", { local: "value" });
      stateService.setRemoteState("ws1", { remote: "value" });
      
      stateService.resolveConflict("ws1", "remote");
      
      const result = stateService.getLocalState("ws1");
      expect(result).toEqual({ remote: "value" });
    });

    it("handles invalid strategy", () => {
      stateService.setLocalState("ws1", { a: 1 });
      
      stateService.resolveConflict("ws1", "invalid" as any);
      
      // Should default to local
      const result = stateService.getLocalState("ws1");
      expect(result).toEqual({ a: 1 });
    });
  });

  describe("autoSync", () => {
    it("starts auto sync", () => {
      stateService.startAutoSync("ws1");
      // Should start interval
      expect(stateService.isAutoSyncActive("ws1")).toBe(true);
    });

    it("stops auto sync", () => {
      stateService.startAutoSync("ws1");
      stateService.stopAutoSync("ws1");
      expect(stateService.isAutoSyncActive("ws1")).toBe(false);
    });

    it("isAutoSyncActive returns status", () => {
      expect(stateService.isAutoSyncActive("ws1")).toBe(false);
    });
  });

  describe("startAutoSync", () => {
    it("sets sync interval", () => {
      stateService.startAutoSync("ws1", 1000);
      expect(stateService.isAutoSyncActive("ws1")).toBe(true);
    });
  });

  describe("stopAutoSync", () => {
    it("clears sync interval", () => {
      stateService.startAutoSync("ws1");
      stateService.stopAutoSync("ws1");
      expect(stateService.isAutoSyncActive("ws1")).toBe(false);
    });
  });

  describe("isAutoSyncActive", () => {
    it("returns false when not active", () => {
      expect(stateService.isAutoSyncActive("ws1")).toBe(false);
    });
  });

  describe("getSyncStatus", () => {
    it("returns sync status", () => {
      const status = stateService.getSyncStatus("ws1");
      expect(status).toBeDefined();
      expect(status).toHaveProperty("lastSync");
      expect(status).toHaveProperty("syncing");
    });
  });

  describe("setSyncStatus", () => {
    it("sets sync status", () => {
      stateService.setSyncStatus("ws1", {
        lastSync: Date.now(),
        syncing: false,
      });
      
      const status = stateService.getSyncStatus("ws1");
      expect(status.syncing).toBe(false);
    });
  });

  describe("clearSyncStatus", () => {
    it("clears sync status", () => {
      stateService.setSyncStatus("ws1", {
        lastSync: Date.now(),
        syncing: false,
      });
      
      stateService.clearSyncStatus("ws1");
      
      const status = stateService.getSyncStatus("ws1");
      expect(status).toBeNull();
    });
  });

  describe("isSyncing", () => {
    it("returns true when syncing", () => {
      stateService.setSyncStatus("ws1", {
        lastSync: Date.now(),
        syncing: true,
      });
      
      expect(stateService.isSyncing("ws1")).toBe(true);
    });

    it("returns false when not syncing", () => {
      stateService.setSyncStatus("ws1", {
        lastSync: Date.now(),
        syncing: false,
      });
      
      expect(stateService.isSyncing("ws1")).toBe(false);
    });
  });

  describe("getLastSyncTime", () => {
    it("returns last sync time", () => {
      const now = Date.now();
      stateService.setSyncStatus("ws1", {
        lastSync: now,
        syncing: false,
      });
      
      expect(stateService.getLastSyncTime("ws1")).toBe(now);
    });

    it("returns null when never synced", () => {
      expect(stateService.getLastSyncTime("ws1")).toBeNull();
    });
  });

  describe("needsSync", () => {
    it("returns true when stale", () => {
      const stale = Date.now() - 60000 * 5; // 5 minutes ago
      stateService.setSyncStatus("ws1", {
        lastSync: stale,
        syncing: false,
      });
      
      expect(stateService.needsSync("ws1")).toBe(true);
    });

    it("returns false when fresh", () => {
      const fresh = Date.now();
      stateService.setSyncStatus("ws1", {
        lastSync: fresh,
        syncing: false,
      });
      
      expect(stateService.needsSync("ws1")).toBe(false);
    });

    it("returns false when syncing", () => {
      stateService.setSyncStatus("ws1", {
        lastSync: 0,
        syncing: true,
      });
      
      expect(stateService.needsSync("ws1")).toBe(false);
    });
  });

  describe("queueSync", () => {
    it("adds workspace to sync queue", () => {
      stateService.queueSync("ws1");
      
      expect(stateService.getSyncQueue()).toContain("ws1");
    });

    it("deduplicates queue", () => {
      stateService.queueSync("ws1");
      stateService.queueSync("ws1");
      
      expect(stateService.getSyncQueue().length).toBe(1);
    });
  });

  describe("dequeueSync", () => {
    it("removes workspace from sync queue", () => {
      stateService.queueSync("ws1");
      stateService.dequeueSync("ws1");
      
      expect(stateService.getSyncQueue()).not.toContain("ws1");
    });
  });

  describe("getSyncQueue", () => {
    it("returns sync queue", () => {
      stateService.queueSync("ws1");
      stateService.queueSync("ws2");
      
      const queue = stateService.getSyncQueue();
      expect(queue).toHaveLength(2);
    });

    it("returns empty array when no queued syncs", () => {
      const queue = stateService.getSyncQueue();
      expect(queue).toEqual([]);
    });
  });

  describe("clearSyncQueue", () => {
    it("clears sync queue", () => {
      stateService.queueSync("ws1");
      stateService.queueSync("ws2");
      stateService.clearSyncQueue();
      
      expect(stateService.getSyncQueue()).toEqual([]);
    });
  });

  describe("processSyncQueue", () => {
    it("processes queued syncs", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      stateService.queueSync("ws1");
      await stateService.processSyncQueue();
      
      expect(global.fetch).toHaveBeenCalled();
      expect(stateService.getSyncQueue()).toEqual([]);
    });

    it("handles queue processing error", async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

      stateService.queueSync("ws1");
      await expect(stateService.processSyncQueue()).resolves.not.toThrow();
      
      // Should still clear queue on error
      expect(stateService.getSyncQueue()).toEqual([]);
    });
  });

  describe("getStateClient", () => {
    it("creates new state client", () => {
      const client = stateService.getStateClient();
      expect(client).toBeDefined();
      expect(client.getState).toBeDefined();
      expect(client.setState).toBeDefined();
    });

    it("creates client with custom config", () => {
      const client = stateService.getStateClient({
        baseUrl: "http://custom:3000",
      });
      
      expect(client).toBeDefined();
    });
  });

  describe("defaultState", () => {
    it("exports default state instance", () => {
      expect(stateService.default).toBeDefined();
      expect(stateService.default.getState).toBeDefined();
    });
  });

  describe("useState", () => {
    it("exports useState hook", () => {
      expect(stateService.useState).toBeDefined();
      expect(typeof stateService.useState).toBe("function");
    });
  });

  describe("StateProvider", () => {
    it("exports StateProvider component", () => {
      expect(stateService.StateProvider).toBeDefined();
      expect(typeof stateService.StateProvider).toBe("function");
    });
  });

  describe("withState", () => {
    it("exports withState HOC", () => {
      expect(stateService.withState).toBeDefined();
      expect(typeof stateService.withState).toBe("function");
    });
  });

  describe("requireState", () => {
    it("exports requireState function", () => {
      expect(stateService.requireState).toBeDefined();
      expect(typeof stateService.requireState).toBe("function");
    });
  });

  describe("getStateStore", () => {
    it("returns state store", () => {
      const store = stateService.getStateStore();
      expect(store).toBeDefined();
      expect(store.getState).toBeDefined();
      expect(store.setState).toBeDefined();
    });
  });

  describe("setStateStore", () => {
    it("sets state store", () => {
      const store = { getState: vi.fn(), setState: vi.fn() };
      stateService.setStateStore(store as any);
      
      expect(stateService.getStateStore()).toBe(store);
    });
  });

  describe("clearStateStore", () => {
    it("clears state store", () => {
      const store = { getState: vi.fn(), setState: vi.fn() };
      stateService.setStateStore(store as any);
      stateService.clearStateStore();
      
      expect(stateService.getStateStore()).toBeNull();
    });
  });

  describe("subscribeToState", () => {
    it("subscribes to state changes", () => {
      const callback = vi.fn();
      stateService.subscribeToState("ws1", callback);
      
      // Should be subscribed
      expect(stateService.getSubscribers("ws1")).toContain(callback);
    });
  });

  describe("unsubscribeFromState", () => {
    it("unsubscribes from state changes", () => {
      const callback = vi.fn();
      stateService.subscribeToState("ws1", callback);
      stateService.unsubscribeFromState("ws1", callback);
      
      expect(stateService.getSubscribers("ws1")).not.toContain(callback);
    });
  });

  describe("notifyStateSubscribers", () => {
    it("notifies all subscribers", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      stateService.subscribeToState("ws1", callback1);
      stateService.subscribeToState("ws1", callback2);
      
      stateService.notifyStateSubscribers("ws1", { key: "value" });
      
      expect(callback1).toHaveBeenCalledWith({ key: "value" });
      expect(callback2).toHaveBeenCalledWith({ key: "value" });
    });
  });

  describe("getSubscribers", () => {
    it("returns subscribers array", () => {
      const callback = vi.fn();
      stateService.subscribeToState("ws1", callback);
      
      const subscribers = stateService.getSubscribers("ws1");
      expect(subscribers).toContain(callback);
    });

    it("returns empty array when no subscribers", () => {
      const subscribers = stateService.getSubscribers("ws1");
      expect(subscribers).toEqual([]);
    });
  });

  describe("clearSubscribers", () => {
    it("clears all subscribers", () => {
      const callback = vi.fn();
      stateService.subscribeToState("ws1", callback);
      stateService.clearSubscribers("ws1");
      
      expect(stateService.getSubscribers("ws1")).toEqual([]);
    });
  });

  describe("validateState", () => {
    it("returns true for valid state", () => {
      const state = { key: "value" };
      expect(stateService.validateState(state)).toBe(true);
    });

    it("returns false for null state", () => {
      expect(stateService.validateState(null)).toBe(false);
    });

    it("returns false for undefined state", () => {
      expect(stateService.validateState(undefined)).toBe(false);
    });

    it("returns false for non-object state", () => {
      expect(stateService.validateState("string")).toBe(false);
      expect(stateService.validateState(123)).toBe(false);
    });
  });

  describe("sanitizeState", () => {
    it("removes invalid keys", () => {
      const state = { valid: "value", __proto__: "invalid" };
      const result = stateService.sanitizeState(state);
      
      expect(result.__proto__).toBeUndefined();
      expect(result.valid).toBe("value");
    });

    it("handles nested objects", () => {
      const state = { nested: { __proto__: "invalid" } };
      const result = stateService.sanitizeState(state);
      
      expect(result.nested.__proto__).toBeUndefined();
    });
  });

  describe("serializeState", () => {
    it("serializes state to JSON", () => {
      const state = { key: "value" };
      const result = stateService.serializeState(state);
      
      expect(result).toBe('{"key":"value"}');
    });

    it("handles circular references", () => {
      const state: any = { key: "value" };
      state.self = state;
      
      const result = stateService.serializeState(state);
      expect(result).toBeDefined();
    });
  });

  describe("deserializeState", () => {
    it("deserializes JSON to state", () => {
      const json = '{"key":"value"}';
      const result = stateService.deserializeState(json);
      
      expect(result).toEqual({ key: "value" });
    });

    it("handles invalid JSON", () => {
      const result = stateService.deserializeState("invalid");
      expect(result).toEqual({});
    });

    it("handles empty string", () => {
      const result = stateService.deserializeState("");
      expect(result).toEqual({});
    });
  });

  describe("exportState", () => {
    it("exports state to file", () => {
      const state = { key: "value" };
      const result = stateService.exportState(state);
      
      expect(result).toContain("key");
      expect(result).toContain("value");
    });
  });

  describe("importState", () => {
    it("imports state from file", () => {
      const json = '{"key":"value"}';
      const result = stateService.importState(json);
      
      expect(result).toEqual({ key: "value" });
    });

    it("handles invalid import", () => {
      const result = stateService.importState("invalid");
      expect(result).toBeNull();
    });
  });

  describe("backupState", () => {
    it("creates state backup", () => {
      stateService.setLocalState("ws1", { key: "value" });
      stateService.backupState("ws1");
      
      const backup = localStorage.getItem("workspace_state_ws1_backup");
      expect(backup).toBeDefined();
    });
  });

  describe("restoreState", () => {
    it("restores state from backup", () => {
      stateService.setLocalState("ws1", { original: "value" });
      stateService.backupState("ws1");
      stateService.setLocalState("ws1", { modified: "value" });
      
      stateService.restoreState("ws1");
      
      const state = stateService.getLocalState("ws1");
      expect(state).toEqual({ original: "value" });
    });

    it("handles missing backup", () => {
      const result = stateService.restoreState("ws1");
      expect(result).toBe(false);
    });
  });

  describe("clearBackup", () => {
    it("clears state backup", () => {
      stateService.backupState("ws1");
      stateService.clearBackup("ws1");
      
      const backup = localStorage.getItem("workspace_state_ws1_backup");
      expect(backup).toBeNull();
    });
  });

  describe("hasBackup", () => {
    it("returns true when backup exists", () => {
      stateService.backupState("ws1");
      expect(stateService.hasBackup("ws1")).toBe(true);
    });

    it("returns false when no backup", () => {
      expect(stateService.hasBackup("ws1")).toBe(false);
    });
  });

  describe("getBackupTime", () => {
    it("returns backup time", () => {
      stateService.backupState("ws1");
      const time = stateService.getBackupTime("ws1");
      expect(time).toBeDefined();
      expect(typeof time).toBe("number");
    });

    it("returns null when no backup", () => {
      expect(stateService.getBackupTime("ws1")).toBeNull();
    });
  });

  describe("cleanupOldBackups", () => {
    it("removes old backups", () => {
      stateService.backupState("ws1");
      stateService.cleanupOldBackups(0); // 0 ms = immediate
      
      expect(stateService.hasBackup("ws1")).toBe(false);
    });
  });
});
