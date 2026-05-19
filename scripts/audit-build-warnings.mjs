import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const buildWarningRules = [
  {
    id: 'vite-html-env-placeholder',
    pattern: /%VITE_[A-Z0-9_]+%/,
    message: 'Vite HTML env placeholder leaked into the production build.',
  },
  {
    id: 'rollup-large-chunk',
    pattern: /Some chunks are larger than \d+ kB after minification/i,
    message: 'Rollup reported a chunk larger than the configured release budget.',
  },
  {
    id: 'rollup-warning-marker',
    pattern: /\n\(!\)/,
    message: 'Rollup emitted at least one build warning.',
  },
];

export function findBuildWarnings(output) {
  return buildWarningRules
    .filter((rule) => rule.pattern.test(output))
    .map((rule) => ({ id: rule.id, message: rule.message }));
}

function spawnPnpm(args, options) {
  if (process.platform === 'win32') {
    return spawn(['pnpm', ...args].join(' '), {
      ...options,
      shell: true,
    });
  }

  return spawn('pnpm', args, {
    ...options,
    shell: false,
  });
}

export async function runBuildAndAudit({
  cwd = rootDir,
  env = process.env,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  const child = spawnPnpm(['run', 'build'], {
    cwd,
    env,
  });

  let combinedOutput = '';

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    combinedOutput += text;
    stdout.write(text);
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    combinedOutput += text;
    stderr.write(text);
  });

  const exitCode = await new Promise((resolve) => {
    child.on('close', resolve);
  });

  if (exitCode !== 0) {
    return Number(exitCode);
  }

  const warnings = findBuildWarnings(combinedOutput);
  if (warnings.length > 0) {
    stderr.write('\nBuild warning audit failed:\n');
    for (const warning of warnings) {
      stderr.write(`- ${warning.id}: ${warning.message}\n`);
    }
    return 1;
  }

  stdout.write('\nBuild warning audit passed: no release-blocking warnings detected.\n');
  return 0;
}

const entrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isMainModule = entrypointPath === path.resolve(rootDir, 'scripts/audit-build-warnings.mjs');

if (isMainModule) {
  runBuildAndAudit().then((code) => {
    process.exitCode = code;
  });
}
