describe("ensureNoiseReducerWorklet", () => {
  function loadModule() {
    jest.resetModules();
    return require("./noiseReducerNode");
  }

  test("reuses the same load promise for one audio context", async () => {
    const { ensureNoiseReducerWorklet } = loadModule();
    const addModule = jest.fn(() => Promise.resolve());
    const audioContext = {
      audioWorklet: {
        addModule,
      },
    };

    const firstLoad = ensureNoiseReducerWorklet(audioContext);
    const secondLoad = ensureNoiseReducerWorklet(audioContext);

    await Promise.all([firstLoad, secondLoad]);
    expect(addModule).toHaveBeenCalledTimes(1);
  });

  test("loads the worklet separately for different audio contexts", async () => {
    const { ensureNoiseReducerWorklet } = loadModule();
    const firstContext = {
      audioWorklet: {
        addModule: jest.fn(() => Promise.resolve()),
      },
    };
    const secondContext = {
      audioWorklet: {
        addModule: jest.fn(() => Promise.resolve()),
      },
    };

    const firstLoad = ensureNoiseReducerWorklet(firstContext);
    const secondLoad = ensureNoiseReducerWorklet(secondContext);

    expect(firstLoad).not.toBe(secondLoad);
    await Promise.all([firstLoad, secondLoad]);
    expect(firstContext.audioWorklet.addModule).toHaveBeenCalledTimes(1);
    expect(secondContext.audioWorklet.addModule).toHaveBeenCalledTimes(1);
  });
});
