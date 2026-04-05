import rnnoiseWasmUrl from 'simple-rnnoise-wasm/rnnoise.wasm?url';
import rnnoiseWorkletUrl from 'simple-rnnoise-wasm/rnnoise.worklet.js?url';

type AudioContextLike = AudioContext & {
  audioWorklet?: {
    addModule: (url: string) => Promise<void>;
  };
};

interface RnnoiseModule {
  RNNoiseNode: {
    register: (audioContext: AudioContextLike, assets: unknown) => Promise<void>;
    new (audioContext: AudioContextLike): RnnoiseNode;
  };
  rnnoise_loadAssets: (input: { scriptSrc: string; moduleSrc: string }) => unknown;
}

interface RnnoiseNode extends AudioWorkletNode {
  update: (keepalive?: boolean) => void;
}

const workletLoadPromises = new WeakMap<AudioContextLike, Promise<void>>();
const fallbackLoadPromises = new WeakMap<AudioContextLike, Promise<void>>();
const rnnoiseNodes = new WeakSet<object>();
let rnnoiseModulePromise: Promise<RnnoiseModule> | null = null;
let patchedWorkletUrlCache: string | null = null;

/** @internal — reset cached patched URL (testing only) */
export function __resetPatchedWorkletCache() {
  patchedWorkletUrlCache = null;
}

/**
 * Patch the simple-rnnoise-wasm worklet source to guard against undefined
 * inputs/outputs in process().  The library (v1.1.0) does not check for
 * disconnected channels, causing "Cannot convert undefined or null to object
 * at Float32Array.set" in some browsers / edge cases.
 */
async function patchedRnnoiseWorkletUrl(): Promise<string> {
  if (patchedWorkletUrlCache) return patchedWorkletUrlCache;
  const rawUrl = toBlobUrl(rnnoiseWorkletUrl);
  const resp = await fetch(rawUrl);
  let src = await resp.text();
  src = src.replace(
    'process(e,a){if(!this.alive)return!1;',
    'process(e,a){if(!this.alive)return!1;if(!e[0]||!e[0][0]||!a[0]||!a[0][0])return!0;'
  );
  patchedWorkletUrlCache = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
  return patchedWorkletUrlCache;
}

/**
 * Convert a data: URI to a blob: URL so it passes CSP script-src (which allows
 * blob: but not data:). Vite inlines small ?url imports as data: URIs when the
 * file is below assetsInlineLimit (default 4 KB).
 */
export function toBlobUrl(url: string): string {
  if (!url.startsWith('data:')) return url;
  const [header, body] = url.split(',');
  const isBase64 = header.includes(';base64');
  const mime = header.match(/:(.*?)(;|$)/)?.[1] || 'application/javascript';
  let bytes: Uint8Array;
  if (isBase64) {
    const bin = atob(body);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } else {
    bytes = new TextEncoder().encode(decodeURIComponent(body));
  }
  return URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: mime }));
}

async function loadRnnoiseModule(): Promise<RnnoiseModule> {
  if (!rnnoiseModulePromise) {
    rnnoiseModulePromise = import('simple-rnnoise-wasm') as Promise<RnnoiseModule>;
  }
  return rnnoiseModulePromise;
}

export async function ensureNoiseReducerWorklet(audioContext: AudioContextLike) {
  if (workletLoadPromises.has(audioContext)) return workletLoadPromises.get(audioContext);

  const loadPromise = Promise.all([loadRnnoiseModule(), patchedRnnoiseWorkletUrl()])
    .then(([{ RNNoiseNode, rnnoise_loadAssets }, patchedUrl]) =>
      RNNoiseNode.register(
        audioContext,
        rnnoise_loadAssets({
          scriptSrc: patchedUrl,
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

async function ensureFallbackNoiseReducerWorklet(audioContext: AudioContextLike) {
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

export async function createNoiseReducerNode(audioContext: AudioContextLike) {
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

export function setNoiseReducerBypassed(node: { port?: MessagePort } | null, bypassed: boolean) {
  if (node?.port) {
    node.port.postMessage({ type: 'bypass', value: bypassed });
  }
}

export function isRnnoiseNode(node: unknown): node is RnnoiseNode {
  return Boolean(node && rnnoiseNodes.has(node));
}

export function requestNoiseReducerStatus(node: unknown, keepalive = true) {
  if (!isRnnoiseNode(node) || typeof node.update !== 'function') return;
  node.update(keepalive);
}
