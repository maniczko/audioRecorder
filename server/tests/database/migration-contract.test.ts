import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, '../../migrations');

const segmentedStorageColumns = [
  'storage_mode',
  'media_manifest_json',
  'source_size_bytes',
  'normalized_size_bytes',
] as const;

const voiceProfileMetadataColumns = [
  'updated_at',
  'profile_source',
  'embedding_model',
  'embedding_version',
  'created_by',
] as const;

const productionSchemaAuditIndexes = [
  'idx_media_assets_workspace_created_at',
  'idx_transcription_jobs_workspace_status_updated_at',
  'idx_transcription_jobs_error_code_updated_at',
  'idx_audit_logs_workspace_entity_created_at',
  'idx_workspace_state_retention_days',
] as const;

const retentionHoldIndexes = [
  'idx_recording_retention_holds_workspace_recording',
  'idx_recording_retention_holds_active',
] as const;

const manualPeopleMigration = '20260716_workspace_state_manual_people.sql';

function readMigration(fileName: string) {
  return fs.readFileSync(path.join(migrationsDir, fileName), 'utf8');
}

describe('Database migration contracts', () => {
  test('Regression: #0 - segmented media asset migration includes all production columns', () => {
    const migration = readMigration('20260601_media_asset_segmented_storage.sql');
    const normalized = migration.replace(/\s+/g, ' ').toLowerCase();

    for (const column of segmentedStorageColumns) {
      expect(normalized).toContain(`add column ${column}`);
    }
    expect(normalized).toContain("storage_mode text not null default 'single'");
    expect(normalized).toContain("media_manifest_json text not null default '{}'");
    expect(normalized).toContain('source_size_bytes integer not null default 0');
    expect(normalized).toContain('normalized_size_bytes integer not null default 0');
  });

  test('initial schema contains the segmented media asset columns for fresh databases', () => {
    const initialSchema = readMigration('001_initial_schema.sql').toLowerCase();

    for (const column of segmentedStorageColumns) {
      expect(initialSchema).toContain(column);
    }
  });

  test('transcription_jobs migration is portable across SQLite and Postgres-compatible SQL', () => {
    const migration = readMigration('20260625_transcription_jobs.sql')
      .replace(/\s+/g, ' ')
      .toLowerCase();

    expect(migration).toContain('create table if not exists transcription_jobs');
    expect(migration).toContain(
      "status in ('queued', 'running', 'retryable_failed', 'failed', 'completed', 'cancelled')"
    );
    expect(migration).toContain(
      'create unique index if not exists idx_transcription_jobs_one_active_per_recording'
    );
    expect(migration).toContain("where status in ('queued', 'running', 'retryable_failed')");
    expect(migration).not.toContain('autoincrement');
    expect(migration).not.toContain('serial');
  });

  test('Issue #1246 - dead-letter migration preserves transcription job history', () => {
    const migration = readMigration('20260704_transcription_jobs_dead_letter.sql')
      .replace(/\s+/g, ' ')
      .toLowerCase();

    expect(migration).toContain('dead_letter');
    expect(migration).toContain('transcription_jobs_v2');
    expect(migration).toContain('insert into transcription_jobs_v2');
    expect(migration).toContain('drop table transcription_jobs');
    expect(migration).toContain("where status in ('queued', 'running', 'retryable_failed')");
  });

  test('Regression: Issue #1333 - voice profile metadata migration includes operational columns', () => {
    const migration = readMigration('20260701_voice_profile_operational_metadata.sql')
      .replace(/\s+/g, ' ')
      .toLowerCase();

    for (const column of voiceProfileMetadataColumns) {
      expect(migration).toContain(`add column ${column}`);
    }

    expect(migration).toContain("profile_source text not null default 'unknown'");
    expect(migration).toContain("embedding_model text not null default 'unknown'");
    expect(migration).toContain("embedding_version text not null default '1'");
  });

  test('initial schema contains voice profile operational metadata columns for fresh databases', () => {
    const initialSchema = readMigration('001_initial_schema.sql').toLowerCase();

    for (const column of voiceProfileMetadataColumns) {
      expect(initialSchema).toContain(column);
    }
  });

  test('Issue #1253 - production schema audit migration adds critical operations indexes', () => {
    const migration = readMigration('20260704_z_production_schema_audit_indexes.sql')
      .replace(/\s+/g, ' ')
      .toLowerCase();

    for (const indexName of productionSchemaAuditIndexes) {
      expect(migration).toContain(`create index if not exists ${indexName}`);
    }

    expect(migration).toContain('on media_assets(workspace_id, created_at desc)');
    expect(migration).toContain('on transcription_jobs(workspace_id, status, updated_at desc)');
    expect(migration).toContain('on transcription_jobs(last_error_code, updated_at desc)');
    expect(migration).toContain(
      'on audit_logs(workspace_id, entity_type, entity_id, created_at desc)'
    );
    expect(migration).toContain('on workspace_state(retention_days)');
  });

  test('Issue #1261 - retention hold migration preserves active hold lookup', () => {
    const migration = readMigration('20260705_recording_retention_holds.sql')
      .replace(/\s+/g, ' ')
      .toLowerCase();
    const initialSchema = readMigration('001_initial_schema.sql')
      .replace(/\s+/g, ' ')
      .toLowerCase();

    expect(migration).toContain('create table if not exists recording_retention_holds');
    expect(initialSchema).toContain('create table if not exists recording_retention_holds');
    for (const indexName of retentionHoldIndexes) {
      expect(migration).toContain(
        `create ${indexName.includes('active') ? 'unique ' : ''}index if not exists ${indexName}`
      );
      expect(initialSchema).toContain(indexName);
    }
    expect(migration).toContain('where released_at is null');
  });

  test('Issue #1262 - workspace feature flag migration preserves fresh and upgraded databases', () => {
    const migration = readMigration('20260705_workspace_feature_flags.sql')
      .replace(/\s+/g, ' ')
      .toLowerCase();
    const initialSchema = readMigration('001_initial_schema.sql')
      .replace(/\s+/g, ' ')
      .toLowerCase();

    expect(migration).toContain('alter table workspace_state');
    expect(migration).toContain('add column feature_flags_json text not null default');
    expect(initialSchema).toContain('feature_flags_json text not null default');
  });

  test('Issue #1506 - manual people state is migrated before registration transactions', () => {
    const migration = readMigration(manualPeopleMigration).replace(/\s+/g, ' ').toLowerCase();

    expect(migration).toContain('alter table workspace_state');
    expect(migration).toContain("add column manual_people_json text not null default '[]'");
  });
});
