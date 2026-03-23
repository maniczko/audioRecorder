-- Add multi-sample enrollment support to voice_profiles
-- sample_count: number of audio samples averaged into this profile (max 5)
-- threshold: per-profile cosine similarity threshold for auto-label (0.70–0.95)
ALTER TABLE voice_profiles ADD COLUMN sample_count INTEGER DEFAULT 1;
ALTER TABLE voice_profiles ADD COLUMN threshold REAL DEFAULT 0.82;
