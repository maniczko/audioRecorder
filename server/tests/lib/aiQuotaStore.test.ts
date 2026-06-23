import { describe, expect, test } from 'vitest';
import {
  createAiQuotaStore,
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

function createFakeDb() {
  const rows = new Map<
    string,
    { key: string; count: number; reset_at: number; updated_at: string }
  >();
  return {
    rows,
    async _execute(sql: string, params: unknown[] = []) {
      if (/CREATE TABLE/i.test(sql)) return;
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

  test('DbAiQuotaStore reset deletes persisted counters', async () => {
    const db = createFakeDb();
    const store = new DbAiQuotaStore(db);

    await store.increment([makeCheck()]);
    await store.reset();

    expect(db.rows.has('ai:user:u1:hour')).toBe(false);
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

  test('createAiQuotaStore falls back to memory in production when no DB adapter exists', () => {
    const store = createAiQuotaStore({
      env: { NODE_ENV: 'production', RAILWAY_ENVIRONMENT_NAME: 'production' } as NodeJS.ProcessEnv,
    });

    expect(store).toBeInstanceOf(MemoryAiQuotaStore);
  });
});
