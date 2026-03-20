import { parentPort } from "node:worker_threads";
import { DatabaseSync } from "node:sqlite";

let db: any = null;

if (parentPort) {
  parentPort.on("message", (msg) => {
    const { id, type, sql, params, dbPath } = msg;

    try {
      if (type === "init") {
        db = new DatabaseSync(dbPath);
        db.exec("PRAGMA journal_mode = WAL;");
        db.exec("PRAGMA foreign_keys = ON;");
        parentPort!.postMessage({ id, result: "ok" });
        return;
      }

      if (!db) {
        throw new Error("SQLite DB not initialized in worker");
      }

      const paramsArray = params || [];

      if (type === "query") {
        const stmt = db.prepare(sql);
        const result = stmt.all(...paramsArray);
        parentPort!.postMessage({ id, result });
      } else if (type === "get") {
        const stmt = db.prepare(sql);
        const result = stmt.get(...paramsArray);
        parentPort!.postMessage({ id, result });
      } else if (type === "execute") {
        db.prepare(sql).run(...paramsArray);
        parentPort!.postMessage({ id, result: "ok" });
      } else if (type === "exec") {
        db.exec(sql);
        parentPort!.postMessage({ id, result: "ok" });
      } else {
        throw new Error(`Unknown message type: ${type}`);
      }
    } catch (error: any) {
      // Return standard error to parent
      parentPort!.postMessage({ id, error: error.message });
    }
  });
}
export {};

