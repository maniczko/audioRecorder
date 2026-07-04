import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_MATRIX_PATH = 'docs/critical-path-coverage.matrix.json';
const SKIP_PATTERN = /\b(?:describe|it|test)\.skip\s*\(/;

export function normalizeRepoPath(filePath) {
  return String(filePath || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .trim();
}

export function loadCriticalPathMatrix({
  cwd = process.cwd(),
  matrixPath = DEFAULT_MATRIX_PATH,
} = {}) {
  const absolutePath = path.resolve(cwd, matrixPath);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

export function validateCriticalPathCoverage({
  cwd = process.cwd(),
  matrix = loadCriticalPathMatrix({ cwd }),
  readFile = fs.readFileSync,
  exists = fs.existsSync,
} = {}) {
  const violations = [];
  const areas = Array.isArray(matrix.areas) ? matrix.areas : [];
  const minimumDimensions = Number(matrix.minimumDimensionsPerArea || 1);

  if (areas.length === 0) {
    violations.push('matrix must define at least one critical path area');
  }

  for (const area of areas) {
    const areaId = area?.id || '<missing-id>';
    const dimensions = Array.isArray(area?.dimensions) ? area.dimensions : [];
    const requiredTests = Array.isArray(area?.requiredTests) ? area.requiredTests : [];

    if (!area?.owner) {
      violations.push(`${areaId}: missing owner`);
    }
    if (!area?.priority || !/^P[0-3]$/.test(area.priority)) {
      violations.push(`${areaId}: priority must be P0, P1, P2, or P3`);
    }
    if (dimensions.length < minimumDimensions) {
      violations.push(`${areaId}: must declare at least ${minimumDimensions} coverage dimensions`);
    }
    if (requiredTests.length === 0) {
      violations.push(`${areaId}: must list at least one required test file`);
    }

    for (const testFile of requiredTests) {
      const repoPath = normalizeRepoPath(testFile);
      const absolutePath = path.resolve(cwd, repoPath);

      if (!exists(absolutePath)) {
        violations.push(`${areaId}: required test file is missing: ${repoPath}`);
        continue;
      }

      const content = String(readFile(absolutePath, 'utf8'));
      if (SKIP_PATTERN.test(content)) {
        violations.push(`${areaId}: required test file contains skipped tests: ${repoPath}`);
      }
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    areaCount: areas.length,
    requiredTestCount: new Set(
      areas.flatMap((area) => (Array.isArray(area.requiredTests) ? area.requiredTests : []))
    ).size,
  };
}

export function assertCriticalPathCoverage(options = {}) {
  const result = validateCriticalPathCoverage(options);
  if (!result.ok) {
    throw new Error(
      `Critical path coverage validation failed:\n${result.violations
        .map((violation) => `- ${violation}`)
        .join('\n')}`
    );
  }
  return result;
}

const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  const result = assertCriticalPathCoverage();
  console.log(
    `Critical path coverage validation passed (${result.areaCount} areas, ${result.requiredTestCount} required test files).`
  );
}
