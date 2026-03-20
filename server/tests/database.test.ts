const path = require("node:path");
const fs = require("node:fs");
const { initDatabase, getDatabase } = require("../database.ts");

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
      try {
        fs.rmSync(testUploadDir, { recursive: true, force: true });
      } catch (err) {
        // Ignore locked file EPERM on Windows test runner
      }
    }
  });

  test("should get the initialized database singleton", () => {
    const singleton = getDatabase();
    expect(singleton).toBeDefined();
    expect(singleton.uploadDir).toBe(testUploadDir);
  });

  test("should successfully query users via worker thread", async () => {
    // Tests the worker based async `_query` and `_get` internally
    const result = await db._get("SELECT * FROM users WHERE email = ?", ["nonexistent_user_for_db_layer@example.com"]);
    expect(result).toBeNull();
  });

  test("should persist data across simulated 'deploys' (process restarts)", async () => {
    const dbPath = path.join(testUploadDir, "data.sqlite");
    
    // 1. Zapisujemy dane na dysk
    const oldDb = initDatabase({ dbPath, uploadDir: testUploadDir });
    await oldDb.init();
    await oldDb._query("CREATE TABLE IF NOT EXISTS test_deploy (id INTEGER PRIMARY KEY, msg TEXT)");
    await oldDb._query("INSERT INTO test_deploy (msg) VALUES (?)", ["Persisted Data!"]);

    // 2. Symulujemy DEPLOY (zamknięcie i ubicie bazy)
    oldDb.worker.terminate();
    
    // 3. Wstajemy po deployu podpinając się pod ten sam dysk
    const newDb = initDatabase({ dbPath, uploadDir: testUploadDir });
    await newDb.init();

    // 4. Sprawdzamy czy dane z poprzedniego życia przetrwały
    const result = await newDb._get("SELECT * FROM test_deploy LIMIT 1");
    expect(result.msg).toBe("Persisted Data!");
    
    newDb.worker.terminate();
  });
});
