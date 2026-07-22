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

  it('does not fail when a commit stages no js or ts files', () => {
    const hookPath = path.resolve('.husky/pre-commit');
    const content = readFileSync(hookPath, 'utf8');

    expect(content).toContain("grep -E '\\.(ts|tsx|js|jsx)$' || true");
    expect(content).toContain("grep -E '\\.(css|scss)$' || true");
    expect(content).toContain(
      "grep -E '\\.(ts|tsx|js|jsx|css|scss|json|md|yml|yaml)$' | grep -v '^pnpm-lock\\.yaml$' || true"
    );
  });

  it('does not reformat pnpm lockfiles during a staged commit', () => {
    const hookPath = path.resolve('.husky/pre-commit');
    const content = readFileSync(hookPath, 'utf8');

    expect(content).toContain("grep -v '^pnpm-lock\\.yaml$'");
  });

  it('runs stylelint for staged css files before commit', () => {
    const hookPath = path.resolve('.husky/pre-commit');
    const content = readFileSync(hookPath, 'utf8');

    expect(content).toContain('Running Stylelint on staged CSS files');
    expect(content).toContain('npx stylelint $STYLE_FILES');
  });

  it('runs the release guard from pre-push hook', () => {
    const hookPath = path.resolve('.husky/pre-push');
    const content = readFileSync(hookPath, 'utf8');

    expect(content).toContain('pnpm run test:release:guard');
  });

  it('uses Node 22 for pre-push release guard when local Node differs', () => {
    const hookPath = path.resolve('.husky/pre-push');
    const content = readFileSync(hookPath, 'utf8');

    expect(content).toContain('NODE_MAJOR=');
    expect(content).toContain('npx -y -p node@22 -p pnpm@9 pnpm run test:release:guard');
  });
});
