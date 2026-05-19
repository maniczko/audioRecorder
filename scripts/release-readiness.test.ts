import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { findBuildWarnings } from './audit-build-warnings.mjs';
import { findMojibakeIssues } from './audit-mojibake.mjs';
import {
  collectFrontendAssetUrls,
  evaluateHealthPayload,
  findMojibake,
} from './production-smoke.mjs';
import { assertNode22, releaseGateCommands } from './release-rehearsal.mjs';

const rootDir = process.cwd();

function read(relativePath: string) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

describe('release readiness gates', () => {
  it('requires the full rehearsal to run on Node 22', () => {
    expect(() => assertNode22('22.17.1')).not.toThrow();
    expect(() => assertNode22('24.14.0')).toThrow('Node 22.x');
  });

  it('keeps the canonical rehearsal gate complete', () => {
    const commandText = releaseGateCommands.map(([command, args]) => [command, ...args].join(' '));

    expect(commandText).toContain('pnpm run typecheck:all');
    expect(commandText).toContain('pnpm run lint:all');
    expect(commandText).toContain('pnpm run lint:css');
    expect(commandText).toContain('pnpm run audit:build-warnings');
    expect(commandText).toContain('pnpm run test:server:retry');
    expect(commandText).toContain('pnpm run test:frontend:ci');
    expect(commandText).toContain('pnpm audit --audit-level=high');
    expect(commandText).toContain('pnpm run audit:a11y:ci');
    expect(commandText).toContain('pnpm run test:visual:check');
    expect(commandText).toContain('pnpm run test:e2e:advanced');
    expect(commandText).toContain('pnpm run test:e2e:remote-api');
  });

  it('detects Vite and Rollup build warnings that block a 9/10 release', () => {
    expect(findBuildWarnings('build ok')).toEqual([]);
    expect(findBuildWarnings('warning: %VITE_CLARITY_ID% is not defined')).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'vite-html-env-placeholder' })])
    );
    expect(
      findBuildWarnings('\n(!) Some chunks are larger than 500 kB after minification')
    ).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'rollup-large-chunk' })]));
  });

  it('rejects production health without remote Supabase persistence', () => {
    expect(evaluateHealthPayload({ ok: true, status: 'ok', supabaseRemote: true })).toEqual([]);
    expect(evaluateHealthPayload({ ok: true, status: 'ok', supabaseRemote: false })).toContain(
      'health supabaseRemote must be true in production'
    );
  });

  it('can require a known backend git SHA for production release evidence', () => {
    expect(
      evaluateHealthPayload(
        { ok: true, status: 'ok', supabaseRemote: true, gitSha: 'unknown' },
        { requireKnownGitSha: true }
      )
    ).toContain('health gitSha must be configured and cannot be unknown in production');
    expect(
      evaluateHealthPayload(
        { ok: true, status: 'ok', supabaseRemote: true, gitSha: 'abc123' },
        { requireKnownGitSha: true }
      )
    ).toEqual([]);
  });

  it('detects mojibake in production frontend text and assets', () => {
    expect(findMojibake('VoiceBóbr działa poprawnie')).toBeNull();
    expect(findMojibake('VoiceBĂłbr ma problem z kodowaniem')).toEqual(
      expect.objectContaining({ index: 6 })
    );
    expect(findMojibake('WiÄ™cej niĹĽ bĂłbr')).toEqual(expect.objectContaining({ index: 2 }));
  });

  it('collects same-origin frontend JS and CSS assets for production smoke', () => {
    const html = [
      '<script type="module" src="/assets/index.js"></script>',
      '<link rel="stylesheet" href="/assets/index.css">',
      '<script src="https://cdn.example.com/external.js"></script>',
    ].join('');

    expect(collectFrontendAssetUrls(html, 'https://voicelog.example.com')).toEqual([
      'https://voicelog.example.com/assets/index.js',
      'https://voicelog.example.com/assets/index.css',
    ]);
  });

  it('keeps package scripts wired to the release gates', () => {
    const packageJson = JSON.parse(read('package.json')) as {
      scripts?: Record<string, string>;
      workspaces?: unknown;
    };

    expect(packageJson.scripts?.['release:rehearsal']).toBe('node scripts/release-rehearsal.mjs');
    expect(packageJson.scripts?.['audit:build-warnings']).toBe(
      'node scripts/audit-build-warnings.mjs'
    );
    expect(packageJson.scripts?.['audit:mojibake']).toBe('node scripts/audit-mojibake.mjs');
    expect(packageJson.scripts?.['release:prod-smoke']).toBe('node scripts/production-smoke.mjs');
  });

  it('uses pnpm-workspace.yaml as the only workspace declaration', () => {
    const packageJson = JSON.parse(read('package.json')) as { workspaces?: unknown };
    const workspaceYaml = read('pnpm-workspace.yaml');

    expect(packageJson.workspaces).toBeUndefined();
    expect(workspaceYaml).toContain('server');
  });

  it('keeps CI release gates blocking for CSS, a11y, build warnings, and visual baselines', () => {
    const ci = read('.github/workflows/ci.yml');

    expect(ci).toContain('pnpm run lint:css');
    expect(ci).toContain('pnpm run audit:a11y:ci');
    expect(ci).toContain('pnpm run audit:build-warnings');
    expect(ci).toContain('pnpm run test:visual:check');
    expect(ci).toContain('runs-on: windows-latest');
  });

  it('keeps release-critical UI/config surfaces free of mojibake', () => {
    expect(findMojibakeIssues()).toEqual([]);
  });
});
