import { describe, expect, it } from 'vitest';

import { findForbiddenTrackedArtifacts, validateRepoHygiene } from './validate-repo-hygiene.mjs';

describe('repo hygiene validation', () => {
  it('detects committed runtime logs, ad hoc test outputs, local reports, and old deployment copies', () => {
    const violations = findForbiddenTrackedArtifacts([
      '.logs/test_run_final.txt',
      'railway_logs_latest.txt',
      'test-results.txt',
      'server_test_result.txt',
      'media_test.txt',
      'Dockerfile.old.txt',
      'reports/dev-server/server.log',
    ]);

    expect(violations.map((violation) => violation.ruleId)).toEqual([
      'dot-logs',
      'railway-log-dump',
      'ad-hoc-test-results',
      'ad-hoc-test-results',
      'ad-hoc-test-results',
      'old-dockerfile-copy',
      'local-reports',
    ]);
  });

  it('allows durable documentation, source files, fixtures, and visual baselines', () => {
    expect(
      findForbiddenTrackedArtifacts([
        'Dockerfile',
        'docs/audits/SCREENSHOT_EVIDENCE.md',
        'docs/audits/screenshots/studio-reference.png',
        'scripts/validate-repo-hygiene.mjs',
        'tests/e2e/visual-regression.spec.ts-snapshots/auth-login-mobile-320-chromium-win32.png',
        'server/tests/routes/media.test.ts',
      ])
    ).toEqual([]);
  });

  it('keeps the current git index free of forbidden generated artifacts', () => {
    expect(() => validateRepoHygiene()).not.toThrow();
  });
});
