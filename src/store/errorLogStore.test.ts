import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { useErrorLogStore } from './errorLogStore';

describe('errorLogStore', () => {
  beforeEach(() => {
    useErrorLogStore.setState({ errors: [] });
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
});
