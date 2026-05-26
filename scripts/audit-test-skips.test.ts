import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

  test('does not allow skipping an entire critical e2e suite', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'voicelog-skip-audit-'));
    const suitePath = path.join(root, 'tests', 'e2e');
    fs.mkdirSync(suitePath, { recursive: true });
    fs.writeFileSync(
      path.join(suitePath, 'critical-flows.spec.js'),
      [
        '// Issue: #0',
        '// Expires: 2099-01-01',
        '// Reason: documented but too broad for a critical release suite.',
        "test.describe.skip('Critical User Flows', () => {});",
      ].join('\n'),
      'utf8'
    );

    expect(findUnexpectedSkips({ root })).toEqual([
      {
        file: 'tests/e2e/critical-flows.spec.js',
        line: 4,
        title: 'Critical User Flows',
      },
    ]);
  });

  test('does not allow keeping the legacy visual suite as a skipped e2e file', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'voicelog-skip-audit-'));
    const suitePath = path.join(root, 'tests', 'e2e');
    fs.mkdirSync(suitePath, { recursive: true });
    fs.writeFileSync(
      path.join(suitePath, 'visual-regression.spec.js'),
      [
        '// Issue: #0',
        '// Expires: 2099-01-01',
        '// Reason: canonical visual-regression.spec.ts exists.',
        "test.describe.skip('Visual Regression - Core Components', () => {});",
      ].join('\n'),
      'utf8'
    );

    expect(findUnexpectedSkips({ root })).toEqual([
      {
        file: 'tests/e2e/visual-regression.spec.js',
        line: 4,
        title: 'Visual Regression - Core Components',
      },
    ]);
  });

  test('does not allow keeping the legacy meeting draft reset journey skipped', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'voicelog-skip-audit-'));
    const suitePath = path.join(root, 'tests', 'e2e');
    fs.mkdirSync(suitePath, { recursive: true });
    fs.writeFileSync(
      path.join(suitePath, 'meeting.spec.js'),
      [
        '// Issue: #0',
        '// Expires: 2099-01-01',
        '// Reason: legacy removed control should be covered by current draft UX.',
        "test.skip('klikniecie Nowe resetuje formularz', () => {});",
      ].join('\n'),
      'utf8'
    );

    expect(findUnexpectedSkips({ root })).toEqual([
      {
        file: 'tests/e2e/meeting.spec.js',
        line: 4,
        title: 'klikniecie Nowe resetuje formularz',
      },
    ]);
  });
});
