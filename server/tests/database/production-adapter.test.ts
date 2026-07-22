import { afterEach, describe, expect, test, vi } from 'vitest';

const originalEnvironment = { ...process.env };

function restoreEnvironment() {
  process.env = { ...originalEnvironment };
}

afterEach(() => {
  restoreEnvironment();
  vi.resetModules();
});

// ----------------------------------------------------------------
// Issue #1510 — production database adapter must fail closed
// Date: 2026-07-21
// Bug: missing production PostgreSQL configuration selected SQLite.
// Fix: getDatabase rejects production before it can construct SQLite.
// ----------------------------------------------------------------
describe('production database adapter', () => {
  test('rejects missing PostgreSQL configuration before creating a database', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_URL;
    delete process.env.VOICELOG_DATABASE_URL;
    vi.resetModules();

    const { getDatabase } = await import('../../database.ts');

    expect(() => getDatabase()).toThrow('Production startup blocked');
  });

  test('rejects malformed production PostgreSQL configuration before creating a database', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'https://db.example.com/not-postgres';
    delete process.env.VOICELOG_DATABASE_URL;
    vi.resetModules();

    const { getDatabase } = await import('../../database.ts');

    expect(() => getDatabase()).toThrow('postgresql://');
  });

  test('selects the PostgreSQL adapter for a valid production connection string', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL =
      'postgresql://postgres:secret@db.project-ref.supabase.co:5432/postgres';
    delete process.env.VOICELOG_DATABASE_URL;
    vi.resetModules();

    const { getDatabase } = await import('../../database.ts');
    const db = getDatabase();

    expect(db.type).toBe('postgres');
    await db.shutdown();
  });

  test('keeps SQLite available for test execution', async () => {
    const { resolveDatabaseAdapter } = await import('../../database.ts');

    expect(
      resolveDatabaseAdapter({
        isTest: true,
        connectionString: null,
        productionDatabaseError: null,
      })
    ).toBe('sqlite');
  });
});
