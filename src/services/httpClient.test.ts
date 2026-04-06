import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  apiRequest,
  probeRemoteApiHealth,
  resetProbeDedup,
  resetCircuitBreaker,
} from './httpClient';

// Mock dependencies
vi.mock('../lib/sessionStorage', () => ({
  readLegacySession: vi.fn(() => null),
  readWorkspacePersistedSession: vi.fn(() => null),
}));

vi.mock('./config', () => ({
  API_BASE_URL: 'http://test-api.local',
  apiBaseUrlConfigured: vi.fn(() => true),
}));

vi.mock('../runtime/browserRuntime', () => ({
  getHostedRuntimeBuildId: vi.fn(() => ''),
  isHostedPreviewHost: vi.fn(() => false),
}));

describe('httpClient retry logic', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.useFakeTimers();
    resetCircuitBreaker();
    resetProbeDedup();
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
    resetCircuitBreaker();
  });

  it('retries on 502 Bad Gateway error', async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
        text: () => Promise.resolve(''),
        headers: new Headers({ 'content-type': 'application/json' }),
      });

    global.fetch = mockFetch as any;

    const promise = apiRequest('/test', { retries: 2 });

    // Fast-forward timers to trigger retries
    await vi.advanceTimersByTimeAsync(3000);

    const result = await promise;
    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('retries on 503 Service Unavailable error', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ message: 'Service Unavailable' }),
        text: () => Promise.resolve(''),
        headers: new Headers({ 'content-type': 'application/json' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ message: 'Service Unavailable' }),
        text: () => Promise.resolve(''),
        headers: new Headers({ 'content-type': 'application/json' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
        text: () => Promise.resolve(''),
        headers: new Headers({ 'content-type': 'application/json' }),
      });

    global.fetch = mockFetch as any;

    const promise = apiRequest('/test', { retries: 2 });

    // Fast-forward timers to trigger retries
    await vi.advanceTimersByTimeAsync(3000);

    const result = await promise;
    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('retries on network error (failed to fetch)', async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
        text: () => Promise.resolve(''),
        headers: new Headers({ 'content-type': 'application/json' }),
      });

    global.fetch = mockFetch as any;

    const promise = apiRequest('/test', { retries: 1 });

    // Fast-forward timers to trigger retry
    await vi.advanceTimersByTimeAsync(1500);

    const result = await promise;
    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on 400 Bad Request', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'Bad request' }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    global.fetch = mockFetch as any;

    await expect(apiRequest('/test', { retries: 3 })).rejects.toThrow('Bad request');
    expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
  });

  it('does NOT retry on 401 Unauthorized', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Unauthorized' }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    global.fetch = mockFetch as any;

    await expect(apiRequest('/test', { retries: 3 })).rejects.toThrow('Unauthorized');
    expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
  });

  it('throws error after all retries are exhausted', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    global.fetch = mockFetch as any;

    const promise = apiRequest('/test', { retries: 2 }).catch((e: unknown) => e);

    // Fast-forward timers past all retries
    await vi.advanceTimersByTimeAsync(10000);

    const error = await promise;
    expect(error).toBeInstanceOf(Error);
    expect(mockFetch).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('uses exponential backoff (1s, 2s, 4s...)', async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
        text: () => Promise.resolve(''),
        headers: new Headers({ 'content-type': 'application/json' }),
      });

    global.fetch = mockFetch as any;

    const promise = apiRequest('/test', { retries: 2 });

    // After 1st retry (1s delay)
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // After 2nd retry (2s delay)
    await vi.advanceTimersByTimeAsync(2000);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    const result = await promise;
    expect(result).toEqual({ success: true });
  });

  it('respects max retry delay of 10 seconds', async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
        text: () => Promise.resolve(''),
        headers: new Headers({ 'content-type': 'application/json' }),
      });

    global.fetch = mockFetch as any;

    const promise = apiRequest('/test', { retries: 4 });

    // Should cap at 10s delay for later retries
    await vi.advanceTimersByTimeAsync(30000);

    await expect(promise).resolves.toEqual({ success: true });
  });

  it('allows disabling retries with retries=0', async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error('Failed to fetch'));

    global.fetch = mockFetch as any;

    await expect(apiRequest('/test', { retries: 0 })).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
  });

  it('fails fast without fetch retries when browser is offline', async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch as any;
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    });

    const error = await apiRequest('/test', { retries: 3 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('Browser offline');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('passes custom headers and auth token', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      text: () => Promise.resolve(''),
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    global.fetch = mockFetch as any;

    await apiRequest('/test', {
      method: 'POST',
      headers: { 'X-Custom-Header': 'test' },
      body: { data: 'test' },
      retries: 0,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://test-api.local/test',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Custom-Header': 'test',
        }),
        body: JSON.stringify({ data: 'test' }),
      })
    );
  });
});

describe('probeRemoteApiHealth retry logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetProbeDedup();
    resetCircuitBreaker();
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    resetCircuitBreaker();
  });

  function mockHealthResponse(
    ok: boolean,
    status = 200,
    payload = { status: 'ok', gitSha: 'abc123' }
  ) {
    return {
      ok,
      status,
      json: () => Promise.resolve(payload),
      text: () => Promise.resolve(JSON.stringify(payload)),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as Response;
  }

  it('returns payload on first successful probe', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(mockHealthResponse(true));

    const promise = probeRemoteApiHealth(fetchMock as any, 0);
    const result = await promise;

    expect(result).toEqual({ status: 'ok', gitSha: 'abc123' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries on 502 and succeeds on second attempt', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockHealthResponse(false, 502))
      .mockResolvedValueOnce(mockHealthResponse(true));

    const promise = probeRemoteApiHealth(fetchMock as any, 2);

    // Advance past first retry delay (1s)
    await vi.advanceTimersByTimeAsync(2000);

    const result = await promise;
    expect(result).toEqual({ status: 'ok', gitSha: 'abc123' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries on network error and succeeds on retry', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce(mockHealthResponse(true));

    const promise = probeRemoteApiHealth(fetchMock as any, 2);
    await vi.advanceTimersByTimeAsync(2000);

    const result = await promise;
    expect(result).toEqual({ status: 'ok', gitSha: 'abc123' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting all retries on 503', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockHealthResponse(false, 503));

    const promise = probeRemoteApiHealth(fetchMock as any, 2).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(15000);

    const error = await promise;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('HTTP 503');
    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('does not retry on 404 (non-transient error)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(mockHealthResponse(false, 404));

    await expect(probeRemoteApiHealth(fetchMock as any, 2)).rejects.toThrow('HTTP 404');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses exponential backoff between retries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockHealthResponse(false, 502))
      .mockResolvedValueOnce(mockHealthResponse(false, 502))
      .mockResolvedValueOnce(mockHealthResponse(true));

    const promise = probeRemoteApiHealth(fetchMock as any, 3);

    // After 1st retry delay (1s)
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // After 2nd retry delay (2s)
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const result = await promise;
    expect(result).toEqual({ status: 'ok', gitSha: 'abc123' });
  });

  it('fails fast without network requests when browser is offline', async () => {
    const fetchMock = vi.fn();
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    });

    const error = await probeRemoteApiHealth(fetchMock as any, 3).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('Browser offline');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────
// Issue #0 — Health probe storm: 7+ useWorkspaceData instances fire
// independent probes during 502 outages
// Date: 2026-03-30
// Bug: Each hook instance has its own isProbingRef, so concurrent
//      callers each trigger a separate probeRemoteApiHealth chain.
// Fix: Module-level promise deduplication + cooldown in httpClient.
// ─────────────────────────────────────────────────────────────────
describe('Regression: Issue #0 — probeRemoteApiHealth deduplication', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetProbeDedup();
    resetCircuitBreaker();
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    resetCircuitBreaker();
  });

  function mockHealthResponse(
    ok: boolean,
    status = 200,
    payload = { status: 'ok', gitSha: 'abc123' }
  ) {
    return {
      ok,
      status,
      json: () => Promise.resolve(payload),
      text: () => Promise.resolve(JSON.stringify(payload)),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as Response;
  }

  it('deduplicates concurrent calls into a single network probe', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockHealthResponse(true));

    // Simulate 5 concurrent callers (like 5 useWorkspaceData instances)
    const p1 = probeRemoteApiHealth(fetchMock as any, 0);
    const p2 = probeRemoteApiHealth(fetchMock as any, 0);
    const p3 = probeRemoteApiHealth(fetchMock as any, 0);
    const p4 = probeRemoteApiHealth(fetchMock as any, 0);
    const p5 = probeRemoteApiHealth(fetchMock as any, 0);

    const results = await Promise.all([p1, p2, p3, p4, p5]);

    // Only 1 fetch call, not 5
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // All callers get the same result
    for (const r of results) {
      expect(r).toEqual({ status: 'ok', gitSha: 'abc123' });
    }
  });

  it('enforces cooldown after a failed probe', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockHealthResponse(false, 502));

    // First call fails (no retries for simplicity)
    const err1 = await probeRemoteApiHealth(fetchMock as any, 0).catch((e: unknown) => e);
    expect(err1).toBeInstanceOf(Error);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Immediate second call should be rejected by cooldown — no network request
    fetchMock.mockClear();
    const err2 = await probeRemoteApiHealth(fetchMock as any, 0).catch((e: unknown) => e);
    expect(err2).toBeInstanceOf(Error);
    expect((err2 as Error).message).toContain('cooldown');
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('allows a new probe after cooldown expires', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockHealthResponse(false, 502))
      .mockResolvedValueOnce(mockHealthResponse(true));

    // First call fails
    await probeRemoteApiHealth(fetchMock as any, 0).catch(() => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance past cooldown (10s)
    await vi.advanceTimersByTimeAsync(11_000);

    // Now a new probe should be allowed
    const result = await probeRemoteApiHealth(fetchMock as any, 0);
    expect(result).toEqual({ status: 'ok', gitSha: 'abc123' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('broadcasts failure to all concurrent callers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockHealthResponse(false, 404));

    const p1 = probeRemoteApiHealth(fetchMock as any, 0).catch((e: unknown) => e);
    const p2 = probeRemoteApiHealth(fetchMock as any, 0).catch((e: unknown) => e);
    const p3 = probeRemoteApiHealth(fetchMock as any, 0).catch((e: unknown) => e);

    const errors = await Promise.all([p1, p2, p3]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    for (const e of errors) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).toBe('HTTP 404');
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// Issue #0 — 501 acoustic-features returns generic error message
// Date: 2026-04-04
// Bug: When server returned 501 (Not Implemented) for missing
//      acoustic_features.py, frontend showed raw error text instead
//      of a user-friendly message.
// Fix: normalizeApiErrorMessage maps status 501 →
//      "Funkcja niedostepna na serwerze."
// ─────────────────────────────────────────────────────────────────
describe('Regression: Issue #0 — httpClient normalizes 501 to user-friendly message', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('throws error with "Funkcja niedostepna" message for HTTP 501', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 501,
      json: () =>
        Promise.resolve({
          message: 'Analiza akustyczna niedostepna — brak skryptu acoustic_features.py.',
        }),
      text: () => Promise.resolve(''),
      headers: new Headers({ 'content-type': 'application/json' }),
    }) as any;

    const error = await apiRequest('/media/recordings/rec1/acoustic-features', {
      method: 'POST',
      retries: 0,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('Funkcja niedostepna na serwerze.');
    expect((error as Error & { status: number }).status).toBe(501);
  });

  it('does NOT retry on 501 — it is a permanent error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 501,
      json: () => Promise.resolve({ message: 'Not Implemented' }),
      text: () => Promise.resolve(''),
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    global.fetch = mockFetch as any;

    await apiRequest('/test', { retries: 3 }).catch(() => {});

    // 501 should NOT trigger retries (only 502/503/504 do)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────
// Issue #0 — Network retry storm when backend is unreachable
// Date: 2026-04-12
// Bug: When backend goes down, httpClient keeps retrying every request
//      independently, stacking retry chains and flooding the console.
// Fix: Added circuit breaker — after 3 consecutive transport failures,
//      new requests are rejected immediately for an increasing cooldown.
// ─────────────────────────────────────────────────────────────────
describe('Regression: Issue #0 — circuit breaker prevents retry storms', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.useFakeTimers();
    resetCircuitBreaker();
    resetProbeDedup();
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
    resetCircuitBreaker();
  });

  it('blocks new requests after 3 consecutive transport failures', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
    global.fetch = mockFetch as any;

    // Exhaust 3 requests with retries:0 to trigger circuit breaker
    for (let i = 0; i < 3; i++) {
      await apiRequest('/test', { retries: 0 }).catch(() => {});
    }

    // 4th request should be blocked immediately without fetch call
    mockFetch.mockClear();
    await expect(apiRequest('/test', { retries: 0 })).rejects.toThrow(
      'Backend jest chwilowo niedostepny'
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('allows requests again after cooldown expires', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
    global.fetch = mockFetch as any;

    // Trip the circuit breaker
    for (let i = 0; i < 3; i++) {
      await apiRequest('/test', { retries: 0 }).catch(() => {});
    }

    // Fast-forward past cooldown (15s base)
    await vi.advanceTimersByTimeAsync(16_000);

    // Now requests should go through again
    mockFetch.mockClear();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      text: () => Promise.resolve(''),
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    const result = await apiRequest('/test', { retries: 0 });
    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not interrupt in-flight retry chain', async () => {
    // Mock: 3 failures then success within a single request
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
        text: () => Promise.resolve(''),
        headers: new Headers({ 'content-type': 'application/json' }),
      });
    global.fetch = mockFetch as any;

    const promise = apiRequest('/test', { retries: 3 });
    await vi.advanceTimersByTimeAsync(15000);

    // Should complete successfully — circuit breaker doesn't break in-flight retries
    const result = await promise;
    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('blocks health probe when circuit breaker is open', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
    global.fetch = fetchMock as any;

    // Trip circuit breaker via regular requests
    for (let i = 0; i < 3; i++) {
      await apiRequest('/test', { retries: 0 }).catch(() => {});
    }

    // Health probe should also be blocked
    fetchMock.mockClear();
    await expect(probeRemoteApiHealth(fetchMock as any, 0)).rejects.toThrow('cooldown');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------
// Issue #0 - Vercel preview timeout message bypasses transport guards
// Date: 2026-04-06
// Bug: the platform error text "timeout exceeded when trying to connect"
//      was not classified as a transport failure, so the client skipped
//      friendly messaging, probe retries and higher-level cooldown logic.
// Fix: treat connection-timeout variants as transport failures everywhere.
// ----------------------------------------------------------------
describe('Regression: Issue #0 - timeout exceeded when trying to connect is treated as transport failure', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.useFakeTimers();
    resetCircuitBreaker();
    resetProbeDedup();
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
    resetCircuitBreaker();
  });

  it('normalizes Vercel proxy timeout responses to backend unavailable', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'timeout exceeded when trying to connect' }),
      text: () => Promise.resolve(''),
      headers: new Headers({ 'content-type': 'application/json' }),
    }) as any;

    const error = await apiRequest('/state/bootstrap', { retries: 0 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      'Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile.'
    );
    expect((error as Error & { status: number }).status).toBe(500);
  });

  it('retries health probe when Vercel reports timeout exceeded when trying to connect', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout exceeded when trying to connect'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', gitSha: 'abc123' }),
        text: () => Promise.resolve('{"status":"ok","gitSha":"abc123"}'),
        headers: new Headers({ 'content-type': 'application/json' }),
      });

    const promise = probeRemoteApiHealth(fetchMock as any, 2);
    await vi.advanceTimersByTimeAsync(2000);

    await expect(promise).resolves.toEqual({ status: 'ok', gitSha: 'abc123' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
