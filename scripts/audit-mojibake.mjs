import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const defaultMojibakeAuditTargets = [
  '.github',
  '.codex',
  '.qwen',
  'AGENTS.md',
  'docs/QUALITY_GATES.md',
  'docs/DESIGN_SYSTEM_RULES.md',
  'index.html',
  'playwright.config.js',
  'scripts/accessibility-audit.cjs',
  'scripts/audit-build-warnings.mjs',
  'scripts/release-rehearsal.mjs',
  'scripts/production-smoke.mjs',
  'src',
  'server',
  'tests/e2e',
];

const excludedPathParts = new Set([
  '.git',
  'node_modules',
  'build',
  'coverage',
  'reports',
  'test-results',
  'layout-visual.spec.js-snapshots',
  'visual-regression.spec.ts-snapshots',
]);

const textFilePattern = /\.(cjs|css|html|js|json|md|mjs|toml|ts|tsx|yml|yaml)$/i;
const suspiciousMojibakePattern =
  /\ufffd|\u0102|\u00c2|\u00c4|\u00c5|\u00e2[\u20ac\u201a-\u201e\u2020-\u2022]?|\u0111\u017a|ÔÄ/u;

function shouldSkip(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  return normalized.split('/').some((part) => excludedPathParts.has(part));
}

function collectFiles(targetPath, collected = []) {
  if (!fs.existsSync(targetPath)) {
    return collected;
  }

  const stat = fs.statSync(targetPath);
  const relativePath = path.relative(rootDir, targetPath);
  if (shouldSkip(relativePath)) {
    return collected;
  }

  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath)) {
      collectFiles(path.join(targetPath, entry), collected);
    }
    return collected;
  }

  if (textFilePattern.test(targetPath)) {
    collected.push(targetPath);
  }
  return collected;
}

export function findMojibakeIssues({ root = rootDir, targets = defaultMojibakeAuditTargets } = {}) {
  const files = targets.flatMap((target) => collectFiles(path.join(root, target)));
  const issues = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (suspiciousMojibakePattern.test(line)) {
        issues.push({
          file: path.relative(root, file).replace(/\\/g, '/'),
          line: index + 1,
          excerpt: line.trim().slice(0, 160),
        });
      }
    });
  }

  return issues;
}

const entrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isMainModule = entrypointPath === path.resolve(rootDir, 'scripts/audit-mojibake.mjs');

if (isMainModule) {
  const issues = findMojibakeIssues();
  if (issues.length > 0) {
    console.error('Mojibake audit failed:');
    for (const issue of issues) {
      console.error(`- ${issue.file}:${issue.line} ${issue.excerpt}`);
    }
    process.exitCode = 1;
  } else {
    console.log('Mojibake audit passed for release-critical UI/config surfaces.');
  }
}
