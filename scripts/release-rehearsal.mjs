import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const releaseGateCommands = [
  ['pnpm', ['run', 'typecheck:all']],
  ['pnpm', ['run', 'lint:all']],
  ['pnpm', ['run', 'lint:css']],
  ['pnpm', ['run', 'format:check']],
  ['pnpm', ['run', 'audit:mojibake']],
  ['pnpm', ['run', 'audit:tooling']],
  ['pnpm', ['run', 'audit:ui-actions']],
  ['pnpm', ['run', 'audit:build-warnings']],
  ['pnpm', ['run', 'test:server:retry']],
  ['pnpm', ['run', 'test:stt-corpus']],
  ['pnpm', ['run', 'test:frontend:ci']],
  ['pnpm', ['audit', '--audit-level=high']],
  ['pnpm', ['run', 'audit:a11y:ci']],
  ['pnpm', ['run', 'test:skips:audit']],
  ['pnpm', ['run', 'test:visual:check']],
  ['pnpm', ['run', 'test:ui-actions']],
  ['pnpm', ['run', 'test:e2e']],
  ['pnpm', ['run', 'test:e2e:advanced']],
  ['pnpm', ['run', 'test:e2e:remote-api']],
];

export function assertNode22(version = process.versions.node) {
  const major = Number(String(version).split('.')[0]);
  if (major !== 22) {
    throw new Error(`Release rehearsal must run on Node 22.x. Current runtime is ${version}.`);
  }
}

async function runCommand(command, args, { cwd = rootDir, env = process.env } = {}) {
  const options = {
    cwd,
    env,
    stdio: 'inherit',
  };

  const child =
    process.platform === 'win32'
      ? spawn([command, ...args].join(' '), { ...options, shell: true })
      : spawn(command, args, { ...options, shell: false });

  return new Promise((resolve) => {
    child.on('close', resolve);
  });
}

export async function runReleaseRehearsal({
  commands = releaseGateCommands,
  cwd = rootDir,
  env = process.env,
  run = runCommand,
} = {}) {
  assertNode22(env.VOICELOG_NODE_VERSION_OVERRIDE || process.versions.node);

  for (const [command, args] of commands) {
    console.log(`\n[release:rehearsal] ${command} ${args.join(' ')}`);
    const code = await run(command, args, { cwd, env });
    if (code !== 0) {
      console.error(`[release:rehearsal] Gate failed: ${command} ${args.join(' ')} (exit ${code})`);
      return Number(code) || 1;
    }
  }

  console.log('\n[release:rehearsal] All release gates passed on Node 22.x.');
  return 0;
}

const entrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isMainModule = entrypointPath === path.resolve(rootDir, 'scripts/release-rehearsal.mjs');

if (isMainModule) {
  runReleaseRehearsal().then((code) => {
    process.exitCode = code;
  });
}
