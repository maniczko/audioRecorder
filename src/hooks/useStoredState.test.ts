import { renderHook, act } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';

import useStoredState from './useStoredState';

const readStorageMock = vi.fn();
const writeStorageMock = vi.fn();
const writeStorageAsyncMock = vi.fn();

vi.mock('../lib/storage', () => ({
  readStorage: (...args: unknown[]) => readStorageMock(...args),
  writeStorage: (...args: unknown[]) => writeStorageMock(...args),
  readStorageAsync: vi.fn().mockResolvedValue(undefined),
  writeStorageAsync: (...args: unknown[]) => writeStorageAsyncMock(...args),
}));

describe('useStoredState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readStorageMock.mockImplementation((_key: string, init: unknown) => init);
  });

  test('yields localStorage value on first render', () => {
    readStorageMock.mockImplementation((key: string) => {
      if (key === 'test.key') return { saved: true };
      return undefined;
    });

    const { result } = renderHook(() => useStoredState('test.key', null));

    expect(readStorageMock).toHaveBeenCalledWith('test.key', null);
    expect(result.current[0]).toEqual({ saved: true });
  });

  test('dual-writes to localStorage and IndexedDB on update', () => {
    const { result } = renderHook(() => useStoredState('dual.key', 'initial'));

    act(() => {
      result.current[1]('updated');
    });

    expect(result.current[0]).toBe('updated');
    expect(writeStorageMock).toHaveBeenCalledWith('dual.key', 'updated');
    expect(writeStorageAsyncMock).toHaveBeenCalledWith('dual.key', 'updated');
  });

  test('supports functional updater', () => {
    readStorageMock.mockImplementation((key: string) => (key === 'counter' ? 5 : undefined));

    const { result } = renderHook(() => useStoredState('counter', 0));

    act(() => {
      result.current[1]((prev: number) => prev + 1);
    });

    expect(result.current[0]).toBe(6);
    expect(writeStorageMock).toHaveBeenCalledWith('counter', 6);
  });
});
