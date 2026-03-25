import { parentPort } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';

let db: any = null;

/**
 * Validates SQL statement type and returns normalized operation info.
 * This function is pure and can be tested without database.
 */
export function validateOperation(type: string, sql?: string): { valid: boolean; error?: string } {
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

/**
 * Normalizes parameters to array format.
 * This function is pure and can be tested without database.
 */
export function normalizeParams(params: any): any[] {
  if (!params) return [];
  if (Array.isArray(params)) return params;
  if (typeof params === 'object') return Object.values(params);
  return [params];
}

/**
 * Formats a database result for consistent output.
 * This function is pure and can be tested without database.
 */
export function formatResult(result: any): any {
  if (result === undefined || result === null) {
    return undefined;
  }

  if (Array.isArray(result)) {
    return result.map((row) => {
      if (row && typeof row === 'object') {
        const formatted: any = {};
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

/**
 * Creates an error response object.
 * This function is pure and can be tested without database.
 */
export function createErrorResponse(error: Error): { error: string } {
  return { error: error.message };
}

/**
 * Creates a success response object.
 * This function is pure and can be tested without database.
 */
export function createSuccessResponse(result?: any, dbInstance?: any): { result?: any; db?: any } {
  const response: { result?: any; db?: any } = {};

  if (result !== undefined) {
    response.result = result;
  }

  if (dbInstance !== undefined) {
    response.db = dbInstance;
  }

  return response;
}

/**
 * Handles a message from the parent thread and returns the result.
 * This function is exported for testing purposes.
 */
export function handleMessage(
  msg: any,
  currentDb: any
): { result?: any; error?: string; db?: any } {
  const { id, type, sql, params, dbPath } = msg;

  try {
    // Validate operation type
    const validation = validateOperation(type, sql);
    if (!validation.valid) {
      throw new Error(validation.error!);
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
      // This should never be reached due to validation above
      throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error: any) {
    return createErrorResponse(error);
  }
}

// Worker thread integration
if (parentPort) {
  parentPort.on('message', (msg) => {
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

export default {
  handleMessage,
  validateOperation,
  normalizeParams,
  formatResult,
  createErrorResponse,
  createSuccessResponse,
};
