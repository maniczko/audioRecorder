import { vi, describe, test, expect } from "vitest";
import { ensureNoiseReducerWorklet } from "./noiseReducerNode";

describe("ensureNoiseReducerWorklet", () => {
  test("reuses the same load promise for one audio context", async () => {
    const addModule = vi.fn().mockReturnValue(Promise.resolve());
    const audioContext = {
      audioWorklet: {
        addModule,
      },
    } as any;

    const firstLoad = ensureNoiseReducerWorklet(audioContext);
    const secondLoad = ensureNoiseReducerWorklet(audioContext);

    // We expect the EXACT same promise object from WeakMap
    expect(firstLoad).toEqual(secondLoad);
    
    await Promise.all([firstLoad, secondLoad]);
    expect(addModule).toHaveBeenCalledTimes(1);
  });

  test("loads the worklet separately for different audio contexts", async () => {
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
    expect(firstContext.audioWorklet.addModule).toHaveBeenCalledTimes(1);
    expect(secondContext.audioWorklet.addModule).toHaveBeenCalledTimes(1);
  });
});
