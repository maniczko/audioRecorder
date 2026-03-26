/**
 * Automated STT Provider Benchmark Runner
 *
 * Uruchamia porównanie providerów STT i generuje raport w formacie JSON/Markdown.
 * Może być wywoływany przez CI/CD lub cron.
 *
 * Uzycie:
 *   pnpm run benchmark:stt:run
 *   pnpm run benchmark:stt:report
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BENCHMARK_DIR = path.join(__dirname, '..', 'benchmarks');
const RESULTS_DIR = path.join(__dirname, '..', 'benchmarks', 'results');

interface BenchmarkResult {
  timestamp: string;
  gitSha: string;
  providerId: string;
  providerLabel: string;
  model: string;
  averageWerProxy: number | null;
  failureRate: number;
  averageDurationMs: number;
  samplesCount: number;
}

interface BenchmarkReport {
  runId: string;
  timestamp: string;
  gitSha: string;
  datasetName: string;
  providers: BenchmarkResult[];
  winner: {
    providerId: string;
    providerLabel: string;
    werProxy: number;
  } | null;
  summary: {
    totalSamples: number;
    providersCount: number;
    bestWerProxy: number;
    worstWerProxy: number;
    averageWerProxy: number;
  };
}

function ensureDirectories() {
  if (!fs.existsSync(BENCHMARK_DIR)) {
    fs.mkdirSync(BENCHMARK_DIR, { recursive: true });
  }
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

function getGitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function runBenchmark(manifestPath: string): string {
  console.log(`🏃 Running benchmark for ${manifestPath}...`);

  const output = execSync(`pnpm exec tsx server/scripts/benchmark-polish-stt.ts ${manifestPath}`, {
    encoding: 'utf8',
    stdio: 'pipe',
  });

  return output;
}

function parseBenchmarkOutput(output: string): BenchmarkResult[] {
  // Parse JSON output from benchmark script
  const jsonMatch = output.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Nie udało się sparsować outputu benchmarku');
  }

  const data = JSON.parse(jsonMatch[0]);
  return data.providers || [];
}

function generateReport(results: BenchmarkResult[], datasetName: string): BenchmarkReport {
  const successfulProviders = results.filter((r) => r.averageWerProxy !== null);
  const bestProvider =
    successfulProviders.length > 0
      ? successfulProviders.reduce((best, current) =>
          current.averageWerProxy! < best.averageWerProxy! ? current : best
        )
      : null;

  const werProxies = successfulProviders
    .map((r) => r.averageWerProxy!)
    .filter((x): x is number => x !== null);

  return {
    runId: `benchmark-${Date.now()}`,
    timestamp: new Date().toISOString(),
    gitSha: getGitSha(),
    datasetName,
    providers: results,
    winner: bestProvider
      ? {
          providerId: bestProvider.providerId,
          providerLabel: bestProvider.providerLabel,
          werProxy: bestProvider.averageWerProxy!,
        }
      : null,
    summary: {
      totalSamples: results.reduce((sum, r) => sum + r.samplesCount, 0),
      providersCount: results.length,
      bestWerProxy: Math.min(...werProxies),
      worstWerProxy: Math.max(...werProxies),
      averageWerProxy:
        werProxies.length > 0 ? werProxies.reduce((a, b) => a + b, 0) / werProxies.length : 0,
    },
  };
}

function saveReport(report: BenchmarkReport) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(RESULTS_DIR, `benchmark-${timestamp}.json`);
  const mdPath = path.join(RESULTS_DIR, `benchmark-${timestamp}.md`);

  // Save JSON
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  // Save Markdown
  const mdContent = generateMarkdownReport(report);
  fs.writeFileSync(mdPath, mdContent);

  console.log(`✅ Report saved to ${mdPath}`);
  return { jsonPath, mdPath };
}

function generateMarkdownReport(report: BenchmarkReport): string {
  const lines = [
    `# 🎯 STT Provider Benchmark Report`,
    ``,
    `**Run ID:** ${report.runId}`,
    `**Timestamp:** ${report.timestamp}`,
    `**Git SHA:** ${report.gitSha}`,
    `**Dataset:** ${report.datasetName}`,
    ``,
    `## 🏆 Winner`,
    ``,
  ];

  if (report.winner) {
    lines.push(
      `**${report.winner.providerLabel}** (${report.winner.providerId})`,
      `- WER Proxy: **${report.winner.werProxy.toFixed(4)}**`,
      ``
    );
  } else {
    lines.push(`❌ No successful providers`, ``);
  }

  lines.push(
    `## 📊 Summary`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total Samples | ${report.summary.totalSamples} |`,
    `| Providers Tested | ${report.summary.providersCount} |`,
    `| Best WER Proxy | ${report.summary.bestWerProxy.toFixed(4)} |`,
    `| Worst WER Proxy | ${report.summary.worstWerProxy.toFixed(4)} |`,
    `| Average WER Proxy | ${report.summary.averageWerProxy.toFixed(4)} |`,
    ``,
    `## 📈 Provider Results`,
    ``,
    `| Provider | Model | WER Proxy ↓ | Failure Rate ↓ | Avg Duration (ms) | Samples |`,
    `|----------|-------|-------------|----------------|-------------------|---------|`
  );

  // Sort by WER Proxy (lower is better)
  const sortedProviders = [...report.providers].sort((a, b) => {
    if (a.averageWerProxy === null && b.averageWerProxy === null) return 0;
    if (a.averageWerProxy === null) return 1;
    if (b.averageWerProxy === null) return -1;
    return a.averageWerProxy - b.averageWerProxy;
  });

  for (const provider of sortedProviders) {
    const werProxy =
      provider.averageWerProxy !== null ? provider.averageWerProxy.toFixed(4) : 'N/A';
    const emoji = provider === sortedProviders[0] && provider.averageWerProxy !== null ? '🥇' : '';

    lines.push(
      `| ${emoji} **${provider.providerLabel}** | ${provider.model} | ${werProxy} | ${(provider.failureRate * 100).toFixed(1)}% | ${provider.averageDurationMs} | ${provider.samplesCount} |`
    );
  }

  lines.push(
    ``,
    `## ℹ️ Notes`,
    `- WER Proxy (Word Error Rate): Im niższy, tym lepiej. 0 = perfect match.`,
    `- Failure Rate: Procent nieudanych transkrypcji.`,
    `- Avg Duration: Średni czas transkrypcji na próbkę.`,
    ``,
    `---`,
    `*Generated automatically by benchmark runner.*`
  );

  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  ensureDirectories();

  if (command === 'run') {
    const manifestPath = args[1] || path.join(BENCHMARK_DIR, 'pl-dataset.json');

    if (!fs.existsSync(manifestPath)) {
      console.error(`❌ Manifest not found: ${manifestPath}`);
      console.log('Create a manifest file with audio samples to benchmark.');
      process.exit(1);
    }

    try {
      const output = runBenchmark(manifestPath);
      const results = parseBenchmarkOutput(output);
      const datasetName = path.basename(manifestPath, '.json');
      const report = generateReport(results, datasetName);
      saveReport(report);

      console.log('\n📊 Benchmark Results:');
      console.log(generateMarkdownReport(report));
    } catch (error: any) {
      console.error('❌ Benchmark failed:', error.message);
      if (error.stdout) console.error(error.stdout.toString());
      if (error.stderr) console.error(error.stderr.toString());
      process.exit(1);
    }
  } else if (command === 'list') {
    const files = fs.readdirSync(RESULTS_DIR).filter((f) => f.endsWith('.json'));
    console.log('Available benchmark results:');
    for (const file of files.slice(-10)) {
      console.log(`  - ${file}`);
    }
  } else if (command === 'latest') {
    const files = fs
      .readdirSync(RESULTS_DIR)
      .filter((f) => f.endsWith('.md'))
      .sort();
    if (files.length === 0) {
      console.log('No benchmark results found.');
    } else {
      const latest = files[files.length - 1];
      console.log(fs.readFileSync(path.join(RESULTS_DIR, latest), 'utf8'));
    }
  } else {
    console.log(`
🎯 STT Benchmark Runner

Usage:
  pnpm run benchmark:stt:run [manifest]  - Run benchmark
  pnpm run benchmark:stt:list            - List recent results
  pnpm run benchmark:stt:latest          - Show latest report

Examples:
  pnpm run benchmark:stt:run
  pnpm run benchmark:stt:run benchmarks/pl-dataset.json
  pnpm run benchmark:stt:latest
`);
  }
}

main().catch(console.error);
