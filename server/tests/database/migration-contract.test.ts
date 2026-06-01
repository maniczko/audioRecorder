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
});
