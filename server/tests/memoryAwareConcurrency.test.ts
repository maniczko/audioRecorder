import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMemoryAwareConcurrency } from '../transcription.ts';

describe('getMemoryAwareConcurrency', () => {
  let originalMemoryUsage: typeof process.memoryUsage;

  beforeEach(() => {
    originalMemoryUsage = process.memoryUsage;
  });

  afterEach(() => {
    process.memoryUsage = originalMemoryUsage;
  });

  function mockHeapUsage(usedMB: number, totalMB: number) {
    process.memoryUsage = (() => ({
      heapUsed: usedMB * 1024 * 1024,
      heapTotal: totalMB * 1024 * 1024,
      rss: (totalMB + 100) * 1024 * 1024,
      external: 0,
      arrayBuffers: 0,
    })) as any;
  }

  it('returns full concurrency when heap usage is low (<70%)', () => {
    mockHeapUsage(100, 384);
    expect(getMemoryAwareConcurrency(6)).toBe(6);
  });

  it('reduces concurrency to 2 when heap is between 70–85%', () => {
    mockHeapUsage(300, 384); // ~78%
    expect(getMemoryAwareConcurrency(6)).toBe(2);
  });

  it('reduces concurrency to 1 when heap is above 85%', () => {
    mockHeapUsage(350, 384); // ~91%
    expect(getMemoryAwareConcurrency(6)).toBe(1);
  });

  it('respects configLimit as upper bound even at low usage', () => {
    mockHeapUsage(50, 384); // ~13%
    expect(getMemoryAwareConcurrency(3)).toBe(3);
  });

  it('never returns less than 1', () => {
    mockHeapUsage(380, 384); // ~99%
    expect(getMemoryAwareConcurrency(1)).toBeGreaterThanOrEqual(1);
  });
});
