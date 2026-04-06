#!/usr/bin/env node

/**
 * Test Results JSON Generator
 *
 * Parses Vitest output and generates test-results.json for the dashboard.
 * Run after tests: node scripts/generate-test-results.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/**
 * Parse Vitest JSON output (from --reporter=json)
 */
function parseVitestResults(resultsPath) {
  if (!fs.existsSync(resultsPath)) {
    console.error('❌ Vitest results file not found:', resultsPath);
    console.error('Run: npx vitest run --reporter=json --outputFile=reports/vitest-results.json');
    process.exit(1);
  }

  const raw = fs.readFileSync(resultsPath, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Extract test results from Vitest output
 */
function extractResults(vitestData) {
  const files = [];
  const failures = [];
  let total = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  if (vitestData.numTotalTestSuites) {
    // Vitest v4+ format
    const testResults = vitestData.testResults || [];

    testResults.forEach((file) => {
      const fileName = path.relative(rootDir, file.name);
      const fileStats = {
        file: fileName,
        passed: file.assertionResults?.filter((r) => r.status === 'passed').length || 0,
        failed: file.assertionResults?.filter((r) => r.status === 'failed').length || 0,
        skipped:
          file.assertionResults?.filter((r) => r.status === 'pending' || r.status === 'skipped')
            .length || 0,
        duration: file.endTime - file.startTime,
      };

      files.push(fileStats);
      total += fileStats.passed + fileStats.failed + fileStats.skipped;
      passed += fileStats.passed;
      failed += fileStats.failed;
      skipped += fileStats.skipped;

      // Collect failures
      file.assertionResults
        ?.filter((r) => r.status === 'failed')
        .forEach((test) => {
          failures.push({
            file: fileName,
            test: test.title,
            error: (test.failureMessages || []).join('\n'),
          });
        });
    });
  }

  return {
    timestamp: new Date().toISOString(),
    summary: { total, passed, failed, skipped },
    files,
    failures,
    coverage: {
      frontend: 55, // Will be updated by coverage script
      backend: 65,
    },
  };
}

/**
 * Generate simplified results from console output
 * Fallback when JSON reporter isn't available
 */
function generateFromConsoleOutput(outputPath) {
  if (!fs.existsSync(outputPath)) {
    console.log('⚠️  No test output found, generating empty report');
    return {
      timestamp: new Date().toISOString(),
      summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
      files: [],
      failures: [],
      coverage: { frontend: 55, backend: 65 },
    };
  }

  const output = fs.readFileSync(outputPath, 'utf-8');

  // Parse summary line: "Test Files  3 failed | 12 passed | 15 total"
  const fileMatch = output.match(/Test Files\s+([\d\s|failed|passed|total]+)/);
  const testsMatch = output.match(/Tests\s+([\d\s|failed|passed|skipped|total]+)/);

  let total = 0,
    passed = 0,
    failed = 0,
    skipped = 0;

  if (testsMatch) {
    const counts = testsMatch[1].match(/(\d+)\s+(passed|failed|skipped)/g);
    if (counts) {
      counts.forEach((count) => {
        const [num, status] = count.trim().split(/\s+/);
        if (status === 'passed') passed = parseInt(num);
        if (status === 'failed') failed = parseInt(num);
        if (status === 'skipped') skipped = parseInt(num);
      });
      total = passed + failed + skipped;
    }
  }

  return {
    timestamp: new Date().toISOString(),
    summary: { total, passed, failed, skipped },
    files: [],
    failures: [],
    coverage: { frontend: 55, backend: 65 },
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('🧪 Generating test dashboard data...\n');

  const vitestJsonPath = path.join(rootDir, 'reports', 'vitest-results.json');
  const consoleOutputPath = path.join(rootDir, 'reports', 'test-output.txt');

  let dashboardData;

  // Try Vitest JSON first
  if (fs.existsSync(vitestJsonPath)) {
    console.log('✓ Found Vitest JSON results');
    try {
      const vitestData = parseVitestResults(vitestJsonPath);
      dashboardData = extractResults(vitestData);
    } catch (error) {
      console.error('⚠️  Failed to parse Vitest JSON, falling back to console output');
      dashboardData = generateFromConsoleOutput(consoleOutputPath);
    }
  } else {
    console.log('⚠️  No Vitest JSON found, using console output');
    dashboardData = generateFromConsoleOutput(consoleOutputPath);
  }

  // Write dashboard data
  const outputPath = path.join(rootDir, 'scripts', 'test-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(dashboardData, null, 2));

  console.log(`\n✓ Dashboard data saved to: scripts/test-results.json`);
  console.log(`📊 Summary:`);
  console.log(`   Total: ${dashboardData.summary.total}`);
  console.log(`   Passed: ${dashboardData.summary.passed}`);
  console.log(`   Failed: ${dashboardData.summary.failed}`);
  console.log(`   Skipped: ${dashboardData.summary.skipped}`);
  console.log(`\n🌐 Open dashboard: scripts/test-dashboard.html`);
}

main().catch(console.error);
