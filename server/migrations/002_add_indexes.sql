CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_media_assets_workspace_id ON media_assets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_meeting_id ON media_assets(meeting_id);
CREATE INDEX IF NOT EXISTS idx_voice_profiles_workspace_id ON voice_profiles(workspace_id);
