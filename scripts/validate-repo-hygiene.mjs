import { execFileSync } from 'node:child_process';
import path from 'node:path';

export const FORBIDDEN_TRACKED_ARTIFACT_RULES = [
  {
    id: 'dot-logs',
    pattern: /^\.logs\//,
    reason: 'runtime and test logs must stay out of git',
  },
  {
    id: 'local-reports',
    pattern: /^reports\//,
    reason: 'local agent, smoke, and visual reports must be artifacts, not committed files',
  },
  {
    id: 'playwright-artifacts',
    pattern: /^(playwright-report|test-results)\//,
    reason: 'Playwright reports and test-results are generated artifacts',
  },
  {
    id: 'old-dockerfile-copy',
    pattern: /^Dockerfile\.old\.txt$/,
    reason: 'obsolete deployment file copies make production readiness ambiguous',
  },
  {
    id: 'railway-log-dump',
    pattern: /^(railway[-_]logs?[-_].*|railway_logs_latest)\.txt$/i,
    reason: 'Railway log dumps may contain stale or sensitive diagnostics',
  },
  {
    id: 'ad-hoc-test-results',
    pattern:
      /^(test[-_]?results|test[-_]?output|server[-_]?test[-_]?result|server[-_]?test[-_]?output|media[-_]?test)\.txt$/i,
    reason: 'ad hoc test result files should be regenerated locally or uploaded as CI artifacts',
  },
  {
    id: 'root-debug-output',
    pattern: /^[^/]*(?:test|debug|coverage)[-_][^/]*\.(?:txt|log)$/i,
    reason: 'root debug/test/coverage output files should not be committed',
  },
];

export function normalizeGitPath(filePath) {
  return String(filePath || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .trim();
}

export function findForbiddenTrackedArtifacts(filePaths = []) {
  return filePaths
    .map(normalizeGitPath)
    .filter(Boolean)
    .map((filePath) => {
      const rule = FORBIDDEN_TRACKED_ARTIFACT_RULES.find((candidate) =>
        candidate.pattern.test(filePath)
      );
      return rule
        ? {
            path: filePath,
            ruleId: rule.id,
            reason: rule.reason,
          }
        : null;
    })
    .filter(Boolean);
}

export function readTrackedFiles({ cwd = process.cwd() } = {}) {
  const output = execFileSync('git', ['ls-files'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return output.split(/\r?\n/).filter(Boolean);
}

export function validateRepoHygiene({ trackedFiles = readTrackedFiles() } = {}) {
  const violations = findForbiddenTrackedArtifacts(trackedFiles);

  if (violations.length > 0) {
    const preview = violations
      .slice(0, 40)
      .map((violation) => `- ${violation.path} (${violation.ruleId}: ${violation.reason})`)
      .join('\n');
    const suffix =
      violations.length > 40
        ? `\n...and ${violations.length - 40} more forbidden artifact(s).`
        : '';

    throw new Error(
      `Forbidden generated artifacts are tracked in git:\n${preview}${suffix}\nRemove them from git and keep them ignored.`
    );
  }

  return true;
}

const entrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isMainModule =
  entrypointPath === path.resolve(process.cwd(), 'scripts/validate-repo-hygiene.mjs');

if (isMainModule) {
  validateRepoHygiene();
  console.log('Repo hygiene validation passed.');
}
