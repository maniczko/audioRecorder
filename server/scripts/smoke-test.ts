import { config } from '../config.ts';
import { buildLocalHealthUrl } from '../runtime.ts';

async function runSmokeTest() {
  const url = process.env.SMOKE_TEST_URL || buildLocalHealthUrl(config);
  const maxRetries = Math.max(1, Number(process.env.SMOKE_MAX_RETRIES || 5));
  const waitMs = Math.max(250, Number(process.env.SMOKE_WAIT_MS || 2000));
  const expectedGitSha = process.env.EXPECTED_GIT_SHA || '';

  console.log(`Starting smoke test against ${url}...`);

  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const body = await res.json();
        if (body?.status !== 'ok') {
          throw new Error(`Health endpoint returned unexpected status: ${body?.status}`);
        }
        if (expectedGitSha && body?.gitSha && body.gitSha !== expectedGitSha) {
          throw new Error(`Health gitSha mismatch. Expected ${expectedGitSha}, got ${body.gitSha}`);
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
