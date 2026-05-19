import { spawnSync } from 'node:child_process';

const baseUrl =
  process.env.LIGHTHOUSE_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const outputPath = process.env.LIGHTHOUSE_OUTPUT_PATH || './reports/lighthouse-report.html';

const result = spawnSync(
  'pnpm',
  ['exec', 'lighthouse', baseUrl, '--output', 'html', '--output-path', outputPath],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }
);

process.exit(result.status ?? 1);
