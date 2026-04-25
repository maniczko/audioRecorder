import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const eslintIgnorePath = path.join(rootDir, '.eslintignore');
const packageJsonPath = path.join(rootDir, 'package.json');

const blanketTestIgnorePatterns = [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
];
const requiredTestOverrideRules = ['@typescript-eslint/no-unused-vars', 'import/first'];

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    return '';
  }

  return fs.readFileSync(filePath, 'utf8');
}

function normalizeIgnoreLines(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return [value];
  }

  return [];
}

function isRuleOff(value) {
  if (value === 'off' || value === 0) {
    return true;
  }

  return Array.isArray(value) && (value[0] === 'off' || value[0] === 0);
}

function hasTestFilePattern(files) {
  return toArray(files).some((filePattern) =>
    blanketTestIgnorePatterns.some((testPattern) => filePattern.includes(testPattern))
  );
}

function validateLintScript(scriptName, scriptCommand) {
  const command = String(scriptCommand ?? '');

  if (!/eslint\b/.test(command) || !/\bsrc\b/.test(command)) {
    throw new Error(`${scriptName} must run ESLint over src, including colocated tests.`);
  }

  if (!/validate-eslint-lint-gate\.mjs/.test(command)) {
    throw new Error(`${scriptName} must run the ESLint lint gate validator.`);
  }
}

export function validateEslintLintGate({
  eslintIgnore = readText(eslintIgnorePath),
  packageJson = JSON.parse(readText(packageJsonPath)),
} = {}) {
  const ignoreLines = normalizeIgnoreLines(eslintIgnore);
  const ignoredTestPatterns = blanketTestIgnorePatterns.filter((pattern) =>
    ignoreLines.includes(pattern)
  );

  if (ignoredTestPatterns.length > 0) {
    throw new Error(`ESLint must not blanket-ignore test files: ${ignoredTestPatterns.join(', ')}`);
  }

  validateLintScript('lint', packageJson.scripts?.lint);
  validateLintScript('lint:all', packageJson.scripts?.['lint:all']);

  const eslintOverrides = toArray(packageJson.eslintConfig?.overrides);
  const testFileOverride = eslintOverrides.find((override) => hasTestFilePattern(override?.files));

  if (!testFileOverride) {
    throw new Error('eslintConfig must define an explicit test-file override.');
  }

  const missingOverrideRules = requiredTestOverrideRules.filter(
    (ruleName) => !isRuleOff(testFileOverride.rules?.[ruleName])
  );

  if (missingOverrideRules.length > 0) {
    throw new Error(
      `Test-file ESLint override must explicitly configure: ${missingOverrideRules.join(', ')}`
    );
  }

  return true;
}

const entrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isMainModule =
  entrypointPath === path.resolve(rootDir, 'scripts/validate-eslint-lint-gate.mjs');

if (isMainModule) {
  validateEslintLintGate();
  console.log('ESLint lint gate validation passed.');
}
