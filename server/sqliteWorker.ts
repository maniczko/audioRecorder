const { parentPort } = require("node:worker_threads");

let db = null;

parentPort.on("message", (msg) => {
  const { id, type, sql, params, dbPath } = msg;

  try {
    if (type === "init") {
      const { DatabaseSync } = require("node:sqlite");
      db = new DatabaseSync(dbPath);
      db.exec("PRAGMA journal_mode = WAL;");
      db.exec("PRAGMA foreign_keys = ON;");
      parentPort.postMessage({ id, result: "ok" });
      return;
    }

    if (!db) {
      throw new Error("SQLite DB not initialized in worker");
    }

    if (type === "query") {
      const stmt = db.prepare(sql);
      const result = stmt.all(...(params || []));
      parentPort.postMessage({ id, result });
    } else if (type === "get") {
      const stmt = db.prepare(sql);
      const result = stmt.get(...(params || []));
      parentPort.postMessage({ id, result });
    } else if (type === "execute") {
      db.prepare(sql).run(...(params || []));
      parentPort.postMessage({ id, result: "ok" });
    } else if (type === "exec") {
      db.exec(sql);
      parentPort.postMessage({ id, result: "ok" });
    } else {
      throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    // Return standard error to parent
    parentPort.postMessage({ id, error: error.message });
  }
});
