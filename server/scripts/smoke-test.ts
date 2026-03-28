import { config } from '../config.ts';
import { buildLocalHealthUrl } from '../runtime.ts';

// Frontend origin used to verify CORS headers in the smoke test.
// Set SMOKE_CORS_ORIGIN to the actual deployed Vercel URL.
// Defaults to a generic *.vercel.app URL which the server auto-allows,
// so CORS validation works even without an explicit origin configured.
const DEFAULT_SMOKE_CORS_ORIGIN = 'https://example-app.vercel.app';

async function runSmokeTest() {
  const url = process.env.SMOKE_TEST_URL || buildLocalHealthUrl(config);
  const maxRetries = Math.max(1, Number(process.env.SMOKE_MAX_RETRIES || 5));
  const waitMs = Math.max(250, Number(process.env.SMOKE_WAIT_MS || 2000));
  const expectedGitSha = process.env.EXPECTED_GIT_SHA || '';
  const corsOrigin = process.env.SMOKE_CORS_ORIGIN || DEFAULT_SMOKE_CORS_ORIGIN;

  console.log(`Starting smoke test against ${url}...`);
  console.log(`CORS origin under test: ${corsOrigin}`);

  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url, {
        headers: { Origin: corsOrigin },
      });
      if (res.ok) {
        const body = await res.json();
        if (body?.status !== 'ok') {
          throw new Error(`Health endpoint returned unexpected status: ${body?.status}`);
        }
        if (expectedGitSha && body?.gitSha && body.gitSha !== expectedGitSha) {
          throw new Error(`Health gitSha mismatch. Expected ${expectedGitSha}, got ${body.gitSha}`);
        }

        // Verify CORS header is present and reflects the requested origin.
        // A missing or mismatched header means browser requests from the frontend will be blocked.
        const acao = res.headers.get('Access-Control-Allow-Origin');
        if (!acao) {
          console.error(
            `[CORS] FAIL: /health response is missing the Access-Control-Allow-Origin header. ` +
            `Browser requests from ${corsOrigin} will be blocked by CORS policy.`
          );
          process.exit(1);
        } else if (acao !== corsOrigin && acao !== '*') {
          console.error(
            `[CORS] FAIL: Access-Control-Allow-Origin is "${acao}" but expected "${corsOrigin}". ` +
            `Cross-origin requests from the frontend will be blocked.`
          );
          process.exit(1);
        } else {
          console.log(`[CORS] OK: Access-Control-Allow-Origin="${acao}"`);
        }

        console.log(
          `Smoke test passed! API is healthy. Uptime: ${body.uptime}s, gitSha: ${body.gitSha || 'unknown'}`
        );
        process.exit(0);
      }
    } catch (e: any) {
      console.log(`Attempt ${i + 1}/${maxRetries} failed: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, waitMs));
  }
  console.error(
    `Smoke test failed after ${maxRetries} retries. Server not responding or unhealthy.`
  );
  process.exit(1);
}

runSmokeTest();
