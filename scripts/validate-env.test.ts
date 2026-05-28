import { describe, expect, it } from 'vitest';

import { validateEnvironmentSnapshot } from './validate-env.js';

function createBaseEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    VITE_DATA_PROVIDER: 'remote',
    VITE_MEDIA_PROVIDER: 'remote',
    VITE_API_BASE_URL: 'http://127.0.0.1:4000',
    VOICELOG_API_PORT: '4000',
    OPENAI_API_KEY: 'sk-proj-test-key',
    ...overrides,
  };
}

// ---------------------------------------------------------------
// Issue #0 - validate-env should not fail on optional integrations
// Date: 2026-04-04
// Bug: the validator treated optional integrations as blocking errors
// Fix: only core runtime settings and STT availability block validation
// ---------------------------------------------------------------
describe('Regression: Issue #0 - validate-env should not fail on optional integrations', () => {
  it('does not block when optional feature keys are missing', () => {
    const report = validateEnvironmentSnapshot(
      createBaseEnv({
        VITE_GOOGLE_CLIENT_ID: undefined,
        ANTHROPIC_API_KEY: undefined,
        GEMINI_API_KEY: undefined,
        HF_TOKEN: undefined,
        LANGCHAIN_API_KEY: undefined,
        GITHUB_TOKEN: undefined,
      })
    );

    expect(report.blocking).toBe(false);
    expect(report.errors.map((entry) => entry.name)).not.toContain('ANTHROPIC_API_KEY');
    expect(report.errors.map((entry) => entry.name)).not.toContain('GEMINI_API_KEY');
    expect(report.errors.map((entry) => entry.name)).not.toContain('GITHUB_TOKEN');
  });

  it('blocks when no STT provider is configured', () => {
    const report = validateEnvironmentSnapshot(
      createBaseEnv({
        OPENAI_API_KEY: undefined,
        GROQ_API_KEY: undefined,
        USE_LOCAL_WHISPER: 'false',
        WHISPER_CPP_PATH: undefined,
      })
    );

    expect(report.blocking).toBe(true);
    expect(report.errors.map((entry) => entry.name)).toContain('STT_PROVIDER');
  });

  it('does not block when local Whisper is enabled without cloud STT keys', () => {
    const report = validateEnvironmentSnapshot(
      createBaseEnv({
        OPENAI_API_KEY: undefined,
        GROQ_API_KEY: undefined,
        USE_LOCAL_WHISPER: 'true',
        WHISPER_CPP_PATH: '/usr/bin/whisper',
      })
    );

    expect(report.blocking).toBe(false);
    expect(report.errors.map((entry) => entry.name)).not.toContain('STT_PROVIDER');
  });

  it('accepts the default GitHub Actions token format', () => {
    const report = validateEnvironmentSnapshot(
      createBaseEnv({
        GITHUB_TOKEN: 'ghs_1234567890',
      })
    );

    const githubTokenCheck = report.checks.find((entry) => entry.name === 'GITHUB_TOKEN');
    expect(githubTokenCheck?.status).toBe('ok');
  });

  it('accepts generic OpenAI secret keys and project keys', () => {
    const genericReport = validateEnvironmentSnapshot(
      createBaseEnv({
        OPENAI_API_KEY: 'sk-test-key',
      })
    );
    const projectReport = validateEnvironmentSnapshot(
      createBaseEnv({
        OPENAI_API_KEY: 'sk-proj-test-key',
      })
    );

    expect(genericReport.checks.find((entry) => entry.name === 'OPENAI_API_KEY')?.status).toBe(
      'ok'
    );
    expect(projectReport.checks.find((entry) => entry.name === 'OPENAI_API_KEY')?.status).toBe(
      'ok'
    );
  });

  it('blocks production deployments without persistent Supabase storage', () => {
    const report = validateEnvironmentSnapshot(
      createBaseEnv({
        NODE_ENV: 'production',
        VOICELOG_ALLOWED_ORIGINS: 'https://voicelog.example.com',
        SUPABASE_URL: undefined,
        SUPABASE_SERVICE_ROLE_KEY: undefined,
      })
    );

    expect(report.blocking).toBe(true);
    expect(report.errors.map((entry) => entry.name)).toEqual(
      expect.arrayContaining(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])
    );
  });

  it('accepts production storage and allowed origins when configured', () => {
    const report = validateEnvironmentSnapshot(
      createBaseEnv({
        NODE_ENV: 'production',
        VOICELOG_ALLOWED_ORIGINS: 'https://voicelog.example.com',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
      })
    );

    expect(report.errors.map((entry) => entry.name)).not.toContain('SUPABASE_URL');
    expect(report.errors.map((entry) => entry.name)).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(report.blocking).toBe(false);
  });

  it('accepts Supabase new secret key format for production storage', () => {
    const report = validateEnvironmentSnapshot(
      createBaseEnv({
        NODE_ENV: 'production',
        VOICELOG_ALLOWED_ORIGINS: 'https://voicelog.example.com',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test_key',
      })
    );

    const keyCheck = report.checks.find((entry) => entry.name === 'SUPABASE_SERVICE_ROLE_KEY');
    expect(keyCheck?.status).toBe('ok');
    expect(report.blocking).toBe(false);
  });

  it('blocks production when DATABASE_URL uses an incomplete Supabase host', () => {
    const report = validateEnvironmentSnapshot(
      createBaseEnv({
        NODE_ENV: 'production',
        VOICELOG_ALLOWED_ORIGINS: 'https://voicelog.example.com',
        SUPABASE_URL: 'https://jfvlwcjmsfewlugdhghq.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
        DATABASE_URL:
          'postgresql://postgres:super-secret@postgres.jfvlwcjmsfewlugdhghq:5432/postgres',
      })
    );

    const databaseCheck = report.errors.find((entry) => entry.name === 'DATABASE_URL');
    expect(report.blocking).toBe(true);
    expect(databaseCheck?.status).toBe('invalid');
    expect(databaseCheck?.preview).not.toContain('super-secret');
    expect(databaseCheck?.preview).toContain('postgres.jfvlwcjmsfewlugdhghq');
  });

  it('accepts complete Supabase Postgres and pooler hosts in production', () => {
    const directReport = validateEnvironmentSnapshot(
      createBaseEnv({
        NODE_ENV: 'production',
        VOICELOG_ALLOWED_ORIGINS: 'https://voicelog.example.com',
        SUPABASE_URL: 'https://jfvlwcjmsfewlugdhghq.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
        DATABASE_URL:
          'postgresql://postgres:secret@db.jfvlwcjmsfewlugdhghq.supabase.co:5432/postgres',
      })
    );
    const poolerReport = validateEnvironmentSnapshot(
      createBaseEnv({
        NODE_ENV: 'production',
        VOICELOG_ALLOWED_ORIGINS: 'https://voicelog.example.com',
        SUPABASE_URL: 'https://jfvlwcjmsfewlugdhghq.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
        DATABASE_URL:
          'postgresql://postgres.jfvlwcjmsfewlugdhghq:secret@aws-0-eu-central-1.pooler.supabase.com:6543/postgres',
      })
    );

    expect(directReport.errors.map((entry) => entry.name)).not.toContain('DATABASE_URL');
    expect(poolerReport.errors.map((entry) => entry.name)).not.toContain('DATABASE_URL');
  });
});
