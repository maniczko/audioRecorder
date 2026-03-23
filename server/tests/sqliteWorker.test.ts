/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Worker } from "node:worker_threads";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

describe("sqliteWorker", () => {
  let worker: Worker;
  let tempDbPath: string;

  beforeEach(() => {
    tempDbPath = path.join(os.tmpdir(), `test_worker_${Date.now()}.sqlite`);
  });

  afterEach(() => {
    if (worker) {
      worker.terminate();
    }
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  function createWorker(): Promise<Worker> {
    return new Promise((resolve) => {
      const w = new Worker(path.resolve(__dirname, "../sqliteWorker.ts"));
      w.once("online", () => resolve(w));
      w.on("error", () => {
        // Worker may fail in some environments, that's expected
        resolve(w);
      });
    });
  }

  it("initializes database with correct path", async () => {
    worker = await createWorker();
    
    const initPromise = new Promise((resolve, reject) => {
      worker.once("message", (msg) => {
        if (msg.error) reject(new Error(msg.error));
        else resolve(msg.result);
      });
    });

    worker.postMessage({
      id: 1,
      type: "init",
      dbPath: tempDbPath,
    });

    const result = await initPromise;
    expect(result).toBe("ok");
    expect(fs.existsSync(tempDbPath)).toBe(true);
  });

  it("executes CREATE TABLE statement", async () => {
    worker = await createWorker();
    
    // Initialize
    worker.postMessage({ id: 1, type: "init", dbPath: tempDbPath });
    await new Promise((resolve) => worker.once("message", resolve));

    // Create table
    const createPromise = new Promise((resolve, reject) => {
      worker.once("message", (msg) => {
        if (msg.error) reject(new Error(msg.error));
        else resolve(msg.result);
      });
    });

    worker.postMessage({
      id: 2,
      type: "exec",
      sql: "CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)",
    });

    const result = await createPromise;
    expect(result).toBe("ok");
  });

  it("executes INSERT and retrieves data", async () => {
    worker = await createWorker();
    
    // Initialize
    worker.postMessage({ id: 1, type: "init", dbPath: tempDbPath });
    await new Promise((resolve) => worker.once("message", resolve));

    // Create table
    worker.postMessage({
      id: 2,
      type: "exec",
      sql: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)",
    });
    await new Promise((resolve) => worker.once("message", resolve));

    // Insert
    worker.postMessage({
      id: 3,
      type: "execute",
      sql: "INSERT INTO users (name, email) VALUES (?, ?)",
      params: ["Alice", "alice@example.com"],
    });
    await new Promise((resolve) => worker.once("message", resolve));

    // Query
    const queryPromise = new Promise((resolve, reject) => {
      worker.once("message", (msg) => {
        if (msg.error) reject(new Error(msg.error));
        else resolve(msg.result);
      });
    });

    worker.postMessage({
      id: 4,
      type: "query",
      sql: "SELECT * FROM users WHERE name = ?",
      params: ["Alice"],
    });

    const result: any = await queryPromise;
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Alice");
    expect(result[0].email).toBe("alice@example.com");
  });

  it("returns single row with GET operation", async () => {
    worker = await createWorker();
    
    // Initialize
    worker.postMessage({ id: 1, type: "init", dbPath: tempDbPath });
    await new Promise((resolve) => worker.once("message", resolve));

    // Create table and insert
    worker.postMessage({
      id: 2,
      type: "exec",
      sql: "CREATE TABLE items (id INTEGER PRIMARY KEY, value TEXT)",
    });
    await new Promise((resolve) => worker.once("message", resolve));

    worker.postMessage({
      id: 3,
      type: "execute",
      sql: "INSERT INTO items (value) VALUES (?)",
      params: ["test-value"],
    });
    await new Promise((resolve) => worker.once("message", resolve));

    // Get single row
    const getPromise = new Promise((resolve, reject) => {
      worker.once("message", (msg) => {
        if (msg.error) reject(new Error(msg.error));
        else resolve(msg.result);
      });
    });

    worker.postMessage({
      id: 4,
      type: "get",
      sql: "SELECT * FROM items WHERE value = ?",
      params: ["test-value"],
    });

    const result: any = await getPromise;
    expect(result).toBeDefined();
    expect(result.value).toBe("test-value");
  });

  it("handles errors gracefully when DB not initialized", async () => {
    worker = await createWorker();
    
    const errorPromise = new Promise((resolve) => {
      worker.once("message", (msg) => {
        resolve(msg.error);
      });
    });

    // Try to query without initializing
    worker.postMessage({
      id: 1,
      type: "query",
      sql: "SELECT 1",
    });

    const error = await errorPromise;
    expect(error).toContain("not initialized");
  });

  it("handles unknown message types", async () => {
    worker = await createWorker();
    
    // Initialize first
    worker.postMessage({ id: 1, type: "init", dbPath: tempDbPath });
    await new Promise((resolve) => worker.once("message", resolve));

    const errorPromise = new Promise((resolve) => {
      worker.once("message", (msg) => {
        resolve(msg.error);
      });
    });

    worker.postMessage({
      id: 2,
      type: "unknown_type",
      sql: "SELECT 1",
    });

    const error = await errorPromise;
    expect(error).toContain("Unknown message type");
  });

  it("handles SQL errors gracefully", async () => {
    worker = await createWorker();
    
    // Initialize
    worker.postMessage({ id: 1, type: "init", dbPath: tempDbPath });
    await new Promise((resolve) => worker.once("message", resolve));

    const errorPromise = new Promise((resolve) => {
      worker.once("message", (msg) => {
        resolve(msg.error);
      });
    });

    // Invalid SQL
    worker.postMessage({
      id: 2,
      type: "query",
      sql: "SELECT * FROM nonexistent_table",
    });

    const error = await errorPromise;
    expect(error).toBeDefined();
    expect(error).toContain("no such table");
  });

  it("supports multiple sequential operations", async () => {
    worker = await createWorker();
    
    // Initialize
    worker.postMessage({ id: 1, type: "init", dbPath: tempDbPath });
    await new Promise((resolve) => worker.once("message", resolve));

    // Create table
    worker.postMessage({
      id: 2,
      type: "exec",
      sql: "CREATE TABLE counter (id INTEGER PRIMARY KEY, count INTEGER DEFAULT 0)",
    });
    await new Promise((resolve) => worker.once("message", resolve));

    // Insert
    worker.postMessage({
      id: 3,
      type: "execute",
      sql: "INSERT INTO counter (count) VALUES (0)",
    });
    await new Promise((resolve) => worker.once("message", resolve));

    // Update
    worker.postMessage({
      id: 4,
      type: "execute",
      sql: "UPDATE counter SET count = count + 1 WHERE id = 1",
    });
    await new Promise((resolve) => worker.once("message", resolve));

    // Query
    const queryPromise = new Promise((resolve, reject) => {
      worker.once("message", (msg) => {
        if (msg.error) reject(new Error(msg.error));
        else resolve(msg.result);
      });
    });

    worker.postMessage({
      id: 5,
      type: "query",
      sql: "SELECT count FROM counter WHERE id = 1",
    });

    const result: any = await queryPromise;
    expect(result[0].count).toBe(1);
  });

  it("initializes with WAL journal mode", async () => {
    worker = await createWorker();
    
    worker.postMessage({ id: 1, type: "init", dbPath: tempDbPath });
    await new Promise((resolve) => worker.once("message", resolve));

    // Check pragma
    const pragmaPromise = new Promise((resolve, reject) => {
      worker.once("message", (msg) => {
        if (msg.error) reject(new Error(msg.error));
        else resolve(msg.result);
      });
    });

    worker.postMessage({
      id: 2,
      type: "query",
      sql: "PRAGMA journal_mode",
    });

    const result: any = await pragmaPromise;
    expect(result[0].journal_mode).toBe("wal");
  });

  it("enables foreign keys", async () => {
    worker = await createWorker();
    
    worker.postMessage({ id: 1, type: "init", dbPath: tempDbPath });
    await new Promise((resolve) => worker.once("message", resolve));

    // Check foreign keys pragma
    const pragmaPromise = new Promise((resolve, reject) => {
      worker.once("message", (msg) => {
        if (msg.error) reject(new Error(msg.error));
        else resolve(msg.result);
      });
    });

    worker.postMessage({
      id: 2,
      type: "query",
      sql: "PRAGMA foreign_keys",
    });

    const result: any = await pragmaPromise;
    expect(result[0].foreign_keys).toBe(1);
  });
});
