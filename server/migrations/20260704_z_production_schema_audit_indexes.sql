-- Production schema audit indexes for issue #1253.
-- These indexes cover workspace-scoped media lists/exports, transcription
-- operations dashboards, recording audit drilldowns, and retention cleanup.

CREATE INDEX IF NOT EXISTS idx_media_assets_workspace_created_at
  ON media_assets(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transcription_jobs_workspace_status_updated_at
  ON transcription_jobs(workspace_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_transcription_jobs_error_code_updated_at
  ON transcription_jobs(last_error_code, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_entity_created_at
  ON audit_logs(workspace_id, entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_state_retention_days
  ON workspace_state(retention_days);
