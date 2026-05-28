import type { Hono } from 'hono';
import { resolveBuildMetadata } from '../runtime.ts';
import { config } from '../config.ts';
import { resolveSttRuntimePolicy } from '../stt/policy.ts';

export function registerHealthRoute(app: Hono<any>, db?: any) {
  app.get('/health', async (c) => {
    const build = resolveBuildMetadata(process.env, '0.1.0');
    let dbStatus: any = { ok: false, status: 'unreachable' };

    if (db) {
      if (typeof db.checkHealth === 'function') {
        dbStatus = await db.checkHealth();
      } else {
        try {
          await db._get('SELECT 1 as ok');
          dbStatus = { ok: true, status: 'connected' };
        } catch (err: any) {
          dbStatus = { ok: false, status: err.message };
        }
      }
    } else {
      dbStatus = { ok: true, status: 'no_db_required' };
    }

    const hasSupabaseEnv =
      Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
    const supabaseStorage = hasSupabaseEnv
      ? await import('../lib/supabaseStorage.ts')
          .then((module) => module.checkSupabaseStorageReadiness())
          .catch((error: any) => ({
            configured: true,
            ready: false,
            bucket: 'recordings',
            status: 'bucket_unavailable',
            error: error?.message || String(error),
          }))
      : {
          configured: false,
          ready: false,
          bucket: 'recordings',
          status: 'missing_config',
        };
    const hasDiarizationToken = Boolean(process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN);
    const stt = resolveSttRuntimePolicy(config, {
      hasOpenAi: Boolean(process.env.OPENAI_API_KEY || process.env.VOICELOG_OPENAI_API_KEY),
      hasGroq: Boolean(process.env.GROQ_API_KEY),
    });

    const memory = process.memoryUsage();
    const storageRequired =
      process.env.NODE_ENV === 'production' ||
      Boolean(process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_PROJECT_ID);
    const storageOk = !storageRequired || Boolean((supabaseStorage as any).ready);
    const status = dbStatus.ok && storageOk ? 'ok' : 'degraded';

    return c.json(
      {
        ok: dbStatus.ok && storageOk,
        status,
        db: dbStatus.status,
        supabaseRemote: Boolean((supabaseStorage as any).ready),
        supabaseStorage,
        uptime: Math.floor(process.uptime()),
        gitSha: build.gitSha,
        buildTime: build.buildTime,
        appVersion: build.appVersion,
        diarization: {
          enabled: hasDiarizationToken,
          provider: hasDiarizationToken ? 'pyannote' : 'disabled',
          status: hasDiarizationToken ? 'available' : 'degraded',
        },
        stt: {
          policy: stt.policy,
          provider: stt.provider,
          fallbackProvider: stt.fallbackProvider,
          processingMode: stt.processingMode,
          fullModel: stt.fullModel,
          fastModel: stt.fastModel,
          language: stt.language,
          openAiConfigured: Boolean(
            process.env.OPENAI_API_KEY || process.env.VOICELOG_OPENAI_API_KEY
          ),
          groqConfigured: Boolean(process.env.GROQ_API_KEY),
        },
        runtime: build.runtime,
        platform: process.platform,
        memory: {
          heapUsed: `${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          rss: `${(memory.rss / 1024 / 1024).toFixed(2)} MB`,
        },
      },
      dbStatus.ok && storageOk ? 200 : 503
    );
  });
}
