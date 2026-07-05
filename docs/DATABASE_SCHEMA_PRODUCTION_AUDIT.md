# Database Schema Production Audit

Issue: #1253
Last updated: 2026-07-04

## Scope

This document is the operational map for the production data model. The runtime
applies SQL files from `server/migrations/` in sorted order through
`server/database.ts`. The same path is used by local SQLite and production
Postgres-compatible deployments, with duplicate `ALTER TABLE ... ADD COLUMN`
errors treated as already-applied migration state.

The enforceable schema/index contract lives in
`scripts/validate-database-schema-audit.mjs` and runs through
`pnpm run audit:repo-hygiene`.

## Table Inventory

| Table                       | Owner          | Purpose                                                                      | Key fields                                                                                            | Operational notes                                                                    |
| --------------------------- | -------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `users`                     | Auth           | Local and Google identities                                                  | `id`, `email`, `provider`, `google_sub`, recovery fields                                              | Provider and recovery cleanup indexes are required.                                  |
| `workspaces`                | Workspace      | Workspace shell and ownership                                                | `id`, `owner_user_id`, `invite_code`                                                                  | `invite_code` is unique.                                                             |
| `workspace_members`         | Workspace/Auth | Membership and role lookup                                                   | `workspace_id`, `user_id`, `member_role`                                                              | Composite primary key plus user lookup index.                                        |
| `workspace_state`           | App state      | JSON-backed meetings, tasks, calendar metadata, vocabulary, retention policy | `workspace_id`, `*_json`, `retention_days`, `updated_at`                                              | `workspace_id` is the sync anchor; `updated_at` supports drift and freshness checks. |
| `sessions`                  | Auth           | Session tokens                                                               | `token`, `user_id`, `workspace_id`, `expires_at`                                                      | Expiry and user+expiry indexes support cleanup and auth reads.                       |
| `media_assets`              | Media          | Uploaded audio, storage pointers, transcript/diarization state               | `id`, `workspace_id`, `meeting_id`, `file_path`, `storage_mode`, `transcription_status`, `created_at` | Query paths need workspace, meeting, status, and created-at indexes.                 |
| `transcription_jobs`        | Audio pipeline | Durable STT queue and retry/dead-letter state                                | `id`, `recording_id`, `workspace_id`, `status`, `next_run_at`, `locked_until`                         | One active job per recording is enforced with a partial unique index.                |
| `audit_logs`                | Compliance     | Sanitized operational events                                                 | `workspace_id`, `actor_user_id`, `entity_type`, `entity_id`, `created_at`                             | Workspace timeline and entity drilldown indexes are required.                        |
| `voice_profiles`            | Speaker ID     | Speaker enrollment and embeddings                                            | `id`, `user_id`, `workspace_id`, profile metadata                                                     | User/workspace/created-at indexes support review screens.                            |
| `rag_chunks`                | Retrieval      | Embedding chunks per recording                                               | `workspace_id`, `recording_id`, `embedding_json`                                                      | Workspace index is required before wider retrieval usage.                            |
| `google_integrations`       | Integrations   | Google Calendar/Tasks OAuth tokens                                           | `user_id`, `workspace_id`, `provider`, token fields                                                   | Unique user/workspace/provider row; indexed by user+workspace.                       |
| `google_oauth_states`       | Integrations   | Short-lived OAuth state verifier                                             | `state`, `user_id`, `workspace_id`, `expires_at`, `used_at`                                           | User+workspace index is required; expiry cleanup is a future hardening item.         |
| `route_rate_limit_counters` | Abuse control  | Route-level counters                                                         | `key`, `count`, `reset_at`                                                                            | Reset-at index supports cleanup.                                                     |

## Critical Index Contract

The validator requires the following production-critical indexes:

| Area                  | Required indexes                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Media assets          | `idx_media_assets_workspace_id`, `idx_media_assets_meeting_id`, `idx_media_assets_transcription_status`, `idx_media_assets_created_at`, `idx_media_assets_meeting_status`, `idx_media_assets_workspace_created_at`                   |
| Transcription jobs    | `idx_transcription_jobs_one_active_per_recording`, `idx_transcription_jobs_lease_queue`, `idx_transcription_jobs_recording_id`, `idx_transcription_jobs_workspace_status_updated_at`, `idx_transcription_jobs_error_code_updated_at` |
| Workspace state       | `idx_workspace_state_updated_at`, `idx_workspace_state_retention_days`                                                                                                                                                               |
| Sessions              | `idx_sessions_user_id`, `idx_sessions_expires_at`, `idx_sessions_user_expires`                                                                                                                                                       |
| Audit events          | `idx_audit_logs_workspace_created_at`, `idx_audit_logs_entity`, `idx_audit_logs_workspace_entity_created_at`                                                                                                                         |
| Retention and cleanup | `idx_media_assets_created_at`, `idx_media_assets_workspace_created_at`, `idx_workspace_state_retention_days`, `idx_sessions_expires_at`, `idx_route_rate_limit_counters_reset_at`                                                    |
| Integrations and RAG  | `idx_google_integrations_user_workspace`, `idx_google_oauth_states_user_workspace`, `idx_rag_chunks_ws`                                                                                                                              |

Deferred:

- `google_oauth_states.expires_at` is not indexed yet. Add it with an expiry
  cleanup worker if OAuth state volume becomes material.
- `rag_chunks(recording_id)` is not required until retrieval routes need
  recording-scoped chunk deletion or reindexing at scale.
- `db:migrate` currently maps to `scripts/post-deploy.js`, whose SQL migration
  commands are commented out. Runtime startup still applies ledgered migrations
  through `server/database.ts`, but a dedicated production migration runner
  should be split into its own follow-up before relying on `db:migrate` as an
  operator command.

## Migration Safety

Current safeguards:

- `server_migrations(version, applied_at)` records applied migration files.
- `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` make schema and
  index migrations safe for fresh databases and safe re-runs.
- Duplicate SQLite/Postgres `ALTER TABLE ... ADD COLUMN` errors are treated as
  already-applied by `isAddColumnAlreadyAppliedMigrationError`.
- `server/tests/database.migration-idempotency.test.ts` covers duplicate-column
  handling and unrelated error propagation.
- `server/tests/database/migration-contract.test.ts` covers key migration
  contracts for segmented media, transcription jobs, dead-letter status, and
  voice profile metadata.
- `server/tests/database/transcriptionJobs.test.ts` verifies the durable
  transcription job queue behavior and required job indexes.

Checklist for every new migration:

- Use `CREATE TABLE IF NOT EXISTS` for new tables.
- Use `CREATE INDEX IF NOT EXISTS` for new indexes.
- For new columns, update `001_initial_schema.sql` and add an `ALTER TABLE`
  migration for existing databases.
- Keep SQL compatible with SQLite and Postgres-compatible production unless a
  branch is explicitly guarded in code.
- Add or extend a migration contract test for every new table, required column,
  partial index, or destructive table rewrite.
- Add rollback guidance. This repo favors forward-fix migrations; destructive
  rollback should be avoided unless a tested restore path exists.

## Rollback And Forward-Fix Strategy

The production strategy is forward-fix first:

1. Stop the writer path that is producing invalid data.
2. Add a corrective migration or repair script.
3. Run the schema validator and targeted migration tests.
4. Deploy and verify `/health`, media upload/finalize, transcription job reads,
   and workspace bootstrap.

Restore-from-backup is reserved for destructive data loss or migration corruption.
Before any destructive operation, capture:

- database backup identifier,
- affected workspace ids,
- affected recording ids,
- migration filename and commit SHA,
- repair/rollback command and operator.

## Validation Commands

Minimum gate for schema-only changes:

```bash
node scripts/validate-database-schema-audit.mjs
pnpm exec vitest run -c vitest.scripts.config.ts scripts/validate-database-schema-audit.test.ts --coverage.enabled=false
pnpm run audit:repo-hygiene
```

Broader DB confidence:

```bash
pnpm exec vitest run -c server/vitest.config.ts server/tests/database.migration-idempotency.test.ts server/tests/database/migration-contract.test.ts server/tests/database/schemaAudit.integration.test.ts server/tests/database/transcriptionJobs.test.ts --coverage.enabled=false
```
