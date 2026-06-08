CREATE TABLE IF NOT EXISTS google_integrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'google_calendar',
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TEXT,
  scopes TEXT,
  provider_account_email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, workspace_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_google_integrations_user_workspace
  ON google_integrations(user_id, workspace_id);

CREATE TABLE IF NOT EXISTS google_oauth_states (
  state TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  return_to TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_google_oauth_states_user_workspace
  ON google_oauth_states(user_id, workspace_id);
