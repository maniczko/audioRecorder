import { logger } from '../logger.ts';

export type AiQuotaCheck = {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
};

export type AiQuotaExceeded = {
  key: string;
  limit: number;
  retryAfter: number;
};

export interface AiQuotaStore {
  increment(checks: AiQuotaCheck[]): Promise<AiQuotaExceeded | null>;
  reset?(): Promise<void> | void;
}

type AiQuotaEntry = {
  count: number;
  resetAt: number;
};

function normalizeNow(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now();
}

function retryAfterSeconds(resetAt: number, now: number) {
  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isResetAtIntegerOverflow(error: unknown) {
  const message = errorMessage(error);
  return /out of range for type integer|integer out of range/i.test(message);
}

function warnQuotaFallback(message: string, error: unknown) {
  logger.warn('[AI quota] DB quota store fallback', {
    message,
    error: errorMessage(error),
  });
}

export class MemoryAiQuotaStore implements AiQuotaStore {
  private readonly counters = new Map<string, AiQuotaEntry>();

  async increment(checks: AiQuotaCheck[]): Promise<AiQuotaExceeded | null> {
    for (const check of checks) {
      const now = normalizeNow(check.now);
      let entry = this.counters.get(check.key);
      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + check.windowMs };
        this.counters.set(check.key, entry);
      }
      entry.count += 1;
      if (entry.count > check.limit) {
        return {
          key: check.key,
          limit: check.limit,
          retryAfter: retryAfterSeconds(entry.resetAt, now),
        };
      }
    }
    return null;
  }

  reset() {
    this.counters.clear();
  }
}

export class DbAiQuotaStore implements AiQuotaStore {
  private initialized = false;
  private fallbackMode = false;
  private readonly fallbackStore = new MemoryAiQuotaStore();

  constructor(private readonly db: any) {}

  private async ensureSchema() {
    if (this.initialized) return;
    await this.db._execute(`
      CREATE TABLE IF NOT EXISTS ai_quota_counters (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        reset_at BIGINT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    await this.ensurePostgresResetAtBigint();
    this.initialized = true;
  }

  private async ensurePostgresResetAtBigint() {
    if (this.db?.type !== 'postgres') return;
    await this.repairResetAtColumn();
  }

  private async repairResetAtColumn() {
    await this.db._execute(`
      ALTER TABLE ai_quota_counters
      ALTER COLUMN reset_at TYPE BIGINT USING reset_at::bigint
    `);
  }

  async increment(checks: AiQuotaCheck[]): Promise<AiQuotaExceeded | null> {
    if (this.fallbackMode) {
      return this.fallbackStore.increment(checks);
    }

    try {
      return await this.incrementWithDb(checks);
    } catch (error) {
      if (!isResetAtIntegerOverflow(error)) {
        throw error;
      }
      warnQuotaFallback('reset_at overflow detected; attempting BIGINT repair', error);
    }

    try {
      await this.repairResetAtColumn();
    } catch (error) {
      warnQuotaFallback('BIGINT repair failed; using in-memory quota fallback', error);
      this.fallbackMode = true;
      return this.fallbackStore.increment(checks);
    }

    try {
      return await this.incrementWithDb(checks);
    } catch (error) {
      if (!isResetAtIntegerOverflow(error)) {
        throw error;
      }
      warnQuotaFallback(
        'reset_at overflow persisted after repair; using in-memory fallback',
        error
      );
      this.fallbackMode = true;
      return this.fallbackStore.increment(checks);
    }
  }

  private async incrementWithDb(checks: AiQuotaCheck[]): Promise<AiQuotaExceeded | null> {
    await this.ensureSchema();

    for (const check of checks) {
      const now = normalizeNow(check.now);
      const row = await this.db._get(
        'SELECT key, count, reset_at FROM ai_quota_counters WHERE key = ?',
        [check.key]
      );
      const resetAt = Number(row?.reset_at);
      const currentCount =
        row && Number.isFinite(resetAt) && resetAt > now ? Number(row.count) || 0 : 0;
      const nextCount = currentCount + 1;
      const nextResetAt =
        row && Number.isFinite(resetAt) && resetAt > now ? resetAt : now + check.windowMs;

      await this.db._execute(
        `
          INSERT INTO ai_quota_counters (key, count, reset_at, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET
            count = excluded.count,
            reset_at = excluded.reset_at,
            updated_at = excluded.updated_at
        `,
        [check.key, nextCount, nextResetAt, new Date(now).toISOString()]
      );

      if (nextCount > check.limit) {
        return {
          key: check.key,
          limit: check.limit,
          retryAfter: retryAfterSeconds(nextResetAt, now),
        };
      }
    }

    return null;
  }

  async reset() {
    this.fallbackMode = false;
    this.fallbackStore.reset();
    await this.ensureSchema();
    await this.db._execute('DELETE FROM ai_quota_counters');
  }
}

export function createAiQuotaStore({
  db,
  env = process.env,
}: {
  db?: any;
  env?: NodeJS.ProcessEnv;
}): AiQuotaStore {
  const requested = String(env.VOICELOG_AI_QUOTA_STORE || '')
    .trim()
    .toLowerCase();
  const isTest = String(env.NODE_ENV || '').toLowerCase() === 'test';
  const isLocal = !env.RAILWAY_ENVIRONMENT_NAME && !env.RAILWAY_PROJECT_ID && !env.VERCEL;
  const canUseDb = Boolean(
    db && typeof db._execute === 'function' && typeof db._get === 'function'
  );

  if (requested === 'memory') return new MemoryAiQuotaStore();
  if (requested === 'db' && canUseDb) return new DbAiQuotaStore(db);
  if (canUseDb && !isTest) return new DbAiQuotaStore(db);
  if (isTest || isLocal) return new MemoryAiQuotaStore();
  return new MemoryAiQuotaStore();
}
