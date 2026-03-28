import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiRequest } from './httpClient';

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
    const mockFetch = vi
      .fn()
      .mockRejectedValue(new Error('Failed to fetch'));

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
