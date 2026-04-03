import { Hono } from 'hono';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../logger.ts';

interface ClientErrorEntry {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  stack?: string;
  source?: string;
  context?: string;
  userAgent?: string;
  url?: string;
}

const MAX_STORED_ERRORS = 500;
const MAX_BODY_ERRORS = 50;

// In-memory store with periodic file persistence
let errorStore: ClientErrorEntry[] = [];
let storeLoaded = false;

function getErrorsFilePath(): string {
  const dataDir = process.env.VOICELOG_UPLOAD_DIR || './server/data/uploads';
  return path.resolve(dataDir, 'client-errors.json');
}

function loadFromDisk(): void {
  if (storeLoaded) return;
  try {
    const filePath = getErrorsFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) errorStore = parsed;
    }
  } catch {
    // Start fresh if file is corrupt
  }
  storeLoaded = true;
}

function persistToDisk(): void {
  try {
    const filePath = getErrorsFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(errorStore, null, 2), 'utf-8');
  } catch (err) {
    logger.error('[ClientErrors] Failed to persist errors to disk:', err);
  }
}

/** @internal — reset in-memory store for tests */
export function _resetStoreForTest(): void {
  errorStore = [];
  storeLoaded = true; // skip disk read in tests
}

export function createClientErrorRoutes() {
  const router = new Hono();

  // POST /api/client-errors — receive error reports from frontend
  router.post('/', async (c) => {
    try {
      const body = await c.req.json();
      const errors: ClientErrorEntry[] = Array.isArray(body) ? body : [body];

      if (errors.length === 0) {
        return c.json({ ok: true, received: 0 });
      }

      if (errors.length > MAX_BODY_ERRORS) {
        return c.json({ error: 'Too many errors in one request' }, 400);
      }

      const userAgent = c.req.header('user-agent') || 'unknown';

      const validErrors = errors
        .filter((e) => e && typeof e.message === 'string' && e.message.length > 0)
        .map((e) => ({
          id: e.id || `srv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: e.timestamp || new Date().toISOString(),
          type: String(e.type || 'unknown').slice(0, 50),
          message: String(e.message).slice(0, 2000),
          stack: e.stack ? String(e.stack).slice(0, 5000) : undefined,
          source: e.source ? String(e.source).slice(0, 500) : undefined,
          context: e.context ? String(e.context).slice(0, 1000) : undefined,
          userAgent: userAgent.slice(0, 300),
          url: e.url ? String(e.url).slice(0, 500) : undefined,
        }));

      if (validErrors.length === 0) {
        return c.json({ ok: true, received: 0 });
      }

      loadFromDisk();
      // Deduplicate by id
      const existingIds = new Set(errorStore.map((e) => e.id));
      const newErrors = validErrors.filter((e) => !existingIds.has(e.id));

      if (newErrors.length > 0) {
        errorStore = [...errorStore, ...newErrors].slice(-MAX_STORED_ERRORS);
        persistToDisk();
        logger.info(`[ClientErrors] Received ${newErrors.length} new error(s) from client.`);
      }

      return c.json({ ok: true, received: newErrors.length });
    } catch (err) {
      logger.error('[ClientErrors] Failed to process error report:', err);
      return c.json({ error: 'Failed to store errors' }, 500);
    }
  });

  // GET /api/client-errors — retrieve stored errors
  router.get('/', (c) => {
    loadFromDisk();
    return c.json({ count: errorStore.length, errors: errorStore });
  });

  // DELETE /api/client-errors — clear stored errors
  router.delete('/', (c) => {
    errorStore = [];
    persistToDisk();
    return c.json({ ok: true, cleared: true });
  });

  return router;
}
