import { describe, expect, it } from 'vitest';
import { createRuntimeGuard } from './runtimeGuard';

describe('createRuntimeGuard', () => {
  it('accepts a run without browser failures', () => {
    const guard = createRuntimeGuard();

    expect(() => guard.assertHealthy()).not.toThrow();
  });

  it('reports an unexpected page error', () => {
    const guard = createRuntimeGuard();
    guard.recordPageError(new Error('Unexpected render failure'));

    expect(() => guard.assertHealthy()).toThrow(/Unexpected render failure/);
  });

  it('reports an unexpected console error', () => {
    const guard = createRuntimeGuard();
    guard.recordConsoleError('Unexpected runtime exception');

    expect(() => guard.assertHealthy()).toThrow(/Unexpected runtime exception/);
  });

  it('reports an unexpected server error without retaining query parameters', () => {
    const guard = createRuntimeGuard();
    guard.recordResponse(500, 'https://api.example.test/state/bootstrap?token=secret');

    expect(() => guard.assertHealthy()).toThrow(/https:\/\/api\.example\.test\/state\/bootstrap/);
    expect(() => guard.assertHealthy()).not.toThrow(/token=secret/);
  });

  it('allows narrowly documented expected errors', () => {
    const guard = createRuntimeGuard({
      allowedConsoleErrors: [/expected browser warning/i],
      allowedServerErrors: ['https://api.example.test/expected-outage'],
    });
    guard.recordConsoleError('Expected browser warning during controlled recovery');
    guard.recordResponse(503, 'https://api.example.test/expected-outage?requestId=redacted');

    expect(() => guard.assertHealthy()).not.toThrow();
  });
});
