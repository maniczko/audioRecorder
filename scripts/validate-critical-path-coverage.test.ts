import { describe, expect, it, vi } from 'vitest';

import {
  assertCriticalPathCoverage,
  normalizeRepoPath,
  validateCriticalPathCoverage,
} from './validate-critical-path-coverage.mjs';

const validMatrix = {
  minimumDimensionsPerArea: 3,
  areas: [
    {
      id: 'browser-recorder',
      priority: 'P0',
      owner: 'frontend-audio',
      dimensions: ['happy', 'error', 'edge'],
      requiredTests: ['src/hooks/useAudioHardware.test.ts'],
    },
  ],
};

describe('critical path coverage validation', () => {
  it('normalizes Windows and relative paths', () => {
    expect(normalizeRepoPath('.\\src\\hooks\\useRecorder.test.tsx')).toBe(
      'src/hooks/useRecorder.test.tsx'
    );
  });

  it('passes when all required critical path test files exist and contain no skips', () => {
    const result = validateCriticalPathCoverage({
      matrix: validMatrix,
      exists: () => true,
      readFile: () => "test('covers recorder lifecycle', () => expect(true).toBe(true));",
    });

    expect(result).toEqual({
      ok: true,
      violations: [],
      areaCount: 1,
      requiredTestCount: 1,
    });
  });

  it('fails when a required test file is missing', () => {
    const result = validateCriticalPathCoverage({
      matrix: validMatrix,
      exists: () => false,
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      'browser-recorder: required test file is missing: src/hooks/useAudioHardware.test.ts'
    );
  });

  it('fails when a required test file contains skipped tests', () => {
    const result = validateCriticalPathCoverage({
      matrix: validMatrix,
      exists: () => true,
      readFile: () => "describe.skip('critical flow', () => {});",
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      'browser-recorder: required test file contains skipped tests: src/hooks/useAudioHardware.test.ts'
    );
  });

  it('fails when matrix entries are too weak to be enforceable', () => {
    const result = validateCriticalPathCoverage({
      matrix: {
        minimumDimensionsPerArea: 3,
        areas: [
          {
            id: 'retry-failure-handling',
            priority: 'critical',
            dimensions: ['happy'],
            requiredTests: [],
          },
        ],
      },
      exists: () => true,
      readFile: () => '',
    });

    expect(result.violations).toEqual([
      'retry-failure-handling: missing owner',
      'retry-failure-handling: priority must be P0, P1, P2, or P3',
      'retry-failure-handling: must declare at least 3 coverage dimensions',
      'retry-failure-handling: must list at least one required test file',
    ]);
  });

  it('throws a readable gate failure message for CI', () => {
    expect(() =>
      assertCriticalPathCoverage({
        matrix: validMatrix,
        exists: () => false,
      })
    ).toThrow(/Critical path coverage validation failed/);
  });

  it('keeps the real repository matrix valid', () => {
    expect(() => assertCriticalPathCoverage()).not.toThrow();
  });
});
