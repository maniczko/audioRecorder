import { describe, test, expect, vi, beforeEach } from 'vitest';
import { resolveServerPort, buildLocalHealthUrl, resolveBuildMetadata } from '../runtime.ts';

describe('runtime.ts', () => {
  describe('resolveServerPort', () => {
    test('uses VOICELOG_API_PORT when PORT not set', () => {
      expect(resolveServerPort({ VOICELOG_API_PORT: 5000 })).toBe(5000);
    });

    test('uses PORT when set', () => {
      expect(resolveServerPort({ PORT: 3000 })).toBe(3000);
    });

    test('PORT takes precedence over VOICELOG_API_PORT', () => {
      expect(resolveServerPort({ PORT: 3000, VOICELOG_API_PORT: 5000 })).toBe(3000);
    });

    test('defaults to 4000 when neither set', () => {
      expect(resolveServerPort({})).toBe(4000);
    });

    test('handles undefined values', () => {
      expect(resolveServerPort({ VOICELOG_API_PORT: undefined, PORT: undefined })).toBe(4000);
    });
  });

  describe('buildLocalHealthUrl', () => {
    test('builds URL with correct port', () => {
      expect(buildLocalHealthUrl({ PORT: 5000 })).toBe('http://127.0.0.1:5000/health');
    });

    test('uses resolved port when PORT not set', () => {
      expect(buildLocalHealthUrl({ VOICELOG_API_PORT: 6000 })).toBe('http://127.0.0.1:6000/health');
    });
  });

  describe('resolveBuildMetadata', () => {
    beforeEach(() => {
      delete process.env.RAILWAY_GIT_COMMIT_SHA;
      delete process.env.VERCEL_GIT_COMMIT_SHA;
      delete process.env.GITHUB_SHA;
      delete process.env.BUILD_TIME;
      delete process.env.APP_BUILD_TIME;
      delete process.env.APP_VERSION;
      delete process.env.npm_package_version;
      delete process.env.RAILWAY_ENVIRONMENT;
      delete process.env.RAILWAY_PROJECT_ID;
      delete process.env.VERCEL;
    });

    test('returns defaults when no env vars set', () => {
      const result = resolveBuildMetadata({}, '0.0.0');
      expect(result.gitSha).toBe('unknown');
      expect(result.appVersion).toBe('0.0.0');
    });

    test('uses RAILWAY_GIT_COMMIT_SHA for gitSha', () => {
      const result = resolveBuildMetadata({ RAILWAY_GIT_COMMIT_SHA: 'abc123' });
      expect(result.gitSha).toBe('abc123');
    });

    test('uses VERCEL_GIT_COMMIT_SHA as fallback for gitSha', () => {
      const result = resolveBuildMetadata({ VERCEL_GIT_COMMIT_SHA: 'vercel456' });
      expect(result.gitSha).toBe('vercel456');
    });

    test('uses GITHUB_SHA as fallback for gitSha', () => {
      const result = resolveBuildMetadata({ GITHUB_SHA: 'gh789' });
      expect(result.gitSha).toBe('gh789');
    });

    test('uses BUILD_TIME for buildTime', () => {
      const result = resolveBuildMetadata({ BUILD_TIME: '2026-01-01' });
      expect(result.buildTime).toBe('2026-01-01');
    });

    test('uses APP_VERSION for appVersion', () => {
      const result = resolveBuildMetadata({ APP_VERSION: '2.0.0' });
      expect(result.appVersion).toBe('2.0.0');
    });

    test('detects Railway runtime', () => {
      const result = resolveBuildMetadata({ RAILWAY_ENVIRONMENT: 'production' });
      expect(result.runtime).toBe('railway');
    });

    test('detects Railway runtime via PROJECT_ID', () => {
      const result = resolveBuildMetadata({ RAILWAY_PROJECT_ID: 'proj-123' });
      expect(result.runtime).toBe('railway');
    });

    test('detects Vercel runtime', () => {
      const result = resolveBuildMetadata({ VERCEL: '1' });
      expect(result.runtime).toBe('vercel');
    });

    test('defaults to node runtime', () => {
      const result = resolveBuildMetadata({});
      expect(result.runtime).toBe('node');
    });

    test('Railway takes precedence over Vercel', () => {
      const result = resolveBuildMetadata({
        RAILWAY_ENVIRONMENT: 'staging',
        VERCEL: '1',
      });
      expect(result.runtime).toBe('railway');
    });
  });
});
