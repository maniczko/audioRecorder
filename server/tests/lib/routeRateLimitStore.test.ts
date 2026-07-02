import { describe, expect, test } from 'vitest';
import {
  DbRouteRateLimitStore,
  MemoryRouteRateLimitStore,
  createRouteRateLimitStore,
  type RouteRateLimitCheck,
} from '../../lib/routeRateLimitStore.ts';

function makeCheck(overrides: Partial<RouteRateLimitCheck> = {}): RouteRateLimitCheck {
  return {
    key: 'route:rag-ask:user:u1',
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
      if (/DELETE FROM route_rate_limit_counters/i.test(sql)) {
        rows.clear();
        return;
      }
      if (/INSERT INTO route_rate_limit_counters/i.test(sql)) {
        const [key, resetAt, updatedAt, now] = params;
        const existing = rows.get(String(key));
        const currentResetAt = Number(existing?.reset_at);
        const shouldReset =
          !existing || !Number.isFinite(currentResetAt) || currentResetAt <= Number(now);
        rows.set(String(key), {
          key: String(key),
          count: shouldReset ? 1 : Number(existing?.count || 0) + 1,
          reset_at: shouldReset ? Number(resetAt) : currentResetAt,
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

function createOverflowDb(
  options: {
    repairSucceeds?: boolean;
    overflowPersists?: boolean;
    genericInsertError?: boolean;
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
      if (/ALTER TABLE route_rate_limit_counters/i.test(sql)) {
        if (!options.repairSucceeds) {
          throw new Error('permission denied for table route_rate_limit_counters');
        }
        repaired = true;
        return;
      }
      if (/INSERT INTO route_rate_limit_counters/i.test(sql)) {
        insertAttempts += 1;
        if (options.genericInsertError) {
          throw new Error('connection lost');
        }
        if (!repaired || options.overflowPersists) {
          throw new Error('value "1782975650185" is out of range for type integer');
        }
        const [key, resetAt, updatedAt] = params;
        rows.set(String(key), {
          key: String(key),
          count: 1,
          reset_at: Number(resetAt),
          updated_at: String(updatedAt),
        });
        return;
      }
      if (/DELETE FROM route_rate_limit_counters/i.test(sql)) {
        rows.clear();
        return;
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    async _get(_sql: string, params: unknown[] = []) {
      return rows.get(String(params[0])) || null;
    },
  };
}

describe('route rate limit stores', () => {
  test('MemoryRouteRateLimitStore returns Retry-After when a route limit is exceeded', async () => {
    const store = new MemoryRouteRateLimitStore();

    await expect(store.increment([makeCheck()])).resolves.toBeNull();
    const exceeded = await store.increment([makeCheck({ now: 2_000 })]);

    expect(exceeded).toEqual({
      key: 'route:rag-ask:user:u1',
      limit: 1,
      retryAfter: 59,
    });
  });

  test('MemoryRouteRateLimitStore reset clears counters', async () => {
    const store = new MemoryRouteRateLimitStore();

    await store.increment([makeCheck()]);
    store.reset();

    await expect(store.increment([makeCheck({ now: 2_000 })])).resolves.toBeNull();
  });

  test('DbRouteRateLimitStore shares counters across store instances using the same database', async () => {
    const db = createFakeDb();
    const firstInstance = new DbRouteRateLimitStore(db);
    const secondInstance = new DbRouteRateLimitStore(db);

    await expect(firstInstance.increment([makeCheck()])).resolves.toBeNull();
    const exceeded = await secondInstance.increment([makeCheck({ now: 2_000 })]);

    expect(exceeded).toEqual({
      key: 'route:rag-ask:user:u1',
      limit: 1,
      retryAfter: 59,
    });
    expect(db.rows.get('route:rag-ask:user:u1')?.count).toBe(2);
  });

  test('DbRouteRateLimitStore resets expired windows before incrementing', async () => {
    const db = createFakeDb();
    const store = new DbRouteRateLimitStore(db);

    await expect(store.increment([makeCheck({ now: 1_000 })])).resolves.toBeNull();
    await expect(store.increment([makeCheck({ now: 62_000 })])).resolves.toBeNull();

    expect(db.rows.get('route:rag-ask:user:u1')?.count).toBe(1);
    expect(db.rows.get('route:rag-ask:user:u1')?.reset_at).toBe(122_000);
  });

  test('DbRouteRateLimitStore repairs reset_at integer overflow and retries the DB write', async () => {
    const db = createOverflowDb({ repairSucceeds: true });
    const store = new DbRouteRateLimitStore(db);

    await expect(store.increment([makeCheck({ now: 1_782_975_650_185 })])).resolves.toBeNull();

    expect(db.insertAttempts).toBe(2);
    expect(db.statements).toContainEqual(
      expect.stringMatching(
        /ALTER TABLE route_rate_limit_counters\s+ALTER COLUMN reset_at TYPE BIGINT/i
      )
    );
    expect(db.rows.get('route:rag-ask:user:u1')?.reset_at).toBe(1_782_975_710_185);
  });

  test('DbRouteRateLimitStore falls back to memory when overflow repair is denied', async () => {
    const db = createOverflowDb();
    const store = new DbRouteRateLimitStore(db);

    await expect(store.increment([makeCheck({ now: 1_782_975_650_185 })])).resolves.toBeNull();
    const exceeded = await store.increment([makeCheck({ now: 1_782_975_650_186 })]);

    expect(exceeded).toMatchObject({
      key: 'route:rag-ask:user:u1',
      limit: 1,
    });
    expect(db.insertAttempts).toBe(1);
  });

  test('DbRouteRateLimitStore falls back to memory when overflow persists after repair', async () => {
    const db = createOverflowDb({ repairSucceeds: true, overflowPersists: true });
    const store = new DbRouteRateLimitStore(db);

    await expect(store.increment([makeCheck({ now: 1_782_975_650_185 })])).resolves.toBeNull();

    expect(db.insertAttempts).toBe(2);
    expect(db.rows.size).toBe(0);
  });

  test('DbRouteRateLimitStore still propagates non-overflow DB failures', async () => {
    const db = createOverflowDb({ genericInsertError: true });
    const store = new DbRouteRateLimitStore(db);

    await expect(store.increment([makeCheck()])).rejects.toThrow('connection lost');
  });

  test('createRouteRateLimitStore selects DB store outside tests when a DB adapter is available', () => {
    const db = createFakeDb();
    const store = createRouteRateLimitStore({
      db,
      env: { NODE_ENV: 'production', RAILWAY_ENVIRONMENT_NAME: 'production' } as NodeJS.ProcessEnv,
    });

    expect(store).toBeInstanceOf(DbRouteRateLimitStore);
  });

  test('createRouteRateLimitStore allows explicit memory fallback', () => {
    const db = createFakeDb();
    const store = createRouteRateLimitStore({
      db,
      env: {
        NODE_ENV: 'production',
        RAILWAY_ENVIRONMENT_NAME: 'production',
        VOICELOG_RATE_LIMIT_STORE: 'memory',
      } as NodeJS.ProcessEnv,
    });

    expect(store).toBeInstanceOf(MemoryRouteRateLimitStore);
  });
});
