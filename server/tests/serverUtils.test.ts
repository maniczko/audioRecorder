import { EventEmitter } from 'node:events';
import v8 from 'node:v8';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkRateLimit,
  corsHeaders,
  getBearerToken,
  getMemoryPressure,
  readBinaryBody,
  readJsonBody,
  securityHeaders,
} from '../lib/serverUtils.ts';

function createMockRequest() {
  const request = new EventEmitter() as any;
  request.headers = {};
  request.complete = true;
  request.destroy = vi.fn();
  request.resume = vi.fn();
  return request;
}

describe('serverUtils', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SKIP_RATE_LIMIT = 'false';
  });

  afterEach(() => {
    process.env.SKIP_RATE_LIMIT = 'true';
  });

  it('builds CORS and security headers for localhost, vercel and fallback origins', () => {
    expect(corsHeaders('http://localhost:3000', 'https://prod.example.test')).toMatchObject({
      'Access-Control-Allow-Origin': 'http://localhost:3000',
    });
    expect(
      corsHeaders('https://preview-app.vercel.app', 'https://prod.example.test')
    ).toMatchObject({
      'Access-Control-Allow-Origin': 'https://preview-app.vercel.app',
    });
    expect(
      corsHeaders(
        'https://evil.example.test',
        'https://prod.example.test,https://stage.example.test'
      )
    ).toMatchObject({
      'Access-Control-Allow-Origin': 'https://prod.example.test',
    });
    expect(securityHeaders()).toEqual({
      'Content-Security-Policy': "default-src 'none'",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    });
  });

  it('returns bearer token only for proper authorization header', () => {
    expect(getBearerToken({ headers: { authorization: 'Bearer token-123' } })).toBe('token-123');
    expect(getBearerToken({ headers: { authorization: 'Basic abc' } })).toBe('');
    expect(getBearerToken({ headers: {} })).toBe('');
  });

  it('throws 429 after exceeding rate limit', () => {
    checkRateLimit('127.0.0.1', 'auth', 2);
    checkRateLimit('127.0.0.1', 'auth', 2);

    expect(() => checkRateLimit('127.0.0.1', 'auth', 2)).toThrowError(/Zbyt wiele prob/);
    let caughtError: any;
    try {
      checkRateLimit('127.0.0.1', 'upload', 0);
    } catch (error: any) {
      caughtError = error;
    }
    expect(caughtError).toBeDefined();
    expect(caughtError.statusCode).toBe(429);
    expect(caughtError.retryAfter).toBeGreaterThan(0);
  });

  it('reads JSON body and handles invalid or oversized payloads', async () => {
    const validRequest = createMockRequest();
    const validPromise = readJsonBody(validRequest, 1024);
    validRequest.emit('data', Buffer.from(JSON.stringify({ ok: true })));
    validRequest.emit('end');
    await expect(validPromise).resolves.toEqual({ ok: true });

    const invalidRequest = createMockRequest();
    const invalidPromise = readJsonBody(invalidRequest, 1024);
    invalidRequest.emit('data', Buffer.from('{invalid'));
    invalidRequest.emit('end');
    await expect(invalidPromise).rejects.toThrow(/Invalid JSON payload/);

    const largeRequest = createMockRequest();
    const largePromise = readJsonBody(largeRequest, 2);
    largeRequest.emit('data', Buffer.from('123'));
    await expect(largePromise).rejects.toMatchObject({ statusCode: 413 });
    expect(largeRequest.destroy).toHaveBeenCalledTimes(1);
  });

  it('reads binary body and handles oversize and aborted requests', async () => {
    const validRequest = createMockRequest();
    const validPromise = readBinaryBody(validRequest, 1024);
    validRequest.emit('data', Buffer.from('abc'));
    validRequest.emit('end');
    await expect(validPromise).resolves.toEqual(Buffer.from('abc'));

    const largeRequest = createMockRequest();
    const largePromise = readBinaryBody(largeRequest, 2);
    largeRequest.emit('data', Buffer.from('abcd'));
    await expect(largePromise).rejects.toMatchObject({ statusCode: 413 });
    expect(largeRequest.resume).toHaveBeenCalledTimes(1);

    const abortedRequest = createMockRequest();
    abortedRequest.complete = false;
    const abortedPromise = readBinaryBody(abortedRequest, 1024);
    abortedRequest.emit('close');
    await expect(abortedPromise).rejects.toThrow(/Request closed or aborted/);
  });

  describe('getMemoryPressure', () => {
    it('returns current memory status with numeric fields', () => {
      const result = getMemoryPressure();
      expect(result).toHaveProperty('ok');
      expect(result).toHaveProperty('heapUsedMB');
      expect(result).toHaveProperty('heapTotalMB');
      expect(result).toHaveProperty('rssMB');
      expect(result).toHaveProperty('ratio');
      expect(typeof result.ok).toBe('boolean');
      expect(result.heapUsedMB).toBeGreaterThan(0);
      expect(result.heapTotalMB).toBeGreaterThan(0);
      expect(result.ratio).toBeGreaterThan(0);
      expect(result.ratio).toBeLessThan(1);
    });

    it('reports ok=true under normal test conditions', () => {
      const result = getMemoryPressure();
      expect(result.ok).toBe(true);
    });

    it('reports ok=false when heap usage ratio exceeds 85%', () => {
      const originalMemoryUsage = process.memoryUsage;
      const originalGetHeapStatistics = v8.getHeapStatistics;
      process.memoryUsage = (() => ({
        heapUsed: 900 * 1024 * 1024,
        heapTotal: 1000 * 1024 * 1024,
        rss: 1100 * 1024 * 1024,
        external: 0,
        arrayBuffers: 0,
      })) as any;
      v8.getHeapStatistics = (() => ({
        ...originalGetHeapStatistics(),
        heap_size_limit: 1000 * 1024 * 1024,
      })) as any;

      try {
        const result = getMemoryPressure();
        expect(result.ok).toBe(false);
        expect(result.ratio).toBeCloseTo(0.9, 1);
      } finally {
        process.memoryUsage = originalMemoryUsage;
        v8.getHeapStatistics = originalGetHeapStatistics;
      }
    });

    // ─────────────────────────────────────────────────────────────────
    // Issue #0 — False memory pressure with low heapTotal
    // Date: 2026-03-30
    // Bug: getMemoryPressure used heapUsed/heapTotal ratio which gave 93%
    //      when heapTotal was only 44 MB (V8 current allocation), causing
    //      false 503 rejections on uploads with only 41 MB heap used
    // Fix: Use v8.getHeapStatistics().heap_size_limit (respects --max-old-space-size)
    //      as denominator instead of heapTotal
    // ─────────────────────────────────────────────────────────────────
    describe('Regression: #0 — false memory pressure with low heapTotal', () => {
      it('reports ok=true when heapUsed is low even if heapTotal is close to heapUsed', () => {
        const originalMemoryUsage = process.memoryUsage;
        const originalGetHeapStatistics = v8.getHeapStatistics;
        // Simulate the exact production scenario: 41MB used, 44MB heapTotal, 768MB limit
        process.memoryUsage = (() => ({
          heapUsed: 41 * 1024 * 1024,
          heapTotal: 44 * 1024 * 1024,
          rss: 4876 * 1024 * 1024,
          external: 0,
          arrayBuffers: 0,
        })) as any;
        v8.getHeapStatistics = (() => ({
          ...originalGetHeapStatistics(),
          heap_size_limit: 768 * 1024 * 1024,
        })) as any;

        try {
          const result = getMemoryPressure();
          expect(result.ok).toBe(true);
          // 41/768 ≈ 5.3%, well below 85% threshold
          expect(result.ratio).toBeLessThan(0.1);
          expect(result.heapUsedMB).toBe(41);
          expect(result.heapTotalMB).toBe(768);
        } finally {
          process.memoryUsage = originalMemoryUsage;
          v8.getHeapStatistics = originalGetHeapStatistics;
        }
      });
    });
  });
});
