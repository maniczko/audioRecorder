// @vitest-environment jsdom

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function loadGeneratedObject(scriptPath: string, variableName: string) {
  const source = fs.readFileSync(scriptPath, 'utf8');
  const context: Record<string, unknown> = { window: {}, globalThis: {} };

  context.globalThis = context;
  context.window = context;

  vm.runInNewContext(source, context, { filename: scriptPath });

  return (context as any)[variableName] ?? (context.window as any)[variableName];
}

function extractInlineScript(html: string) {
  const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  const match = matches.at(-1);

  if (!match) {
    throw new Error('Inline dashboard script not found');
  }

  return match[1];
}

describe('Regression: #0 — services tab renders current external snapshot', () => {
  it('does not crash when rendering railway and vercel deployment summaries', () => {
    document.body.innerHTML = `
      <div id="p-services"></div>
      <div id="auto-refresh-info"></div>
      <button id="manual-refresh-btn"></button>
    `;

    const helperPath = path.resolve(process.cwd(), 'scripts', 'dashboard-services.js');
    const dashboardPath = path.resolve(process.cwd(), 'scripts', 'test-dashboard-pro.html');
    const externalServicesPath = path.resolve(process.cwd(), 'scripts', 'external-services.js');

    (window as any).Chart = vi.fn(function ChartMock() {
      return {};
    });
    (window as any).TEST_DATA = loadGeneratedObject(
      path.resolve(process.cwd(), 'scripts', 'test-results.js'),
      'TEST_DATA'
    );
    (window as any).EXTERNAL_SERVICES_DATA = loadGeneratedObject(
      externalServicesPath,
      'EXTERNAL_SERVICES_DATA'
    );

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

    const freshServices = {
      timestamp: '2026-04-11T09:30:00.000Z',
      github: {
        status: 'connected',
        repo: { full_name: 'maniczko/audioRecorder' },
        actions: {
          recent_runs: [
            {
              name: 'Optimized CI',
              status: 'failure',
              branch: 'main',
              created_at: '2026-04-11T08:28:56Z',
              updated_at: '2026-04-11T08:36:04Z',
              duration_ms: 428000,
              url: 'https://example.test/failure',
            },
            {
              name: 'Optimized CI',
              status: 'success',
              branch: 'main',
              created_at: '2026-04-11T08:39:53Z',
              updated_at: '2026-04-11T08:40:38Z',
              duration_ms: 45000,
              url: 'https://example.test/success',
            },
          ],
          latest_by_workflow: [
            {
              name: 'Optimized CI',
              status: 'success',
              branch: 'main',
              created_at: '2026-04-11T08:39:53Z',
              updated_at: '2026-04-11T08:40:38Z',
              duration_ms: 45000,
              url: 'https://example.test/success',
            },
          ],
          total_runs: 2,
          success_rate: 50,
          last_run: '2026-04-11T08:40:38Z',
        },
        issues: { open: [] },
        pull_requests: { open: [] },
      },
      sentry: { status: 'configured', configured: true, issues: [], stats: null, note: 'n/a' },
      railway: { status: 'connected', deployments: [] },
      vercel: { status: 'connected', deployments: [], stats: { daily: [] } },
    };

    const staleServices = {
      ...freshServices,
      github: {
        ...freshServices.github,
        actions: {
          ...freshServices.github.actions,
          latest_by_workflow: [
            {
              name: 'Optimized CI',
              status: 'failure',
              branch: 'main',
              created_at: '2026-04-11T08:28:56Z',
              updated_at: '2026-04-11T08:36:04Z',
              duration_ms: 428000,
              url: 'https://example.test/failure',
            },
          ],
        },
      },
    };

    (window as any).Chart = vi.fn(function ChartMock() {
      return {};
    });
    (window as any).TEST_DATA = {
      ...loadGeneratedObject(
        path.resolve(process.cwd(), 'scripts', 'test-results.js'),
        'TEST_DATA'
      ),
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
    const refreshedServices = {
      timestamp: '2026-04-11T09:45:00.000Z',
      github: {
        status: 'connected',
        repo: { full_name: 'maniczko/audioRecorder' },
        actions: {
          recent_runs: [
            {
              name: 'Optimized CI',
              status: 'success',
              branch: 'main',
              created_at: '2026-04-11T08:39:53Z',
              updated_at: '2026-04-11T08:40:38Z',
              duration_ms: 45000,
              url: 'https://example.test/success',
            },
          ],
          latest_by_workflow: [
            {
              name: 'Optimized CI',
              status: 'success',
              branch: 'main',
              created_at: '2026-04-11T08:39:53Z',
              updated_at: '2026-04-11T08:40:38Z',
              duration_ms: 45000,
              url: 'https://example.test/success',
            },
          ],
          total_runs: 1,
          success_rate: 100,
          last_run: '2026-04-11T08:40:38Z',
        },
        issues: { open: [] },
        pull_requests: { open: [] },
      },
      sentry: { status: 'configured', configured: true, issues: [], stats: null, note: 'n/a' },
      railway: { status: 'connected', deployments: [] },
      vercel: { status: 'connected', deployments: [], stats: { daily: [] } },
    };

    const fetchedData = {
      ...loadGeneratedObject(
        path.resolve(process.cwd(), 'scripts', 'test-results.js'),
        'TEST_DATA'
      ),
      external_services: refreshedServices,
    };

    (window as any).Chart = vi.fn(function ChartMock() {
      return {};
    });
    (window as any).TEST_DATA = loadGeneratedObject(
      path.resolve(process.cwd(), 'scripts', 'test-results.js'),
      'TEST_DATA'
    );
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
});
