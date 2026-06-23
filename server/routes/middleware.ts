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
    const authHeader = c.req.header('Authorization') || '';
    const queryToken = String(c.req.query?.('token') || '').trim();
    const progressToken = String(c.req.query?.('progressToken') || '').trim();
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (!bearerToken && progressToken) {
      const recordingId = String(c.req.param?.('recordingId') || '').trim();
      const progressSession = verifyProgressToken(progressToken, recordingId);
      if (!progressSession) {
        return c.json({ message: 'Token postepu wygasl lub jest nieprawidlowy.' }, 401);
      }
      c.set('session', progressSession);
      return await next();
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
