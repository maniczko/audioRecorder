import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { httpClient, httpGet, httpPost } from '../lib/httpClient.ts';

describe('httpClient.ts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('makes a GET request with default options', async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    const result = await httpClient('https://api.example.com/data');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.com/data',
      expect.objectContaining({
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });

  test('sends JSON body for POST requests', async () => {
    const mockResponse = new Response(JSON.stringify({ id: 1 }), { status: 201 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    await httpClient('https://api.example.com/items', {
      method: 'POST',
      body: { name: 'test' },
    });

    const callArgs = fetchSpy.mock.calls[0][1];
    expect(callArgs?.method).toBe('POST');
    expect(callArgs?.headers).toHaveProperty('Content-Type', 'application/json');
    expect(JSON.parse(callArgs?.body as string)).toEqual({ name: 'test' });
  });

  test('passes custom headers', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    await httpClient('https://api.example.com', {
      headers: { Authorization: 'Bearer token123' },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token123' }),
      })
    );
  });

  test('does not set Content-Type for FormData body', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    // Create a minimal mock FormData
    const formData = new FormData();
    formData.append('file', new Blob(['test']), 'test.txt');

    await httpClient('https://api.example.com/upload', {
      method: 'POST',
      body: formData,
    });

    const callArgs = fetchSpy.mock.calls[0][1];
    expect(callArgs?.headers).not.toHaveProperty('Content-Type', 'application/json');
    expect(callArgs?.body).toBeInstanceOf(FormData);
  });

  test('returns response text via text() method', async () => {
    const mockResponse = new Response('hello world', { status: 200 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    const result = await httpClient('https://api.example.com');
    const text = await result.text();
    expect(text).toBe('hello world');
  });

  test('returns response JSON via json() method', async () => {
    const data = { id: 42, name: 'test' };
    const mockResponse = new Response(JSON.stringify(data), { status: 200 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    const result = await httpClient('https://api.example.com');
    const json = await result.json();
    expect(json).toEqual(data);
  });

  test('throws on non-retryable errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Invalid URL'));

    await expect(httpClient('https://api.example.com')).rejects.toThrow('Invalid URL');
  });

  test('throws immediately when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      httpClient('https://api.example.com', { signal: controller.signal })
    ).rejects.toThrow();
  });

  test('retries on transient 502 error', async () => {
    const mock502 = new Response('Bad Gateway', { status: 502 });
    const mock200 = new Response(JSON.stringify({ ok: true }), { status: 200 });
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mock502)
      .mockResolvedValueOnce(mock200);

    const promise = httpClient('https://api.example.com');
    // Fast-forward through retry delay (500ms * 2^0 = 500ms)
    await vi.advanceTimersByTimeAsync(600);
    const result = await promise;

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.status).toBe(200);
  });

  test('retries on transient 503 error', async () => {
    const mock503 = new Response('Service Unavailable', { status: 503 });
    const mock200 = new Response('ok', { status: 200 });
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mock503)
      .mockResolvedValueOnce(mock200);

    const promise = httpClient('https://api.example.com');
    await vi.advanceTimersByTimeAsync(600);
    const result = await promise;

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.status).toBe(200);
  });

  test('retries on transient 504 error', async () => {
    const mock504 = new Response('Gateway Timeout', { status: 504 });
    const mock200 = new Response('ok', { status: 200 });
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mock504)
      .mockResolvedValueOnce(mock200);

    const promise = httpClient('https://api.example.com');
    await vi.advanceTimersByTimeAsync(600);
    const result = await promise;

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.status).toBe(200);
  });

  test('retries on network error', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValue(new Response('ok', { status: 200 }));

    const promise = httpClient('https://api.example.com');
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.status).toBe(200);
  });

  test('returns response with ok=false after max retries on persistent 502', async () => {
    const mock502 = new Response('Bad Gateway', { status: 502 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mock502);

    const promise = httpClient('https://api.example.com');
    // Fast-forward through all retry delays: 500 + 1000 = 1500ms (only 2 retries, 3rd attempt returns)
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result.status).toBe(502);
    expect(result.ok).toBe(false);
  });

  test('httpGet convenience method uses GET', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    await httpGet('https://api.example.com');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'GET' })
    );
  });

  test('httpPost convenience method uses POST with body', async () => {
    const mockResponse = new Response('created', { status: 201 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    await httpPost('https://api.example.com', { name: 'item' });

    const callArgs = fetchSpy.mock.calls[0][1];
    expect(callArgs?.method).toBe('POST');
    expect(JSON.parse(callArgs?.body as string)).toEqual({ name: 'item' });
  });

  test('uses custom timeout from options', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    await httpClient('https://api.example.com', { timeout: 5000 });

    // fetch should have been called with an AbortController signal
    expect(fetch).toHaveBeenCalled();
  });
});
