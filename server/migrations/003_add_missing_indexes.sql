-- Migration 003: Add missing indexes for performance optimization
-- Created: 2026-03-20
-- Purpose: Improve query performance for frequently accessed columns

-- NOTE: meetings are stored as JSON in workspace_state.meetings_json — no standalone meetings table exists

-- ============================================
-- MEDIA_ASSETS TABLE INDEXES
-- ============================================

-- Filter by transcription status (queued, processing, completed, failed)
CREATE INDEX IF NOT EXISTS idx_media_assets_transcription_status ON media_assets(transcription_status);

-- Recent assets ordering
CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON media_assets(created_at DESC);

-- Assets by meeting (for meeting detail view)
CREATE INDEX IF NOT EXISTS idx_media_assets_meeting_id ON media_assets(meeting_id);

-- Composite index for meeting assets with status filtering
CREATE INDEX IF NOT EXISTS idx_media_assets_meeting_status ON media_assets(meeting_id, transcription_status);

-- ============================================
-- USERS TABLE INDEXES
-- ============================================

-- Provider-based authentication lookups
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider);

-- Google OAuth sub lookup
CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);

-- Recovery code expiration cleanup
CREATE INDEX IF NOT EXISTS idx_users_recovery_expires ON users(recovery_code_expires_at);

-- ============================================
-- WORKSPACE_STATE TABLE INDEXES
-- ============================================

-- Sync operations - find recently updated workspaces
CREATE INDEX IF NOT EXISTS idx_workspace_state_updated_at ON workspace_state(updated_at DESC);

-- ============================================
-- VOICE_PROFILES TABLE INDEXES
-- ============================================

-- User's voice profiles
CREATE INDEX IF NOT EXISTS idx_voice_profiles_user_id ON voice_profiles(user_id);

-- Recent profiles ordering
CREATE INDEX IF NOT EXISTS idx_voice_profiles_created_at ON voice_profiles(created_at DESC);

-- Workspace voice profiles
CREATE INDEX IF NOT EXISTS idx_voice_profiles_workspace_id ON voice_profiles(workspace_id);

-- ============================================
-- SESSIONS TABLE ADDITIONAL INDEXES
-- ============================================

-- Session cleanup by expiration
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Active sessions by user
CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON sessions(user_id, expires_at DESC);

-- ============================================
-- WORKSPACE_MEMBERS TABLE ADDITIONAL INDEXES
-- ============================================

-- User's workspaces lookup
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);

