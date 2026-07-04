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

export type AiQuotaSnapshot = {
  key: string;
  count: number;
  resetAt: number;
  updatedAt?: string;
};

export interface AiQuotaStore {
  increment(checks: AiQuotaCheck[]): Promise<AiQuotaExceeded | null>;
  snapshot?(options?: { prefix?: string; contains?: string }): Promise<AiQuotaSnapshot[]>;
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

  async snapshot(options: { prefix?: string; contains?: string } = {}) {
    return [...this.counters.entries()]
      .filter(([key]) => !options.prefix || key.startsWith(options.prefix))
      .filter(([key]) => !options.contains || key.includes(options.contains))
      .map(([key, entry]) => ({
        key,
        count: entry.count,
        resetAt: entry.resetAt,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
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

  async snapshot(options: { prefix?: string; contains?: string } = {}) {
    if (this.fallbackMode) {
      return this.fallbackStore.snapshot(options);
    }
    await this.ensureSchema();
    if (typeof this.db._all !== 'function') {
      return [];
    }
    const rows = await this.db._all(
      'SELECT key, count, reset_at, updated_at FROM ai_quota_counters ORDER BY key'
    );
    return (Array.isArray(rows) ? rows : [])
      .map((row: any) => ({
        key: String(row.key || ''),
        count: Number(row.count || 0),
        resetAt: Number(row.reset_at || 0),
        updatedAt: row.updated_at ? String(row.updated_at) : undefined,
      }))
      .filter((entry) => entry.key)
      .filter((entry) => !options.prefix || entry.key.startsWith(options.prefix))
      .filter((entry) => !options.contains || entry.key.includes(options.contains));
  }
}

export type ProviderQuotaKind = 'ai' | 'stt' | 'live-transcription' | 'image' | 'embedding';

export type ProviderQuotaInput = {
  kind: ProviderQuotaKind;
  endpoint: string;
  userId: string;
  workspaceId?: string;
  ip?: string;
  now?: number;
  env?: NodeJS.ProcessEnv;
};

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const providerQuotaDefaults: Record<
  ProviderQuotaKind,
  { userPerHour: number; workspacePerDay: number; ipPerMinute: number }
> = {
  ai: { userPerHour: 20, workspacePerDay: 200, ipPerMinute: 30 },
  stt: { userPerHour: 20, workspacePerDay: 300, ipPerMinute: 20 },
  'live-transcription': { userPerHour: 120, workspacePerDay: 1200, ipPerMinute: 60 },
  image: { userPerHour: 8, workspacePerDay: 60, ipPerMinute: 5 },
  embedding: { userPerHour: 40, workspacePerDay: 400, ipPerMinute: 20 },
};

export function readPositiveIntEnv(name: string, fallback: number, env = process.env) {
  const value = Number(env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function envSegment(value: string) {
  return value
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

export function buildProviderQuotaChecks(input: ProviderQuotaInput): AiQuotaCheck[] {
  const env = input.env || process.env;
  const now = input.now || Date.now();
  const defaults = providerQuotaDefaults[input.kind];
  const kindEnv = envSegment(input.kind);
  const endpointEnv = envSegment(`${input.kind}_${input.endpoint}`);
  const kindKey = input.kind;
  const endpoint = input.endpoint.replace(/[^a-zA-Z0-9_-]+/g, '-');
  const userId = String(input.userId || '').trim();
  const workspaceId = String(input.workspaceId || '').trim();
  const ip = String(input.ip || 'local').trim() || 'local';
  const userPerHour = readPositiveIntEnv(
    `VOICELOG_${kindEnv}_USER_QUOTA_PER_HOUR`,
    readPositiveIntEnv('VOICELOG_PROVIDER_USER_QUOTA_PER_HOUR', defaults.userPerHour, env),
    env
  );
  const workspacePerDay = readPositiveIntEnv(
    `VOICELOG_${kindEnv}_WORKSPACE_QUOTA_PER_DAY`,
    readPositiveIntEnv('VOICELOG_PROVIDER_WORKSPACE_QUOTA_PER_DAY', defaults.workspacePerDay, env),
    env
  );
  const ipPerMinute = readPositiveIntEnv(
    `VOICELOG_${kindEnv}_IP_QUOTA_PER_MINUTE`,
    readPositiveIntEnv('VOICELOG_PROVIDER_IP_QUOTA_PER_MINUTE', defaults.ipPerMinute, env),
    env
  );
  const endpointUserPerHour = readPositiveIntEnv(
    `VOICELOG_${endpointEnv}_USER_QUOTA_PER_HOUR`,
    userPerHour,
    env
  );
  const endpointWorkspacePerDay = readPositiveIntEnv(
    `VOICELOG_${endpointEnv}_WORKSPACE_QUOTA_PER_DAY`,
    workspacePerDay,
    env
  );
  const endpointIpPerMinute = readPositiveIntEnv(
    `VOICELOG_${endpointEnv}_IP_QUOTA_PER_MINUTE`,
    ipPerMinute,
    env
  );

  return [
    { key: `${kindKey}:user:${userId}:hour`, limit: userPerHour, windowMs: HOUR_MS, now },
    {
      key: `${kindKey}:user:${userId}:endpoint:${endpoint}:hour`,
      limit: endpointUserPerHour,
      windowMs: HOUR_MS,
      now,
    },
    { key: `${kindKey}:ip:${ip}:minute`, limit: ipPerMinute, windowMs: MINUTE_MS, now },
    {
      key: `${kindKey}:ip:${ip}:endpoint:${endpoint}:minute`,
      limit: endpointIpPerMinute,
      windowMs: MINUTE_MS,
      now,
    },
    ...(workspaceId
      ? [
          {
            key: `${kindKey}:workspace:${workspaceId}:day`,
            limit: workspacePerDay,
            windowMs: DAY_MS,
            now,
          },
          {
            key: `${kindKey}:workspace:${workspaceId}:endpoint:${endpoint}:day`,
            limit: endpointWorkspacePerDay,
            windowMs: DAY_MS,
            now,
          },
        ]
      : []),
  ];
}

export function buildProviderQuotaExceededBody(input: {
  kind: ProviderQuotaKind;
  endpoint: string;
  exceeded: AiQuotaExceeded;
}) {
  const code = `${input.kind.replace(/-/g, '_')}_quota_exceeded`;
  return {
    code,
    message: 'Przekroczono limit uzycia dostawcy. Sprobuj ponownie pozniej.',
    retryAfter: input.exceeded.retryAfter,
    limit: input.exceeded.limit,
    quotaKey: input.exceeded.key,
    providerFamily: input.kind,
    endpoint: input.endpoint,
  };
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
