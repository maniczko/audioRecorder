#!/usr/bin/env node

/**
 * Smart Retry Script
 *
 * Runs tests with intelligent retry logic and detailed logging.
 * Creates a failure report if tests fail after all retries.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
let attempt = 0;
const failures = [];
const DEFAULT_COVERAGE_ENABLED = false;

function normalizeBoolean(value, fallback = false) {
  if (value == null || value === '') {
    return fallback;
  }

  return /^(1|true|yes|on)$/i.test(String(value));
}

function buildVitestCommand(options = {}) {
  const coverageEnabled = normalizeBoolean(
    options.coverageEnabled,
    DEFAULT_COVERAGE_ENABLED
  );

  return coverageEnabled ? 'vitest run' : 'vitest run --coverage.enabled=false';
}

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
  }[type];

  console.log(`${prefix} [${timestamp}] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  while (attempt < MAX_RETRIES) {
    try {
      log(`Test attempt ${attempt + 1}/${MAX_RETRIES}...`, 'info');

      execSync(buildVitestCommand({ coverageEnabled: process.env.SMART_RETRY_COVERAGE }), {
        stdio: 'inherit',
        env: { ...process.env, CI: 'true' },
      });

      log('All tests passed!', 'success');
      process.exit(0);
    } catch (error) {
      attempt++;

      const failure = {
        attempt,
        timestamp: new Date().toISOString(),
        error: error.message,
        status: error.status,
      };

      failures.push(failure);

      if (attempt >= MAX_RETRIES) {
        log(`Tests failed after ${MAX_RETRIES} attempts`, 'error');

        // Create failure report
        const report = {
          summary: 'Tests failed after retries',
          totalAttempts: MAX_RETRIES,
          failures,
          timestamp: new Date().toISOString(),
        };

        const reportPath = path.join(process.cwd(), 'test-failure-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        log(`Failure report saved to: ${reportPath}`, 'warning');
        process.exit(1);
      }

      log(`Attempt ${attempt} failed, retrying in ${RETRY_DELAY_MS}ms...`, 'warning');
      await sleep(RETRY_DELAY_MS);
    }
  }
}

module.exports = {
  buildVitestCommand,
  runTests,
};

if (require.main === module) {
  runTests().catch((error) => {
    log(`Unexpected error: ${error.message}`, 'error');
    process.exit(1);
  });
}
