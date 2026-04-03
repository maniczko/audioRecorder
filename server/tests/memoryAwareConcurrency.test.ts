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

  function mockMemory(usedMB: number, totalMB: number, rssMB: number) {
    process.memoryUsage = (() => ({
      heapUsed: usedMB * 1024 * 1024,
      heapTotal: totalMB * 1024 * 1024,
      rss: rssMB * 1024 * 1024,
      external: 0,
      arrayBuffers: 0,
    })) as any;
  }

  it('returns capped concurrency (max 3) when heap and RSS are low', () => {
    mockMemory(100, 384, 400); // heap 26%, RSS 400MB
    expect(getMemoryAwareConcurrency(6)).toBe(3); // capped at 3
  });

  it('reduces concurrency to 2 when heap is between 65–80%', () => {
    mockMemory(270, 384, 400); // heap ~70%, RSS 400MB (under 500)
    expect(getMemoryAwareConcurrency(6)).toBe(2);
  });

  it('reduces concurrency to 1 when heap is above 80%', () => {
    mockMemory(320, 384, 400); // heap ~83%, RSS 400MB
    expect(getMemoryAwareConcurrency(6)).toBe(1);
  });

  it('reduces concurrency to 1 when RSS exceeds 700MB', () => {
    mockMemory(100, 384, 750); // heap low, but RSS high
    expect(getMemoryAwareConcurrency(6)).toBe(1);
  });

  it('reduces concurrency to 2 when RSS exceeds 500MB', () => {
    mockMemory(100, 384, 550); // heap low, RSS moderate
    expect(getMemoryAwareConcurrency(6)).toBe(2);
  });

  it('respects configLimit as upper bound even at low usage', () => {
    mockMemory(50, 384, 300); // heap ~13%, RSS low
    expect(getMemoryAwareConcurrency(2)).toBe(2);
  });

  it('never returns less than 1', () => {
    mockMemory(380, 384, 800); // heap ~99%, RSS very high
    expect(getMemoryAwareConcurrency(1)).toBeGreaterThanOrEqual(1);
  });
});
