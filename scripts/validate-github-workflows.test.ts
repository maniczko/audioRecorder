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

  it('keeps the main CI install path resilient with Node 22, pnpm cache, and install retries', () => {
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
      const setupNodeStep = steps.find((step) => step.uses?.startsWith('actions/setup-node@'));
      const resolveStoreStep = steps.find((step) => step.name === 'Resolve pnpm store');
      const cacheStep = steps.find((step) => step.name === 'Cache pnpm store');
      const installStep = steps.find((step) => step.name === 'Install dependencies');

      expect(setupNodeStep, `${jobName} setup-node step`).toBeTruthy();
      expect(setupNodeStep?.uses, `${jobName} setup-node action`).toBe('actions/setup-node@v6');
      expect(setupNodeStep?.with?.['node-version'], `${jobName} node version`).toBe('22');
      expect(setupNodeStep?.with?.cache, `${jobName} setup-node cache before pnpm exists`).toBe(
        undefined
      );
      expect(resolveStoreStep?.run, `${jobName} pnpm store path`).toContain('pnpm store path');
      expect(cacheStep?.uses, `${jobName} cache action`).toBe('actions/cache@v4');
      expect(cacheStep?.with?.path, `${jobName} cache path`).toBe('${{ env.PNPM_STORE_PATH }}');
      expect(cacheStep?.with?.key, `${jobName} cache key`).toContain("hashFiles('pnpm-lock.yaml')");
      expect(installStep?.run, `${jobName} install retry loop`).toContain('for attempt in 1 2 3');
      expect(installStep?.run, `${jobName} frozen lockfile`).toContain(
        'pnpm install --frozen-lockfile'
      );
    }
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
    const resolveStoreStep = steps.find((step) => step.name === 'Resolve pnpm store');
    const cacheStep = steps.find((step) => step.name === 'Cache pnpm store');
    const installStep = steps.find((step) => step.name === 'Install dependencies');
    const debugStep = steps.find((step) => step.name === 'Debug - Log Railway deployment status');

    expect(content).not.toContain('pnpm install --no-frozen-lockfile');
    expect(resolveStoreStep?.run).toContain('pnpm store path');
    expect(cacheStep?.uses).toBe('actions/cache@v4');
    expect(cacheStep?.with?.path).toBe('${{ env.PNPM_STORE_PATH }}');
    expect(cacheStep?.with?.key).toContain("hashFiles('pnpm-lock.yaml')");
    expect(installStep?.run).toContain('for attempt in 1 2 3');
    expect(installStep?.run).toContain('pnpm install --frozen-lockfile --ignore-scripts');
    expect(debugStep?.if).toBe("failure() && steps.smoke.outcome == 'failure'");
    expect(debugStep?.env?.SMOKE_TEST_URL).toBe(
      'https://audiorecorder-production.up.railway.app/health'
    );
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
    expect(railwayWorkflow.match(/--skip-deploys/g)).toHaveLength(3);
    expect(vercelWorkflow).toContain("workflows: ['Railway Build Metadata']");
  });

  it('checks out the error monitor workflow with the built-in GitHub token', () => {
    const workflowPath = path.join(workflowDir, 'error-monitor-and-task-creator.yml');
    const content = readFileSync(workflowPath, 'utf8');

    expect(content).toContain('actions/checkout@v6');
    expect(content).toContain('github.token');
    expect(content).not.toContain('secrets.GH_PAT');
    expect(content).not.toContain('secrets.GITHUB_TOKEN');
  });

  it('checks out and pushes the task queue workflow with built-in credentials only', () => {
    const workflowPath = path.join(workflowDir, 'task-queue-auto-assign.yml');
    const content = readFileSync(workflowPath, 'utf8');

    expect(content).toContain('actions/checkout@v6');
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

    expect(content).toContain('node-version: 22');
    expect(content).toContain('PRODUCTION_SMOKE_AUTH_TOKEN');
    expect(content).toContain('PRODUCTION_SMOKE_WORKSPACE_ID');
    expect(content).toContain('PRODUCTION_SYSTEM_AUDIT_REQUIRED');
    expect(content).toContain('pnpm run test:e2e:production-system');
    expect(content).toContain('pnpm run release:prod-smoke:strict');
    expect(content).toContain('pnpm run sentry:release-health');
  });
});
