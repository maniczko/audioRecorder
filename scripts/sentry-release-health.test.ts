import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  classifySentryIssue,
  createSentryReleaseHealthConfig,
  runSentryReleaseHealth,
} from './sentry-release-health.mjs';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('sentry-release-health', () => {
  it('fails production release health when SENTRY_AUTH_TOKEN is missing', () => {
    vi.stubEnv('SENTRY_RELEASE', 'abc123');
    vi.stubEnv('SENTRY_ENVIRONMENT', 'production');

    expect(() => createSentryReleaseHealthConfig()).toThrow(
      'SENTRY_AUTH_TOKEN is required for production release health.'
    );
  });

  it('classifies fatal and error issues as blocking release evidence', () => {
    expect(
      classifySentryIssue({
        title: 'TypeError: Cannot read properties of undefined',
        level: 'error',
        count: '1',
        permalink: 'https://sentry.example/issues/1',
      })
    ).toEqual(expect.objectContaining({ severity: 'P1', blocking: true }));

    expect(
      classifySentryIssue({
        title: 'Handled audio_source_unavailable',
        level: 'warning',
        count: '1',
      })
    ).toEqual(expect.objectContaining({ severity: 'P2', blocking: false }));
  });

  it('blocks repeated handled premium-action warnings above the configured threshold', () => {
    expect(
      classifySentryIssue(
        {
          title: 'voice-profiles/from-speaker audio_source_unavailable',
          level: 'warning',
          count: '6',
        },
        { warningThreshold: 5 }
      )
    ).toEqual(expect.objectContaining({ severity: 'P1', blocking: true }));
  });

  it('queries Sentry for the release SHA and fails on blocking issues', async () => {
    vi.stubEnv('SENTRY_AUTH_TOKEN', 'token');
    vi.stubEnv('SENTRY_ORG', 'voice-org');
    vi.stubEnv('SENTRY_PROJECT', 'frontend');
    vi.stubEnv('SENTRY_RELEASE', 'abc123');
    vi.stubEnv('SENTRY_ENVIRONMENT', 'production');

    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain('release%3Aabc123');
      expect(url).toContain('environment%3Aproduction');
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            id: 'issue-1',
            title: 'Unhandled TypeError in Studio',
            level: 'error',
            count: '1',
            permalink: 'https://sentry.example/issues/1',
          },
        ],
        text: async () => '[]',
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(runSentryReleaseHealth()).rejects.toThrow(
      'Sentry release health failed with 1 blocking issue(s).'
    );
  });

  it('passes with only non-blocking warning issues and reports them for GitHub triage', async () => {
    vi.stubEnv('SENTRY_AUTH_TOKEN', 'token');
    vi.stubEnv('SENTRY_ORG', 'voice-org');
    vi.stubEnv('SENTRY_PROJECT', 'frontend');
    vi.stubEnv('SENTRY_RELEASE', 'abc123');
    vi.stubEnv('SENTRY_ENVIRONMENT', 'production');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => [
          {
            id: 'issue-2',
            title: 'Handled audio_source_unavailable',
            level: 'warning',
            count: '1',
          },
        ],
        text: async () => '[]',
      }))
    );

    await expect(runSentryReleaseHealth()).resolves.toEqual(
      expect.objectContaining({
        blockingIssues: [],
        triageIssues: [expect.objectContaining({ severity: 'P2' })],
      })
    );
  });
});
