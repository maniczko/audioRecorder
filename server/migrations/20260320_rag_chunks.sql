CREATE TABLE IF NOT EXISTS rag_chunks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  recording_id TEXT NOT NULL,
  speaker_name TEXT,
  text TEXT NOT NULL,
  embedding_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_ws ON rag_chunks(workspace_id);
