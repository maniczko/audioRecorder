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

export function isAllowedDocumentedSkip(contextLines, now = new Date()) {
  const context = contextLines.join('\n');
  const hasIssue = /Issue:\s*#\d+/i.test(context);
  const hasReason = /Reason:\s*\S.{10,}/i.test(context);
  const expiryMatch = context.match(/Expires:\s*(\d{4}-\d{2}-\d{2})/i);
  if (!hasIssue || !hasReason || !expiryMatch) return false;

  const expiry = new Date(`${expiryMatch[1]}T23:59:59.999Z`);
  return Number.isFinite(expiry.getTime()) && expiry.getTime() >= now.getTime();
}

function isDisallowedCriticalSuiteSkip(relativePath, title) {
  return (
    (relativePath === 'tests/e2e/critical-flows.spec.js' && /critical user flows/i.test(title)) ||
    (relativePath === 'tests/e2e/visual-regression.spec.js' &&
      /visual regression - core components/i.test(title))
  );
}

export function findUnexpectedSkips({ root = rootDir } = {}) {
  const files = criticalTargets.flatMap((target) => collectFiles(path.join(root, target)));
  const issues = [];

  for (const file of files) {
    const relative = path.relative(root, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);
    for (const match of content.matchAll(skipPattern)) {
      const title = match[2];
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      const contextLines = lines.slice(Math.max(0, line - 7), line - 1);
      if (
        isDisallowedCriticalSuiteSkip(relative, title) ||
        !isAllowedDocumentedSkip(contextLines)
      ) {
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
