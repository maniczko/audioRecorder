import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const playwrightPackageRoot = path.dirname(require.resolve('@playwright/test'));
const playwrightCli = path.join(playwrightPackageRoot, 'cli.js');
const args = [
  'test',
  'tests/e2e/auth-session.spec.ts',
  '--project=chromium',
  '--workers=1',
  ...process.argv.slice(2),
];

const result = spawnSync(process.execPath, [playwrightCli, ...args], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PLAYWRIGHT_DATA_PROVIDER: 'remote',
    PLAYWRIGHT_MEDIA_PROVIDER: 'remote',
    VITE_DATA_PROVIDER: 'remote',
    VITE_MEDIA_PROVIDER: 'remote',
  },
});

if (result.error) {
  console.error(`[test:e2e:auth-session] Failed to start Playwright: ${result.error.message}`);
}

process.exit(result.status ?? 1);
