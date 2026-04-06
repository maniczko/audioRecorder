import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('husky hooks', () => {
  it('uses LF line endings in pre-commit hook for Linux runners', () => {
    const hookPath = path.resolve('.husky/pre-commit');
    const content = readFileSync(hookPath, 'utf8');

    expect(content.startsWith('#!/bin/sh\n')).toBe(true);
    expect(content.includes('\r')).toBe(false);
  });

  it('runs the release guard from pre-push hook', () => {
    const hookPath = path.resolve('.husky/pre-push');
    const content = readFileSync(hookPath, 'utf8');

    expect(content).toContain('pnpm run test:release:guard');
  });
});
