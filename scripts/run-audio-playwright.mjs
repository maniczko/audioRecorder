import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const viteBinary = path.join(
  repoRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'vite.cmd' : 'vite'
);
const playwrightPackageRoot = path.dirname(require.resolve('@playwright/test'));
const playwrightCli = path.join(playwrightPackageRoot, 'cli.js');
const args = [
  'test',
  'tests/e2e/audio-pipeline.spec.ts',
  '--project=chromium',
  ...process.argv.slice(2),
];

const result = spawnSync(process.execPath, [playwrightCli, ...args], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PLAYWRIGHT_MEDIA_PROVIDER: 'remote',
    PLAYWRIGHT_WEB_COMMAND:
      process.env.PLAYWRIGHT_WEB_COMMAND || `"${viteBinary}" --host 127.0.0.1 --port 3000`,
  },
});

if (result.error) {
  console.error(result.error);
}

process.exit(result.status ?? 1);
