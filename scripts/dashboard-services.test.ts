import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { externalServicesFixture } from './fixtures/dashboard-fixtures';

function cloneFixture<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function loadDashboardServices() {
  const scriptPath = path.resolve(process.cwd(), 'scripts', 'dashboard-services.js');
  const source = fs.readFileSync(scriptPath, 'utf8');
  const context: Record<string, unknown> = {
    console,
    globalThis: {},
  };

  context.globalThis = context;
  context.window = context;

  vm.runInNewContext(source, context, { filename: scriptPath });

  return context.DashboardServices as {
    normalizeServicesData: (services?: unknown) => any;
    isRailwayFailure: (status?: string) => boolean;
    isVercelFailure: (state?: string) => boolean;
  };
}

describe('dashboard-services', () => {
  const servicesApi = loadDashboardServices();

  it('derives github metrics from nested actions data', () => {
    const normalized = servicesApi.normalizeServicesData({
      github: {
        status: 'connected',
        actions: {
          recent_runs: [{ status: 'success' }, { status: 'failure' }, { status: 'skipped' }],
          latest_by_workflow: [{ name: 'Optimized CI' }],
          total_runs: 42,
          success_rate: 67,
          last_run: '2026-04-07T15:00:00.000Z',
        },
        issues: { open: [{ number: 1 }] },
        pull_requests: { open: [{ number: 2 }] },
      },
    });

    expect(normalized.github.successCount).toBe(1);
    expect(normalized.github.failureCount).toBe(1);
    expect(normalized.github.skippedCount).toBe(1);
    expect(normalized.github.totalRuns).toBe(42);
    expect(normalized.github.successRate).toBe(67);
    expect(normalized.github.latest).toHaveLength(1);
    expect(normalized.github.issues).toHaveLength(1);
    expect(normalized.github.pullRequests).toHaveLength(1);
  });

  it('marks non-ready vercel deployments as failed deployments', () => {
    const normalized = servicesApi.normalizeServicesData({
      vercel: {
        deployments: [
          { state: 'READY', name: 'ok' },
          { state: 'ERROR', name: 'broken' },
          { state: 'CANCELED', name: 'cancelled' },
        ],
      },
    });

    expect(normalized.vercel.failedDeployments).toEqual([
      { state: 'ERROR', name: 'broken' },
      { state: 'CANCELED', name: 'cancelled' },
    ]);
  });

  it('marks railway deployments outside healthy statuses as failed deployments', () => {
    const normalized = servicesApi.normalizeServicesData({
      railway: {
        deployments: [
          { status: 'SUCCESS', id: 'one' },
          { status: 'FAILED', id: 'two' },
          { status: 'CRASHED', id: 'three' },
        ],
      },
    });

    expect(normalized.railway.failedDeployments).toEqual([
      { status: 'FAILED', id: 'two' },
      { status: 'CRASHED', id: 'three' },
    ]);
  });

  it('preserves snapshot timestamp and safe defaults for optional sections', () => {
    const normalized = servicesApi.normalizeServicesData({
      timestamp: '2026-04-07T15:02:51.205Z',
      sentry: { status: 'configured' },
    });

    expect(normalized.timestamp).toBe('2026-04-07T15:02:51.205Z');
    expect(normalized.github.runs).toEqual([]);
    expect(normalized.github.latest).toEqual([]);
    expect(normalized.github.issues).toEqual([]);
    expect(normalized.github.pullRequests).toEqual([]);
    expect(normalized.railway.failedDeployments).toEqual([]);
    expect(normalized.vercel.failedDeployments).toEqual([]);
  });

  it('regression: hermetic external-services fixture exposes failure arrays', () => {
    const normalized = servicesApi.normalizeServicesData(cloneFixture(externalServicesFixture));

    expect(Array.isArray(normalized.railway.failedDeployments)).toBe(true);
    expect(Array.isArray(normalized.vercel.failedDeployments)).toBe(true);
    expect(normalized.github.latest.length).toBeGreaterThan(0);
    expect(normalized.timestamp).toBeTruthy();
  });
});
