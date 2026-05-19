import type { Hono } from 'hono';
import { timingSafeEqual } from 'node:crypto';
import type { AppMiddlewares, AppServices } from '../routes/middleware.ts';
import { createAuthRoutes } from '../routes/auth.ts';
import { createDigestRoutes } from '../routes/digest.ts';
import { createWorkspacesRoutes } from '../routes/workspaces.ts';
import { createMediaRoutes, createTranscribeRoutes } from '../routes/media.ts';
import { createAiRoutes } from '../routes/ai.ts';
import { createClientErrorRoutes } from '../routes/clientErrors.ts';
import { registerHealthRoute } from './health.ts';
import { MetricsService } from '../services/MetricsService.ts';

function tokenMatches(provided: string, expected: string) {
  if (!provided || !expected) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function getProvidedAdminToken(c: any) {
  const authHeader = String(c.req.header('Authorization') || '');
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  return bearer || String(c.req.header('X-Admin-Token') || '').trim();
}

function requireOpsAccess(c: any, services: AppServices) {
  const expected = String(services.config?.adminToken || process.env.VOICELOG_ADMIN_TOKEN || '');
  if (!expected.trim()) {
    return c.json({ message: 'Admin endpoints are disabled.' }, 403);
  }

  if (!tokenMatches(getProvidedAdminToken(c), expected.trim())) {
    return c.json({ message: 'Admin authorization required.' }, 401);
  }

  return null;
}

export function registerAppRoutes(
  app: Hono<any>,
  services: AppServices,
  middlewares: AppMiddlewares
) {
  registerHealthRoute(app, (services as any).db);

  app.get('/metrics', async (c) => {
    const denied = requireOpsAccess(c, services);
    if (denied) return denied;
    const metrics = await MetricsService.getPrometheusMetrics();
    return c.text(metrics);
  });

  app.get('/api/admin/metrics', (c) => {
    const denied = requireOpsAccess(c, services);
    if (denied) return denied;
    const summary = MetricsService.getJsonSummary();
    return c.json(summary);
  });

  app.get('/api/admin/heapdump', async (c) => {
    if (
      services.config?.enableHeapdump !== true &&
      process.env.VOICELOG_ENABLE_HEAPDUMP !== 'true'
    ) {
      return c.json({ message: 'Heapdump endpoint is disabled.' }, 404);
    }
    const denied = requireOpsAccess(c, services);
    if (denied) return denied;

    const v8 = await import('node:v8');
    const path = await import('node:path');
    const filename = `heap-${Date.now()}.heapsnapshot`;
    const filepath = path.join(process.cwd(), filename);
    v8.writeHeapSnapshot(filepath);
    return c.json({ message: 'Heap snapshot created', fileName: filename });
  });

  app.route('/auth', createAuthRoutes(services, middlewares));
  app.route('/', createWorkspacesRoutes(services, middlewares));
  app.route('/media', createMediaRoutes(services, middlewares));
  app.route('/transcribe', createTranscribeRoutes(services, middlewares));
  app.route('/digest', createDigestRoutes(services, middlewares));
  app.route('/ai', createAiRoutes(middlewares));
  app.route('/api/client-errors', createClientErrorRoutes());
}
