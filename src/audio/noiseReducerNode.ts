/**
 * noiseReducerNode.js
 *
 * Creates an AudioWorkletNode backed by rnnoise-worklet.js (spectral
 * subtraction noise reducer).  Falls back to null if AudioWorklet is
 * unavailable (Firefox private, Safari < 15, some mobile browsers).
 */

const _loadPromises = new WeakMap();

/**
 * Ensures the worklet module is registered in the given AudioContext.
 * Subsequent calls with the same context resolve immediately.
 * Each AudioContext still needs its own module registration.
 *
 * @param {AudioContext} audioContext
 * @returns {Promise<void>}
 */
export async function ensureNoiseReducerWorklet(audioContext) {
  if (_loadPromises.has(audioContext)) return _loadPromises.get(audioContext);
  const url = import.meta.env.BASE_URL + "advanced-noise-worklet.js";
  const loadPromise = audioContext.audioWorklet.addModule(url).catch((err) => {
    _loadPromises.delete(audioContext);
    throw err;
  });
  _loadPromises.set(audioContext, loadPromise);
  return loadPromise;
}

/**
 * Creates and returns an AudioWorkletNode for noise reduction.
 * Returns null if AudioWorklet is not supported or the module fails to load.
 *
 * @param {AudioContext} audioContext
 * @returns {Promise<AudioWorkletNode|null>}
 */
export async function createNoiseReducerNode(audioContext) {
  if (
    typeof AudioWorkletNode === "undefined" ||
    !audioContext.audioWorklet
  ) {
    console.warn("[NoiseReducer] AudioWorklet not supported — bypassing.");
    return null;
  }

  try {
    await ensureNoiseReducerWorklet(audioContext);
    const node = new AudioWorkletNode(audioContext, "advanced-noise-reducer", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1,
      channelCountMode: "explicit",
    });
    return node;
  } catch (err) {
    console.warn("[NoiseReducer] Failed to create worklet node — bypassing.", err);
    return null;
  }
}

/**
 * Sends a bypass toggle to the running worklet node.
 *
 * @param {AudioWorkletNode} node
 * @param {boolean} bypassed
 */
export function setNoiseReducerBypassed(node, bypassed) {
  if (node?.port) {
    node.port.postMessage({ type: "bypass", value: bypassed });
  }
}
