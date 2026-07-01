import { getConnInfo } from '@hono/node-server/conninfo';
import { verifyProgressToken } from '../lib/progressTokens.ts';
import {
  createRouteRateLimitStore,
  type RouteRateLimitCheck,
  type RouteRateLimitStore,
} from '../lib/routeRateLimitStore.ts';

export type AppServices = {
  authService: any;
  workspaceService: any;
  transcriptionService: any;
  db: any;
  config: any;
  rateLimitStore?: RouteRateLimitStore;
};

const PROGRESS_TOKEN_HEADER = 'X-Progress-Token';
const PROGRESS_TOKEN_COOKIE = 'progressToken';

function getHeader(c: any, name: string) {
  return String(c.req.header?.(name) || '').trim();
}

function readCookieValue(cookieHeader: string, name: string) {
  const cookies = String(cookieHeader || '').split(';');
  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf('=');
    if (separatorIndex < 0) continue;
    const key = cookie.slice(0, separatorIndex).trim();
    if (key !== name) continue;
    const value = cookie.slice(separatorIndex + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return '';
}

function getProgressTokenFromSafeTransport(c: any) {
  const explicitHeaderToken = getHeader(c, PROGRESS_TOKEN_HEADER);
  if (explicitHeaderToken) return explicitHeaderToken;

  const authHeader = getHeader(c, 'Authorization');
  const progressAuthMatch = authHeader.match(/^Progress\s+(.+)$/i);
  if (progressAuthMatch?.[1]?.trim()) return progressAuthMatch[1].trim();

  return readCookieValue(getHeader(c, 'Cookie'), PROGRESS_TOKEN_COOKIE);
}

function isProgressStreamRequest(c: any) {
  const requestPath = String(c.req.path || c.req.url || '').split('?')[0];
  return /\/recordings\/[^/]+\/progress$/.test(requestPath);
}

function allowProgressQueryToken() {
  return process.env.VOICELOG_ALLOW_PROGRESS_QUERY_TOKEN === 'true';
}

export function createMiddlewares(services: AppServices) {
  const { authService, workspaceService, config } = services;
  const rateLimitStore =
    services.rateLimitStore ||
    createRouteRateLimitStore({ db: services.db, config: services.config, env: process.env });

  const rateLimitWindowMs = () => {
    const configured =
      config?.rateLimitWindowMs ||
      config?.VOICELOG_RATE_LIMIT_WINDOW_MS ||
      process.env.VOICELOG_RATE_LIMIT_WINDOW_MS;
    const parsed = Number(configured);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 60_000;
  };

  const cleanKeyPart = (value: unknown) =>
    String(value || 'unknown')
      .trim()
      .replace(/[^a-zA-Z0-9_.:-]/g, '_')
      .slice(0, 160);

  const getClientIp = (c: any) => {
    let socketIp = 'unknown';
    try {
      const conn = getConnInfo(c);
      socketIp = conn?.remote?.address || 'unknown';
    } catch (_) {
      // getConnInfo throws when called via app.request() in tests
    }
    return config?.trustProxy
      ? c.req.header('x-forwarded-for')?.split(',')[0].trim() || socketIp
      : socketIp;
  };

  const getSession = (c: any) => {
    try {
      return c.get('session') || null;
    } catch (_) {
      return null;
    }
  };

  const getWorkspaceId = (c: any, session: any) => {
    const candidates = [
      c.req.param?.('workspaceId'),
      c.req.header('X-Workspace-Id'),
      c.req.query?.('workspaceId'),
      session?.workspace_id,
      session?.workspaceId,
    ];
    return String(candidates.find((value) => String(value || '').trim()) || '').trim();
  };

  const buildRateLimitChecks = (c: any, route: string, max: number): RouteRateLimitCheck[] => {
    const now = Date.now();
    const windowMs = rateLimitWindowMs();
    const session = getSession(c);
    const clientIp = getClientIp(c);
    const userId = String(session?.user_id || session?.userId || '').trim();
    const workspaceId = getWorkspaceId(c, session);
    const routeKey = cleanKeyPart(route);
    const checks: RouteRateLimitCheck[] = [
      {
        key: `route:${routeKey}:ip:${cleanKeyPart(clientIp)}`,
        limit: max,
        windowMs,
        now,
      },
    ];

    if (userId) {
      checks.push({
        key: `route:${routeKey}:user:${cleanKeyPart(userId)}`,
        limit: max,
        windowMs,
        now,
      });
    }

    if (workspaceId) {
      checks.push({
        key: `route:${routeKey}:workspace:${cleanKeyPart(workspaceId)}`,
        limit: max,
        windowMs,
        now,
      });
    }

    return checks;
  };

  const applyRateLimit =
    (route: string, max = 10) =>
    async (c: any, next: any) => {
      if (process.env.SKIP_RATE_LIMIT === 'true') {
        await next();
        return;
      }

      const limit = Number.isFinite(Number(max)) && Number(max) > 0 ? Math.floor(Number(max)) : 1;
      const exceeded = await rateLimitStore.increment(buildRateLimitChecks(c, route, limit));
      if (exceeded) {
        const clientIp = getClientIp(c);
        console.warn(
          `[RATE LIMIT] ${clientIp} exceeded ${exceeded.limit} req/min on /${route}. Retry after ${exceeded.retryAfter}s`
        );
        c.header('Retry-After', String(exceeded.retryAfter));
        c.header('X-RateLimit-Limit', String(exceeded.limit));
        c.header('X-RateLimit-Remaining', '0');
        return c.json(
          {
            code: 'rate_limited',
            message: 'Zbyt wiele prob. Sprobuj ponownie pozniej.',
            retryable: true,
            retryAfter: exceeded.retryAfter,
            route,
            requestId: c.get('reqId') || 'unknown',
          },
          429
        );
      }

      await next();
    };

  const authMiddleware = async (c: any, next: any) => {
    // Pass OPTIONS preflight requests through — cors middleware handles them.
    if (c.req.method === 'OPTIONS') {
      return await next();
    }
    const authHeader = getHeader(c, 'Authorization');
    const queryToken = String(c.req.query?.('token') || '').trim();
    const queryProgressToken = String(c.req.query?.('progressToken') || '').trim();
    const safeProgressToken = getProgressTokenFromSafeTransport(c);
    const progressToken =
      safeProgressToken || (allowProgressQueryToken() ? queryProgressToken : '');
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (!bearerToken && progressToken) {
      if (!isProgressStreamRequest(c)) {
        return c.json({ message: 'Progress token is only valid for progress streams.' }, 401);
      }
      const recordingId = String(c.req.param?.('recordingId') || '').trim();
      const progressSession = verifyProgressToken(progressToken, recordingId);
      if (!progressSession) {
        return c.json({ message: 'Token postepu wygasl lub jest nieprawidlowy.' }, 401);
      }
      c.set('session', progressSession);
      return await next();
    }

    if (!bearerToken && queryProgressToken) {
      return c.json({ message: 'Progress token query transport is disabled.' }, 401);
    }

    if (!bearerToken && queryToken && String(process.env.NODE_ENV).toLowerCase() === 'production') {
      return c.json({ message: 'Query token is disabled in production.' }, 401);
    }

    const token = bearerToken || queryToken;
    if (!token) {
      return c.json({ message: 'Brak tokenu autoryzacyjnego.' }, 401);
    }
    const session = await authService.getSession(token);
    if (!session) {
      return c.json({ message: 'Sesja wygasla lub jest nieprawidlowa.' }, 401);
    }
    c.set('session', session);
    return await next();
  };

  const ensureWorkspaceAccess = async (c: any, workspaceId: string) => {
    const session = c.get('session');
    const membership = await workspaceService.getMembership(workspaceId, session.user_id);
    if (!membership) {
      const err = new Error('Nie masz dostepu do tego workspace.') as any;
      err.statusCode = 403;
      throw err;
    }
    return membership;
  };

  return { applyRateLimit, authMiddleware, ensureWorkspaceAccess };
}

export type AppMiddlewares = ReturnType<typeof createMiddlewares>;
