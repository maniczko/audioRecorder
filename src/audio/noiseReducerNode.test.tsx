import { vi, describe, test, expect } from 'vitest';
import { ensureNoiseReducerWorklet } from './noiseReducerNode';

vi.mock('simple-rnnoise-wasm', () => ({
  RNNoiseNode: {
    register: vi.fn().mockResolvedValue(undefined),
  },
  rnnoise_loadAssets: vi.fn((value) => value),
}));

vi.mock('simple-rnnoise-wasm/rnnoise.wasm?url', () => ({
  default: '/assets/rnnoise.wasm',
}));

vi.mock('simple-rnnoise-wasm/rnnoise.worklet.js?url', () => ({
  default: '/assets/rnnoise.worklet.js',
}));

describe('ensureNoiseReducerWorklet', () => {
  test('loads the worklet separately for different audio contexts', async () => {
    const { RNNoiseNode } = await import('simple-rnnoise-wasm');
    vi.mocked(RNNoiseNode.register).mockClear();
    const audioContext = {
      audioWorklet: {
        addModule: vi.fn().mockReturnValue(Promise.resolve()),
      },
    } as any;

    const firstLoad = ensureNoiseReducerWorklet(audioContext);
    const secondLoad = ensureNoiseReducerWorklet(audioContext);

    expect(firstLoad).toEqual(secondLoad);

    await Promise.all([firstLoad, secondLoad]);
    expect(RNNoiseNode.register).toHaveBeenCalledTimes(1);
  });

  test('reuses the same load promise for one audio context', async () => {
    const { RNNoiseNode } = await import('simple-rnnoise-wasm');
    vi.mocked(RNNoiseNode.register).mockClear();
    const firstContext = {
      audioWorklet: {
        addModule: vi.fn().mockReturnValue(Promise.resolve()),
      },
    } as any;
    const secondContext = {
      audioWorklet: {
        addModule: vi.fn().mockReturnValue(Promise.resolve()),
      },
    } as any;

    const firstLoad = ensureNoiseReducerWorklet(firstContext);
    const secondLoad = ensureNoiseReducerWorklet(secondContext);

    expect(firstLoad).not.toBe(secondLoad);
    await Promise.all([firstLoad, secondLoad]);
    expect(RNNoiseNode.register).toHaveBeenCalledTimes(2);
  });
});
