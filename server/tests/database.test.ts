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

  test("should persist data across simulated 'deploys' (process restarts)", async () => {
    // 1. Zapisujemy dane symulując działanie
    await db._query("CREATE TABLE IF NOT EXISTS test_deploy (id INTEGER PRIMARY KEY, msg TEXT)");
    await db._query("INSERT INTO test_deploy (msg) VALUES (?)", ["Persisted Data!"]);

    // 2. Symulujemy DEPLOY (zamknięcie i ubicie bazy)
    db.worker.terminate();
    
    // 3. Wstajemy po deployu podpinając się pod ten sam dysk
    const newDb = initDatabase({ dbPath: path.join(testUploadDir, "data.sqlite"), uploadDir: testUploadDir });
    await newDb.init();

    // 4. Sprawdzamy czy dane z poprzedniego życia przetrwały
    const result = await newDb._get("SELECT * FROM test_deploy LIMIT 1");
    expect(result.msg).toBe("Persisted Data!");
    
    newDb.worker.terminate();
  });
});
