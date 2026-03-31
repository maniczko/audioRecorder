import crypto from 'node:crypto';
import type { Hono } from 'hono';
import { z } from 'zod';
import { logger } from '../logger.ts';
import { corsHeaders, securityHeaders } from '../lib/serverUtils.ts';

function buildCorsHeaders(origin: string | undefined, allowedOrigins: string) {
  return corsHeaders(origin || '', allowedOrigins);
}

export function applyAppCors(app: Hono<any>, _allowedOrigins: string) {
  app.use('*', async (c, next) => {
    const requestOrigin = c.req.header('origin') || '';
    const cors = buildCorsHeaders(requestOrigin, _allowedOrigins);

    if (c.req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': cors['Access-Control-Allow-Origin'],
          'Access-Control-Allow-Headers': cors['Access-Control-Allow-Headers'],
          'Access-Control-Allow-Methods': cors['Access-Control-Allow-Methods'],
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
          Vary: cors['Vary'],
        },
      });
    }

    await next();

    c.header('Access-Control-Allow-Origin', cors['Access-Control-Allow-Origin']);
    c.header('Access-Control-Allow-Headers', cors['Access-Control-Allow-Headers']);
    c.header('Access-Control-Allow-Methods', cors['Access-Control-Allow-Methods']);
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Vary', cors['Vary']);
  });
}

export function applyRequestMetadata(app: Hono<any>) {
  app.use('*', async (c, next) => {
    const reqId = crypto.randomUUID();
    c.set('reqId', reqId);

    const start = performance.now();
    await next();
    c.res.headers.set('X-Request-Id', reqId);

    const durationMs = performance.now() - start;
    logger.info(
      `[REQ] ${c.req.method} ${c.req.path} - ${c.res.status} [${durationMs.toFixed(1)}ms]`,
      {
        requestId: reqId,
        method: c.req.method,
        route: c.req.path,
        status: c.res.status,
        durationMs: durationMs.toFixed(2),
      }
    );
  });
}

const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = Number(process.env.RATE_LIMIT_MAX) || 100;
const RATE_LIMIT_MAX_ENTRIES = 10_000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Periodic sweep of expired rate-limit entries to prevent unbounded memory growth
let _rateLimitSweepTimer: ReturnType<typeof setInterval> | null = null;
export function startRateLimitSweep() {
  if (_rateLimitSweepTimer) return;
  _rateLimitSweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, state] of rateLimitMap) {
      if (state.resetAt < now) rateLimitMap.delete(ip);
    }
  }, 60_000);
  // Allow process to exit without waiting for this timer
  if (_rateLimitSweepTimer.unref) _rateLimitSweepTimer.unref();
}

export function applyRateLimiting(app: Hono<any>) {
  startRateLimitSweep();

  app.use('/auth/*', async (c, next) => {
    // [TEST] Skip rate limiting in tests to avoid interference with functional suites
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      await next();
      return;
    }

    const ip = c.req.header('x-forwarded-for') || 'local';
    const now = Date.now();
    const state = rateLimitMap.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

    if (now > state.resetAt) {
      state.count = 1;
      state.resetAt = now + RATE_LIMIT_WINDOW_MS;
    } else {
      state.count++;
    }

    rateLimitMap.set(ip, state);

    // Evict oldest entries if map grows too large (memory safety)
    if (rateLimitMap.size > RATE_LIMIT_MAX_ENTRIES) {
      const keysIter = rateLimitMap.keys();
      for (let i = 0; i < 1000; i++) {
        const k = keysIter.next();
        if (k.done) break;
        rateLimitMap.delete(k.value);
      }
    }

    if (state.count > MAX_REQUESTS_PER_WINDOW) {
      logger.warn(`[Security] Rate limit exceeded for IP: ${ip}`);
      return c.json(
        { message: 'Too many requests.', retryAfter: Math.ceil((state.resetAt - now) / 1000) },
        429
      );
    }

    await next();
  });
}

export function applySecurityHeaders(app: Hono<any>) {
  app.use('*', async (c, next) => {
    const headers = securityHeaders();
    c.header('Content-Security-Policy', headers['Content-Security-Policy']);
    c.header('X-Content-Type-Options', headers['X-Content-Type-Options']);
    c.header('X-Frame-Options', headers['X-Frame-Options']);
    await next();
  });
}

export function registerNotFoundHandler(app: Hono<any>) {
  app.notFound((c) => {
    const requestOrigin = c.req.header('origin');
    if (requestOrigin) {
      c.header('Access-Control-Allow-Origin', requestOrigin);
      c.header('Access-Control-Allow-Credentials', 'true');
    }
    return c.json({ message: 'Not found.' }, 404);
  });
}

export function registerAppErrorHandler(app: Hono<any>) {
  app.onError((err: any, c) => {
    console.error('APP ERROR STACK', err.stack);

    // Ensure CORS headers are always present on error responses.
    // app.onError creates a new response that may bypass the cors middleware's
    // post-next() header injection, so we set them explicitly here.
    const requestOrigin = c.req.header('origin');
    if (requestOrigin) {
      c.header('Access-Control-Allow-Origin', requestOrigin);
      c.header('Access-Control-Allow-Credentials', 'true');
    }

    if (err.name === 'ContextError' || err instanceof z.ZodError || err?.statusCode === 422) {
      return c.json({ message: 'Invalid payload.', errors: err?.errors || err.message }, 422);
    }
    const statusCode = err?.statusCode || err?.status || 500;
    if (statusCode === 429 && err?.retryAfter) {
      c.header('Retry-After', String(err.retryAfter));
    }
    return c.json({ message: err.message || 'Unexpected server error.' }, statusCode as any);
  });
}
