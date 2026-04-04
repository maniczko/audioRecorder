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
});
