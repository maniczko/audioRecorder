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
