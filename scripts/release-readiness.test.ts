import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { findBuildWarnings } from './audit-build-warnings.mjs';
import { findMojibakeIssues } from './audit-mojibake.mjs';
import {
  collectFrontendAssetUrls,
  evaluateHealthPayload,
  findMojibake,
  runProductionSmoke,
  runStaleRecordingSmoke,
  runVoiceProfileSmoke,
} from './production-smoke.mjs';
import {
  productionGateCommands,
  productionGateRequiredEnv,
  validateProductionGateEnv,
} from './release-prod-gate-strict.mjs';
import { assertNode22, releaseGateCommands } from './release-rehearsal.mjs';

const rootDir = process.cwd();

function read(relativePath: string) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

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
    expect(commandText).toContain('pnpm run audit:tooling');
    expect(commandText).toContain('pnpm run audit:ui-actions');
    expect(commandText).toContain('pnpm run test:ui-actions:contract');
    expect(commandText).toContain('pnpm run audit:build-warnings');
    expect(commandText).toContain('pnpm run test:server:retry');
    expect(commandText).toContain('pnpm run test:stt-corpus');
    expect(commandText).toContain('pnpm run test:frontend:ci');
    expect(commandText).toContain('pnpm audit --audit-level=high');
    expect(commandText).toContain('pnpm run audit:a11y:ci');
    expect(commandText).toContain('pnpm run test:skips:audit');
    expect(commandText).toContain('pnpm run test:visual:check');
    expect(commandText).toContain('pnpm run test:ui-actions');
    expect(commandText).toContain('pnpm run test:e2e');
    expect(commandText).toContain('pnpm run test:e2e:advanced');
    expect(commandText).toContain('pnpm run test:e2e:remote-api');
  });

  it('keeps the strict production gate focused on real production actions, persistence, smoke, and Sentry', () => {
    const commandText = productionGateCommands.map(([command, args]) =>
      [command, ...args].join(' ')
    );

    expect(commandText).toEqual([
      'pnpm run test:e2e:production-actions',
      'pnpm run test:e2e:production-persistence',
      'pnpm run release:prod-smoke:strict',
      'pnpm run verify:supabase:workspace',
      'pnpm run sentry:release-health',
    ]);
    expect(productionGateRequiredEnv).toEqual(
      expect.arrayContaining([
        'PRODUCTION_SMOKE_AUTH_TOKEN',
        'PRODUCTION_SMOKE_WORKSPACE_ID',
        'PRODUCTION_FRONTEND_URL',
        'PRODUCTION_API_BASE_URL',
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'SENTRY_AUTH_TOKEN',
        'SENTRY_ORG',
        'SENTRY_PROJECT',
      ])
    );
  });

  it('fails strict production gate config when required production secrets are missing', () => {
    expect(() => validateProductionGateEnv({})).toThrow('release:prod-gate:strict missing');
    expect(() =>
      validateProductionGateEnv({
        PRODUCTION_SMOKE_AUTH_TOKEN: 'token',
        PRODUCTION_SMOKE_WORKSPACE_ID: 'workspace',
        PRODUCTION_FRONTEND_URL: 'https://front.example',
        PRODUCTION_API_BASE_URL: 'https://api.example',
        SUPABASE_URL: 'https://project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        SENTRY_AUTH_TOKEN: 'sentry',
        SENTRY_ORG: 'org',
        SENTRY_PROJECT: 'project',
      })
    ).not.toThrow();
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
    expect(
      evaluateHealthPayload(
        {
          ok: true,
          status: 'ok',
          supabaseRemote: true,
          supabaseStorage: { ready: true, status: 'ready', bucket: 'recordings' },
        },
        { requirePremiumStt: false }
      )
    ).toEqual([]);
    expect(
      evaluateHealthPayload(
        { ok: true, status: 'ok', supabaseRemote: false },
        { requirePremiumStt: false }
      )
    ).toContain('health supabaseRemote must be true in production');
    expect(
      evaluateHealthPayload(
        {
          ok: true,
          status: 'ok',
          supabaseRemote: true,
          supabaseStorage: { ready: false, status: 'invalid_url', bucket: 'recordings' },
        },
        { requirePremiumStt: false }
      )
    ).toContain('health supabaseStorage.ready must be true in production');
  });

  it('requires premium OpenAI STT evidence in production health', () => {
    const premiumHealth = {
      ok: true,
      status: 'ok',
      supabaseRemote: true,
      supabaseStorage: { ready: true, status: 'ready', bucket: 'recordings' },
      stt: {
        policy: 'premium',
        provider: 'openai',
        fullModel: 'gpt-4o-transcribe',
        language: 'pl',
      },
    };
    expect(evaluateHealthPayload(premiumHealth)).toEqual([]);
    expect(
      evaluateHealthPayload({
        ...premiumHealth,
        stt: { ...premiumHealth.stt, provider: 'groq' },
      })
    ).toContain('health stt.provider must be openai, received groq');
  });

  it('can require a known backend git SHA for production release evidence', () => {
    expect(
      evaluateHealthPayload(
        {
          ok: true,
          status: 'ok',
          supabaseRemote: true,
          supabaseStorage: { ready: true, status: 'ready', bucket: 'recordings' },
          gitSha: 'unknown',
        },
        { requireKnownGitSha: true, requirePremiumStt: false }
      )
    ).toContain('health gitSha must be configured and cannot be unknown in production');
    expect(
      evaluateHealthPayload(
        {
          ok: true,
          status: 'ok',
          supabaseRemote: true,
          supabaseStorage: { ready: true, status: 'ready', bucket: 'recordings' },
          gitSha: 'abc123',
        },
        { requireKnownGitSha: true, requirePremiumStt: false }
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

  it('checks stale remote recordings with auth and workspace headers in production smoke', async () => {
    const fetchMock = vi.fn(async () => ({
      status: 404,
      text: async () => JSON.stringify({ message: 'Nie znaleziono nagrania.' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      runStaleRecordingSmoke({
        api: 'https://voicelog.example.com',
        authToken: 'token',
        workspaceId: 'workspace_1',
        staleRecordingId: 'recording_missing',
      })
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://voicelog.example.com/media/recordings/recording_missing/transcribe',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
          'X-Workspace-Id': 'workspace_1',
        }),
      })
    );
  });

  it('checks the premium voice-profile journey with auth and workspace headers in production smoke', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'vp_1',
          speakerName: 'Barbara',
          sampleCount: 1,
          hasEmbedding: true,
        }),
        text: async () => '',
        headers: new Headers({ 'content-type': 'application/json' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          profiles: [{ id: 'vp_1', speakerName: 'Barbara', sampleCount: 1, hasEmbedding: true }],
        }),
        text: async () => '',
        headers: new Headers({ 'content-type': 'application/json' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      runVoiceProfileSmoke({
        api: 'https://voicelog.example.com',
        authToken: 'token',
        workspaceId: 'workspace_1',
        recordingId: 'recording_voice_1',
        speakerId: 'speaker_2',
        speakerName: 'Barbara',
      })
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://voicelog.example.com/media/recordings/recording_voice_1/voice-profiles/from-speaker',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
          'X-Workspace-Id': 'workspace_1',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ speakerId: 'speaker_2', speakerName: 'Barbara' }),
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://voicelog.example.com/voice-profiles',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
          'X-Workspace-Id': 'workspace_1',
        }),
      })
    );
  });

  it('fails strict production smoke when the required voice-profile evidence is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/health')) {
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({
                ok: true,
                status: 'ok',
                supabaseRemote: true,
                supabaseStorage: { ready: true, status: 'ready', bucket: 'recordings' },
                gitSha: 'abc123',
              }),
          };
        }
        return {
          ok: true,
          status: 200,
          text: async () => '<div id="root">VoiceLog</div>',
        };
      })
    );

    await expect(
      runProductionSmoke({
        frontendUrl: 'https://voicelog.example.com',
        apiBaseUrl: 'https://voicelog.example.com',
        requireSupabaseRemote: false,
        requireKnownGitSha: false,
        requirePremiumStt: false,
        requireVoiceProfileSmoke: true,
      })
    ).rejects.toThrow(
      'Voice profile smoke requires PRODUCTION_SMOKE_AUTH_TOKEN, PRODUCTION_SMOKE_WORKSPACE_ID, PRODUCTION_SMOKE_VOICE_PROFILE_RECORDING_ID, PRODUCTION_SMOKE_VOICE_PROFILE_SPEAKER_ID, and PRODUCTION_SMOKE_VOICE_PROFILE_SPEAKER_NAME.'
    );
  });

  it('skips stale recording smoke only when auth or workspace evidence is missing', async () => {
    await expect(
      runStaleRecordingSmoke({
        api: 'https://voicelog.example.com',
        authToken: '',
        workspaceId: 'workspace_1',
      })
    ).resolves.toBe(false);
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
    expect(packageJson.scripts?.['audit:tooling']).toBe(
      'node scripts/tooling-readiness-audit.mjs --write-report'
    );
    expect(packageJson.scripts?.['audit:ui-actions']).toBe(
      'node scripts/audit-ui-action-contracts.mjs --write-report'
    );
    expect(packageJson.scripts?.['test:ui-actions']).toBe('playwright test tests/e2e/ui-actions');
    expect(packageJson.scripts?.['test:e2e:production-system']).toBe(
      'playwright test tests/e2e/production-system-audit.spec.js --project=chromium'
    );
    expect(packageJson.scripts?.['test:e2e:production-actions']).toBe(
      'playwright test tests/e2e/production-actions.spec.js --project=chromium'
    );
    expect(packageJson.scripts?.['release:prod-smoke']).toBe('node scripts/production-smoke.mjs');
    expect(packageJson.scripts?.['test:stt-corpus']).toBe('node scripts/stt-corpus-gate.mjs');
    expect(packageJson.scripts?.['release:prod-smoke:strict']).toBe(
      'node scripts/production-smoke-strict.mjs'
    );
    expect(packageJson.scripts?.['verify:supabase:workspace']).toBe(
      'node scripts/verify-supabase-workspace-consistency.mjs --strict --write-report'
    );
    expect(packageJson.scripts?.['sentry:release-health']).toBe(
      'node scripts/sentry-release-health.mjs'
    );
    expect(packageJson.scripts?.['test:skips:audit']).toBe('node scripts/audit-test-skips.mjs');
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
    expect(ci).not.toMatch(/Validate environment contract[\s\S]{0,160}continue-on-error:\s*true/);
  });

  it('requires production deploy smoke to cover stale recordings, voice profiles, and Sentry release health', () => {
    const workflow = read('.github/workflows/vercel-production.yml');

    expect(workflow).toContain('PRODUCTION_REQUIRE_STALE_RECORDING_SMOKE');
    expect(workflow).toContain('PRODUCTION_SMOKE_STALE_RECORDING_ID');
    expect(workflow).toContain('PRODUCTION_REQUIRE_VOICE_PROFILE_SMOKE');
    expect(workflow).toContain('PRODUCTION_SMOKE_VOICE_PROFILE_RECORDING_ID');
    expect(workflow).toContain('SUPABASE_URL: ${{ secrets.SUPABASE_URL }}');
    expect(workflow).toContain(
      'SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}'
    );
    expect(workflow).toContain('pnpm run release:prod-smoke:strict');
    expect(workflow).toContain('pnpm run sentry:release-health');
    expect(workflow).toContain('SENTRY_AUTH_TOKEN');
  });

  it('keeps production action crawler evidence as uploaded CI artifacts', () => {
    const workflow = read('.github/workflows/production-system-audit.yml');
    const productionActionsSpec = read('tests/e2e/production-actions.spec.js');

    expect(workflow).toContain('pnpm run test:e2e:production-system');
    expect(workflow).toContain('pnpm run release:prod-gate:strict');
    expect(workflow).toContain('reports/production-action-crawler/');
    expect(productionActionsSpec).toContain('production-action-crawler-report.json');
    expect(productionActionsSpec).toContain('production-action-crawler');
    expect(productionActionsSpec).toContain('missing-feedback');
    expect(productionActionsSpec).toContain('runtime-failure');
  });

  it('keeps Vercel rewrites aligned with backend route prefixes used by the frontend', () => {
    const vercelConfig = JSON.parse(read('vercel.json')) as {
      rewrites?: Array<{ source?: string; destination?: string }>;
    };
    const rewriteSources = new Set(
      (vercelConfig.rewrites || []).map((rewrite) => String(rewrite.source || ''))
    );

    for (const source of [
      '/health',
      '/api/:path*',
      '/auth/:path*',
      '/media/:path*',
      '/voice-profiles/:path*',
      '/transcribe',
      '/ai/:path*',
    ]) {
      expect(rewriteSources).toContain(source);
    }
  });

  it('keeps the error monitor issue-driven instead of committing root TASK_QUEUE.md', () => {
    const workflow = read('.github/workflows/error-monitor-and-task-creator.yml');

    expect(workflow).not.toContain("fs.writeFileSync('./TASK_QUEUE.md'");
    expect(workflow).not.toContain('git add TASK_QUEUE.md');
    expect(workflow).not.toContain('--no-verify');
    expect(workflow).toContain('docs/automation/TASK_QUEUE.md');
    expect(workflow).toContain('Regression test path');
    expect(workflow).toContain('Target command');
  });

  it('prevents scheduled error monitoring from committing task queue changes to main', () => {
    const workflow = read('.github/workflows/error-monitor-and-task-creator.yml');

    expect(workflow).toContain(
      "github.event_name == 'workflow_dispatch' && github.event.inputs.create_tasks == 'true'"
    );
    expect(workflow).not.toContain("github.event.inputs.create_tasks != 'false'");
    expect(workflow).toContain('Create GitHub Issues for Errors');
  });

  it('keeps production deploys ordered behind Railway verification with exact backend SHA', () => {
    const railwayWorkflow = read('.github/workflows/railway-build-metadata.yml');
    const backendSmokeWorkflow = read('.github/workflows/backend-production-smoke.yml');
    const vercelWorkflow = read('.github/workflows/vercel-production.yml');

    expect(railwayWorkflow).toContain("workflows: ['CI']");
    expect(railwayWorkflow).toContain('github.event.workflow_run.head_sha || github.sha');
    expect(railwayWorkflow).not.toContain('BUILD_SHA: ${{ github.sha }}');
    expect(railwayWorkflow).not.toContain('EXPECTED_SHA: ${{ github.sha }}');
    expect(railwayWorkflow).toContain('cancel-in-progress: true');
    expect(railwayWorkflow).toContain('timeout-minutes: 30');
    expect(railwayWorkflow).toContain('--detach');
    expect(railwayWorkflow).toContain('for attempt in 1 2 3');
    expect(railwayWorkflow).toContain('Railway deploy failed after 3 attempts');
    expect(railwayWorkflow).toContain('seq 1 60');
    expect(railwayWorkflow).toContain('--skip-deploys');
    expect(railwayWorkflow).toContain('set_railway_variable_with_retry()');
    expect(railwayWorkflow).toContain('Railway variable set failed after 3 attempts for $name');
    expect(backendSmokeWorkflow).toContain("workflows: ['Railway Build Metadata']");
    expect(backendSmokeWorkflow).toContain("REQUIRE_EXACT_GIT_SHA: 'true'");
    expect(vercelWorkflow).toContain("workflows: ['Railway Build Metadata']");
  });

  it('keeps Railway storage secrets synchronized with the production database', () => {
    const workflow = read('.github/workflows/railway-sync-database-url.yml');

    expect(workflow).toContain('SUPABASE_URL: ${{ secrets.SUPABASE_URL }}');
    expect(workflow).toContain(
      'SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}'
    );
    expect(workflow).toContain('railway variable set');
    expect(workflow).toContain('SUPABASE_URL');
    expect(workflow).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('requires the production system audit to prove write-delete-refresh persistence', () => {
    const spec = read('tests/e2e/production-system-audit.spec.js');
    const workflow = read('.github/workflows/production-system-audit.yml');

    expect(spec).toContain('audit_20260524_');
    expect(spec).toContain('/state/workspaces/');
    expect(spec).toContain('removeIds');
    expect(spec).toContain('does not return after refresh');
    expect(workflow).toContain('SUPABASE_URL: ${{ secrets.SUPABASE_URL }}');
    expect(workflow).toContain(
      'SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}'
    );
  });

  it('requires the production system audit to cover notes, people, calendar, and recording shell persistence', () => {
    const spec = read('tests/e2e/production-system-audit.spec.js');

    expect(spec).toContain('note meeting');
    expect(spec).toContain('people and calendar meeting');
    expect(spec).toContain('recording shell meeting');
    expect(spec).toContain('calendarMeta');
    expect(spec).toContain('recordings:');
  });

  it('requires the production system audit to cover Studio voice-profile UI controls', () => {
    const spec = read('tests/e2e/production-system-audit.spec.js');
    const workflow = read('.github/workflows/production-system-audit.yml');

    expect(workflow).toContain('PRODUCTION_SMOKE_VOICE_PROFILE_RECORDING_ID');
    expect(workflow).toContain('PRODUCTION_SMOKE_VOICE_PROFILE_SPEAKER_ID');
    expect(workflow).toContain('PRODUCTION_SMOKE_VOICE_PROFILE_SPEAKER_NAME');
    expect(spec).toContain('PRODUCTION_SMOKE_VOICE_PROFILE_RECORDING_ID');
    expect(spec).toContain('from-speaker/preflight');
    expect(spec).toContain('voice-profile UI journey');
    expect(spec).toContain('Nowy m');
    expect(spec).toContain('Nazwa nowego mowcy');
  });

  it('prevents production Playwright audits from starting a local web server', () => {
    const playwrightConfig = read('playwright.config.js');
    const workflow = read('.github/workflows/production-system-audit.yml');

    expect(playwrightConfig).toContain('PLAYWRIGHT_SKIP_WEB_SERVER');
    expect(playwrightConfig).toContain('isLocalPlaywrightTarget');
    expect(playwrightConfig).toContain('webServer: shouldStartWebServer');
    expect(workflow).toContain("PLAYWRIGHT_SKIP_WEB_SERVER: 'true'");
  });

  it('keeps release-critical UI/config surfaces free of mojibake', () => {
    expect(findMojibakeIssues()).toEqual([]);
  }, 20_000);

  it('keeps test contracts and UI action docs free of mojibake', () => {
    expect(findMojibakeIssues({ targets: ['docs/testing', 'docs/ui-actions'] })).toEqual([]);
  }, 20_000);
});
