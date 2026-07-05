CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'local',
  google_sub TEXT NOT NULL DEFAULT '',
  google_email TEXT NOT NULL DEFAULT '',
  recovery_code_hash TEXT NOT NULL DEFAULT '',
  recovery_code_expires_at TEXT NOT NULL DEFAULT '',
  profile_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  member_role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS workspace_state (
  workspace_id TEXT PRIMARY KEY,
  meetings_json TEXT NOT NULL DEFAULT '[]',
  manual_tasks_json TEXT NOT NULL DEFAULT '[]',
  task_state_json TEXT NOT NULL DEFAULT '{}',
  task_boards_json TEXT NOT NULL DEFAULT '{}',
  calendar_meta_json TEXT NOT NULL DEFAULT '{}',
  vocabulary_json TEXT NOT NULL DEFAULT '[]',
  retention_days INTEGER NOT NULL DEFAULT 365,
  feature_flags_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  meeting_id TEXT NOT NULL DEFAULT '',
  created_by_user_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  storage_mode TEXT NOT NULL DEFAULT 'single',
  media_manifest_json TEXT NOT NULL DEFAULT '{}',
  source_size_bytes INTEGER NOT NULL DEFAULT 0,
  normalized_size_bytes INTEGER NOT NULL DEFAULT 0,
  transcription_status TEXT NOT NULL DEFAULT 'queued',
  transcript_json TEXT NOT NULL DEFAULT '[]',
  diarization_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);


CREATE TABLE IF NOT EXISTS transcription_jobs (
  id TEXT PRIMARY KEY,
  recording_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  meeting_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  locked_by TEXT,
  locked_until TEXT,
  next_run_at TEXT NOT NULL,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  CHECK (status IN ('queued', 'running', 'retryable_failed', 'failed', 'completed', 'cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transcription_jobs_one_active_per_recording
  ON transcription_jobs(recording_id)
  WHERE status IN ('queued', 'running', 'retryable_failed');

CREATE INDEX IF NOT EXISTS idx_transcription_jobs_lease_queue
  ON transcription_jobs(status, next_run_at, locked_until, created_at);

CREATE INDEX IF NOT EXISTS idx_transcription_jobs_recording_id
  ON transcription_jobs(recording_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_created_at
  ON audit_logs(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON audit_logs(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS recording_retention_holds (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  recording_id TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_by_user_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  released_at TEXT,
  released_by_user_id TEXT NOT NULL DEFAULT '',
  release_reason TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_recording_retention_holds_workspace_recording
  ON recording_retention_holds(workspace_id, recording_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_recording_retention_holds_active
  ON recording_retention_holds(workspace_id, recording_id)
  WHERE released_at IS NULL;

CREATE TABLE IF NOT EXISTS voice_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  speaker_name TEXT NOT NULL,
  audio_path TEXT NOT NULL,
  embedding_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  profile_source TEXT NOT NULL DEFAULT 'unknown',
  embedding_model TEXT NOT NULL DEFAULT 'unknown',
  embedding_version TEXT NOT NULL DEFAULT '1',
  created_by TEXT
);
