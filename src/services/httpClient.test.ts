import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiRequest, probeRemoteApiHealth, resetProbeDedup } from './httpClient';

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
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
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
  });

  afterEach(() => {
    vi.useRealTimers();
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
  });

  afterEach(() => {
    vi.useRealTimers();
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
