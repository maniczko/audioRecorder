import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RELEVANT_PATHS = [
  './src',
  './public',
  './package.json',
  './pnpm-lock.yaml',
  './index.html',
  './vite.config.js',
  './vercel.json',
];

export function shouldIgnoreBuild({ branch, parentExists, changedPaths }) {
  if (branch !== 'main') {
    return false;
  }

  if (!parentExists) {
    return false;
  }

  return changedPaths.length === 0;
}

function readBranch(env = process.env) {
  return env.VERCEL_GIT_COMMIT_REF || '';
}

function hasGitParent() {
  try {
    execSync('git rev-parse --verify HEAD^', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function readChangedPaths() {
  const diffCommand = `git diff --name-only HEAD^ HEAD -- ${RELEVANT_PATHS.join(' ')}`;

  try {
    const output = execSync(diffCommand, { encoding: 'utf8' }).trim();
    return output ? output.split(/\r?\n/).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function runIgnoreCommand(env = process.env) {
  const ignoreBuild = shouldIgnoreBuild({
    branch: readBranch(env),
    parentExists: hasGitParent(),
    changedPaths: readChangedPaths(),
  });

  process.exitCode = ignoreBuild ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runIgnoreCommand();
}
