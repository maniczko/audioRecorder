import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_MIGRATIONS_DIR = 'server/migrations';

export const REQUIRED_TABLES = [
  'users',
  'workspaces',
  'workspace_members',
  'workspace_state',
  'sessions',
  'media_assets',
  'transcription_jobs',
  'audit_logs',
  'voice_profiles',
  'rag_chunks',
  'google_integrations',
  'google_oauth_states',
  'route_rate_limit_counters',
];

export const REQUIRED_INDEXES = [
  'idx_media_assets_workspace_id',
  'idx_media_assets_meeting_id',
  'idx_media_assets_transcription_status',
  'idx_media_assets_created_at',
  'idx_media_assets_meeting_status',
  'idx_media_assets_workspace_created_at',
  'idx_transcription_jobs_one_active_per_recording',
  'idx_transcription_jobs_lease_queue',
  'idx_transcription_jobs_recording_id',
  'idx_transcription_jobs_workspace_status_updated_at',
  'idx_transcription_jobs_error_code_updated_at',
  'idx_workspace_state_updated_at',
  'idx_workspace_state_retention_days',
  'idx_sessions_user_id',
  'idx_sessions_expires_at',
  'idx_sessions_user_expires',
  'idx_audit_logs_workspace_created_at',
  'idx_audit_logs_entity',
  'idx_audit_logs_workspace_entity_created_at',
  'idx_route_rate_limit_counters_reset_at',
  'idx_google_integrations_user_workspace',
  'idx_google_oauth_states_user_workspace',
  'idx_rag_chunks_ws',
];

function normalizeSql(sql) {
  return String(sql || '')
    .replace(/--[^\n\r]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function loadMigrationSql({
  cwd = process.cwd(),
  migrationsDir = DEFAULT_MIGRATIONS_DIR,
  readFile = fs.readFileSync,
  readdir = fs.readdirSync,
  exists = fs.existsSync,
} = {}) {
  const absoluteDir = path.resolve(cwd, migrationsDir);
  if (!exists(absoluteDir)) {
    throw new Error(`Migrations directory is missing: ${migrationsDir}`);
  }

  const files = readdir(absoluteDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  return {
    files,
    sql: files.map((file) => readFile(path.join(absoluteDir, file), 'utf8')).join('\n\n'),
  };
}

export function validateDatabaseSchemaAudit({
  cwd = process.cwd(),
  migrations = loadMigrationSql({ cwd }),
  requiredTables = REQUIRED_TABLES,
  requiredIndexes = REQUIRED_INDEXES,
} = {}) {
  const normalized = normalizeSql(migrations.sql);
  const violations = [];

  if (!Array.isArray(migrations.files) || migrations.files.length === 0) {
    violations.push('server/migrations must contain at least one SQL migration');
  }

  for (const tableName of requiredTables) {
    const tablePattern = new RegExp(
      `\\bcreate\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?${escapeRegExp(tableName)}\\b`
    );
    if (!tablePattern.test(normalized)) {
      violations.push(`missing required table migration: ${tableName}`);
    }
  }

  for (const indexName of requiredIndexes) {
    const indexPattern = new RegExp(
      `\\bcreate\\s+(?:unique\\s+)?index\\s+if\\s+not\\s+exists\\s+${escapeRegExp(indexName)}\\b`
    );
    if (!indexPattern.test(normalized)) {
      violations.push(`missing required idempotent index migration: ${indexName}`);
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    migrationCount: migrations.files?.length || 0,
    requiredTableCount: requiredTables.length,
    requiredIndexCount: requiredIndexes.length,
  };
}

export function assertDatabaseSchemaAudit(options = {}) {
  const result = validateDatabaseSchemaAudit(options);
  if (!result.ok) {
    throw new Error(
      `Database schema audit validation failed:\n${result.violations
        .map((violation) => `- ${violation}`)
        .join('\n')}`
    );
  }
  return result;
}

const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  const result = assertDatabaseSchemaAudit();
  console.log(
    `Database schema audit validation passed (${result.migrationCount} migrations, ${result.requiredTableCount} tables, ${result.requiredIndexCount} indexes).`
  );
}
