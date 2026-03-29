import { config } from '../config.ts';
import { buildLocalHealthUrl } from '../runtime.ts';

async function runSmokeTest() {
  const url = process.env.SMOKE_TEST_URL || buildLocalHealthUrl(config);
  const maxRetries = Math.max(1, Number(process.env.SMOKE_MAX_RETRIES || 5));
  const waitMs = Math.max(250, Number(process.env.SMOKE_WAIT_MS || 2000));
  const expectedGitSha = process.env.EXPECTED_GIT_SHA || '';

  console.log(`[SMOKE] Starting smoke test against ${url}...`);
  console.log(`[SMOKE] Max retries: ${maxRetries}, Wait: ${waitMs}ms`);
  console.log(`[SMOKE] Expected Git SHA: ${expectedGitSha || 'N/A'}`);

  let lastError: string | null = null;

  for (let i = 0; i < maxRetries; i++) {
    const attemptStart = Date.now();

    try {
      console.log(`[SMOKE] Attempt ${i + 1}/${maxRetries}...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

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

      const body = await res.json();

      if (body?.status !== 'ok') {
        throw new Error(`Health endpoint returned unexpected status: ${body?.status}`);
      }

      if (expectedGitSha && body?.gitSha && body.gitSha !== expectedGitSha) {
        throw new Error(`Health gitSha mismatch. Expected ${expectedGitSha}, got ${body.gitSha}`);
      }

      console.log(`[SMOKE] ✅ Success! API is healthy.`);
      console.log(`  - Uptime: ${body.uptime}s`);
      console.log(`  - Git SHA: ${body.gitSha || 'unknown'}`);
      console.log(`  - Version: ${body.version || 'unknown'}`);

      process.exit(0);
    } catch (e: any) {
      const attemptDuration = Date.now() - attemptStart;
      lastError = e.message;
      console.log(
        `[SMOKE] ❌ Attempt ${i + 1}/${maxRetries} failed after ${attemptDuration}ms: ${e.message}`
      );

      // Log more details for common errors
      if (e.message.includes('timeout')) {
        console.log(
          `[SMOKE] Hint: Server took too long to respond. Check if backend is starting properly.`
        );
      } else if (e.message.includes('fetch failed') || e.message.includes('ECONNREFUSED')) {
        console.log(
          `[SMOKE] Hint: Server not reachable. Check if backend is running on the expected URL.`
        );
      } else if (e.message.includes('abort')) {
        console.log(`[SMOKE] Hint: Request timed out after 10s. Server might be overloaded.`);
      }
    }

    if (i < maxRetries - 1) {
      console.log(`[SMOKE] Waiting ${waitMs}ms before next attempt...`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  console.error(``);
  console.error(`[SMOKE] ╔═══════════════════════════════════════════════════════════╗`);
  console.error(`[SMOKE] ║  ❌ SMOKE TEST FAILED                                     ║`);
  console.error(`[SMOKE] ╚═══════════════════════════════════════════════════════════╝`);
  console.error(
    `[SMOKE] Failed after ${maxRetries} retries (total time: ~${Math.round((maxRetries * waitMs) / 1000)}s)`
  );
  console.error(`[SMOKE] Last error: ${lastError}`);
  console.error(``);
  console.error(`[SMOKE] Troubleshooting:`);
  console.error(`  1. Check backend logs for startup errors`);
  console.error(`  2. Verify backend is listening on the expected port/URL`);
  console.error(`  3. Check if database migrations completed successfully`);
  console.error(`  4. Verify environment variables are set correctly`);
  console.error(`  5. Check Railway deployment status: https://railway.app/dashboard`);
  console.error(``);

  process.exit(1);
}

runSmokeTest();
