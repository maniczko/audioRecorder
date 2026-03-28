import { config } from '../config.ts';
import { buildLocalHealthUrl } from '../runtime.ts';

async function runSmokeTest() {
  const url = process.env.SMOKE_TEST_URL || buildLocalHealthUrl(config);
  const maxRetries = Math.max(1, Number(process.env.SMOKE_MAX_RETRIES || 5));
  const waitMs = Math.max(250, Number(process.env.SMOKE_WAIT_MS || 2000));
  const expectedGitSha = process.env.EXPECTED_GIT_SHA || '';
  // Optional: provide a frontend Origin to verify CORS headers are returned
  const corsOrigin = process.env.SMOKE_CORS_ORIGIN || '';

  console.log(`Starting smoke test against ${url}...`);
  if (corsOrigin) {
    console.log(`CORS check enabled for origin: ${corsOrigin}`);
  }

  for (let i = 0; i < maxRetries; i++) {
    try {
      const headers: Record<string, string> = {};
      if (corsOrigin) {
        headers['Origin'] = corsOrigin;
      }
      const res = await fetch(url, { headers });
      if (res.ok) {
        const body = await res.json();
        if (body?.status !== 'ok') {
          throw new Error(`Health endpoint returned unexpected status: ${body?.status}`);
        }
        if (expectedGitSha && body?.gitSha && body.gitSha !== expectedGitSha) {
          throw new Error(`Health gitSha mismatch. Expected ${expectedGitSha}, got ${body.gitSha}`);
        }

        // Verify CORS header is present when an Origin was sent
        if (corsOrigin) {
          const acao = res.headers.get('access-control-allow-origin');
          if (!acao) {
            throw new Error(
              `CORS check failed: Access-Control-Allow-Origin header missing in /health response`
            );
          }
          console.log(`CORS check passed. Access-Control-Allow-Origin: ${acao}`);
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
