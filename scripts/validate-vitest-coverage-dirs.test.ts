import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';

// ---------------------------------------------------------------
// Issue #0 - Vitest coverage writes fail when .tmp directory is missing
// Date: 2026-04-04
// Bug: full frontend/server runs could crash with ENOENT while writing
//      coverage shards into coverage/*/.tmp/coverage-*.json
// Fix: vitest configs eagerly create the .tmp directories on load
// ---------------------------------------------------------------
describe('Regression: Issue #0 - vitest coverage temp directories exist', () => {
  it('creates frontend and server coverage temp directories when configs load', async () => {
    await import('./ensure-coverage-dirs.mjs');
    await import('../vitest.config.ts');
    await import('../server/vitest.config.ts');
    const setupTestsContent = fs.readFileSync(
      path.resolve(process.cwd(), 'src/setupTests.ts'),
      'utf8'
    );

    expect(fs.existsSync(path.resolve(process.cwd(), 'coverage/frontend/.tmp'))).toBe(true);
    expect(fs.existsSync(path.resolve(process.cwd(), 'coverage/server/.tmp'))).toBe(true);
    expect(setupTestsContent).toContain('coverage/frontend/.tmp');
  });

  it('keeps the default test script coverage-free because coverage has a dedicated command', () => {
    expect(packageJson.scripts.test).toContain('--coverage.enabled=false');
    expect(packageJson.scripts['test:coverage']).toContain('--coverage');
  });

  it('preserves frontend coverage shards during a coverage run', () => {
    const frontendConfig = fs.readFileSync(path.resolve(process.cwd(), 'vitest.config.ts'), 'utf8');

    expect(frontendConfig).toContain('clean: false');
  });
});
