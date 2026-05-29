import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const productionGateRequiredEnv = [
  'PRODUCTION_SMOKE_AUTH_TOKEN',
  'PRODUCTION_SMOKE_WORKSPACE_ID',
  'PRODUCTION_FRONTEND_URL',
  'PRODUCTION_API_BASE_URL',
  'SENTRY_AUTH_TOKEN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
];

export const productionGateCommands = [
  ['pnpm', ['run', 'test:e2e:production-actions']],
  ['pnpm', ['run', 'test:e2e:production-persistence']],
  ['pnpm', ['run', 'release:prod-smoke:strict']],
  ['pnpm', ['run', 'sentry:release-health']],
];

export function validateProductionGateEnv(env = process.env) {
  const missing = productionGateRequiredEnv.filter((key) => !String(env[key] || '').trim());
  if (missing.length > 0) {
    throw new Error(`release:prod-gate:strict missing required env: ${missing.join(', ')}`);
  }
}

async function runCommand(command, args, { cwd = rootDir, env = process.env } = {}) {
  const options = { cwd, env, stdio: 'inherit' };
  const child =
    process.platform === 'win32'
      ? spawn([command, ...args].join(' '), { ...options, shell: true })
      : spawn(command, args, { ...options, shell: false });

  return new Promise((resolve) => {
    child.on('close', resolve);
  });
}

export async function runProductionGate({
  commands = productionGateCommands,
  cwd = rootDir,
  env = process.env,
  run = runCommand,
} = {}) {
  validateProductionGateEnv(env);

  const gateEnv = {
    ...env,
    PLAYWRIGHT_BASE_URL: env.PRODUCTION_FRONTEND_URL,
    PLAYWRIGHT_API_BASE_URL: env.PRODUCTION_API_BASE_URL,
    PLAYWRIGHT_SKIP_WEB_SERVER: 'true',
    PRODUCTION_SYSTEM_AUDIT_REQUIRED: 'true',
  };

  for (const [command, args] of commands) {
    console.log(`\n[release:prod-gate:strict] ${command} ${args.join(' ')}`);
    const code = await run(command, args, { cwd, env: gateEnv });
    if (code !== 0) {
      console.error(
        `[release:prod-gate:strict] Gate failed: ${command} ${args.join(' ')} (exit ${code})`
      );
      return Number(code) || 1;
    }
  }

  console.log('\n[release:prod-gate:strict] Production gate passed.');
  return 0;
}

const entrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isMainModule =
  entrypointPath === path.resolve(rootDir, 'scripts/release-prod-gate-strict.mjs');

if (isMainModule) {
  runProductionGate()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
