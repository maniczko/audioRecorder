ALTER TABLE workspace_state
  ADD COLUMN feature_flags_json TEXT NOT NULL DEFAULT '{}';
