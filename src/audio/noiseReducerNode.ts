import rnnoiseWasmUrl from 'simple-rnnoise-wasm/rnnoise.wasm?url';
import rnnoiseWorkletUrl from 'simple-rnnoise-wasm/rnnoise.worklet.js?url';

const workletLoadPromises = new WeakMap();
const fallbackLoadPromises = new WeakMap();
const rnnoiseNodes = new WeakSet();
let rnnoiseModulePromise = null;

async function loadRnnoiseModule() {
  if (!rnnoiseModulePromise) {
    rnnoiseModulePromise = import('simple-rnnoise-wasm');
  }
  return rnnoiseModulePromise;
}

export async function ensureNoiseReducerWorklet(audioContext) {
  if (workletLoadPromises.has(audioContext)) return workletLoadPromises.get(audioContext);

  const loadPromise = loadRnnoiseModule()
    .then(({ RNNoiseNode, rnnoise_loadAssets }) =>
      RNNoiseNode.register(
        audioContext,
        rnnoise_loadAssets({
          scriptSrc: rnnoiseWorkletUrl,
          moduleSrc: rnnoiseWasmUrl,
        })
      )
    )
    .catch((error) => {
      workletLoadPromises.delete(audioContext);
      throw error;
    });

  workletLoadPromises.set(audioContext, loadPromise);
  return loadPromise;
}

async function ensureFallbackNoiseReducerWorklet(audioContext) {
  if (fallbackLoadPromises.has(audioContext)) return fallbackLoadPromises.get(audioContext);

  const loadPromise = audioContext.audioWorklet
    .addModule(`${import.meta.env.BASE_URL}advanced-noise-worklet.js`)
    .catch((error) => {
      fallbackLoadPromises.delete(audioContext);
      throw error;
    });

  fallbackLoadPromises.set(audioContext, loadPromise);
  return loadPromise;
}

export async function createNoiseReducerNode(audioContext) {
  if (typeof AudioWorkletNode === 'undefined' || !audioContext.audioWorklet) {
    console.warn('[NoiseReducer] AudioWorklet not supported, bypassing.');
    return null;
  }

  try {
    await ensureNoiseReducerWorklet(audioContext);
    const { RNNoiseNode } = await loadRnnoiseModule();
    const node = new RNNoiseNode(audioContext);
    rnnoiseNodes.add(node);
    return node;
  } catch (error) {
    console.warn('[NoiseReducer] RNNoise unavailable, falling back to spectral reducer.', error);
  }

  try {
    await ensureFallbackNoiseReducerWorklet(audioContext);
    return new AudioWorkletNode(audioContext, 'advanced-noise-reducer', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1,
      channelCountMode: 'explicit',
    });
  } catch (error) {
    console.warn('[NoiseReducer] Failed to create fallback worklet node, bypassing.', error);
    return null;
  }
}

export function setNoiseReducerBypassed(node, bypassed) {
  if (node?.port) {
    node.port.postMessage({ type: 'bypass', value: bypassed });
  }
}

export function isRnnoiseNode(node) {
  return Boolean(node && rnnoiseNodes.has(node));
}

export function requestNoiseReducerStatus(node, keepalive = true) {
  if (!isRnnoiseNode(node) || typeof node.update !== 'function') return;
  node.update(keepalive);
}
