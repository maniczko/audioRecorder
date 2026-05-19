import { describe, expect, test } from 'vitest';
import { findUnexpectedSkips } from './audit-test-skips.mjs';

describe('audit-test-skips', () => {
  test('keeps critical release paths free from unexpected skipped tests', () => {
    expect(findUnexpectedSkips()).toEqual([]);
  });
});
