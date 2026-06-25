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
  locked_by TEXT NOT NULL DEFAULT '',
  locked_until TEXT NOT NULL DEFAULT '',
  next_run_at TEXT NOT NULL,
  last_error_code TEXT NOT NULL DEFAULT '',
  last_error_message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transcription_jobs_active_recording
  ON transcription_jobs(recording_id)
  WHERE status IN ('queued', 'running', 'retryable_failed');

CREATE INDEX IF NOT EXISTS idx_transcription_jobs_queue
  ON transcription_jobs(status, next_run_at, locked_until);

CREATE INDEX IF NOT EXISTS idx_transcription_jobs_recording
  ON transcription_jobs(recording_id);

CREATE TABLE IF NOT EXISTS voice_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  speaker_name TEXT NOT NULL,
  audio_path TEXT NOT NULL,
  embedding_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
