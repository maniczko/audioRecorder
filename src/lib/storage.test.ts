import { readStorage, writeStorage, readStorageAsync, writeStorageAsync, idbJSONStorage } from "./storage";
import { vi } from 'vitest';
import * as idb from 'idb-keyval';

vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));

describe("storage utilities", () => {
  const originalIndexedDB = global.window.indexedDB;
  
  beforeEach(() => {
    vi.clearAllMocks();
    // Simulate IndexedDB support
    global.window.indexedDB = {}; 
    global.window.localStorage.clear();
  });

  afterAll(() => {
    global.window.indexedDB = originalIndexedDB;
  });

  test("readStorage returns fallback if not in localStorage", () => {
    expect(readStorage("missing", "fallback")).toBe("fallback");
  });

  test("writeStorage saves value to localStorage", () => {
    writeStorage("testKey", { success: true });
    expect(window.localStorage.getItem("testKey")).toBe(JSON.stringify({ success: true }));
  });

  test("readStorageAsync uses idb-keyval get", async () => {
    idb.get.mockResolvedValueOnce({ saved: "data" });
    const result = await readStorageAsync("asyncKey", "fallback");
    expect(idb.get).toHaveBeenCalledWith("asyncKey");
    expect(result).toEqual({ saved: "data" });
  });

  test("writeStorageAsync uses idb-keyval set", async () => {
    await writeStorageAsync("asyncKey", { new: "data" });
    expect(idb.set).toHaveBeenCalledWith("asyncKey", { new: "data" });
  });
  
  test("idbJSONStorage conforms to createJSONStorage expected API", async () => {
    idb.get.mockResolvedValueOnce({ parseMe: "yes" });
    const str = await idbJSONStorage.getItem("someName");
    expect(str).toBe(JSON.stringify({ parseMe: "yes" }));
    
    await idbJSONStorage.setItem("someName", JSON.stringify({ savedId: 10 }));
    expect(idb.set).toHaveBeenCalledWith("someName", { savedId: 10 });
    
    await idbJSONStorage.removeItem("someName");
    expect(idb.del).toHaveBeenCalledWith("someName");
  });
});
