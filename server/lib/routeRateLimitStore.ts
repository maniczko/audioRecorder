import { logger } from '../logger.ts';

export type RouteRateLimitCheck = {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
};

export type RouteRateLimitExceeded = {
  key: string;
  limit: number;
  retryAfter: number;
};

export interface RouteRateLimitStore {
  increment(checks: RouteRateLimitCheck[]): Promise<RouteRateLimitExceeded | null>;
  reset?(): Promise<void> | void;
}

type RouteRateLimitEntry = {
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

function warnRateLimitFallback(message: string, error: unknown) {
  logger.warn('[Rate limit] DB store fallback', {
    message,
    error: errorMessage(error),
  });
}

function normalizeStoreName(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export class MemoryRouteRateLimitStore implements RouteRateLimitStore {
  private readonly counters = new Map<string, RouteRateLimitEntry>();

  async increment(checks: RouteRateLimitCheck[]): Promise<RouteRateLimitExceeded | null> {
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

export class DbRouteRateLimitStore implements RouteRateLimitStore {
  private initialized = false;
  private fallbackMode = false;
  private readonly fallbackStore = new MemoryRouteRateLimitStore();

  constructor(private readonly db: any) {}

  private async ensureSchema() {
    if (this.initialized) return;
    await this.db._execute(`
      CREATE TABLE IF NOT EXISTS route_rate_limit_counters (
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
      ALTER TABLE route_rate_limit_counters
      ALTER COLUMN reset_at TYPE BIGINT USING reset_at::bigint
    `);
  }

  async increment(checks: RouteRateLimitCheck[]): Promise<RouteRateLimitExceeded | null> {
    if (this.fallbackMode) {
      return this.fallbackStore.increment(checks);
    }

    try {
      return await this.incrementWithDb(checks);
    } catch (error) {
      if (!isResetAtIntegerOverflow(error)) {
        throw error;
      }
      warnRateLimitFallback('reset_at overflow detected; attempting BIGINT repair', error);
    }

    try {
      await this.repairResetAtColumn();
    } catch (error) {
      warnRateLimitFallback('BIGINT repair failed; using in-memory rate-limit fallback', error);
      this.fallbackMode = true;
      return this.fallbackStore.increment(checks);
    }

    try {
      return await this.incrementWithDb(checks);
    } catch (error) {
      if (!isResetAtIntegerOverflow(error)) {
        throw error;
      }
      warnRateLimitFallback(
        'reset_at overflow persisted after repair; using in-memory fallback',
        error
      );
      this.fallbackMode = true;
      return this.fallbackStore.increment(checks);
    }
  }

  private async incrementWithDb(
    checks: RouteRateLimitCheck[]
  ): Promise<RouteRateLimitExceeded | null> {
    await this.ensureSchema();

    for (const check of checks) {
      const now = normalizeNow(check.now);
      const resetAt = now + check.windowMs;
      await this.db._execute(
        `
          INSERT INTO route_rate_limit_counters (key, count, reset_at, updated_at)
          VALUES (?, 1, ?, ?)
          ON CONFLICT(key) DO UPDATE SET
            count = CASE
              WHEN route_rate_limit_counters.reset_at <= ? THEN 1
              ELSE route_rate_limit_counters.count + 1
            END,
            reset_at = CASE
              WHEN route_rate_limit_counters.reset_at <= ? THEN excluded.reset_at
              ELSE route_rate_limit_counters.reset_at
            END,
            updated_at = excluded.updated_at
        `,
        [check.key, resetAt, new Date(now).toISOString(), now, now]
      );

      const row = await this.db._get(
        'SELECT key, count, reset_at FROM route_rate_limit_counters WHERE key = ?',
        [check.key]
      );
      const count = Number(row?.count) || 0;
      const persistedResetAt = Number(row?.reset_at);
      const effectiveResetAt = Number.isFinite(persistedResetAt) ? persistedResetAt : resetAt;

      if (count > check.limit) {
        return {
          key: check.key,
          limit: check.limit,
          retryAfter: retryAfterSeconds(effectiveResetAt, now),
        };
      }
    }

    return null;
  }

  async reset() {
    this.fallbackMode = false;
    this.fallbackStore.reset();
    await this.ensureSchema();
    await this.db._execute('DELETE FROM route_rate_limit_counters');
  }
}

export function createRouteRateLimitStore({
  db,
  env = process.env,
  config,
}: {
  db?: any;
  env?: NodeJS.ProcessEnv;
  config?: Record<string, unknown>;
} = {}): RouteRateLimitStore {
  const requested = normalizeStoreName(
    config?.rateLimitStore ||
      config?.VOICELOG_RATE_LIMIT_STORE ||
      config?.VOICELOG_RATE_LIMIT_BACKEND ||
      env.VOICELOG_RATE_LIMIT_STORE ||
      env.VOICELOG_RATE_LIMIT_BACKEND
  );
  const isTest = normalizeStoreName(env.NODE_ENV) === 'test' || Boolean(env.VITEST);
  const isProduction =
    normalizeStoreName(config?.NODE_ENV) === 'production' ||
    normalizeStoreName(env.NODE_ENV) === 'production';
  const isLocal =
    !isProduction && !env.RAILWAY_ENVIRONMENT_NAME && !env.RAILWAY_PROJECT_ID && !env.VERCEL;
  const canUseDb = Boolean(
    db && typeof db._execute === 'function' && typeof db._get === 'function'
  );

  if (requested === 'memory') return new MemoryRouteRateLimitStore();
  if (['db', 'database', 'postgres', 'postgresql'].includes(requested) && canUseDb) {
    return new DbRouteRateLimitStore(db);
  }
  if (canUseDb && !isTest && !isLocal) return new DbRouteRateLimitStore(db);

  return new MemoryRouteRateLimitStore();
}
