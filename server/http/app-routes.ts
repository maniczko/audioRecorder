import type { Hono } from 'hono';
import { timingSafeEqual } from 'node:crypto';
import type { AppMiddlewares, AppServices } from '../routes/middleware.ts';
import { createAuthRoutes } from '../routes/auth.ts';
import { createDigestRoutes } from '../routes/digest.ts';
import { createGoogleIntegrationRoutes } from '../routes/googleIntegrations.ts';
import { createWorkspacesRoutes } from '../routes/workspaces.ts';
import { createMediaRoutes, createTranscribeRoutes } from '../routes/media.ts';
import { createAiRoutes } from '../routes/ai.ts';
import { createClientErrorRoutes } from '../routes/clientErrors.ts';
import { registerCapabilitiesRoute } from './capabilities.ts';
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

function cleanQueryValue(value: unknown, maxLength = 160) {
  return String(value || '')
    .trim()
    .slice(0, maxLength);
}

function parsePositiveInt(value: unknown, fallback?: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function safeJobReason(value: unknown) {
  return cleanQueryValue(value, 500);
}

function serializeTranscriptionJob(job: any) {
  if (!job) return null;
  return {
    id: String(job.id || ''),
    recordingId: String(job.recording_id || ''),
    workspaceId: String(job.workspace_id || ''),
    meetingId: String(job.meeting_id || ''),
    status: String(job.status || ''),
    attemptCount: Number(job.attempt_count || 0),
    maxAttempts: Number(job.max_attempts || 0),
    nextRunAt: String(job.next_run_at || ''),
    createdAt: String(job.created_at || ''),
    updatedAt: String(job.updated_at || ''),
    completedAt: String(job.completed_at || ''),
    diagnostics: {
      lockedBy: String(job.locked_by || ''),
      lockedUntil: String(job.locked_until || ''),
      lastErrorCode: String(job.last_error_code || ''),
      lastErrorMessage: String(job.last_error_message || ''),
    },
  };
}

async function writeTranscriptionJobOperatorAudit(
  services: AppServices,
  action: string,
  job: any,
  reason: string,
  requestId: string
) {
  const auditTarget =
    typeof services.db?.writeAuditLogBestEffort === 'function' ? services.db : null;
  if (!auditTarget || !job?.workspace_id || !job?.id) return;

  await auditTarget.writeAuditLogBestEffort({
    workspaceId: String(job.workspace_id),
    actorUserId: 'ops-token',
    action,
    entityType: 'transcription_job',
    entityId: String(job.id),
    metadata: {
      recordingId: String(job.recording_id || ''),
      meetingId: String(job.meeting_id || ''),
      status: String(job.status || ''),
      reason,
      requestId,
      source: 'api',
    },
  });
}

export function registerAppRoutes(
  app: Hono<any>,
  services: AppServices,
  middlewares: AppMiddlewares
) {
  registerHealthRoute(app, (services as any).db);
  registerCapabilitiesRoute(app);

  app.get('/metrics', middlewares.applyRateLimit('admin-sensitive', 20), async (c) => {
    const denied = requireOpsAccess(c, services);
    if (denied) return denied;
    const deadLetterMetrics =
      typeof services.db?.getTranscriptionDeadLetterMetrics === 'function'
        ? await services.db.getTranscriptionDeadLetterMetrics()
        : null;
    const metrics = [
      await MetricsService.getPrometheusMetrics(),
      deadLetterMetrics
        ? MetricsService.formatTranscriptionDeadLetterMetrics(deadLetterMetrics)
        : '',
    ]
      .filter(Boolean)
      .join('\n');
    return c.text(metrics);
  });

  app.get('/api/admin/metrics', middlewares.applyRateLimit('admin-sensitive', 20), async (c) => {
    const denied = requireOpsAccess(c, services);
    if (denied) return denied;
    const summary = MetricsService.getJsonSummary();
    if (typeof services.db?.getTranscriptionDeadLetterMetrics === 'function') {
      summary.transcriptionJobs = {
        ...(summary.transcriptionJobs || {}),
        deadLetter: await services.db.getTranscriptionDeadLetterMetrics(),
      };
    }
    return c.json(summary);
  });

  app.get('/api/admin/heapdump', middlewares.applyRateLimit('admin-sensitive', 5), async (c) => {
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

  app.get(
    '/api/admin/transcription-jobs',
    middlewares.applyRateLimit('admin-sensitive', 20),
    async (c) => {
      const denied = requireOpsAccess(c, services);
      if (denied) return denied;
      if (typeof services.db?.listTranscriptionJobsForOperations !== 'function') {
        return c.json({ message: 'Transcription job operations are unavailable.' }, 501);
      }

      const filters = {
        workspaceId: cleanQueryValue(c.req.query('workspaceId')),
        status: cleanQueryValue(c.req.query('status'), 60),
        recordingId: cleanQueryValue(c.req.query('recordingId')),
        errorCode: cleanQueryValue(c.req.query('errorCode'), 120),
        olderThanMinutes: parsePositiveInt(c.req.query('olderThanMinutes')),
        limit: parsePositiveInt(c.req.query('limit'), 50),
      };
      const jobs = await services.db.listTranscriptionJobsForOperations(filters);
      return c.json(
        { jobs: jobs.map(serializeTranscriptionJob), count: jobs.length, filters },
        200
      );
    }
  );

  app.get(
    '/api/admin/transcription-jobs/:jobId',
    middlewares.applyRateLimit('admin-sensitive', 20),
    async (c) => {
      const denied = requireOpsAccess(c, services);
      if (denied) return denied;
      if (typeof services.db?.getTranscriptionJobById !== 'function') {
        return c.json({ message: 'Transcription job operations are unavailable.' }, 501);
      }

      const job = await services.db.getTranscriptionJobById(c.req.param('jobId'));
      if (!job) return c.json({ message: 'Nie znaleziono zadania transkrypcji.' }, 404);
      return c.json({ job: serializeTranscriptionJob(job) }, 200);
    }
  );

  const runTranscriptionJobAction = async (c: any, methodName: string, auditAction: string) => {
    const denied = requireOpsAccess(c, services);
    if (denied) return denied;
    if (typeof services.db?.[methodName] !== 'function') {
      return c.json({ message: 'Transcription job operations are unavailable.' }, 501);
    }

    const body = await c.req.json().catch(() => ({}));
    const reason = safeJobReason(body?.reason);
    const job = await services.db[methodName](c.req.param('jobId'), { reason });
    if (!job) return c.json({ message: 'Nie znaleziono zadania transkrypcji.' }, 404);
    await writeTranscriptionJobOperatorAudit(
      services,
      auditAction,
      job,
      reason,
      c.get('reqId') || ''
    );
    return c.json({ job: serializeTranscriptionJob(job) }, 200);
  };

  app.post(
    '/api/admin/transcription-jobs/:jobId/retry',
    middlewares.applyRateLimit('admin-sensitive', 10),
    (c) =>
      runTranscriptionJobAction(
        c,
        'retryTranscriptionJobForOperations',
        'operator.transcription_job.retry'
      )
  );

  app.post(
    '/api/admin/transcription-jobs/:jobId/cancel',
    middlewares.applyRateLimit('admin-sensitive', 10),
    (c) =>
      runTranscriptionJobAction(
        c,
        'cancelTranscriptionJobForOperations',
        'operator.transcription_job.cancel'
      )
  );

  app.post(
    '/api/admin/transcription-jobs/:jobId/mark-failed',
    middlewares.applyRateLimit('admin-sensitive', 10),
    (c) =>
      runTranscriptionJobAction(
        c,
        'markTranscriptionJobFailedForOperations',
        'operator.transcription_job.mark_failed'
      )
  );

  app.post(
    '/api/admin/transcription-jobs/:jobId/replay',
    middlewares.applyRateLimit('admin-sensitive', 10),
    (c) =>
      runTranscriptionJobAction(
        c,
        'replayDeadLetterTranscriptionJobForOperations',
        'operator.transcription_job.replay'
      )
  );

  app.route('/auth', createAuthRoutes(services, middlewares));
  app.route('/', createWorkspacesRoutes(services, middlewares));
  app.route('/media', createMediaRoutes(services, middlewares));
  app.route('/transcribe', createTranscribeRoutes(services, middlewares));
  app.route('/digest', createDigestRoutes(services, middlewares));
  app.route('/integrations/google', createGoogleIntegrationRoutes(services, middlewares));
  app.route('/ai', createAiRoutes(services, middlewares));
  app.route('/api/client-errors', createClientErrorRoutes());
}
