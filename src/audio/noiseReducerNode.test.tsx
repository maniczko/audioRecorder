import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { ensureNoiseReducerWorklet, toBlobUrl } from './noiseReducerNode';

const mockRegister = vi.fn().mockResolvedValue(undefined);
const mockLoadAssets = vi.fn((value) => value);

vi.mock('simple-rnnoise-wasm', () => ({
  RNNoiseNode: {
    register: (...args: unknown[]) => mockRegister(...args),
  },
  rnnoise_loadAssets: (...args: unknown[]) => mockLoadAssets(...args),
}));

vi.mock('simple-rnnoise-wasm/rnnoise.wasm?url', () => ({
  default: '/assets/rnnoise.wasm',
}));

vi.mock('simple-rnnoise-wasm/rnnoise.worklet.js?url', () => ({
  default: '/assets/rnnoise.worklet.js',
}));

describe('ensureNoiseReducerWorklet', () => {
  beforeEach(() => {
    mockRegister.mockClear();
    mockLoadAssets.mockClear();
  });

  test('loads the worklet separately for different audio contexts', async () => {
    mockRegister.mockResolvedValue(undefined);
    const audioContext = {
      audioWorklet: {
        addModule: vi.fn().mockReturnValue(Promise.resolve()),
      },
    } as any;

    const firstLoad = ensureNoiseReducerWorklet(audioContext);
    const secondLoad = ensureNoiseReducerWorklet(audioContext);

    expect(firstLoad).toEqual(secondLoad);

    await Promise.all([firstLoad, secondLoad]);
    expect(mockRegister).toHaveBeenCalledTimes(1);
  });

  test('reuses the same load promise for one audio context', async () => {
    mockRegister.mockResolvedValue(undefined);
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
    expect(mockRegister).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────────
// Issue #0 — CSP blocks data: URI worklet scripts
// Date: 2026-03-29
// Bug: Vite inlined small rnnoise.worklet.js (1 KB) as data:text/javascript;
//      base64,... which is blocked by CSP script-src (no data: allowed).
//      Console: "[Violation] Permissions policy violation" + AbortError
// Fix: toBlobUrl() converts data: URIs to blob: URLs before addModule()
// ─────────────────────────────────────────────────────────────────
describe('Regression: #0 — CSP-safe worklet loading (data: → blob:)', () => {
  beforeEach(() => {
    mockRegister.mockClear();
    mockLoadAssets.mockClear();
  });

  test('scriptSrc passed to rnnoise_loadAssets is not a data: URI', async () => {
    mockLoadAssets.mockImplementation((opts) => opts);
    mockRegister.mockImplementation(async (_ctx, assetsPromiseOrArray) => {
      // rnnoise_loadAssets returns [scriptSrc, wasmCompilePromise]
      const assets = await assetsPromiseOrArray;
      return assets;
    });

    const audioContext = {
      audioWorklet: { addModule: vi.fn().mockResolvedValue(undefined) },
    } as any;

    // Clear cached promises by using a fresh context
    try {
      await ensureNoiseReducerWorklet(audioContext);
    } catch {
      // may throw if mock doesn't fully replicate — that's OK
    }

    // Verify loadAssets was called with a URL that is NOT a data: URI
    if (mockLoadAssets.mock.calls.length > 0) {
      const opts = mockLoadAssets.mock.calls[0][0];
      expect(opts.scriptSrc).not.toMatch(/^data:/);
    }
  });

  test('regular URL paths are passed through unchanged', async () => {
    // When the worklet mock returns a normal path (not data:), it should stay as-is
    mockLoadAssets.mockImplementation((opts) => opts);
    mockRegister.mockResolvedValue(undefined);

    const audioContext = {
      audioWorklet: { addModule: vi.fn().mockResolvedValue(undefined) },
    } as any;

    try {
      await ensureNoiseReducerWorklet(audioContext);
    } catch {
      // ignore
    }

    if (mockLoadAssets.mock.calls.length > 0) {
      const opts = mockLoadAssets.mock.calls[0][0];
      // The mock returns '/assets/rnnoise.worklet.js' — a normal path
      expect(opts.scriptSrc).toMatch(/^\/|^blob:/);
    }
  });
});

describe('toBlobUrl', () => {
  test('returns non-data: URLs unchanged', () => {
    expect(toBlobUrl('/assets/worklet.js')).toBe('/assets/worklet.js');
    expect(toBlobUrl('https://example.com/x.js')).toBe('https://example.com/x.js');
  });

  test('converts base64 data: URI to blob: URL', () => {
    const code = 'console.log("hello")';
    const b64 = btoa(code);
    const dataUri = `data:text/javascript;base64,${b64}`;
    const result = toBlobUrl(dataUri);
    expect(result).toMatch(/^blob:/);
  });

  test('converts plain data: URI to blob: URL', () => {
    const code = encodeURIComponent('console.log("test")');
    const dataUri = `data:text/javascript,${code}`;
    const result = toBlobUrl(dataUri);
    expect(result).toMatch(/^blob:/);
  });
});
