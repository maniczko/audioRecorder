import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useErrorLogStore } from '../store/errorLogStore';

// Must import after store since it uses the store
import { useGlobalErrorCatcher } from './useGlobalErrorCatcher';

describe('useGlobalErrorCatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useErrorLogStore.setState({ errors: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('registers error and unhandledrejection listeners on mount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() => useGlobalErrorCatcher());

    const eventNames = addSpy.mock.calls.map(([name]) => name);
    expect(eventNames).toContain('error');
    expect(eventNames).toContain('unhandledrejection');
  });

  test('removes listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useGlobalErrorCatcher());

    unmount();

    const eventNames = removeSpy.mock.calls.map(([name]) => name);
    expect(eventNames).toContain('error');
    expect(eventNames).toContain('unhandledrejection');
  });

  test('catches runtime errors via window error event', () => {
    renderHook(() => useGlobalErrorCatcher());

    const event = new ErrorEvent('error', {
      message: 'Test runtime error',
      error: new Error('Test runtime error'),
      filename: 'test.ts',
      lineno: 42,
      colno: 10,
    });
    window.dispatchEvent(event);

    const errors = useErrorLogStore.getState().errors;
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe('runtime');
    expect(errors[0].message).toBe('Test runtime error');
    expect(errors[0].source).toBe('test.ts:42:10');
  });

  test('catches unhandled promise rejections', () => {
    renderHook(() => useGlobalErrorCatcher());

    const reason = new Error('Promise failed');
    const event = new PromiseRejectionEvent('unhandledrejection', {
      promise: Promise.reject(reason).catch(() => {}),
      reason,
    });
    window.dispatchEvent(event);

    const errors = useErrorLogStore.getState().errors;
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe('unhandled-rejection');
    expect(errors[0].message).toBe('Promise failed');
  });

  test('handles error event with missing details', () => {
    renderHook(() => useGlobalErrorCatcher());

    const event = new ErrorEvent('error', {});
    window.dispatchEvent(event);

    const errors = useErrorLogStore.getState().errors;
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('Unknown runtime error');
    expect(errors[0].source).toMatch(/unknown:/);
  });
});
