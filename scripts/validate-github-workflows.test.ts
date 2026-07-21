/* eslint-disable no-template-curly-in-string */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const workflowDir = path.resolve('.github/workflows');
const suspiciousMojibakePattern =
  /[\u0102\u00c4]\S*|\u00e2[\u20ac\u2022\u2020\u201d\u2122]?|\u0111\u017a|\ufffd/u;

describe('GitHub workflows validation', () => {
  it('parses every workflow file and keeps required top-level keys', async () => {
    const { readdirSync } = await import('node:fs');
    const workflowFiles = readdirSync(workflowDir).filter((entry) => entry.endsWith('.yml'));

    for (const fileName of workflowFiles) {
      const filePath = path.join(workflowDir, fileName);
      const parsed = parse(readFileSync(filePath, 'utf8')) as {
        name?: unknown;
        on?: unknown;
        jobs?: unknown;
      } | null;

      expect(parsed, fileName).toBeTruthy();
      expect(typeof parsed?.name, fileName).toBe('string');
      expect(parsed && 'on' in parsed, fileName).toBe(true);
      expect(parsed && 'jobs' in parsed, fileName).toBe(true);
    }
  });

  it('rejects the mojibake pattern that broke workflow loading before', () => {
    const brokenSample =
      "name: Broken\non:\n  push:\n    branches: [main]\njobs:\n  bad:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo 'Ä‚â€žĂ˘â‚¬ÂĂ„Ä…ÄąĹş broken'\n";

    expect(suspiciousMojibakePattern.test(brokenSample)).toBe(true);
  });

  it('does not flag the restored CI workflow as mojibake', () => {
    const workflowPath = path.join(workflowDir, 'ci.yml');
    const content = readFileSync(workflowPath, 'utf8');

    expect(suspiciousMojibakePattern.test(content)).toBe(false);
  });

  it('keeps Docker cache export non-blocking and workflow logs UTF-8 clean', () => {
    const workflowPath = path.join(workflowDir, 'docker-build.yml');
    const content = readFileSync(workflowPath, 'utf8');

    expect(content).toContain('cache-to: type=gha,mode=max,ignore-error=true');
    expect(suspiciousMojibakePattern.test(content)).toBe(false);
  });

  it('keeps the CI security audit report while blocking only high and critical findings', () => {
    const workflowPath = path.join(workflowDir, 'ci.yml');
    const content = readFileSync(workflowPath, 'utf8');

    expect(content).toContain('pnpm audit --audit-level=high --json > audit-report.json || true');
    expect(content).toContain('report.metadata?.vulnerabilities');
    expect(content).toContain('high > 0 || critical > 0');
  });

  it('routes every main CI job through one named installation profile', () => {
    const workflowPath = path.join(workflowDir, 'ci.yml');
    const parsed = parse(readFileSync(workflowPath, 'utf8')) as {
      jobs?: Record<
        string,
        {
          steps?: Array<{
            name?: string;
            run?: string;
            uses?: string;
            with?: Record<string, unknown>;
          }>;
        }
      >;
    } | null;
    const jobs = parsed?.jobs ?? {};

    for (const [jobName, job] of Object.entries(jobs)) {
      const steps = job.steps ?? [];
      const setupStep = steps.find((step) => step.uses === './.github/actions/setup-node-pnpm');

      expect(setupStep, `${jobName} canonical setup`).toBeTruthy();
      expect(setupStep?.with?.['install-profile'], `${jobName} install profile`).toMatch(
        /^(pure-js|native)$/u
      );
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // Issue #1514 — canonical GitHub Actions Node and pnpm toolchain
  // Date: 2026-07-21
  // Bug: workflows mixed Corepack with direct pnpm action setup, so the
  //      package-manager version and install strategy could drift.
  // Fix: every workflow that invokes pnpm delegates setup and installation
  //      to the repository-owned composite action.
  // ─────────────────────────────────────────────────────────────────
  it('uses the canonical Node 22 and pnpm setup action for every pnpm workflow', async () => {
    const { readdirSync } = await import('node:fs');
    const workflowFiles = readdirSync(workflowDir).filter((entry) => entry.endsWith('.yml'));

    for (const fileName of workflowFiles) {
      const content = readFileSync(path.join(workflowDir, fileName), 'utf8');
      const parsed = parse(content) as {
        jobs?: Record<
          string,
          {
            steps?: Array<{
              run?: string;
              uses?: string;
            }>;
          }
        >;
      };
      for (const [jobName, job] of Object.entries(parsed.jobs ?? {})) {
        const invokesPnpm = (job.steps ?? []).some((step) =>
          (step.run ?? '')
            .split(/\r?\n/u)
            .some((line) => !line.trimStart().startsWith('#') && /\bpnpm\b/u.test(line))
        );

        if (!invokesPnpm) {
          continue;
        }

        expect(
          (job.steps ?? []).some((step) => step.uses === './.github/actions/setup-node-pnpm'),
          `${fileName} ${jobName}`
        ).toBe(true);
      }

      expect(content, fileName).not.toContain('corepack enable');
      expect(content, fileName).not.toContain('uses: pnpm/action-setup@');
    }
  });

  it('pins pnpm 9.12.1, Node 22, cache and install profiles in the shared action', () => {
    const actionPath = path.resolve('.github/actions/setup-node-pnpm/action.yml');
    const content = readFileSync(actionPath, 'utf8');

    expect(content).toContain('uses: pnpm/action-setup@v6');
    expect(content).toContain('version: 9.12.1');
    expect(content).toContain('uses: actions/setup-node@v6');
    expect(content).toContain("node-version: '22'");
    expect(content).toContain('cache: pnpm');
    expect(content).toContain('pnpm install --frozen-lockfile --ignore-scripts');
    expect(content).toContain('for attempt in 1 2 3');
    expect(content).toContain('Dependency installation failed before tests started');
  });

  it('rejects a future workflow that mixes direct pnpm setup or installation back in', async () => {
    const { validateWorkflowContent } = await import('./validate-github-workflows.mjs');
    const directPnpmSetup = [
      'name: Broken setup',
      'on: workflow_dispatch',
      'jobs:',
      '  verify:',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - uses: pnpm/action-setup@v6',
      '      - run: pnpm install --frozen-lockfile',
    ].join('\n');

    expect(() => validateWorkflowContent(directPnpmSetup, 'broken.yml')).toThrow(
      'direct pnpm action setup is not allowed'
    );
  });

  it('uses the shared cache-owning action in backend production smoke', () => {
    const workflowPath = path.join(workflowDir, 'backend-production-smoke.yml');
    const content = readFileSync(workflowPath, 'utf8');

    expect(content).toContain('uses: ./.github/actions/setup-node-pnpm');
    expect(content).toContain('install-profile: pure-js');
    expect(content).not.toContain('uses: actions/cache@');
  });

  it('keeps CodeQL security scanning enabled on current action majors', () => {
    const workflowPath = path.join(workflowDir, 'codeql.yml');
    const content = readFileSync(workflowPath, 'utf8');

    expect(existsSync(workflowPath)).toBe(true);
    expect(content).toContain('uses: actions/checkout@v7');
    expect(content).toContain('uses: github/codeql-action/init@v4');
    expect(content).toContain('uses: github/codeql-action/analyze@v4');
    expect(content).toContain('queries: +security-and-quality');
  });

  it('keeps production readiness queue reconciliation blocking stale PR work', () => {
    const workflowPath = path.join(workflowDir, 'codex-production-readiness-queue.yml');
    const content = readFileSync(workflowPath, 'utf8');
    const parsed = parse(content) as {
      on?: {
        workflow_dispatch?: { inputs?: { mode?: { options?: string[] } } };
        schedule?: unknown[];
      };
      permissions?: Record<string, string>;
    } | null;

    expect(parsed?.on?.workflow_dispatch?.inputs?.mode?.options).toContain('reconcile');
    expect(parsed?.on?.schedule).toBeTruthy();
    expect(parsed?.permissions?.checks).toBe('read');
    expect(parsed?.permissions?.actions).toBe('read');
    expect(parsed?.permissions?.['pull-requests']).toBe('write');
    expect(content).toContain('codex:checks-failed');
    expect(content).toContain('sync_pr_checks');
    expect(content).toContain('reconcile_open_prs');
    expect(content).toContain('if [ "$MODE" = "reconcile" ]; then reconcile_open_prs; exit 0; fi');
  });

  it('runs compressed-size-action with the package-manager build command', () => {
    const workflowNames = ['bundle-size.yml', 'code-review.yml'];

    for (const workflowName of workflowNames) {
      const workflowPath = path.join(workflowDir, workflowName);
      const parsed = parse(readFileSync(workflowPath, 'utf8')) as {
        jobs?: Record<
          string,
          {
            steps?: Array<{
              run?: string;
              uses?: string;
              with?: Record<string, unknown>;
            }>;
          }
        >;
      } | null;

      for (const [jobName, job] of Object.entries(parsed?.jobs ?? {})) {
        const steps = job.steps ?? [];
        const compressedSizeStep = steps.find((step) =>
          step.uses?.startsWith('preactjs/compressed-size-action@')
        );

        if (!compressedSizeStep) {
          continue;
        }

        expect(
          compressedSizeStep.with?.['build-script'],
          `${workflowName} ${jobName} build-script`
        ).toBe('pnpm run build');
        expect(
          steps.some((step) => step.run === 'pnpm run build'),
          `${workflowName} ${jobName} duplicate standalone build`
        ).toBe(false);
      }
    }
  });

  // -----------------------------------------------------------------
  // Issue #1514 — compressed-size action replaces the repository checkout
  // Date: 2026-07-21
  // Bug: the action checked out main and its post step then could not locate
  //      the repository-owned setup action used earlier in the job.
  // Fix: restore the pull-request checkout after artifact and comment steps.
  // -----------------------------------------------------------------
  it('restores the pull-request checkout after compressed-size-action finishes', () => {
    const workflowPath = path.join(workflowDir, 'bundle-size.yml');
    const content = readFileSync(workflowPath, 'utf8');

    expect(content).toContain('name: Restore pull request checkout for action cleanup');
    expect(content).toContain("if: always() && github.event_name == 'pull_request'");
    expect(content).toContain('ref: ${{ github.event.pull_request.head.sha }}');
  });

  it('pins remediation versions for dependency findings that block the high-severity gate', () => {
    const packageJson = JSON.parse(readFileSync(path.resolve('package.json'), 'utf8')) as {
      pnpm?: { overrides?: Record<string, string> };
    };

    expect(packageJson.pnpm?.overrides).toMatchObject({
      axios: '1.18.0',
      'brace-expansion': '1.1.16',
      'fast-uri': '3.1.3',
      'js-yaml': '4.3.0',
    });
  });

  it('gives code review coverage check extra heap for the large coverage suite', () => {
    const workflowPath = path.join(workflowDir, 'code-review.yml');
    const parsed = parse(readFileSync(workflowPath, 'utf8')) as {
      jobs?: {
        'coverage-check'?: {
          env?: Record<string, string>;
          steps?: Array<{
            run?: string;
          }>;
        };
      };
    } | null;

    expect(parsed?.jobs?.['coverage-check']?.env?.NODE_OPTIONS).toBe('--max-old-space-size=8192');

    const coverageRun = parsed?.jobs?.['coverage-check']?.steps?.find((step) =>
      step.run?.includes('vitest run --coverage')
    )?.run;
    expect(coverageRun).toContain('--exclude=src/App.test.tsx');
    expect(coverageRun).toContain('--exclude=src/App.integration.test.tsx');
    expect(coverageRun).toContain('--exclude=src/hooks/useMeetings.test.tsx');
    expect(coverageRun).toContain('--maxWorkers=2');
  });

  it('installs Vercel preview CLI without requiring a pnpm global bin dir', () => {
    const workflowPath = path.join(workflowDir, 'preview.yml');
    const content = readFileSync(workflowPath, 'utf8');

    expect(content).toContain('npm install -g vercel@latest');
    expect(content).not.toContain('pnpm install -g vercel@latest');
  });

  it('treats Vercel preview deployment quota as a controlled skip', () => {
    const workflowPath = path.join(workflowDir, 'preview.yml');
    const content = readFileSync(workflowPath, 'utf8');

    expect(content).toContain('api-deployments-free-per-day');
    expect(content).toContain('preview_skipped=true');
    expect(content).toContain(
      'GitHub App deployment status remains the authoritative preview signal'
    );
    expect(content).toContain('exit "$DEPLOY_STATUS"');
    expect(content).toContain("steps.vercel_deploy.outputs.preview_url != ''");
  });

  it('gives optimized ci test job extra heap for the large Vitest suite', () => {
    const workflowPath = path.join(workflowDir, 'ci-optimized.yml');
    const parsed = parse(readFileSync(workflowPath, 'utf8')) as {
      jobs?: {
        test?: {
          env?: Record<string, string>;
        };
      };
    } | null;

    expect(parsed?.jobs?.test?.env?.NODE_OPTIONS).toBe('--max-old-space-size=12288');
  });

  it('runs backend smoke only after Railway deploy and requires an exact SHA match', () => {
    const workflowPath = path.join(workflowDir, 'backend-production-smoke.yml');
    const content = readFileSync(workflowPath, 'utf8');

    expect(content).toContain("workflows: ['Railway Build Metadata']");
    expect(content).toContain('REQUIRE_EXACT_GIT_SHA');
    expect(content).toContain("REQUIRE_EXACT_GIT_SHA: 'true'");
    expect(content).toContain("SMOKE_MAX_RETRIES: '30'");
    expect(content).not.toContain('steps.scope.outputs.require_exact_git_sha');
  });

  it('keeps backup restore verification staging-safe in production data maintenance', () => {
    const workflowPath = path.join(workflowDir, 'production-data-maintenance.yml');
    const content = readFileSync(workflowPath, 'utf8');
    const parsed = parse(content) as {
      on?: {
        workflow_dispatch?: { inputs?: Record<string, unknown> };
        schedule?: unknown[];
      };
      jobs?: {
        'repair-workspace-consistency'?: {
          if?: string;
        };
        'backup-restore-verification'?: {
          if?: string;
          env?: Record<string, unknown>;
          steps?: Array<{
            name?: string;
            run?: string;
            uses?: string;
            with?: Record<string, unknown>;
          }>;
        };
      };
    } | null;
    const repairJob = parsed?.jobs?.['repair-workspace-consistency'];
    const job = parsed?.jobs?.['backup-restore-verification'];
    const steps = job?.steps ?? [];

    expect(parsed?.on?.schedule).toBeTruthy();
    expect(parsed?.on?.workflow_dispatch?.inputs).toHaveProperty('run_restore_verification');
    expect(parsed?.on?.workflow_dispatch?.inputs).toHaveProperty('restore_workspace_id');
    expect(repairJob?.if).toBe("${{ github.event_name == 'workflow_dispatch' }}");
    expect(job?.if).toContain("github.event_name == 'schedule'");
    expect(job?.if).toContain("inputs.run_restore_verification == 'true'");
    expect(job?.env?.SUPABASE_URL).toBe('${{ secrets.STAGING_SUPABASE_URL }}');
    expect(job?.env?.SUPABASE_SERVICE_ROLE_KEY).toBe(
      '${{ secrets.STAGING_SUPABASE_SERVICE_ROLE_KEY }}'
    );
    expect(job?.env?.RESTORE_VERIFY_ENVIRONMENT).toContain('staging');
    expect(content).toContain('RESTORE_VERIFY_ENVIRONMENT must be staging or sandbox');
    expect(steps.some((step) => step.run === 'pnpm run verify:backup-restore')).toBe(true);
    expect(steps.some((step) => step.with?.path === 'reports/backup-restore-verification/')).toBe(
      true
    );
  });

  it('keeps scheduled workspace maintenance dry-run by default with an explicit apply gate', () => {
    const workflowPath = path.join(workflowDir, 'workspace-maintenance-report.yml');
    const content = readFileSync(workflowPath, 'utf8');

    expect(content).toContain('name: Workspace Maintenance Report');
    expect(content).toContain('workflow_dispatch:');
    expect(content).toContain("default: 'false'");
    expect(content).toContain("github.event.inputs.apply == 'true'");
    expect(content).toContain('pnpm run repair:supabase:workspace -- --apply');
    expect(content).toContain('pnpm run repair:supabase:workspace -- --write-report');
    expect(content).toContain('pnpm run verify:supabase:workspace');
    expect(content).toContain('reports/supabase-workspace-repair/');
    expect(content).toContain('reports/supabase-workspace-consistency/');
  });

  it('keeps backend smoke dependency setup resilient and debugs only smoke failures', () => {
    const workflowPath = path.join(workflowDir, 'backend-production-smoke.yml');
    const content = readFileSync(workflowPath, 'utf8');
    const parsed = parse(content) as {
      jobs?: {
        'verify-backend-production'?: {
          steps?: Array<{
            name?: string;
            if?: string;
            run?: string;
            uses?: string;
            with?: Record<string, unknown>;
            env?: Record<string, unknown>;
          }>;
        };
      };
    } | null;
    const steps = parsed?.jobs?.['verify-backend-production']?.steps ?? [];
    const setupStep = steps.find((step) => step.uses === './.github/actions/setup-node-pnpm');
    const debugStep = steps.find((step) => step.name === 'Debug - Log Railway deployment status');

    expect(content).not.toContain('pnpm install');
    expect(setupStep?.with?.['install-profile']).toBe('pure-js');
    expect(debugStep?.if).toBe("failure() && steps.smoke.outcome == 'failure'");
    expect(debugStep?.env?.SMOKE_TEST_URL).toBe(
      'https://audiorecorder-production.up.railway.app/health'
    );
  });

  it('wires seeded audio smoke into backend production smoke with secrets-only credentials', () => {
    const workflowPath = path.join(workflowDir, 'backend-production-smoke.yml');
    const content = readFileSync(workflowPath, 'utf8');
    const parsed = parse(content) as {
      on?: {
        workflow_dispatch?: {
          inputs?: Record<string, unknown>;
        };
      };
      jobs?: {
        'verify-backend-production'?: {
          env?: Record<string, unknown>;
          steps?: Array<{
            name?: string;
            if?: string;
            run?: string;
            uses?: string;
            with?: Record<string, unknown>;
          }>;
        };
      };
    } | null;

    const job = parsed?.jobs?.['verify-backend-production'];
    const steps = job?.steps ?? [];
    const validateStep = steps.find((step) => step.name === 'Validate audio smoke secrets');
    const audioSmokeStep = steps.find(
      (step) => step.name === 'Seeded audio upload and transcription smoke'
    );
    const artifactStep = steps.find((step) => step.name === 'Upload audio smoke report');
    const expression = (value: string) => ['$', '{{ ', value, ' }}'].join('');

    expect(parsed?.on?.workflow_dispatch?.inputs).toHaveProperty('run_audio_smoke');
    expect(job?.env?.VOICELOG_SMOKE_BASE_URL).toContain('secrets.VOICELOG_SMOKE_BASE_URL');
    expect(job?.env?.VOICELOG_SMOKE_TOKEN).toBe(expression('secrets.VOICELOG_SMOKE_TOKEN'));
    expect(job?.env?.VOICELOG_SMOKE_EMAIL).toBe(expression('secrets.VOICELOG_SMOKE_EMAIL'));
    expect(job?.env?.VOICELOG_SMOKE_PASSWORD).toBe(expression('secrets.VOICELOG_SMOKE_PASSWORD'));
    expect(job?.env?.VOICELOG_SMOKE_WORKSPACE_ID).toBe(
      expression('secrets.VOICELOG_SMOKE_WORKSPACE_ID')
    );
    expect(job?.env?.VOICELOG_SMOKE_CLEANUP).toBe('true');
    expect(validateStep?.run).toContain('VOICELOG_SMOKE_WORKSPACE_ID');
    expect(validateStep?.run).toContain('VOICELOG_SMOKE_TOKEN or VOICELOG_SMOKE_EMAIL');
    expect(audioSmokeStep?.run).toContain('pnpm run release:audio-prod-smoke');
    expect(audioSmokeStep?.if).toContain('inputs.run_audio_smoke == true');
    expect(audioSmokeStep?.if).toContain("env.VOICELOG_SMOKE_WORKSPACE_ID != ''");
    expect(artifactStep?.uses).toBe('actions/upload-artifact@v4');
    expect(artifactStep?.with?.path).toBe('reports/audio-prod-smoke-*.json');
    expect(content).not.toContain('echo "$VOICELOG_SMOKE_PASSWORD"');
  });

  it('deploys Railway after CI and deploys Vercel only after Railway verification', () => {
    const railwayWorkflow = readFileSync(
      path.join(workflowDir, 'railway-build-metadata.yml'),
      'utf8'
    );
    const vercelWorkflow = readFileSync(path.join(workflowDir, 'vercel-production.yml'), 'utf8');

    expect(railwayWorkflow).toContain("workflows: ['CI']");
    expect(railwayWorkflow).toContain('github.event.workflow_run.head_sha || github.sha');
    expect(railwayWorkflow).not.toContain('BUILD_SHA: ${{ github.sha }}');
    expect(railwayWorkflow).not.toContain('EXPECTED_SHA: ${{ github.sha }}');
    expect(railwayWorkflow).toContain('railway deployment list');
    expect(railwayWorkflow).toContain('cancel-in-progress: true');
    expect(railwayWorkflow).toContain('timeout-minutes: 30');
    expect(railwayWorkflow).toContain('--detach');
    expect(railwayWorkflow).toContain('for attempt in 1 2 3');
    expect(railwayWorkflow).toContain('Railway deploy failed after 3 attempts');
    expect(railwayWorkflow).toContain('seq 1 60');
    expect(railwayWorkflow).toContain('--skip-deploys');
    expect(vercelWorkflow).toContain("workflows: ['Railway Build Metadata']");
  });

  it('passes Google Tasks client id into the production Vercel build', () => {
    const vercelWorkflow = readFileSync(path.join(workflowDir, 'vercel-production.yml'), 'utf8');

    expect(vercelWorkflow).toContain('VITE_GOOGLE_CLIENT_ID');
    expect(vercelWorkflow).toContain('missing+=("VITE_GOOGLE_CLIENT_ID")');
    expect(vercelWorkflow).toContain('VITE_GOOGLE_CLIENT_ID: ${{ secrets.VITE_GOOGLE_CLIENT_ID }}');
    expect(vercelWorkflow).toContain('VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}');
  });

  it('retries Railway metadata variable writes before failing the release gate', () => {
    const railwayWorkflow = readFileSync(
      path.join(workflowDir, 'railway-build-metadata.yml'),
      'utf8'
    );

    expect(railwayWorkflow).toContain('set_railway_variable_with_retry()');
    expect(railwayWorkflow).toContain('Railway variable set attempt $attempt/3 for $name');
    expect(railwayWorkflow).toContain('Railway variable set failed after 3 attempts for $name');
    expect(railwayWorkflow).toContain('sleep $((attempt * 10))');
    expect(railwayWorkflow).toContain('set_railway_variable_with_retry RAILWAY_GIT_COMMIT_SHA');
    expect(railwayWorkflow).toContain('set_railway_variable_with_retry GITHUB_SHA');
    expect(railwayWorkflow).toContain('set_railway_variable_with_retry APP_BUILD_TIME');
  });

  it('collects Railway diagnostics when production health stays unavailable', () => {
    const railwayWorkflow = readFileSync(
      path.join(workflowDir, 'railway-build-metadata.yml'),
      'utf8'
    );

    expect(railwayWorkflow).toContain('dump_railway_diagnostics()');
    expect(railwayWorkflow).toContain('Railway health HTTP status: $last_http_status');
    expect(railwayWorkflow).toContain(
      'Railway health did not expose expected git SHA after 60 attempts'
    );
    expect(railwayWorkflow).toContain('railway logs');
    expect(railwayWorkflow).toContain('--latest');
    expect(railwayWorkflow).toContain('--deployment');
    expect(railwayWorkflow).toContain('--http');
    expect(railwayWorkflow).toContain('--status ">=500"');
  });

  it('keeps Google OAuth Railway sync explicit and secret-safe', () => {
    const workflowPath = path.join(workflowDir, 'railway-sync-google-oauth.yml');
    const content = readFileSync(workflowPath, 'utf8');

    expect(content).toContain('GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}');
    expect(content).toContain('GOOGLE_CLIENT_SECRET: ${{ secrets.GOOGLE_CLIENT_SECRET }}');
    expect(content).toContain('GOOGLE_CALENDAR_SCOPES: ${{ secrets.GOOGLE_CALENDAR_SCOPES }}');
    expect(content).toContain(
      'GOOGLE_OAUTH_REDIRECT_URI: ${{ secrets.GOOGLE_OAUTH_REDIRECT_URI }}'
    );
    expect(content).toContain(
      'https://audiorecorder-production.up.railway.app/integrations/google/callback'
    );
    expect(content).toContain('--skip-deploys');
    expect(content).toContain('--stdin');
    expect(content).toContain('railway variable list');
    expect(content).toContain('railway up');
    expect(content).not.toContain('localhost');
  });

  it('keeps production Railway health checks on the current backend domain', () => {
    const checkedFiles = [
      '.github/workflows/railway-build-metadata.yml',
      '.github/workflows/backend-production-smoke.yml',
      '.github/workflows/railway-sync-google-oauth.yml',
      'scripts/fetch-railway-errors.js',
      'scripts/monitor-external-services.js',
      'vercel.json',
    ];

    for (const fileName of checkedFiles) {
      const content = readFileSync(path.resolve(fileName), 'utf8');

      expect(content, fileName).toContain('https://audiorecorder-production.up.railway.app');
      expect(content, fileName).not.toContain('https://voicelog-production.up.railway.app');
    }
  });

  it('checks out the error monitor workflow with the built-in GitHub token', () => {
    const workflowPath = path.join(workflowDir, 'error-monitor-and-task-creator.yml');
    const content = readFileSync(workflowPath, 'utf8');

    expect(content).toContain('actions/checkout@v7');
    expect(content).toContain('github.token');
    expect(content).not.toContain('secrets.GH_PAT');
    expect(content).not.toContain('secrets.GITHUB_TOKEN');
  });

  it('checks out and pushes the task queue workflow with built-in credentials only', () => {
    const workflowPath = path.join(workflowDir, 'task-queue-auto-assign.yml');
    const content = readFileSync(workflowPath, 'utf8');

    expect(content).toContain('actions/checkout@v7');
    expect(content).toContain("git push origin HEAD:${{ github.ref_name || 'main' }}");
    expect(content).not.toContain('secrets.GH_PAT');
    expect(content).not.toContain('secrets.GITHUB_TOKEN');
    expect(content).not.toContain('GIT_TOKEN=');
    expect(content).not.toContain('git remote set-url origin https://x-access-token');
  });

  it('prevents task queue automation from racing active production release workflows', () => {
    const workflowPath = path.join(workflowDir, 'task-queue-auto-assign.yml');
    const content = readFileSync(workflowPath, 'utf8');

    expect(content).toContain('actions: read');
    expect(content).toContain('Skip while release workflows are active');
    expect(content).toContain('ci.yml');
    expect(content).toContain('railway-build-metadata.yml');
    expect(content).toContain('vercel-production.yml');
    expect(content).toContain('backend-production-smoke.yml');
    expect(content).toContain('production-system-audit.yml');
    expect(content).toContain("steps.release-guard.outputs.skip != 'true'");
  });

  it('keeps the changelog CLI installed for tag release automation', () => {
    const workflowPath = path.join(workflowDir, 'changelog.yml');
    const workflowContent = readFileSync(workflowPath, 'utf8');
    const packageJson = JSON.parse(readFileSync(path.resolve('package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    const installedPackages = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    expect(workflowContent).toContain('pnpm run changelog');
    expect(packageJson.scripts?.changelog).toContain('conventional-changelog');
    expect(installedPackages).toHaveProperty('conventional-changelog-cli');
  });

  it('has a production system audit workflow for real-auth click coverage', () => {
    const workflowPath = path.join(workflowDir, 'production-system-audit.yml');

    expect(existsSync(workflowPath)).toBe(true);

    const content = readFileSync(workflowPath, 'utf8');

    expect(content).toContain('uses: ./.github/actions/setup-node-pnpm');
    expect(content).toContain('PRODUCTION_SMOKE_AUTH_TOKEN');
    expect(content).toContain('PRODUCTION_SMOKE_WORKSPACE_ID');
    expect(content).toContain('PRODUCTION_SYSTEM_AUDIT_REQUIRED');
    expect(content).toContain('pnpm run test:ui-actions:contract');
    expect(content).toContain('pnpm run test:e2e:production-system');
    expect(content).toContain('pnpm run release:prod-gate:strict');
  });
});
