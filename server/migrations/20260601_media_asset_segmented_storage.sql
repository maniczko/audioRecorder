ALTER TABLE media_assets ADD COLUMN storage_mode TEXT NOT NULL DEFAULT 'single';
ALTER TABLE media_assets ADD COLUMN media_manifest_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE media_assets ADD COLUMN source_size_bytes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE media_assets ADD COLUMN normalized_size_bytes INTEGER NOT NULL DEFAULT 0;
