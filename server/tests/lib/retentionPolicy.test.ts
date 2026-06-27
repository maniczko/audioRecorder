import { describe, expect, test } from 'vitest';
import {
  calculateRetentionCutoff,
  isCreatedAtExpiredByRetention,
  normalizeRetentionDays,
} from '../../lib/retentionPolicy.ts';

describe('retentionPolicy', () => {
  test('calculates retention cutoff from an ISO timestamp and day count', () => {
    expect(calculateRetentionCutoff('2026-06-25T12:00:00.000Z', 30)).toBe(
      '2026-05-26T12:00:00.000Z'
    );
  });

  test('treats zero retention as disabled and rejects invalid dates', () => {
    expect(calculateRetentionCutoff('2026-06-25T12:00:00.000Z', 0)).toBeNull();
    expect(calculateRetentionCutoff('not-a-date', 7)).toBeNull();
  });

  test('normalizes fractional and invalid retention values', () => {
    expect(normalizeRetentionDays('14.9')).toBe(14);
    expect(normalizeRetentionDays(-1)).toBe(365);
  });

  test('marks records before the cutoff as expired', () => {
    expect(
      isCreatedAtExpiredByRetention({
        createdAt: '2026-05-25T12:00:00.000Z',
        nowIso: '2026-06-25T12:00:00.000Z',
        retentionDays: 30,
      })
    ).toBe(true);
    expect(
      isCreatedAtExpiredByRetention({
        createdAt: '2026-05-26T12:00:00.000Z',
        nowIso: '2026-06-25T12:00:00.000Z',
        retentionDays: 30,
      })
    ).toBe(false);
  });
});
