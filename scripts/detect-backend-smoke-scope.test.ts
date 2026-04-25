import { describe, expect, it } from 'vitest';

import { detectBackendSmokeScope } from './detect-backend-smoke-scope.mjs';

const basePackageJson = {
  name: 'voicelog-server',
  scripts: {
    lint: 'eslint src --max-warnings=0',
  },
  eslintConfig: {
    extends: ['react-app'],
  },
  dependencies: {
    hono: '^4.12.12',
  },
  devDependencies: {
    esbuild: '^0.28.0',
  },
};

describe('backend smoke scope detection', () => {
  it('does not require exact backend SHA for package.json lint-only changes', () => {
    const result = detectBackendSmokeScope({
      changedFiles: ['package.json', '.eslintignore', 'scripts/validate-eslint-lint-gate.mjs'],
      beforePackageJson: basePackageJson,
      afterPackageJson: {
        ...basePackageJson,
        scripts: {
          lint: 'node scripts/validate-eslint-lint-gate.mjs && eslint src --max-warnings=0',
        },
        eslintConfig: {
          extends: ['react-app'],
          overrides: [{ files: ['**/*.test.ts'], rules: { 'import/first': 'off' } }],
        },
      },
    });

    expect(result.requireExactGitSha).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it('requires exact backend SHA for server source changes', () => {
    const result = detectBackendSmokeScope({
      changedFiles: ['server/routes/media.ts'],
      beforePackageJson: basePackageJson,
      afterPackageJson: basePackageJson,
    });

    expect(result.requireExactGitSha).toBe(true);
    expect(result.reasons).toContain('server/routes/media.ts');
  });

  it('requires exact backend SHA for root package dependency changes', () => {
    const result = detectBackendSmokeScope({
      changedFiles: ['package.json'],
      beforePackageJson: basePackageJson,
      afterPackageJson: {
        ...basePackageJson,
        dependencies: {
          ...basePackageJson.dependencies,
          zod: '^4.3.6',
        },
      },
    });

    expect(result.requireExactGitSha).toBe(true);
    expect(result.reasons).toContain('package.json runtime/build fields changed');
  });

  it('requires exact backend SHA for shared code copied into the backend image', () => {
    const result = detectBackendSmokeScope({
      changedFiles: ['src/shared/contracts.ts'],
      beforePackageJson: basePackageJson,
      afterPackageJson: basePackageJson,
    });

    expect(result.requireExactGitSha).toBe(true);
    expect(result.reasons).toContain('src/shared/contracts.ts');
  });
});
