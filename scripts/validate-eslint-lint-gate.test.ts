import { describe, expect, it } from 'vitest';

import { validateEslintLintGate } from './validate-eslint-lint-gate.mjs';

describe('ESLint lint gate validation', () => {
  it('rejects blanket ignore patterns for test files', () => {
    expect(() =>
      validateEslintLintGate({
        eslintIgnore: ['coverage/', '**/*.test.ts', '**/*.test.tsx'].join('\n'),
        packageJson: { scripts: { 'lint:all': 'eslint src --max-warnings=0' } },
      })
    ).toThrow('ESLint must not blanket-ignore test files');
  });

  it('requires the main lint script to run the guard validator', () => {
    expect(() =>
      validateEslintLintGate({
        eslintIgnore: ['coverage/', 'dist/'].join('\n'),
        packageJson: {
          scripts: {
            lint: 'eslint src --max-warnings=0',
            'lint:all': 'node scripts/validate-eslint-lint-gate.mjs && eslint src --max-warnings=0',
          },
        },
      })
    ).toThrow('lint must run the ESLint lint gate validator');
  });

  it('requires explicit test-file lint rule overrides', () => {
    expect(() =>
      validateEslintLintGate({
        eslintIgnore: ['coverage/', 'dist/'].join('\n'),
        packageJson: {
          scripts: {
            lint: 'node scripts/validate-eslint-lint-gate.mjs && eslint src --max-warnings=0',
            'lint:all': 'node scripts/validate-eslint-lint-gate.mjs && eslint src --max-warnings=0',
          },
          eslintConfig: {
            extends: ['react-app'],
          },
        },
      })
    ).toThrow('eslintConfig must define an explicit test-file override');
  });

  it('accepts the repository lint gate configuration', () => {
    expect(() => validateEslintLintGate()).not.toThrow();
  });
});
