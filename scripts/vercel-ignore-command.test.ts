import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { shouldIgnoreBuild } from './vercel-ignore-command.mjs';

const ROOT = path.resolve(__dirname, '..');

describe('Regression: #0 - Vercel ignore command must not skip preview builds', () => {
  test('builds preview deployments even when branch is not main', () => {
    expect(
      shouldIgnoreBuild({
        branch: 'gpt-fix-420-1775559543',
        parentExists: true,
        changedPaths: [],
      })
    ).toBe(false);
  });

  test('builds main deployment when repository has no parent commit', () => {
    expect(
      shouldIgnoreBuild({
        branch: 'main',
        parentExists: false,
        changedPaths: [],
      })
    ).toBe(false);
  });

  test('skips main deployment only when relevant files did not change', () => {
    expect(
      shouldIgnoreBuild({
        branch: 'main',
        parentExists: true,
        changedPaths: [],
      })
    ).toBe(true);
  });

  test('builds main deployment when relevant files changed', () => {
    expect(
      shouldIgnoreBuild({
        branch: 'main',
        parentExists: true,
        changedPaths: ['src/App.tsx'],
      })
    ).toBe(false);
  });

  test('vercel.json uses the tested ignore command script', () => {
    const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

    expect(vercelConfig.ignoreCommand).toBe('node scripts/vercel-ignore-command.mjs');
  });
});
