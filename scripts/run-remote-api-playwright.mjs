import { spawn } from 'node:child_process';

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const args = ['exec', 'playwright', 'test', 'tests/e2e/remote-api.spec.js', '--project=remote-api'];
const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3105';
const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL || process.env.VITE_API_BASE_URL || 'http://127.0.0.1:4000';
const webCommand =
  process.env.PLAYWRIGHT_WEB_COMMAND || 'pnpm exec vite --host 127.0.0.1 --port 3105 --strictPort';
const env = {
  ...process.env,
  PLAYWRIGHT_BASE_URL: baseUrl,
  PLAYWRIGHT_API_BASE_URL: apiBaseUrl,
  PLAYWRIGHT_WEB_COMMAND: webCommand,
  PLAYWRIGHT_MEDIA_PROVIDER: 'remote',
  PLAYWRIGHT_INCLUDE_REMOTE_API: 'true',
};
const child =
  process.platform === 'win32'
    ? spawn([command, ...args].join(' '), {
        shell: true,
        stdio: 'inherit',
        env,
      })
    : spawn(command, args, {
        stdio: 'inherit',
        env,
      });

child.on('error', (error) => {
  console.error(`[test:e2e:remote-api] Failed to start Playwright: ${error.message}`);
  process.exitCode = 1;
});

child.on('close', (code) => {
  process.exitCode = Number(code) || 0;
});
