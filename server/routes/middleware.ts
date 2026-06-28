import { getConnInfo } from '@hono/node-server/conninfo';
import { checkRateLimit } from '../lib/serverUtils.ts';
import { verifyProgressToken } from '../lib/progressTokens.ts';

export type AppServices = {
  authService: any;
  workspaceService: any;
  transcriptionService: any;
  db: any;
  config: any;
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

  const applyRateLimit =
    (route: string, max = 10) =>
    async (c: any, next: any) => {
      let socketIp = 'unknown';
      try {
        const conn = getConnInfo(c);
        socketIp = conn?.remote?.address || 'unknown';
      } catch (_) {
        // getConnInfo throws when called via app.request() in tests
      }
      const clientIp = config.trustProxy
        ? c.req.header('x-forwarded-for')?.split(',')[0].trim() || socketIp
        : socketIp;
      checkRateLimit(clientIp, route, max);
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
