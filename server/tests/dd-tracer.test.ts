import { describe, test, expect, vi } from 'vitest';

const mockInit = vi.fn(() => ({}));
const mockUse = vi.fn();

vi.mock('dd-trace', () => {
  const tracer = {
    init: mockInit,
    use: mockUse,
  };
  return { default: tracer, __esModule: true };
});

describe('dd-tracer.ts', () => {
  test('initializes dd-trace with logInjection', async () => {
    await import('../dd-tracer.js');
    expect(mockInit).toHaveBeenCalledWith({ logInjection: true });
  });

  test('exports tracer as default', async () => {
    const mod = await import('../dd-tracer.js');
    expect(mod.default).toHaveProperty('init');
    expect(mod.default).toHaveProperty('use');
  });
});
