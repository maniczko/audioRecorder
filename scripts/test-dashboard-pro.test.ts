// @vitest-environment jsdom

import fs from 'node:fs';
import path from 'node:path';

import {
  externalServicesFixture,
  testResultsFixture,
  type DashboardExternalServices,
} from './fixtures/dashboard-fixtures';

function cloneFixture<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function extractInlineScript(html: string) {
  const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  const match = matches.at(-1);

  if (!match) {
    throw new Error('Inline dashboard script not found');
  }

  return match[1];
}

function createServicesWithLatest(status: 'success' | 'failure'): DashboardExternalServices {
  const services = cloneFixture(externalServicesFixture);
  const successRun = {
    ...services.github.actions.recent_runs[0],
    status: 'success' as const,
    updated_at: '2026-04-11T08:40:38.000Z',
  };
  const failureRun = {
    ...services.github.actions.recent_runs[1],
    status: 'failure' as const,
    updated_at: '2026-04-11T08:36:04.000Z',
  };

  services.timestamp = '2026-04-11T09:30:00.000Z';
  services.github.actions.recent_runs = [failureRun, successRun];
  services.github.actions.latest_by_workflow = [status === 'success' ? successRun : failureRun];
  services.github.actions.total_runs = 2;
  services.github.actions.success_rate = 50;
  services.github.actions.last_run = successRun.updated_at;
  services.github.issues.open = [];
  services.github.pull_requests.open = [];
  services.railway.deployments = [];
  services.vercel.deployments = [];
  services.vercel.stats.daily = [];
  services.vercel.stats.deployments_7d = 0;

  return services;
}

describe('Regression: #0 - services tab renders hermetic external snapshot', () => {
  it('does not crash when rendering railway and vercel deployment summaries', () => {
    document.body.innerHTML = `
      <div id="p-services"></div>
      <div id="auto-refresh-info"></div>
      <button id="manual-refresh-btn"></button>
    `;

    const helperPath = path.resolve(process.cwd(), 'scripts', 'dashboard-services.js');
    const dashboardPath = path.resolve(process.cwd(), 'scripts', 'test-dashboard-pro.html');

    (window as any).Chart = vi.fn(function ChartMock() {
      return {};
    });
    (window as any).TEST_DATA = cloneFixture(testResultsFixture);
    (window as any).EXTERNAL_SERVICES_DATA = cloneFixture(externalServicesFixture);

    vi.spyOn(document, 'addEventListener').mockImplementation(() => undefined);
    vi.spyOn(window, 'setInterval').mockImplementation(() => 0 as any);

    window.eval(fs.readFileSync(helperPath, 'utf8'));
    window.eval(extractInlineScript(fs.readFileSync(dashboardPath, 'utf8')));

    expect(() => (window as any).renderSvcs()).not.toThrow();

    const panel = document.getElementById('p-services');
    expect(panel?.textContent).toContain('GitHub Actions');
    expect(panel?.textContent).toContain('Railway');
    expect(panel?.textContent).toContain('Vercel');
    expect(panel?.textContent).toContain('Latest per Workflow');
  });

  it('prefers refreshed services embedded in test-results over stale window snapshot', () => {
    document.body.innerHTML = `
      <div id="p-services"></div>
      <div id="auto-refresh-info"></div>
      <button id="manual-refresh-btn"></button>
    `;

    const helperPath = path.resolve(process.cwd(), 'scripts', 'dashboard-services.js');
    const dashboardPath = path.resolve(process.cwd(), 'scripts', 'test-dashboard-pro.html');

    const freshServices = createServicesWithLatest('success');
    const staleServices = createServicesWithLatest('failure');

    (window as any).Chart = vi.fn(function ChartMock() {
      return {};
    });
    (window as any).TEST_DATA = {
      ...cloneFixture(testResultsFixture),
      external_services: freshServices,
    };
    (window as any).EXTERNAL_SERVICES_DATA = staleServices;

    vi.spyOn(document, 'addEventListener').mockImplementation(() => undefined);
    vi.spyOn(window, 'setInterval').mockImplementation(() => 0 as any);

    window.eval(fs.readFileSync(helperPath, 'utf8'));
    window.eval(extractInlineScript(fs.readFileSync(dashboardPath, 'utf8')));

    expect(() => (window as any).renderSvcs((window as any).TEST_DATA)).not.toThrow();
    expect(document.getElementById('gh-current-failures')?.textContent).toContain('0');
    expect(document.getElementById('gh-current-successes')?.textContent).toContain('1');
  });

  it('syncs external services during auto-refresh from fetched test-results snapshot', async () => {
    document.body.innerHTML = '<div id="app"></div><div id="auto-refresh-info"></div>';

    const helperPath = path.resolve(process.cwd(), 'scripts', 'dashboard-services.js');
    const dashboardPath = path.resolve(process.cwd(), 'scripts', 'test-dashboard-pro.html');
    const refreshedServices = createServicesWithLatest('success');
    refreshedServices.timestamp = '2026-04-11T09:45:00.000Z';
    refreshedServices.github.actions.total_runs = 1;
    refreshedServices.github.actions.success_rate = 100;
    refreshedServices.github.actions.recent_runs =
      refreshedServices.github.actions.latest_by_workflow;

    const fetchedData = {
      ...cloneFixture(testResultsFixture),
      external_services: refreshedServices,
    };

    (window as any).Chart = vi.fn(function ChartMock() {
      return {};
    });
    (window as any).TEST_DATA = cloneFixture(testResultsFixture);
    (window as any).EXTERNAL_SERVICES_DATA = null;

    vi.spyOn(document, 'addEventListener').mockImplementation(() => undefined);
    vi.spyOn(window, 'setInterval').mockImplementation(() => 0 as any);
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => fetchedData,
    } as unknown as Response);

    window.eval(fs.readFileSync(helperPath, 'utf8'));
    window.eval(extractInlineScript(fs.readFileSync(dashboardPath, 'utf8')));

    await (window as any).loadDashboardData();

    expect((window as any).EXTERNAL_SERVICES_DATA).toEqual(refreshedServices);
    expect(document.getElementById('gh-current-failures')?.textContent).toContain('0');
  });

  it('regression: overview marks historical test snapshots and shows live monitor status', () => {
    document.body.innerHTML = '<div id="app"></div><div id="auto-refresh-info"></div>';

    const helperPath = path.resolve(process.cwd(), 'scripts', 'dashboard-services.js');
    const dashboardPath = path.resolve(process.cwd(), 'scripts', 'test-dashboard-pro.html');

    const staleData = {
      timestamp: '2026-04-08T09:39:27.000Z',
      summary: {
        total: 20,
        passed: 15,
        failed: 5,
        skipped: 0,
        totalFiles: 1,
        passingFiles: 0,
        failingFiles: 1,
      },
      files: [
        {
          file: 'src/shared/example.test.ts',
          passed: 15,
          failed: 5,
          skipped: 0,
          duration: 120,
          coverage: 78,
        },
      ],
      failures: [],
      coverage: { lines: 78, statements: 78, functions: 74, branches: 70 },
      external_services: {
        timestamp: '2026-04-11T12:52:00.000Z',
        github: {
          status: 'connected',
          repo: { full_name: 'maniczko/audioRecorder' },
          actions: {
            recent_runs: [
              { name: 'Optimized CI', status: 'success', updated_at: '2026-04-11T12:40:38Z' },
            ],
            latest_by_workflow: [
              { name: 'Optimized CI', status: 'success', updated_at: '2026-04-11T12:40:38Z' },
            ],
            total_runs: 1,
            success_rate: 100,
            last_run: '2026-04-11T12:40:38Z',
          },
          issues: { open: [] },
          pull_requests: { open: [] },
        },
        sentry: { status: 'configured', configured: true, issues: [], stats: null, note: 'n/a' },
        railway: { status: 'connected', deployments: [{ status: 'SUCCESS', id: 'rw-ok' }] },
        vercel: {
          status: 'connected',
          deployments: [{ state: 'READY', name: 'deploy-ok' }],
          stats: { daily: [] },
        },
      },
    };

    (window as any).Chart = vi.fn(function ChartMock() {
      return {};
    });
    (window as any).TEST_DATA = staleData;
    (window as any).EXTERNAL_SERVICES_DATA = staleData.external_services;

    vi.spyOn(document, 'addEventListener').mockImplementation(() => undefined);
    vi.spyOn(window, 'setInterval').mockImplementation(() => 0 as any);

    window.eval(fs.readFileSync(helperPath, 'utf8'));
    window.eval(extractInlineScript(fs.readFileSync(dashboardPath, 'utf8')));

    expect(() => (window as any).render(staleData)).not.toThrow();
    expect(document.body.textContent).toContain('Historical test snapshot');
    expect(document.body.textContent).toContain('Live monitor clean');
  });

  it('regression: production dashboard loads dashboard-services helper in browser', () => {
    const dashboardPath = path.resolve(process.cwd(), 'scripts', 'test-dashboard-pro.html');
    const html = fs.readFileSync(dashboardPath, 'utf8');

    expect(html).toContain('<script src="dashboard-services.js"></script>');
  });
});
