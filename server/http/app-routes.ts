import type { Hono } from 'hono';
import type { AppMiddlewares, AppServices } from '../routes/middleware.ts';
import { createAuthRoutes } from '../routes/auth.ts';
import { createDigestRoutes } from '../routes/digest.ts';
import { createWorkspacesRoutes } from '../routes/workspaces.ts';
import { createMediaRoutes, createTranscribeRoutes } from '../routes/media.ts';
import { createAiRoutes } from '../routes/ai.ts';
import { createClientErrorRoutes } from '../routes/clientErrors.ts';
import { registerHealthRoute } from './health.ts';
import { MetricsService } from '../services/MetricsService.ts';

export function registerAppRoutes(
  app: Hono<any>,
  services: AppServices,
  middlewares: AppMiddlewares
) {
  registerHealthRoute(app, (services as any).db);

  app.get('/metrics', async (c) => {
    const metrics = await MetricsService.getPrometheusMetrics();
    return c.text(metrics);
  });

  app.get('/api/admin/metrics', (c) => {
    const summary = MetricsService.getJsonSummary();
    return c.json(summary);
  });

  app.get('/api/admin/heapdump', async (c) => {
    const v8 = await import('node:v8');
    const path = await import('node:path');
    const filename = `heap-${Date.now()}.heapsnapshot`;
    const filepath = path.join(process.cwd(), filename);
    v8.writeHeapSnapshot(filepath);
    return c.json({ message: 'Heap snapshot created', file: filepath });
  });

  app.route('/auth', createAuthRoutes(services, middlewares));
  app.route('/', createWorkspacesRoutes(services, middlewares));
  app.route('/media', createMediaRoutes(services, middlewares));
  app.route('/transcribe', createTranscribeRoutes(services, middlewares));
  app.route('/digest', createDigestRoutes(services, middlewares));
  app.route('/ai', createAiRoutes(middlewares));
  app.route('/api/client-errors', createClientErrorRoutes());
}
