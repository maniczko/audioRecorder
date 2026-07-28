import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const githubApiBaseUrl = 'https://api.github.com';
const REQUIRED_CONSECUTIVE_RUNS = 3;

export const productionGateRequiredEnv = [
  'PRODUCTION_SMOKE_AUTH_TOKEN',
  'PRODUCTION_SMOKE_WORKSPACE_ID',
  'PRODUCTION_FRONTEND_URL',
  'PRODUCTION_API_BASE_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SENTRY_AUTH_TOKEN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'GITHUB_TOKEN',
  'GITHUB_REPOSITORY',
];

function resolveGithubToken(env) {
  return String(env.GITHUB_TOKEN || env.GH_TOKEN || env.GH_PAT || '').trim();
}

export const productionGateCommands = [
  ['pnpm', ['run', 'test:e2e:production-actions']],
  ['pnpm', ['run', 'test:e2e:production-persistence']],
  ['pnpm', ['run', 'release:prod-smoke:strict']],
  ['pnpm', ['run', 'release:audio-prod-smoke']],
  ['pnpm', ['run', 'verify:supabase:workspace']],
  ['pnpm', ['run', 'sentry:release-health']],
];

export function parsePositiveInteger(value, fallback = 1) {
  const normalized = String(value || '').trim();
  const parsed = Number.parseInt(normalized, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
}

function resolveRepository(env) {
  const full = String(env.GITHUB_REPOSITORY || '').trim();
  if (!full) {
    throw new Error('release:prod-gate:strict missing required env: GITHUB_REPOSITORY');
  }

  const [owner, repo] = full.split('/');
  if (!owner || !repo) {
    throw new Error(`release:prod-gate:strict has invalid GITHUB_REPOSITORY value: ${full}`);
  }

  return `${owner}/${repo}`;
}

function resolveWorkflowFile(env) {
  const explicit = String(env.PRODUCTION_GATE_WORKFLOW || '').trim();
  if (explicit) {
    return explicit;
  }

  const ref = String(env.GITHUB_WORKFLOW_REF || '').trim();
  if (ref) {
    const workflowPath = ref.split('@')[0] || '';
    const marker = '.github/workflows/';
    const markerIndex = workflowPath.lastIndexOf(marker);
    return markerIndex >= 0
      ? workflowPath.slice(markerIndex + marker.length)
      : workflowPath.split('/').pop();
  }

  const fallback = String(env.GITHUB_WORKFLOW || '').trim();
  if (!fallback) {
    throw new Error(
      'release:prod-gate:strict missing workflow reference for consecutive-run check.'
    );
  }

  return fallback.includes('.yml') || fallback.includes('.yaml') ? fallback : `${fallback}.yml`;
}

function buildGitHubApiHeaders(token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'voicelog-release-prod-gate',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

export async function verifyConsecutiveProductionGateRuns({
  env = process.env,
  fetchImpl = fetch,
  requiredRuns = parsePositiveInteger(
    env.PRODUCTION_GATE_REQUIRED_CONSECUTIVE_RUNS,
    REQUIRED_CONSECUTIVE_RUNS
  ),
} = {}) {
  const consecutive = parsePositiveInteger(requiredRuns, REQUIRED_CONSECUTIVE_RUNS);
  if (consecutive <= 1) {
    console.log('[release:prod-gate:strict] Consecutive runs requirement disabled.');
    return true;
  }

  const token = resolveGithubToken(env);

  const repository = resolveRepository(env);
  const workflow = resolveWorkflowFile(env);
  const requiredHistory = consecutive - 1;
  const url = new URL(
    `${githubApiBaseUrl}/repos/${repository}/actions/workflows/${encodeURIComponent(workflow)}/runs`
  );
  url.searchParams.set('status', 'completed');
  url.searchParams.set('per_page', String(Math.max(requiredHistory, 1)));

  const response = await fetchImpl(url, {
    headers: buildGitHubApiHeaders(token),
  });

  if (!response.ok) {
    if (!token && response.status === 404) {
      throw new Error(
        'release:prod-gate:strict missing required env: GITHUB_TOKEN (public workflow run history lookup is unauthorized for private repositories without token)'
      );
    }

    throw new Error(
      `GitHub API ${response.status} for workflow runs for ${workflow}: ${await response.text()}`
    );
  }

  const payload = await response.json();
  const runs = Array.isArray(payload?.workflow_runs) ? payload.workflow_runs : [];
  const currentRunId = String(env.GITHUB_RUN_ID || '').trim();
  const recentRuns = runs.filter((run) => String(run?.id || '') !== currentRunId);

  if (recentRuns.length < requiredHistory) {
    throw new Error(
      `Production gate requires ${consecutive} consecutive successful runs, but only found ${recentRuns.length} completed run(s) for ${workflow}.`
    );
  }

  const windowedRuns = recentRuns.slice(0, requiredHistory);
  const failureEntries = windowedRuns.filter((run) => run?.conclusion !== 'success');
  if (failureEntries.length > 0) {
    const details = failureEntries.map((run) => `${run.id}: ${run.conclusion}`).join(', ');
    throw new Error(
      `Production gate requires ${consecutive} consecutive successful runs for ${workflow}, but recent status is: ${details}`
    );
  }

  console.log(
    `[release:prod-gate:strict] Consecutive gate passed with ${consecutive} green runs for ${workflow}.`
  );
  return true;
}

export function validateProductionGateEnv(env = process.env) {
  const token = resolveGithubToken(env);
  const missing = productionGateRequiredEnv.filter((key) => {
    if (key === 'GITHUB_TOKEN') {
      return false;
    }
    return !String(env[key] || '').trim();
  });
  if (missing.length > 0) {
    throw new Error(`release:prod-gate:strict missing required env: ${missing.join(', ')}`);
  }

  if (!token) {
    console.log(
      '[release:prod-gate:strict] Optional GitHub token not found; using anonymous API requests for workflow run history.'
    );
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
  verifyConsecutiveRuns = verifyConsecutiveProductionGateRuns,
} = {}) {
  validateProductionGateEnv(env);
  await verifyConsecutiveRuns({ env });

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
