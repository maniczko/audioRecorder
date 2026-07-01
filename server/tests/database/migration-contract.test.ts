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
});
