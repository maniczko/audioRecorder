import { describe, expect, test } from 'vitest';
import {
  REQUIRED_INDEXES,
  REQUIRED_TABLES,
  assertDatabaseSchemaAudit,
  validateDatabaseSchemaAudit,
} from './validate-database-schema-audit.mjs';

const makeSql = ({
  tables = REQUIRED_TABLES,
  indexes = REQUIRED_INDEXES,
}: {
  tables?: readonly string[];
  indexes?: readonly string[];
} = {}) => {
  const tableSql = tables.map((table) => `CREATE TABLE IF NOT EXISTS ${table} (id TEXT);`);
  const indexSql = indexes.map((index) => `CREATE INDEX IF NOT EXISTS ${index} ON t(id);`);
  return [...tableSql, ...indexSql].join('\n');
};

describe('validate-database-schema-audit', () => {
  test('accepts the repository migration contract', () => {
    const result = validateDatabaseSchemaAudit();

    expect(result.ok).toBe(true);
    expect(result.migrationCount).toBeGreaterThanOrEqual(10);
    expect(result.requiredTableCount).toBe(REQUIRED_TABLES.length);
    expect(result.requiredIndexCount).toBe(REQUIRED_INDEXES.length);
  });

  test('fails when a required table migration is missing', () => {
    const result = validateDatabaseSchemaAudit({
      migrations: {
        files: ['001.sql'],
        sql: makeSql({ tables: REQUIRED_TABLES.filter((table) => table !== 'media_assets') }),
      },
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toContain('missing required table migration: media_assets');
  });

  test('fails when a required index is missing', () => {
    const result = validateDatabaseSchemaAudit({
      migrations: {
        files: ['001.sql'],
        sql: makeSql({
          indexes: REQUIRED_INDEXES.filter(
            (index) => index !== 'idx_transcription_jobs_lease_queue'
          ),
        }),
      },
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      'missing required idempotent index migration: idx_transcription_jobs_lease_queue'
    );
  });

  test('requires critical indexes to be idempotent', () => {
    const sql = makeSql({
      indexes: REQUIRED_INDEXES.filter((index) => index !== 'idx_sessions_expires_at'),
    }).concat('\nCREATE INDEX idx_sessions_expires_at ON sessions(expires_at);');

    const result = validateDatabaseSchemaAudit({
      migrations: {
        files: ['001.sql'],
        sql,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      'missing required idempotent index migration: idx_sessions_expires_at'
    );
  });

  test('throws a readable error with all violations', () => {
    expect(() =>
      assertDatabaseSchemaAudit({
        migrations: {
          files: [],
          sql: '',
        },
      })
    ).toThrow(
      /Database schema audit validation failed:[\s\S]*media_assets[\s\S]*idx_media_assets_workspace_id/
    );
  });
});
