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
