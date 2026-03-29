/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clamp,
  createId,
  downloadTextFile,
  formatDateTime,
  formatDuration,
  idbJSONStorage,
  readStorage,
  readStorageAsync,
  writeStorage,
  writeStorageAsync,
} from './storage';

vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));

describe('storage (browser)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('reads and writes localStorage values', () => {
    writeStorage('k1', { ok: true });
    expect(readStorage('k1', null)).toEqual({ ok: true });
  });

  it('returns fallback when localStorage has invalid JSON', () => {
    window.localStorage.setItem('bad', '{not-json');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(readStorage('bad', { fallback: true })).toEqual({ fallback: true });
    expect(spy).toHaveBeenCalled();
  });

  it('readStorageAsync falls back to localStorage when indexedDB is missing', async () => {
    const originalIndexedDB = window.indexedDB;
    (window as any).indexedDB = undefined;
    window.localStorage.setItem('async1', JSON.stringify({ ok: 1 }));
    const result = await readStorageAsync('async1', { ok: 0 });
    expect(result).toEqual({ ok: 1 });
    (window as any).indexedDB = originalIndexedDB;
  });

  it('readStorageAsync writes to idb when value exists in localStorage', async () => {
    const { get, set } = await import('idb-keyval');
    (window as any).indexedDB = {};
    (get as any).mockResolvedValueOnce(undefined);
    window.localStorage.setItem('async2', JSON.stringify({ ok: 2 }));
    const result = await readStorageAsync('async2', { ok: 0 });
    expect(result).toEqual({ ok: 2 });
    expect(set).toHaveBeenCalledWith('async2', { ok: 2 });
  });

  it('writeStorageAsync delegates to idb when available', async () => {
    const { set } = await import('idb-keyval');
    (window as any).indexedDB = {};
    await writeStorageAsync('async3', { ok: 3 });
    expect(set).toHaveBeenCalledWith('async3', { ok: 3 });
  });

  it('idbJSONStorage getItem returns stringified data', async () => {
    window.localStorage.setItem('json1', JSON.stringify({ ok: 4 }));
    const result = await idbJSONStorage.getItem('json1');
    expect(result).toBe(JSON.stringify({ ok: 4 }));
  });

  it('idbJSONStorage removeItem deletes from localStorage when indexedDB missing', async () => {
    const originalIndexedDB = window.indexedDB;
    (window as any).indexedDB = undefined;
    window.localStorage.setItem('json2', JSON.stringify({ ok: 5 }));
    await idbJSONStorage.removeItem('json2');
    expect(window.localStorage.getItem('json2')).toBeNull();
    (window as any).indexedDB = originalIndexedDB;
  });

  it('createId includes prefix and is unique-ish', () => {
    const id = createId('rec');
    expect(id.startsWith('rec_')).toBe(true);
    expect(id.length).toBeGreaterThan(8);
  });

  it('clamp enforces bounds', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('formatDuration formats minutes and seconds', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(65)).toBe('01:05');
  });

  it('formatDateTime returns No date for falsy input', () => {
    expect(formatDateTime(null)).toBe('No date');
  });

  it('formatDateTime returns formatted string for valid input', () => {
    const result = formatDateTime('2026-03-24T10:15:00.000Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(4);
  });

  it('downloadTextFile creates and clicks a link with correct href and filename', () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:abc');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const fakeLink = { href: '', download: '', click: vi.fn() };
    const createElSpy = vi.spyOn(document, 'createElement').mockReturnValue(fakeLink as any);

    vi.useFakeTimers();
    downloadTextFile('x.txt', 'hello');
    expect(createSpy).toHaveBeenCalled();
    expect(fakeLink.href).toBe('blob:abc');
    expect(fakeLink.download).toBe('x.txt');
    expect(fakeLink.click).toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeSpy).toHaveBeenCalled();
    vi.useRealTimers();
    createElSpy.mockRestore();
  });

  it('idbJSONStorage setItem writes parsed value via writeStorageAsync', async () => {
    const { set } = await import('idb-keyval');
    (window as any).indexedDB = {};
    await idbJSONStorage.setItem('json_set', JSON.stringify({ test: 42 }));
    expect(set).toHaveBeenCalledWith('json_set', { test: 42 });
  });

  it('writeStorageAsync falls back to localStorage when indexedDB is missing', async () => {
    const originalIndexedDB = window.indexedDB;
    (window as any).indexedDB = undefined;
    await writeStorageAsync('fallback_key', { stored: true });
    expect(readStorage('fallback_key', null)).toEqual({ stored: true });
    (window as any).indexedDB = originalIndexedDB;
  });
});
