import { config } from "../config.ts";
import { buildLocalHealthUrl } from "../runtime.ts";

async function runSmokeTest() {
  const url = buildLocalHealthUrl(config);
  const maxRetries = 5;
  const waitMs = 2000;

  console.log(`Starting smoke test against ${url}...`);

  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const body = await res.json();
        console.log(`Smoke test passed! API is healthy. Uptime: ${body.uptime}s`);
        process.exit(0);
      }
    } catch (e: any) {
      console.log(`Attempt ${i + 1}/${maxRetries} failed: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, waitMs));
  }
  console.error(`Smoke test failed after ${maxRetries} retries. Server not responding or unhealthy.`);
  process.exit(1);
}

runSmokeTest();
