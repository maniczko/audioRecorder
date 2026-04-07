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
});
