import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { buildVitestCommand } = require('./smart-retry.cjs') as {
  buildVitestCommand: (options?: { coverageEnabled?: boolean | string }) => string;
};

// ---------------------------------------------------------------
// Issue #0 - smart retry enabled coverage in CI and amplified OOMs
// Date: 2026-04-11
// Bug: the retry runner called plain `vitest run`, so CI inherited
//      coverage thresholds and extra memory pressure on the large suite.
// Fix: default smart retry to `--coverage.enabled=false` and allow
//      explicit opt-in only when coverage is intentionally requested.
// ---------------------------------------------------------------
describe('Regression: Issue #0 - smart retry disables coverage by default', () => {
  it('disables coverage when no override is provided', () => {
    expect(buildVitestCommand()).toBe('vitest run --coverage.enabled=false');
  });

  it('allows explicit coverage opt-in', () => {
    expect(buildVitestCommand({ coverageEnabled: true })).toBe('vitest run');
    expect(buildVitestCommand({ coverageEnabled: 'true' })).toBe('vitest run');
  });
});
