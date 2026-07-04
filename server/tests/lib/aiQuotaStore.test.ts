import { describe, expect, test } from 'vitest';
import {
  createAiQuotaStore,
  buildProviderQuotaChecks,
  DbAiQuotaStore,
  MemoryAiQuotaStore,
  type AiQuotaCheck,
} from '../../lib/aiQuotaStore.ts';

function makeCheck(overrides: Partial<AiQuotaCheck> = {}): AiQuotaCheck {
  return {
    key: 'ai:user:u1:hour',
    limit: 1,
    windowMs: 60_000,
    now: 1_000,
    ...overrides,
  };
}

function createFakeDb(options: { type?: string } = {}) {
  const rows = new Map<
    string,
    { key: string; count: number; reset_at: number; updated_at: string }
  >();
  const statements: string[] = [];
  return {
    rows,
    statements,
    type: options.type,
    async _execute(sql: string, params: unknown[] = []) {
      statements.push(sql);
      if (/CREATE TABLE/i.test(sql)) return;
      if (/ALTER TABLE ai_quota_counters/i.test(sql)) return;
      if (/DELETE FROM ai_quota_counters/i.test(sql)) {
        if (params.length) {
          rows.delete(String(params[0]));
        } else {
          rows.clear();
        }
        return;
      }
      if (/INSERT INTO ai_quota_counters/i.test(sql)) {
        const [key, count, resetAt, updatedAt] = params;
        rows.set(String(key), {
          key: String(key),
          count: Number(count),
          reset_at: Number(resetAt),
          updated_at: String(updatedAt),
        });
        return;
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    async _get(_sql: string, params: unknown[] = []) {
      return rows.get(String(params[0])) || null;
    },
    async _all() {
      return [...rows.values()];
    },
  };
}

function createOverflowDb(
  options: {
    repairSucceeds?: boolean;
    overflowPersists?: boolean;
    genericInsertError?: boolean;
    genericAfterRepair?: boolean;
    overflowAsString?: boolean;
  } = {}
) {
  const rows = new Map<
    string,
    { key: string; count: number; reset_at: number; updated_at: string }
  >();
  const statements: string[] = [];
  let repaired = false;
  let insertAttempts = 0;

  return {
    rows,
    statements,
    get insertAttempts() {
      return insertAttempts;
    },
    async _execute(sql: string, params: unknown[] = []) {
      statements.push(sql);
      if (/CREATE TABLE/i.test(sql)) return;
      if (/ALTER TABLE ai_quota_counters/i.test(sql)) {
        if (!options.repairSucceeds) {
          throw new Error('permission denied for table ai_quota_counters');
        }
        repaired = true;
        return;
      }
      if (/INSERT INTO ai_quota_counters/i.test(sql)) {
        insertAttempts += 1;
        if (options.genericInsertError) {
          throw new Error('connection lost');
        }
        if (repaired && options.genericAfterRepair) {
          throw new Error('post-repair connection lost');
        }
        if (!repaired || options.overflowPersists) {
          if (options.overflowAsString) {
            return Promise.reject('integer out of range');
          }
          throw new Error('value "1782975650185" is out of range for type integer');
        }
        const [key, count, resetAt, updatedAt] = params;
        rows.set(String(key), {
          key: String(key),
          count: Number(count),
          reset_at: Number(resetAt),
          updated_at: String(updatedAt),
        });
        return;
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    async _get(_sql: string, params: unknown[] = []) {
      return rows.get(String(params[0])) || null;
    },
  };
}

describe('AI quota stores', () => {
  test('MemoryAiQuotaStore returns Retry-After when a window limit is exceeded', async () => {
    const store = new MemoryAiQuotaStore();

    await expect(store.increment([makeCheck()])).resolves.toBeNull();
    const exceeded = await store.increment([makeCheck({ now: 2_000 })]);

    expect(exceeded).toEqual({
      key: 'ai:user:u1:hour',
      limit: 1,
      retryAfter: 59,
    });
  });

  test('MemoryAiQuotaStore reset clears counters', async () => {
    const store = new MemoryAiQuotaStore();

    await store.increment([makeCheck()]);
    store.reset();

    await expect(store.increment([makeCheck({ now: 2_000 })])).resolves.toBeNull();
  });

  test('MemoryAiQuotaStore snapshot filters counters for operator usage views', async () => {
    const store = new MemoryAiQuotaStore();

    await store.increment([
      makeCheck({ key: 'stt:workspace:ws1:day', limit: 10 }),
      makeCheck({ key: 'stt:workspace:ws2:day', limit: 10 }),
    ]);

    await expect(store.snapshot({ contains: ':workspace:ws1:' })).resolves.toEqual([
      {
        key: 'stt:workspace:ws1:day',
        count: 1,
        resetAt: 61_000,
      },
    ]);
  });

  test('MemoryAiQuotaStore snapshot supports prefix filters', async () => {
    const store = new MemoryAiQuotaStore();

    await store.increment([
      makeCheck({ key: 'stt:workspace:ws1:day', limit: 10 }),
      makeCheck({ key: 'ai:workspace:ws1:day', limit: 10 }),
    ]);

    await expect(store.snapshot({ prefix: 'ai:' })).resolves.toEqual([
      {
        key: 'ai:workspace:ws1:day',
        count: 1,
        resetAt: 61_000,
      },
    ]);
  });

  test('MemoryAiQuotaStore normalizes invalid timestamps to the current time', async () => {
    const store = new MemoryAiQuotaStore();
    const before = Date.now();

    await store.increment([makeCheck({ key: 'ai:user:u1:invalid-now', now: 0 })]);
    const [snapshot] = await store.snapshot({ contains: 'invalid-now' });

    expect(snapshot.resetAt).toBeGreaterThanOrEqual(before + 60_000);
  });

  test('buildProviderQuotaChecks applies endpoint-specific env overrides', () => {
    const checks = buildProviderQuotaChecks({
      kind: 'image',
      endpoint: 'sketchnote',
      userId: 'u1',
      workspaceId: 'ws1',
      ip: '127.0.0.1',
      now: 10_000,
      env: {
        VOICELOG_IMAGE_SKETCHNOTE_USER_QUOTA_PER_HOUR: '2',
        VOICELOG_IMAGE_SKETCHNOTE_WORKSPACE_QUOTA_PER_DAY: '5',
      } as NodeJS.ProcessEnv,
    });

    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'image:user:u1:endpoint:sketchnote:hour',
          limit: 2,
        }),
        expect.objectContaining({
          key: 'image:workspace:ws1:endpoint:sketchnote:day',
          limit: 5,
        }),
      ])
    );
  });

  test('buildProviderQuotaChecks applies provider fallback env and sanitizes optional keys', () => {
    const checks = buildProviderQuotaChecks({
      kind: 'stt',
      endpoint: 'live/audio beta',
      userId: '',
      ip: '',
      now: 20_000,
      env: {
        VOICELOG_PROVIDER_USER_QUOTA_PER_HOUR: '3',
        VOICELOG_PROVIDER_IP_QUOTA_PER_MINUTE: '4',
      } as NodeJS.ProcessEnv,
    });

    expect(checks).toEqual([
      expect.objectContaining({ key: 'stt:user::hour', limit: 3 }),
      expect.objectContaining({ key: 'stt:user::endpoint:live-audio-beta:hour', limit: 3 }),
      expect.objectContaining({ key: 'stt:ip:local:minute', limit: 4 }),
      expect.objectContaining({ key: 'stt:ip:local:endpoint:live-audio-beta:minute', limit: 4 }),
    ]);
  });

  test('buildProviderQuotaChecks falls back to current time when no timestamp is provided', () => {
    const before = Date.now();
    const [firstCheck] = buildProviderQuotaChecks({
      kind: 'ai',
      endpoint: 'summary',
      userId: 'u1',
      env: {} as NodeJS.ProcessEnv,
    });

    expect(firstCheck.now).toBeGreaterThanOrEqual(before);
  });

  test('DbAiQuotaStore shares quota counters across store instances using the same database', async () => {
    const db = createFakeDb();
    const firstInstance = new DbAiQuotaStore(db);
    const secondInstance = new DbAiQuotaStore(db);

    await expect(firstInstance.increment([makeCheck()])).resolves.toBeNull();
    const exceeded = await secondInstance.increment([makeCheck({ now: 2_000 })]);

    expect(exceeded).toEqual({
      key: 'ai:user:u1:hour',
      limit: 1,
      retryAfter: 59,
    });
    expect(db.rows.get('ai:user:u1:hour')?.count).toBe(2);
  });

  test('DbAiQuotaStore resets expired windows before incrementing', async () => {
    const db = createFakeDb();
    const store = new DbAiQuotaStore(db);

    await expect(store.increment([makeCheck({ now: 1_000 })])).resolves.toBeNull();
    await expect(store.increment([makeCheck({ now: 62_000 })])).resolves.toBeNull();

    expect(db.rows.get('ai:user:u1:hour')?.count).toBe(1);
    expect(db.rows.get('ai:user:u1:hour')?.reset_at).toBe(122_000);
  });

  test('DbAiQuotaStore treats invalid persisted counts as zero before incrementing', async () => {
    const db = createFakeDb();
    db.rows.set('ai:user:u1:hour', {
      key: 'ai:user:u1:hour',
      count: Number.NaN,
      reset_at: 61_000,
      updated_at: new Date(1_000).toISOString(),
    });
    const store = new DbAiQuotaStore(db);

    await expect(store.increment([makeCheck()])).resolves.toBeNull();

    expect(db.rows.get('ai:user:u1:hour')?.count).toBe(1);
  });

  test('DbAiQuotaStore creates reset windows as BIGINT for millisecond timestamps', async () => {
    const db = createFakeDb();
    const store = new DbAiQuotaStore(db);
    const now = 1_767_827_414_000;

    await expect(store.increment([makeCheck({ now, windowMs: 86_400_000 })])).resolves.toBeNull();

    const createStatement = db.statements.find((sql) =>
      /CREATE TABLE IF NOT EXISTS ai_quota_counters/i.test(sql)
    );
    expect(createStatement).toMatch(/reset_at\s+BIGINT\s+NOT NULL/i);
    expect(db.rows.get('ai:user:u1:hour')?.reset_at).toBe(now + 86_400_000);
  });

  test('DbAiQuotaStore upgrades Postgres reset_at columns to BIGINT', async () => {
    const db = createFakeDb({ type: 'postgres' });
    const store = new DbAiQuotaStore(db);

    await expect(store.increment([makeCheck()])).resolves.toBeNull();

    expect(db.statements).toContainEqual(
      expect.stringMatching(
        /ALTER TABLE ai_quota_counters\s+ALTER COLUMN reset_at TYPE BIGINT USING reset_at::bigint/i
      )
    );
  });

  test('DbAiQuotaStore repairs reset_at integer overflow and retries the DB write', async () => {
    const db = createOverflowDb({ repairSucceeds: true });
    const store = new DbAiQuotaStore(db);

    await expect(store.increment([makeCheck({ now: 1_782_975_650_185 })])).resolves.toBeNull();

    expect(db.insertAttempts).toBe(2);
    expect(db.statements).toContainEqual(
      expect.stringMatching(/ALTER TABLE ai_quota_counters\s+ALTER COLUMN reset_at TYPE BIGINT/i)
    );
    expect(db.rows.get('ai:user:u1:hour')?.reset_at).toBe(1_782_975_710_185);
  });

  test('DbAiQuotaStore falls back to memory when overflow repair is denied', async () => {
    const db = createOverflowDb();
    const store = new DbAiQuotaStore(db);

    await expect(store.increment([makeCheck({ now: 1_782_975_650_185 })])).resolves.toBeNull();
    const exceeded = await store.increment([makeCheck({ now: 1_782_975_650_186 })]);

    expect(exceeded).toMatchObject({
      key: 'ai:user:u1:hour',
      limit: 1,
    });
    expect(db.insertAttempts).toBe(1);
  });

  test('DbAiQuotaStore snapshot reads fallback counters after overflow fallback', async () => {
    const db = createOverflowDb();
    const store = new DbAiQuotaStore(db);

    await expect(store.increment([makeCheck({ now: 1_782_975_650_185 })])).resolves.toBeNull();

    await expect(store.snapshot({ contains: ':user:u1:' })).resolves.toEqual([
      expect.objectContaining({
        key: 'ai:user:u1:hour',
        count: 1,
      }),
    ]);
  });

  test('DbAiQuotaStore falls back to memory when reset_at overflow persists after repair', async () => {
    const db = createOverflowDb({ repairSucceeds: true, overflowPersists: true });
    const store = new DbAiQuotaStore(db);

    await expect(store.increment([makeCheck({ now: 1_782_975_650_185 })])).resolves.toBeNull();

    expect(db.insertAttempts).toBe(2);
    expect(db.rows.size).toBe(0);
  });

  test('DbAiQuotaStore recognizes non-Error reset_at overflow failures', async () => {
    const db = createOverflowDb({ repairSucceeds: true, overflowAsString: true });
    const store = new DbAiQuotaStore(db);

    await expect(store.increment([makeCheck({ now: 1_782_975_650_185 })])).resolves.toBeNull();

    expect(db.insertAttempts).toBe(2);
  });

  test('DbAiQuotaStore propagates non-overflow failures after reset_at repair', async () => {
    const db = createOverflowDb({ repairSucceeds: true, genericAfterRepair: true });
    const store = new DbAiQuotaStore(db);

    await expect(store.increment([makeCheck({ now: 1_782_975_650_185 })])).rejects.toThrow(
      'post-repair connection lost'
    );
    expect(db.insertAttempts).toBe(2);
  });

  test('DbAiQuotaStore still propagates non-overflow DB failures', async () => {
    const db = createOverflowDb({ genericInsertError: true });
    const store = new DbAiQuotaStore(db);

    await expect(store.increment([makeCheck()])).rejects.toThrow('connection lost');
  });

  test('DbAiQuotaStore reset deletes persisted counters', async () => {
    const db = createFakeDb();
    const store = new DbAiQuotaStore(db);

    await store.increment([makeCheck()]);
    await store.reset();

    expect(db.rows.has('ai:user:u1:hour')).toBe(false);
  });

  test('DbAiQuotaStore snapshot returns persisted counters when adapter supports _all', async () => {
    const db = createFakeDb();
    const store = new DbAiQuotaStore(db);

    await store.increment([makeCheck({ key: 'ai:workspace:ws1:endpoint:search:day' })]);

    await expect(store.snapshot({ contains: ':workspace:ws1:' })).resolves.toEqual([
      expect.objectContaining({
        key: 'ai:workspace:ws1:endpoint:search:day',
        count: 1,
      }),
    ]);
  });

  test('DbAiQuotaStore snapshot tolerates malformed listed rows', async () => {
    const db = {
      ...createFakeDb(),
      async _all() {
        return [
          { key: 'ai:workspace:ws1:endpoint:search:day', count: 0, reset_at: 0 },
          { key: '', count: 5, reset_at: 10, updated_at: '' },
        ];
      },
    };
    const store = new DbAiQuotaStore(db);

    await expect(store.snapshot({ prefix: 'ai:' })).resolves.toEqual([
      {
        key: 'ai:workspace:ws1:endpoint:search:day',
        count: 0,
        resetAt: 0,
        updatedAt: undefined,
      },
    ]);
  });

  test('DbAiQuotaStore snapshot treats non-array adapter results as empty', async () => {
    const db = {
      ...createFakeDb(),
      async _all() {
        return null;
      },
    };
    const store = new DbAiQuotaStore(db);

    await expect(store.snapshot()).resolves.toEqual([]);
  });

  test('DbAiQuotaStore snapshot returns an empty list when adapter cannot list rows', async () => {
    const db = createFakeDb();
    const { _all: _unused, ...dbWithoutAll } = db;
    const store = new DbAiQuotaStore(dbWithoutAll);

    await store.increment([makeCheck({ key: 'ai:workspace:ws1:endpoint:search:day' })]);

    await expect(store.snapshot({ contains: ':workspace:ws1:' })).resolves.toEqual([]);
  });

  test('createAiQuotaStore selects DB store outside tests when a DB adapter is available', () => {
    const db = createFakeDb();
    const store = createAiQuotaStore({
      db,
      env: { NODE_ENV: 'production', RAILWAY_ENVIRONMENT_NAME: 'production' } as NodeJS.ProcessEnv,
    });

    expect(store).toBeInstanceOf(DbAiQuotaStore);
  });

  test('createAiQuotaStore allows explicit memory fallback', () => {
    const db = createFakeDb();
    const store = createAiQuotaStore({
      db,
      env: {
        NODE_ENV: 'production',
        VOICELOG_AI_QUOTA_STORE: 'memory',
        RAILWAY_ENVIRONMENT_NAME: 'production',
      } as NodeJS.ProcessEnv,
    });

    expect(store).toBeInstanceOf(MemoryAiQuotaStore);
  });

  test('createAiQuotaStore allows explicit DB store in test mode', () => {
    const db = createFakeDb();
    const store = createAiQuotaStore({
      db,
      env: {
        NODE_ENV: 'test',
        VOICELOG_AI_QUOTA_STORE: 'db',
      } as NodeJS.ProcessEnv,
    });

    expect(store).toBeInstanceOf(DbAiQuotaStore);
  });

  test('createAiQuotaStore uses memory when Vercel env has no usable DB adapter', () => {
    const store = createAiQuotaStore({
      env: {
        NODE_ENV: '',
        VERCEL: '1',
      } as NodeJS.ProcessEnv,
    });

    expect(store).toBeInstanceOf(MemoryAiQuotaStore);
  });

  test('createAiQuotaStore falls back to memory in production when no DB adapter exists', () => {
    const store = createAiQuotaStore({
      env: { NODE_ENV: 'production', RAILWAY_ENVIRONMENT_NAME: 'production' } as NodeJS.ProcessEnv,
    });

    expect(store).toBeInstanceOf(MemoryAiQuotaStore);
  });
});
