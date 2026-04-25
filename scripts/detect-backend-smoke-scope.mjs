import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDeployFilePatterns = [
  /^Dockerfile$/,
  /^pnpm-lock\.yaml$/,
  /^railway\.toml$/,
  /^tsconfig\.json$/,
  /^src\/shared\//,
  /^server\/package\.json$/,
  /^server\/requirements\.txt$/,
  /^server\/[^/]+\.(ts|js|py)$/,
  /^server\/(?:routes|services|lib|stt|http|scripts|agents|migrations)\//,
];

const rootPackageBackendKeys = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
  'workspaces',
  'engines',
  'packageManager',
  'pnpm',
  'overrides',
  'resolutions',
];

function normalizeChangedFiles(changedFiles) {
  const files = Array.isArray(changedFiles)
    ? changedFiles
    : String(changedFiles || '').split(/\r?\n/);

  return files.map((filePath) => String(filePath).trim().replace(/\\/g, '/')).filter(Boolean);
}

function normalizeForCompare(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForCompare(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, normalizeForCompare(entryValue)])
    );
  }

  return value;
}

function stableStringify(value) {
  return JSON.stringify(normalizeForCompare(value));
}

function hasRootPackageBackendChange(beforePackageJson, afterPackageJson) {
  if (!beforePackageJson || !afterPackageJson) {
    return true;
  }

  return rootPackageBackendKeys.some(
    (key) => stableStringify(beforePackageJson[key]) !== stableStringify(afterPackageJson[key])
  );
}

export function detectBackendSmokeScope({
  changedFiles,
  beforePackageJson = null,
  afterPackageJson = null,
} = {}) {
  const normalizedChangedFiles = normalizeChangedFiles(changedFiles);
  const reasons = [];

  for (const changedFile of normalizedChangedFiles) {
    if (changedFile === 'package.json') {
      if (hasRootPackageBackendChange(beforePackageJson, afterPackageJson)) {
        reasons.push('package.json runtime/build fields changed');
      }

      continue;
    }

    if (backendDeployFilePatterns.some((pattern) => pattern.test(changedFile))) {
      reasons.push(changedFile);
    }
  }

  return {
    requireExactGitSha: reasons.length > 0,
    reasons,
  };
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith('--')) {
      continue;
    }

    const key = arg.slice(2);
    args[key] = argv[index + 1] || '';
    index += 1;
  }

  return args;
}

function readTextIfPresent(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return '';
  }

  return fs.readFileSync(filePath, 'utf8');
}

function readJsonIfPresent(filePath) {
  const text = readTextIfPresent(filePath).trim();

  if (!text) {
    return null;
  }

  return JSON.parse(text);
}

function writeGithubOutput(result) {
  const outputPath = process.env.GITHUB_OUTPUT;

  if (!outputPath) {
    return;
  }

  fs.appendFileSync(outputPath, `require_exact_git_sha=${result.requireExactGitSha}\n`);
  fs.appendFileSync(outputPath, `backend_smoke_reasons=${result.reasons.join('; ')}\n`);
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const changedFiles = readTextIfPresent(args['changed-files']);
  const beforePackageJson = readJsonIfPresent(args['before-package-json']);
  const afterPackageJson = readJsonIfPresent(args['after-package-json']);
  const result = detectBackendSmokeScope({
    changedFiles,
    beforePackageJson,
    afterPackageJson,
  });

  console.log(`require_exact_git_sha=${result.requireExactGitSha}`);
  console.log(
    result.reasons.length > 0
      ? `backend_smoke_reasons=${result.reasons.join('; ')}`
      : 'backend_smoke_reasons=none'
  );

  writeGithubOutput(result);
}

const currentModulePath = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] ? path.resolve(process.argv[1]) === currentModulePath : false;

if (isMainModule) {
  runCli();
}
