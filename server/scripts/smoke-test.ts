import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from '../config.ts';
import { buildLocalHealthUrl } from '../runtime.ts';

interface SmokeHealthBody {
  status?: unknown;
  gitSha?: unknown;
  uptime?: unknown;
  version?: unknown;
}

interface SmokeEvaluationOptions {
  body: SmokeHealthBody;
  expectedGitSha?: string;
  requireExactGitSha?: boolean;
}

interface SmokeEvaluationResult {
  ok: boolean;
  warning?: string;
  error?: string;
}

export function evaluateSmokeHealth({
  body,
  expectedGitSha = '',
  requireExactGitSha = false,
}: SmokeEvaluationOptions): SmokeEvaluationResult {
  if (body?.status !== 'ok') {
    return {
      ok: false,
      error: `Health endpoint returned unexpected status: ${String(body?.status)}`,
    };
  }

  const actualGitSha = typeof body?.gitSha === 'string' ? body.gitSha : '';
  const hasExpectedSha = expectedGitSha.trim().length > 0;
  const hasActualSha = actualGitSha.trim().length > 0;

  if (hasExpectedSha && hasActualSha && actualGitSha !== expectedGitSha) {
    const mismatchMessage =
      `Git SHA mismatch (expected ${expectedGitSha.slice(0, 8)}, got ${actualGitSha.slice(0, 8)}). ` +
      `This usually means Railway has not deployed the tested backend revision yet.`;

    if (requireExactGitSha) {
      return {
        ok: false,
        error: mismatchMessage,
      };
    }

    return {
      ok: true,
      warning: mismatchMessage,
    };
  }

  return { ok: true };
}

async function runSmokeTest() {
  const url = process.env.SMOKE_TEST_URL || buildLocalHealthUrl(config);
  const maxRetries = Math.max(1, Number(process.env.SMOKE_MAX_RETRIES || 5));
  const waitMs = Math.max(250, Number(process.env.SMOKE_WAIT_MS || 2000));
  const expectedGitSha = process.env.EXPECTED_GIT_SHA || '';
  const requireExactGitSha = /^(1|true|yes|on)$/i.test(process.env.REQUIRE_EXACT_GIT_SHA || '');

  console.log(`[SMOKE] Starting smoke test against ${url}...`);
  console.log(`[SMOKE] Max retries: ${maxRetries}, Wait: ${waitMs}ms`);
  console.log(`[SMOKE] Expected Git SHA: ${expectedGitSha || 'N/A (will accept any SHA)'}`);
  console.log(
    `[SMOKE] Exact Git SHA required: ${requireExactGitSha ? 'yes' : 'no (warn only on mismatch)'}`
  );

  let lastError: string | null = null;

  for (let i = 0; i < maxRetries; i++) {
    const attemptStart = Date.now();

    try {
      console.log(`[SMOKE] Attempt ${i + 1}/${maxRetries}...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      const attemptDuration = Date.now() - attemptStart;
      console.log(`[SMOKE] HTTP ${res.status} in ${attemptDuration}ms`);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const body = (await res.json()) as SmokeHealthBody;
      const evaluation = evaluateSmokeHealth({
        body,
        expectedGitSha,
        requireExactGitSha,
      });

      if (!evaluation.ok) {
        throw new Error(evaluation.error || 'Health endpoint validation failed');
      }

      if (evaluation.warning) {
        console.warn(`[SMOKE] Warning: ${evaluation.warning}`);
      }

      console.log(`[SMOKE] Success! API is healthy.`);
      console.log(`  - Uptime: ${String(body.uptime ?? 'unknown')}s`);
      console.log(
        `  - Git SHA: ${typeof body.gitSha === 'string' ? body.gitSha.slice(0, 8) : 'unknown'}`
      );
      console.log(`  - Version: ${String(body.version ?? 'unknown')}`);

      process.exit(0);
    } catch (error) {
      const attemptDuration = Date.now() - attemptStart;
      const message = error instanceof Error ? error.message : String(error);
      lastError = message;

      console.log(
        `[SMOKE] Attempt ${i + 1}/${maxRetries} failed after ${attemptDuration}ms: ${message}`
      );

      if (message.includes('timeout')) {
        console.log(
          '[SMOKE] Hint: Server took too long to respond. Check if backend is starting properly.'
        );
      } else if (message.includes('fetch failed') || message.includes('ECONNREFUSED')) {
        console.log(
          '[SMOKE] Hint: Server not reachable. Check if backend is running on the expected URL.'
        );
      } else if (message.includes('abort')) {
        console.log('[SMOKE] Hint: Request timed out after 10s. Server might be overloaded.');
      }
    }

    if (i < maxRetries - 1) {
      console.log(`[SMOKE] Waiting ${waitMs}ms before next attempt...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  console.error('');
  console.error('[SMOKE] Smoke test failed.');
  console.error(
    `[SMOKE] Failed after ${maxRetries} retries (total time: ~${Math.round((maxRetries * waitMs) / 1000)}s)`
  );
  console.error(`[SMOKE] Last error: ${lastError}`);
  console.error('');
  console.error('[SMOKE] Troubleshooting:');
  console.error('  1. Check backend logs for startup errors');
  console.error('  2. Verify backend is listening on the expected port/URL');
  console.error('  3. Check if database migrations completed successfully');
  console.error('  4. Verify environment variables are set correctly');
  console.error('  5. Check Railway deployment status: https://railway.app/dashboard');
  console.error('');

  process.exit(1);
}

const currentModulePath = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] ? path.resolve(process.argv[1]) === currentModulePath : false;

if (isMainModule) {
  void runSmokeTest();
}
