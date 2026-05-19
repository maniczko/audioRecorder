ALTER TABLE workspace_state
  ADD COLUMN vocabulary_json TEXT NOT NULL DEFAULT '[]';
