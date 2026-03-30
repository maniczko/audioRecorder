import type { Hono } from 'hono';
import { resolveBuildMetadata } from '../runtime.ts';

export function registerHealthRoute(app: Hono<any>, db?: any) {
  app.get('/health', async (c) => {
    const build = resolveBuildMetadata(process.env, '0.1.0');
    let dbOk = false;
    if (db) {
      try {
        await Promise.race([
          db._get('SELECT 1 as ok'),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('DB health timeout')), 5000)
          ),
        ]);
        dbOk = true;
      } catch (err: any) {
        console.warn('[health] DB check failed:', err?.message);
      }
    } else {
      dbOk = true; // no DB reference, assume OK
    }
    const hasSupabase =
      Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
    const status = dbOk ? 'ok' : 'degraded';
    return c.json(
      {
        ok: dbOk,
        status,
        db: dbOk ? 'connected' : 'unreachable',
        supabaseRemote: hasSupabase,
        uptime: process.uptime(),
        gitSha: build.gitSha,
        buildTime: build.buildTime,
        appVersion: build.appVersion,
        runtime: build.runtime,
      },
      dbOk ? 200 : 503
    );
  });
}
