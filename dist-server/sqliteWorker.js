// server/sqliteWorker.ts
import { parentPort } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';
var db = null;
function validateOperation(type, sql) {
  const validTypes = ['init', 'query', 'get', 'execute', 'exec'];
  if (!type || typeof type !== 'string') {
    return { valid: false, error: 'Invalid or missing message type' };
  }
  if (!validTypes.includes(type)) {
    return { valid: false, error: `Unknown message type: ${type}` };
  }
  if (type !== 'init' && !sql) {
    return { valid: false, error: 'SQL is required for this operation' };
  }
  return { valid: true };
}
function normalizeParams(params) {
  if (!params) return [];
  if (Array.isArray(params)) return params;
  if (typeof params === 'object') return Object.values(params);
  return [params];
}
function formatResult(result) {
  if (result === void 0 || result === null) {
    return void 0;
  }
  if (Array.isArray(result)) {
    return result.map((row) => {
      if (row && typeof row === 'object') {
        const formatted = {};
        for (const key of Object.keys(row)) {
          if (row[key] instanceof Buffer) {
            formatted[key] = row[key].toString('base64');
          } else {
            formatted[key] = row[key];
          }
        }
        return formatted;
      }
      return row;
    });
  }
  if (result instanceof Buffer) {
    return result.toString('base64');
  }
  return result;
}
function createErrorResponse(error) {
  return { error: error.message };
}
function createSuccessResponse(result, dbInstance) {
  const response = {};
  if (result !== void 0) {
    response.result = result;
  }
  if (dbInstance !== void 0) {
    response.db = dbInstance;
  }
  return response;
}
function handleMessage(msg, currentDb) {
  const { id, type, sql, params, dbPath } = msg;
  try {
    const validation = validateOperation(type, sql);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    if (type === 'init') {
      if (!dbPath || typeof dbPath !== 'string') {
        throw new Error('Database path is required for initialization');
      }
      const newDb = new DatabaseSync(dbPath);
      newDb.exec('PRAGMA journal_mode = WAL;');
      newDb.exec('PRAGMA foreign_keys = ON;');
      return createSuccessResponse('ok', newDb);
    }
    if (!currentDb) {
      throw new Error('SQLite DB not initialized in worker');
    }
    const paramsArray = normalizeParams(params);
    if (type === 'query') {
      const stmt = currentDb.prepare(sql);
      const result = stmt.all(...paramsArray);
      return createSuccessResponse(formatResult(result));
    } else if (type === 'get') {
      const stmt = currentDb.prepare(sql);
      const result = stmt.get(...paramsArray);
      return createSuccessResponse(formatResult(result));
    } else if (type === 'execute') {
      currentDb.prepare(sql).run(...paramsArray);
      return createSuccessResponse('ok');
    } else if (type === 'exec') {
      currentDb.exec(sql);
      return createSuccessResponse('ok');
    } else {
      throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    return createErrorResponse(error);
  }
}
if (parentPort) {
  parentPort.on('message', (msg) => {
    const response = handleMessage(msg, db);
    if (response.db) {
      db = response.db;
    }
    if (response.error) {
      parentPort.postMessage({ id: msg.id, error: response.error });
    } else {
      parentPort.postMessage({ id: msg.id, result: response.result });
    }
  });
}
var sqliteWorker_default = {
  handleMessage,
  validateOperation,
  normalizeParams,
  formatResult,
  createErrorResponse,
  createSuccessResponse,
};
export {
  createErrorResponse,
  createSuccessResponse,
  sqliteWorker_default as default,
  formatResult,
  handleMessage,
  normalizeParams,
  validateOperation,
};
