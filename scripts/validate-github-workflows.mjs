import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { parse } from 'yaml';

const workflowDir = path.resolve('.github/workflows');
const canonicalSetupAction = './.github/actions/setup-node-pnpm';
const canonicalSetupActionPath = path.resolve('.github/actions/setup-node-pnpm/action.yml');
const suspiciousMojibakePattern =
  /[\u0102\u00c4]\S*|\u00e2[\u20ac\u2022\u2020\u201d\u2122]?|\u0111\u017a|\ufffd/u;

export function validateWorkflowContent(content, relativePath) {
  if (suspiciousMojibakePattern.test(content)) {
    throw new Error(`Workflow validation failed for ${relativePath}: suspicious mojibake detected`);
  }

  const parsed = parse(content);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Workflow validation failed for ${relativePath}: file does not parse`);
  }

  if (typeof parsed.name !== 'string' || parsed.name.trim().length === 0) {
    throw new Error(`Workflow validation failed for ${relativePath}: missing workflow name`);
  }

  if (!('on' in parsed) || !('jobs' in parsed)) {
    throw new Error(
      `Workflow validation failed for ${relativePath}: missing required on/jobs keys`
    );
  }

  if (content.includes('corepack enable')) {
    throw new Error(
      `Workflow validation failed for ${relativePath}: Corepack setup is not allowed; use ${canonicalSetupAction}`
    );
  }

  if (content.includes('uses: pnpm/action-setup@')) {
    throw new Error(
      `Workflow validation failed for ${relativePath}: direct pnpm action setup is not allowed; use ${canonicalSetupAction}`
    );
  }

  if (/\bpnpm install\b/u.test(content)) {
    throw new Error(
      `Workflow validation failed for ${relativePath}: direct pnpm install is not allowed; select an install profile in ${canonicalSetupAction}`
    );
  }

  const jobs = parsed.jobs;
  if (!jobs || typeof jobs !== 'object') {
    return;
  }

  for (const [jobName, job] of Object.entries(jobs)) {
    if (!job || typeof job !== 'object' || !Array.isArray(job.steps)) {
      continue;
    }

    const invokesPnpm = job.steps.some((step) => {
      if (!step || typeof step !== 'object') {
        return false;
      }

      return String(step.run ?? '')
        .split(/\r?\n/u)
        .some((line) => !line.trimStart().startsWith('#') && /\bpnpm\b/u.test(line));
    });
    const usesCanonicalSetup = job.steps.some(
      (step) => step && typeof step === 'object' && step.uses === canonicalSetupAction
    );

    if (invokesPnpm && !usesCanonicalSetup) {
      throw new Error(
        `Workflow validation failed for ${relativePath}: job ${jobName} invokes pnpm without ${canonicalSetupAction}`
      );
    }
  }
}

export function validateCanonicalSetupAction(content) {
  const requiredFragments = [
    'uses: pnpm/action-setup@v6',
    'version: 9.12.1',
    'uses: actions/setup-node@v6',
    "node-version: '22'",
    'cache: pnpm',
    'pnpm install --frozen-lockfile --ignore-scripts',
    'for attempt in 1 2 3',
  ];

  for (const fragment of requiredFragments) {
    if (!content.includes(fragment)) {
      throw new Error(
        `Canonical pnpm setup validation failed: missing required fragment ${JSON.stringify(fragment)}`
      );
    }
  }
}

function validateWorkflowFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');

  validateWorkflowContent(content, relativePath);
}

function main() {
  for (const entry of fs.readdirSync(workflowDir)) {
    if (!entry.endsWith('.yml')) {
      continue;
    }

    validateWorkflowFile(path.join(workflowDir, entry));
  }

  validateCanonicalSetupAction(fs.readFileSync(canonicalSetupActionPath, 'utf8'));

  console.log('GitHub workflow validation passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
