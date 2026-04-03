import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock config for auto-send
vi.mock('../services/config', () => ({
  API_BASE_URL: 'http://localhost:4000',
  apiBaseUrlConfigured: () => true,
}));

import { useErrorLogStore, _resetPendingForTest } from './errorLogStore';

describe('errorLogStore', () => {
  beforeEach(() => {
    useErrorLogStore.setState({ errors: [] });
    _resetPendingForTest();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('starts with empty errors', () => {
    expect(useErrorLogStore.getState().errors).toEqual([]);
  });

  test('addError creates entry with id and timestamp', () => {
    useErrorLogStore.getState().addError({
      type: 'runtime',
      message: 'Test error',
    });

    const errors = useErrorLogStore.getState().errors;
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      type: 'runtime',
      message: 'Test error',
    });
    expect(errors[0].id).toMatch(/^err-/);
    expect(errors[0].timestamp).toBeTruthy();
  });

  test('addError preserves stack and context', () => {
    useErrorLogStore.getState().addError({
      type: 'react-boundary',
      message: 'Component crash',
      stack: 'Error: Component crash\n  at Component',
      context: 'ErrorBoundary:App',
    });

    const entry = useErrorLogStore.getState().errors[0];
    expect(entry.stack).toBe('Error: Component crash\n  at Component');
    expect(entry.context).toBe('ErrorBoundary:App');
  });

  test('addError respects maxErrors limit', () => {
    useErrorLogStore.setState({ maxErrors: 3 });

    for (let i = 0; i < 5; i++) {
      useErrorLogStore.getState().addError({
        type: 'runtime',
        message: `Error ${i}`,
      });
    }

    const errors = useErrorLogStore.getState().errors;
    expect(errors).toHaveLength(3);
    expect(errors[0].message).toBe('Error 2');
    expect(errors[2].message).toBe('Error 4');
  });

  test('clearErrors removes all entries', () => {
    useErrorLogStore.getState().addError({ type: 'runtime', message: 'err1' });
    useErrorLogStore.getState().addError({ type: 'network', message: 'err2' });
    expect(useErrorLogStore.getState().errors).toHaveLength(2);

    useErrorLogStore.getState().clearErrors();
    expect(useErrorLogStore.getState().errors).toEqual([]);
  });

  test('exportErrors returns valid JSON with all entries', () => {
    useErrorLogStore.getState().addError({ type: 'runtime', message: 'err1' });
    useErrorLogStore.getState().addError({ type: 'manual', message: 'err2' });

    const json = useErrorLogStore.getState().exportErrors();
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].message).toBe('err1');
    expect(parsed[1].message).toBe('err2');
  });

  test('getErrorCount returns current count', () => {
    expect(useErrorLogStore.getState().getErrorCount()).toBe(0);
    useErrorLogStore.getState().addError({ type: 'runtime', message: 'err' });
    expect(useErrorLogStore.getState().getErrorCount()).toBe(1);
  });

  test('handles all error types', () => {
    useErrorLogStore.setState({ maxErrors: 200 });
    const types = [
      'runtime',
      'unhandled-rejection',
      'react-boundary',
      'network',
      'manual',
    ] as const;
    for (const type of types) {
      useErrorLogStore.getState().addError({ type, message: `${type} error` });
    }
    expect(useErrorLogStore.getState().errors).toHaveLength(5);
    expect(useErrorLogStore.getState().errors.map((e) => e.type)).toEqual([...types]);
  });

  describe('auto-send to server', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      vi.useFakeTimers();
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ ok: true, received: 1 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test('sends errors to server after delay', async () => {
      useErrorLogStore.getState().addError({ type: 'runtime', message: 'Auto-sent' });

      // Not sent immediately
      expect(fetchSpy).not.toHaveBeenCalled();

      // Advance past flush delay (5s)
      await vi.advanceTimersByTimeAsync(6000);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:4000/api/client-errors',
        expect.objectContaining({ method: 'POST' })
      );
    });

    test('batches multiple errors into one request', async () => {
      useErrorLogStore.getState().addError({ type: 'runtime', message: 'Err 1' });
      useErrorLogStore.getState().addError({ type: 'network', message: 'Err 2' });

      await vi.advanceTimersByTimeAsync(6000);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(body).toHaveLength(2);
    });

    test('does not crash when fetch fails', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Network down'));

      useErrorLogStore.getState().addError({ type: 'runtime', message: 'Err during failure' });
      await vi.advanceTimersByTimeAsync(6000);

      // Should not throw — error still in local store
      expect(useErrorLogStore.getState().errors).toHaveLength(1);
    });
  });
});
