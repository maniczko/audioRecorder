/**
 * dd-tracer.test.ts
 *
 * Tests for dd-trace initialization wrapper.
 * Coverage target: 100% (currently 0%)
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dd-trace before importing the module
vi.mock('dd-trace', () => {
  const mockTracer = {
    init: vi.fn().mockReturnThis(),
    use: vi.fn().mockReturnThis(),
    wrap: vi.fn().mockImplementation((_name: string, fn: Function) => fn),
    trace: vi.fn(),
  };
  return { default: mockTracer };
});

describe('dd-tracer', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('initializes tracer with logInjection enabled', async () => {
    const { default: tracerModule } = await import('../dd-tracer');
    const tracer = (await import('dd-trace')).default;

    expect(tracer.init).toHaveBeenCalledWith({ logInjection: true });
    expect(tracerModule).toBe(tracer);
  });

  test('exports the tracer instance as default', async () => {
    const { default: tracerModule } = await import('../dd-tracer');
    const tracer = (await import('dd-trace')).default;

    expect(tracerModule).toBeDefined();
    expect(tracerModule).toBe(tracer);
  });

  test('tracer has expected methods available', async () => {
    const { default: tracerModule } = await import('../dd-tracer');

    expect(typeof tracerModule.init).toBe('function');
    expect(typeof tracerModule.use).toBe('function');
    expect(typeof tracerModule.wrap).toBe('function');
    expect(typeof tracerModule.trace).toBe('function');
  });
});
