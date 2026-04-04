import { describe, test, expect } from 'vitest';
import { getSttModelForProcessingMode, shouldUseFastModel } from '../stt/modelSelector.js';

describe('modelSelector.ts', () => {
  test('returns configured fast model for "fast" mode', () => {
    const result = getSttModelForProcessingMode('fast');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('returns configured full model for "full" mode', () => {
    const result = getSttModelForProcessingMode('full');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('shouldUseFastModel returns true for "fast"', () => {
    expect(shouldUseFastModel('fast')).toBe(true);
  });

  test('shouldUseFastModel returns false for "full"', () => {
    expect(shouldUseFastModel('full')).toBe(false);
  });

  test('shouldUseFastModel returns false for unknown mode', () => {
    expect(shouldUseFastModel('unknown')).toBe(false);
  });
});
