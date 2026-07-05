import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

describe('Database Postgres transactions', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('pg');
  });

  test('Regression: Issue #1403 - registerUser keeps workspace and workspace_state inserts on one Postgres client', async () => {
    const realFs = await vi.importActual<typeof import('node:fs')>('node:fs');
    const realOs = await vi.importActual<typeof import('node:os')>('node:os');
    const uploadDir = realFs.mkdtempSync(path.join(realOs.tmpdir(), 'voicelog-pg-tx-'));
    const poolQueries: Array<{ sql: string; params?: unknown[] }> = [];
    const clientQueries: Array<{ sql: string; params?: unknown[] }> = [];
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        clientQueries.push({ sql, params });
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        poolQueries.push({ sql, params });
        return { rows: [] };
      }),
      connect: vi.fn(async () => client),
      end: vi.fn(),
    };

    const PoolMock = vi.fn(function Pool() {
      return pool;
    });

    vi.doMock('pg', () => ({
      Pool: PoolMock,
    }));

    const { initDatabase } = await import('../database.ts');
    const db = initDatabase({
      connectionString: 'postgres://unit-test',
      uploadDir,
    }) as any;
    db.createSession = vi.fn(async () => ({
      token: 'token',
      expiresAt: '2026-07-05T00:00:00.000Z',
    }));
    db.buildSessionPayload = vi.fn(async (userId: string, workspaceId: string) => ({
      user: { id: userId, email: 'new@example.test', name: 'New User' },
      users: [],
      workspaces: [{ id: workspaceId, name: 'Workspace' }],
      workspaceId,
      state: {},
    }));

    try {
      const result = await db.registerUser({
        email: 'new@example.test',
        password: 'password123',
        name: 'New User',
        workspaceName: 'Workspace',
        workspaceMode: 'create',
      });

      expect(result.workspaceId).toMatch(/^workspace_/);
      expect(pool.connect).toHaveBeenCalledTimes(1);
      expect(client.release).toHaveBeenCalledTimes(1);

      const clientSql = clientQueries.map((entry) => entry.sql);
      expect(clientSql[0]).toBe('BEGIN');
      expect(clientSql).toContain('COMMIT');
      expect(clientSql.some((sql) => /INSERT INTO workspaces/i.test(sql))).toBe(true);
      expect(clientSql.some((sql) => /INSERT INTO workspace_state/i.test(sql))).toBe(true);
      expect(poolQueries.some((entry) => /INSERT INTO workspace_state/i.test(entry.sql))).toBe(
        false
      );
    } finally {
      await db.shutdown();
      realFs.rmSync(uploadDir, { recursive: true, force: true });
    }
  });
});
