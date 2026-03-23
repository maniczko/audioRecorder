import { parentPort } from "node:worker_threads";
import { DatabaseSync } from "node:sqlite";

let db: any = null;

/**
 * Handles a message from the parent thread and returns the result.
 * This function is exported for testing purposes.
 */
export function handleMessage(msg: any, currentDb: any): { result?: any; error?: string; db?: any } {
  const { id, type, sql, params, dbPath } = msg;

  try {
    if (type === "init") {
      const newDb = new DatabaseSync(dbPath);
      newDb.exec("PRAGMA journal_mode = WAL;");
      newDb.exec("PRAGMA foreign_keys = ON;");
      return { result: "ok", db: newDb };
    }

    if (!currentDb) {
      throw new Error("SQLite DB not initialized in worker");
    }

    const paramsArray = params || [];

    if (type === "query") {
      const stmt = currentDb.prepare(sql);
      const result = stmt.all(...paramsArray);
      return { result };
    } else if (type === "get") {
      const stmt = currentDb.prepare(sql);
      const result = stmt.get(...paramsArray);
      return { result };
    } else if (type === "execute") {
      currentDb.prepare(sql).run(...paramsArray);
      return { result: "ok" };
    } else if (type === "exec") {
      currentDb.exec(sql);
      return { result: "ok" };
    } else {
      throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error: any) {
    return { error: error.message };
  }
}

// Worker thread integration
if (parentPort) {
  parentPort.on("message", (msg) => {
    const response = handleMessage(msg, db);

    if (response.db) {
      db = response.db;
    }

    if (response.error) {
      parentPort!.postMessage({ id: msg.id, error: response.error });
    } else {
      parentPort!.postMessage({ id: msg.id, result: response.result });
    }
  });
}

export default { handleMessage };

