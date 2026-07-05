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
