import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { Database } from '../../database.ts';

const tempRoots: string[] = [];
let actualFs: typeof import('node:fs');

const criticalSchemaAuditIndexes = [
  'idx_media_assets_workspace_created_at',
  'idx_transcription_jobs_workspace_status_updated_at',
  'idx_transcription_jobs_error_code_updated_at',
  'idx_audit_logs_workspace_entity_created_at',
  'idx_workspace_state_retention_days',
  'idx_recording_retention_holds_workspace_recording',
  'idx_recording_retention_holds_active',
] as const;

async function initDbAt(dbPath: string, uploadDir: string) {
  const db = new Database({ dbPath, uploadDir });
  await db.init();
  return db;
}

async function getActualFs() {
  actualFs ??= await vi.importActual<typeof import('node:fs')>('node:fs');
  return actualFs;
}

describe('database schema audit integration', () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      actualFs?.rmSync(root, { recursive: true, force: true });
    }
  });

  test('Issue #1253 - fresh database and rerun preserve migration ledger and critical indexes', async () => {
    const fs = await getActualFs();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'voicelog-schema-audit-'));
    tempRoots.push(root);
    const dbPath = path.join(root, 'schema-audit.sqlite');
    const uploadDir = path.join(root, 'uploads');

    const first = await initDbAt(dbPath, uploadDir);
    const firstMigrationRows = await first._query('SELECT version FROM server_migrations');
    await first.shutdown();

    const second = await initDbAt(dbPath, uploadDir);
    try {
      const secondMigrationRows = await second._query('SELECT version FROM server_migrations');
      const indexRows = await second._query(
        "SELECT name FROM sqlite_master WHERE type = 'index' ORDER BY name"
      );

      expect(secondMigrationRows).toHaveLength(firstMigrationRows.length);
      expect(secondMigrationRows.length).toBeGreaterThanOrEqual(14);
      expect(indexRows.map((row: { name: string }) => row.name)).toEqual(
        expect.arrayContaining([...criticalSchemaAuditIndexes])
      );
    } finally {
      await second.shutdown();
    }
  });
});
