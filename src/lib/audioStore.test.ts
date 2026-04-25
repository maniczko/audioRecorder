import { afterEach, describe, expect, test, vi } from 'vitest';
import { getAudioStorageEstimate, saveAudioBlob } from './audioStore';

const originalStorage = navigator.storage;
const originalIndexedDb = globalThis.indexedDB;

function setStorageEstimate(estimate: StorageEstimate | null) {
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: estimate
      ? {
          estimate: vi.fn(async () => estimate),
        }
      : undefined,
  });
}

afterEach(() => {
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: originalStorage,
  });
  vi.stubGlobal('indexedDB', originalIndexedDb);
  vi.restoreAllMocks();
});

describe('audioStore', () => {
  test('ignores empty save requests', async () => {
    setStorageEstimate({ usage: 0, quota: 1024 * 1024 * 1024 });
    const openMock = vi.fn();
    vi.stubGlobal('indexedDB', { open: openMock });

    await expect(saveAudioBlob('', new Blob(['audio']))).resolves.toBeUndefined();

    expect(openMock).not.toHaveBeenCalled();
  });

  test('rejects blobs above the hard size limit before IndexedDB access', async () => {
    setStorageEstimate({ usage: 0, quota: 1024 * 1024 * 1024 });
    const openMock = vi.fn();
    vi.stubGlobal('indexedDB', { open: openMock });
    const oversized = { size: 501 * 1024 * 1024 } as Blob;

    await expect(saveAudioBlob('rec-1', oversized)).rejects.toThrow('przekracza limit 500 MB');

    expect(openMock).not.toHaveBeenCalled();
  });

  test('rejects saves when browser quota is nearly exhausted', async () => {
    setStorageEstimate({
      usage: 95 * 1024 * 1024,
      quota: 100 * 1024 * 1024,
    });
    const openMock = vi.fn();
    vi.stubGlobal('indexedDB', { open: openMock });

    await expect(saveAudioBlob('rec-1', new Blob(['audio']))).rejects.toThrow(
      'Za malo miejsca w przegladarce'
    );

    expect(openMock).not.toHaveBeenCalled();
  });

  test('returns null estimate when the browser storage API is unavailable', async () => {
    setStorageEstimate(null);

    await expect(getAudioStorageEstimate()).resolves.toBeNull();
  });

  test('returns normalized storage estimate values', async () => {
    setStorageEstimate({
      usage: 80,
      quota: 100,
    });

    await expect(getAudioStorageEstimate()).resolves.toEqual({
      usageBytes: 80,
      quotaBytes: 100,
      freeBytes: 20,
      usageRatio: 0.8,
      isNearQuota: true,
    });
  });
});
