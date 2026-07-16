import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────────
// Issue #1506 - registration aborts after workspace-state schema mutation
// Date: 2026-07-16
// Bug: a duplicate ADD COLUMN inside the registration transaction leaves PostgreSQL aborted.
// Fix: workspace-state migrations run before registration; the transaction only writes data.
// ─────────────────────────────────────────────────────────────────
describe('Regression: Issue #1506 - PostgreSQL registration transaction', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('pg');
  });

  test('registers a user without running schema mutations in the transaction', async () => {
    const realFs = await vi.importActual<typeof import('node:fs')>('node:fs');
    const realOs = await vi.importActual<typeof import('node:os')>('node:os');
    const uploadDir = realFs.mkdtempSync(path.join(realOs.tmpdir(), 'voicelog-register-pg-'));
    const clientQueries: Array<{ sql: string; params?: unknown[] }> = [];
    let transactionAborted = false;

    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        clientQueries.push({ sql, params });

        if (transactionAborted && sql !== 'ROLLBACK') {
          throw new Error(
            'current transaction is aborted, commands ignored until end of transaction block'
          );
        }

        if (/ALTER TABLE workspace_state ADD COLUMN retention_days/i.test(sql)) {
          transactionAborted = true;
          throw new Error('column "retention_days" of relation "workspace_state" already exists');
        }

        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async () => ({ rows: [] })),
      connect: vi.fn(async () => client),
      end: vi.fn(),
    };

    const PoolMock = vi.fn(function Pool() {
      return pool;
    });
    vi.doMock('pg', () => ({ Pool: PoolMock }));

    const { initDatabase } = await import('../../database.ts');
    const db = initDatabase({ connectionString: 'postgres://unit-test', uploadDir }) as any;
    db.createSession = vi.fn(async () => ({
      token: 'token',
      expiresAt: '2026-07-16T00:00:00.000Z',
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
      expect(clientQueries.map((entry) => entry.sql)).toContain('COMMIT');
      expect(clientQueries.some((entry) => /ALTER TABLE/i.test(entry.sql))).toBe(false);
    } finally {
      await db.shutdown();
      realFs.rmSync(uploadDir, { recursive: true, force: true });
    }
  });
});
