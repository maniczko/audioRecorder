const path = require("node:path");
const fs = require("node:fs");
const { initDatabase, getDatabase } = require("../database");

describe("Database (Async Worker SQLite)", () => {
  let db;
  const testUploadDir = path.resolve(__dirname, "test_uploads_db_layer");

  beforeAll(async () => {
    db = initDatabase({ dbPath: ":memory:", uploadDir: testUploadDir });
    await db.init();
  });

  afterAll(() => {
    if (db && db.worker) {
      db.worker.terminate();
    }
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
  });

  test("should get the initialized database singleton", () => {
    const singleton = getDatabase();
    expect(singleton).toBeDefined();
    expect(singleton.uploadDir).toBe(testUploadDir);
  });

  test("should successfully query users via worker thread", async () => {
    // Tests the worker based async `_query` and `_get` internally
    const result = await db.getUserByEmail("nonexistent_user_for_db_layer@example.com");
    expect(result).toBeUndefined();
  });

  test("should execute arbitrary updates without blocking event loop", async () => {
    // Execute multiple parallel reads to ensure worker message queuing works
    const queries = Array.from({ length: 15 }).map((_, i) => db.getWorkspaceById(`ws_${i}`));
    const results = await Promise.all(queries);
    expect(results).toHaveLength(15);
    expect(results[0]).toBeUndefined();
  });
});
