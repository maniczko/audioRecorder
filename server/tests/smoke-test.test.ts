import { describe, expect, it } from 'vitest';

import { evaluateSmokeHealth } from '../scripts/smoke-test.ts';

// ---------------------------------------------------------------
// Issue #0 - backend smoke stayed green while Railway served old SHA
// Date: 2026-04-11
// Bug: smoke treated every git SHA mismatch as a warning, so backend
//      deploy drift could look healthy even when Railway never updated.
// Fix: allow workflows to require an exact SHA for backend-changing pushes
//      while keeping frontend-only pushes informational.
// ---------------------------------------------------------------
describe('Regression: Issue #0 - backend smoke git sha enforcement', () => {
  it('warns instead of failing when exact SHA is not required', () => {
    const result = evaluateSmokeHealth({
      body: { status: 'ok', gitSha: 'old-sha-12345678' },
      expectedGitSha: 'new-sha-87654321',
      requireExactGitSha: false,
    });

    expect(result.ok).toBe(true);
    expect(result.warning).toContain('Git SHA mismatch');
    expect(result.error).toBeUndefined();
  });

  it('fails when exact SHA is required and Railway serves an older revision', () => {
    const result = evaluateSmokeHealth({
      body: { status: 'ok', gitSha: 'old-sha-12345678' },
      expectedGitSha: 'new-sha-87654321',
      requireExactGitSha: true,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Git SHA mismatch');
  });

  it('fails when health status itself is not ok', () => {
    const result = evaluateSmokeHealth({
      body: { status: 'degraded' },
      expectedGitSha: 'new-sha-87654321',
      requireExactGitSha: true,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('unexpected status');
  });
});
