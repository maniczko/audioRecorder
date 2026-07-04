DROP TABLE IF EXISTS transcription_jobs_v2;

CREATE TABLE transcription_jobs_v2 (
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
  CHECK (
    status IN (
      'queued',
      'running',
      'retryable_failed',
      'failed',
      'dead_letter',
      'completed',
      'cancelled'
    )
  )
);

INSERT INTO transcription_jobs_v2 (
  id,
  recording_id,
  workspace_id,
  meeting_id,
  status,
  attempt_count,
  max_attempts,
  locked_by,
  locked_until,
  next_run_at,
  last_error_code,
  last_error_message,
  created_at,
  updated_at,
  completed_at
)
SELECT
  id,
  recording_id,
  workspace_id,
  meeting_id,
  status,
  attempt_count,
  max_attempts,
  locked_by,
  locked_until,
  next_run_at,
  last_error_code,
  last_error_message,
  created_at,
  updated_at,
  completed_at
FROM transcription_jobs;

DROP TABLE transcription_jobs;

ALTER TABLE transcription_jobs_v2 RENAME TO transcription_jobs;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transcription_jobs_one_active_per_recording
  ON transcription_jobs(recording_id)
  WHERE status IN ('queued', 'running', 'retryable_failed');

CREATE INDEX IF NOT EXISTS idx_transcription_jobs_lease_queue
  ON transcription_jobs(status, next_run_at, locked_until, created_at);

CREATE INDEX IF NOT EXISTS idx_transcription_jobs_recording_id
  ON transcription_jobs(recording_id);

