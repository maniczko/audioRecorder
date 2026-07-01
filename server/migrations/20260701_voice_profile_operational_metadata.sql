-- Add operational metadata for voice profile provenance and refresh tracking.
ALTER TABLE voice_profiles ADD COLUMN updated_at TEXT;
ALTER TABLE voice_profiles ADD COLUMN profile_source TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE voice_profiles ADD COLUMN embedding_model TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE voice_profiles ADD COLUMN embedding_version TEXT NOT NULL DEFAULT '1';
ALTER TABLE voice_profiles ADD COLUMN created_by TEXT;
