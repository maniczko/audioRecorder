import { describe, expect, test } from 'vitest';
import { findUnexpectedSkips, isAllowedDocumentedSkip } from './audit-test-skips.mjs';

describe('audit-test-skips', () => {
  test('keeps critical release paths free from unexpected skipped tests', () => {
    expect(findUnexpectedSkips()).toEqual([]);
  });

  test('allows critical skips only with an issue, expiry, and reason', () => {
    expect(
      isAllowedDocumentedSkip([
        '// Issue: #0',
        '// Expires: 2026-06-21',
        '// Reason: legacy selectors need rewrite before promotion to release gate.',
      ])
    ).toBe(true);

    expect(isAllowedDocumentedSkip(['// TODO: skip until stable'])).toBe(false);
    expect(
      isAllowedDocumentedSkip([
        '// Issue: #0',
        '// Expires: 2020-01-01',
        '// Reason: expired skip.',
      ])
    ).toBe(false);
  });
});
