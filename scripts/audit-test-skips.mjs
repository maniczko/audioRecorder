import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const criticalTargets = [
  'tests/e2e',
  'src/store/authStore.test.ts',
  'src/store/workspaceStore.test.ts',
  'src/store/meetingsStore.test.ts',
  'src/store/uiStore.test.ts',
];

const allowedSkips = new Map([
  [
    'tests/e2e/critical-flows.spec.js',
    new Set(['Critical User Flows']),
  ],
  [
    'tests/e2e/meeting.spec.js',
    new Set(['klikniecie Nowe resetuje formularz']),
  ],
  [
    'tests/e2e/visual-regression.spec.js',
    new Set(['Visual Regression - Core Components']),
  ],
]);

const skipPattern = /\b(?:test|it|describe)\.skip\s*\(\s*(['"`])([^'"`]+)\1/g;

function collectFiles(targetPath, files = []) {
  if (!fs.existsSync(targetPath)) return files;
  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath)) {
      collectFiles(path.join(targetPath, entry), files);
    }
    return files;
  }
  if (/\.(js|ts|tsx)$/.test(targetPath)) files.push(targetPath);
  return files;
}

export function findUnexpectedSkips({ root = rootDir } = {}) {
  const files = criticalTargets.flatMap((target) => collectFiles(path.join(root, target)));
  const issues = [];

  for (const file of files) {
    const relative = path.relative(root, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    for (const match of content.matchAll(skipPattern)) {
      const title = match[2];
      const allowedTitles = allowedSkips.get(relative);
      if (!allowedTitles?.has(title)) {
        const line = content.slice(0, match.index).split(/\r?\n/).length;
        issues.push({ file: relative, line, title });
      }
    }
  }

  return issues;
}

const entrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isMainModule = entrypointPath === path.resolve(rootDir, 'scripts/audit-test-skips.mjs');

if (isMainModule) {
  const issues = findUnexpectedSkips();
  if (issues.length > 0) {
    console.error('Unexpected skipped critical tests:');
    for (const issue of issues) {
      console.error(`- ${issue.file}:${issue.line} ${issue.title}`);
    }
    process.exitCode = 1;
  } else {
    console.log('Critical skip audit passed.');
  }
}
