import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { Hono } from 'hono';
import { AppServices, AppMiddlewares } from './middleware.ts';
import { applyWorkspaceStateDelta, normalizeWorkspaceState } from '../../src/shared/contracts.ts';
import type { VoiceProfileSummary, VoiceProfilesListPayload } from '../../src/shared/types.ts';
import { buildFallbackRagAnswer, generateRagAnswer } from '../lib/ragAnswer.ts';
import {
  createVoiceProfileEmbeddingFailure,
  requireVoiceProfileEmbedding,
} from '../lib/voiceProfileEmbedding.ts';

const workspaceStatePatchLocks = new Map<string, Promise<void>>();
const DEFAULT_WORKSPACE_STATE_PATCH_LOCK_TIMEOUT_MS = 30_000;

function resolveWorkspaceStatePatchLockTimeoutMs() {
  const numeric = Number(process.env.WORKSPACE_STATE_PATCH_LOCK_TIMEOUT_MS);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.floor(numeric);
  }
  return DEFAULT_WORKSPACE_STATE_PATCH_LOCK_TIMEOUT_MS;
}

function createWorkspaceStatePatchTimeoutError(timeoutMs: number) {
  const error = new Error(`Workspace state patch timed out after ${timeoutMs}ms.`) as Error & {
    statusCode?: number;
    retryAfter?: number;
  };
  error.statusCode = 503;
  error.retryAfter = Math.max(1, Math.ceil(timeoutMs / 1000));
  return error;
}

async function runWorkspaceStatePatchWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
  const timeoutMs = resolveWorkspaceStatePatchLockTimeoutMs();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(createWorkspaceStatePatchTimeoutError(timeoutMs)),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function withWorkspaceStatePatchLock<T>(
  workspaceId: string,
  operation: () => Promise<T>
): Promise<T> {
  const key = String(workspaceId || 'default');
  const previous = workspaceStatePatchLocks.get(key) ?? Promise.resolve();
  let releaseCurrent: () => void = () => {};
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const queued = previous.catch(() => undefined).then(() => current);

  workspaceStatePatchLocks.set(key, queued);
  await previous.catch(() => undefined);

  try {
    return await runWorkspaceStatePatchWithTimeout(operation);
  } finally {
    releaseCurrent();
    if (workspaceStatePatchLocks.get(key) === queued) {
      workspaceStatePatchLocks.delete(key);
    }
  }
}

export function createWorkspacesRoutes(services: AppServices, middlewares: AppMiddlewares) {
  const router = new Hono<{ Variables: { session: any; user: any; reqId: string } }>();
  const { authService, workspaceService, transcriptionService, config } = services;
  const { authMiddleware, applyRateLimit, ensureWorkspaceAccess } = middlewares;

  // --- Users ---
  router.use('/users/*', authMiddleware);
  router.put('/users/:userId/profile', async (c) => {
    const session = c.get('session') as any;
    const userId = c.req.param('userId');
    if (session.user_id !== userId)
      return c.json({ message: 'Mozesz edytowac tylko swoj profil.' }, 403);
    const workspaceId = c.req.query('workspaceId') || session.workspace_id;
    const body = await c.req.json().catch(() => ({}));
    const user = await authService.updateUserProfile(userId, body);
    const payload = await authService.buildSessionPayload(session.user_id, workspaceId);
    return c.json({ user, users: payload.users }, 200);
  });

  router.post('/users/:userId/password', async (c) => {
    const session = c.get('session') as any;
    const userId = c.req.param('userId');
    if (session.user_id !== userId)
      return c.json({ message: 'Mozesz zmienic tylko swoje haslo.' }, 403);
    const body = await c.req.json().catch(() => ({}));
    return c.json(await authService.changeUserPassword(userId, body), 200);
  });

  // --- State ---
  router.use('/state/*', authMiddleware);
  router.get('/state/bootstrap', async (c) => {
    const session = c.get('session') as any;
    const workspaceId = c.req.query('workspaceId') || session.workspace_id;
    await ensureWorkspaceAccess(c, workspaceId);
    return c.json(await authService.buildSessionPayload(session.user_id, workspaceId), 200);
  });

  router.put('/state/workspaces/:workspaceId', async (c) => {
    const workspaceId = c.req.param('workspaceId');
    await ensureWorkspaceAccess(c, workspaceId);
    const body = await c.req.json().catch(() => ({}));
    return c.json(
      {
        workspaceId,
        state: await workspaceService.saveWorkspaceState(workspaceId, body),
      },
      200
    );
  });

  router.patch('/state/workspaces/:workspaceId', async (c) => {
    const workspaceId = c.req.param('workspaceId');
    await ensureWorkspaceAccess(c, workspaceId);
    const delta = await c.req.json().catch(() => ({}));
    return withWorkspaceStatePatchLock(workspaceId, async () => {
      const currentState = normalizeWorkspaceState(
        await workspaceService.getWorkspaceState(workspaceId)
      );
      const mergedState = applyWorkspaceStateDelta(currentState, delta);
      return c.json(
        {
          workspaceId,
          state: await workspaceService.saveWorkspaceState(workspaceId, mergedState),
        },
        200
      );
    });
  });

  // --- Workspaces ---
  router.use('/workspaces/*', authMiddleware);

  function requireWorkspaceAdmin(membership: any) {
    return ['owner', 'admin'].includes(String(membership?.member_role || ''));
  }

  function requireAuditReader(membership: any) {
    return ['owner', 'admin', 'operator'].includes(String(membership?.member_role || ''));
  }

  router.put('/workspaces/:workspaceId/retention', async (c) => {
    const workspaceId = c.req.param('workspaceId');
    const membership = await ensureWorkspaceAccess(c, workspaceId);
    if (!requireWorkspaceAdmin(membership)) {
      return c.json({ message: 'Tylko owner lub admin moze zmieniac retencje.' }, 403);
    }

    const body = await c.req.json().catch(() => ({}));
    const retentionDays = Number(body.retentionDays);
    if (!Number.isFinite(retentionDays) || retentionDays < 0) {
      return c.json({ message: 'retentionDays musi byc liczba nieujemna.' }, 400);
    }

    const session = c.get('session') as any;
    return c.json(
      await workspaceService.updateRetentionPolicy(
        workspaceId,
        Math.floor(retentionDays),
        String(session?.user_id || ''),
        String(c.get('reqId') || '')
      ),
      200
    );
  });

  router.post('/workspaces/:workspaceId/retention/cleanup', async (c) => {
    const workspaceId = c.req.param('workspaceId');
    const membership = await ensureWorkspaceAccess(c, workspaceId);
    if (!requireWorkspaceAdmin(membership)) {
      return c.json({ message: 'Tylko owner lub admin moze uruchomic cleanup retencji.' }, 403);
    }

    const body = await c.req.json().catch(() => ({}));
    const session = c.get('session') as any;
    return c.json(
      await workspaceService.cleanupExpiredRecordingsByRetention(workspaceId, {
        nowIso: body.nowIso,
        actorUserId: String(session?.user_id || ''),
        source: 'api',
        requestId: String(c.get('reqId') || ''),
      }),
      200
    );
  });

  router.get('/workspaces/:workspaceId/export', async (c) => {
    const workspaceId = c.req.param('workspaceId');
    const membership = await ensureWorkspaceAccess(c, workspaceId);
    if (!requireWorkspaceAdmin(membership)) {
      return c.json({ message: 'Tylko owner lub admin moze eksportowac dane workspace.' }, 403);
    }

    const session = c.get('session') as any;
    return c.json(
      await workspaceService.exportWorkspaceData(workspaceId, {
        actorUserId: String(session?.user_id || ''),
        source: 'api',
        requestId: String(c.get('reqId') || ''),
      }),
      200
    );
  });

  router.get('/workspaces/:workspaceId/audit-logs', async (c) => {
    const workspaceId = c.req.param('workspaceId');
    const membership = await ensureWorkspaceAccess(c, workspaceId);
    if (!requireAuditReader(membership)) {
      return c.json({ message: 'Tylko owner, admin lub operator moze przegladac audyt.' }, 403);
    }

    const limit = Number(c.req.query('limit') || 100);
    return c.json(
      await workspaceService.listAuditLogs(workspaceId, {
        recordingId: String(c.req.query('recordingId') || '').trim(),
        cursor: String(c.req.query('cursor') || '').trim(),
        limit: Number.isFinite(limit) ? Math.floor(limit) : 100,
      }),
      200
    );
  });

  router.put('/workspaces/:workspaceId/members/:targetUserId/role', async (c) => {
    const workspaceId = c.req.param('workspaceId');
    const targetUserId = c.req.param('targetUserId');
    const membership = await ensureWorkspaceAccess(c, workspaceId);
    if (!['owner', 'admin'].includes(membership.member_role)) {
      return c.json({ message: 'Tylko owner lub admin moze zmieniac role.' }, 403);
    }
    const body = await c.req.json().catch(() => ({}));
    return c.json(
      await workspaceService.updateWorkspaceMemberRole(workspaceId, targetUserId, body.memberRole),
      200
    );
  });

  router.delete('/workspaces/:workspaceId/members/:targetUserId', async (c) => {
    const workspaceId = c.req.param('workspaceId');
    const targetUserId = c.req.param('targetUserId');
    const membership = await ensureWorkspaceAccess(c, workspaceId);
    const session = c.get('session') as any;
    if (membership.member_role !== 'owner') {
      return c.json({ message: 'Tylko owner moze usuwac czlonkow.' }, 403);
    }
    if (session.user_id === targetUserId) {
      return c.json({ message: 'Nie mozesz usunac samego siebie.' }, 400);
    }
    await workspaceService.removeWorkspaceMember(workspaceId, targetUserId);
    return new Response(null, { status: 204 });
  });

  router.post('/workspaces/:workspaceId/rag/ask', applyRateLimit('rag-ask', 10), async (c) => {
    const workspaceId = c.req.param('workspaceId');
    await ensureWorkspaceAccess(c, workspaceId);

    const body = await c.req.json().catch(() => ({}));
    const question = String(body.question || '').trim();
    if (!question) return c.json({ answer: 'Zadaj konkretne pytanie.' }, 400);

    const topChunks = await transcriptionService.queryRAG(workspaceId, question);
    if (!topChunks || topChunks.length === 0) {
      return c.json({ answer: 'Brak danych z archiwalnych spotkan na ten temat.' }, 200);
    }

    try {
      const answer = await generateRagAnswer({
        question,
        chunks: topChunks,
        config,
        workspaceId,
      });
      return c.json({ answer });
    } catch (err: any) {
      console.warn('[RAG] Falling back to archive snippets:', err?.message || err);
      return c.json(
        {
          answer: buildFallbackRagAnswer({
            question,
            chunks: topChunks,
            errorMessage: err?.message || '',
          }),
          fallback: true,
        },
        200
      );
    }
  });

  const hasVoiceProfileEmbedding = (profile: any) => {
    const value = profile.embedding_json ?? profile.embeddingJson ?? profile.embedding;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value !== 'string' || !value.trim()) return false;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  };

  const VOICE_PROFILE_EMBEDDING_MODEL = 'voice-profile-embedding';
  const VOICE_PROFILE_EMBEDDING_VERSION = '1';
  const VOICE_PROFILE_MANUAL_SOURCE = 'manual_upload';

  const voiceProfileMetadata = (profile: any) => {
    const fallbackCreatedAt = profile?.created_at ?? profile?.createdAt;
    const fallbackUserId = profile?.user_id ?? profile?.userId ?? '';
    return {
      source: profile?.profile_source ?? profile?.source ?? 'unknown',
      model: profile?.embedding_model ?? profile?.model ?? 'unknown',
      version: profile?.embedding_version ?? profile?.version ?? VOICE_PROFILE_EMBEDDING_VERSION,
      createdBy: profile?.created_by ?? profile?.createdBy ?? fallbackUserId,
      updatedAt: profile?.updated_at ?? profile?.updatedAt ?? fallbackCreatedAt,
    };
  };

  // --- Voice Profiles ---
  router.use('/voice-profiles', authMiddleware);
  router.use('/voice-profiles/*', authMiddleware);
  router.get('/voice-profiles', async (c) => {
    const session = c.get('session') as any;
    const profiles: VoiceProfileSummary[] = (
      await workspaceService.getWorkspaceVoiceProfiles(session.workspace_id)
    ).map((p: any) => ({
      id: p.id,
      speakerName: p.speaker_name,
      userId: p.user_id,
      createdAt: p.created_at,
      hasEmbedding: hasVoiceProfileEmbedding(p),
      sampleCount: Number.isFinite(Number(p.sample_count)) ? Number(p.sample_count) : 1,
      threshold: typeof p.threshold === 'number' ? p.threshold : 0.82,
      ...voiceProfileMetadata(p),
    }));
    const payload: VoiceProfilesListPayload = { profiles };
    return c.json(payload, 200);
  });

  router.post('/voice-profiles', applyRateLimit('voice-profiles'), async (c) => {
    const session = c.get('session') as any;
    await ensureWorkspaceAccess(c, session.workspace_id);

    const speakerName = String(c.req.header('X-Speaker-Name') || '').slice(0, 120);
    if (!speakerName.trim()) return c.json({ message: 'Brakuje naglowka X-Speaker-Name.' }, 400);

    const bufferArray = await c.req.arrayBuffer();
    if (bufferArray.byteLength > 1 * 1024 * 1024)
      return c.json({ message: 'Plik audio przekracza maksymalny rozmiar limitu 1MB.' }, 413);
    const buffer = Buffer.from(bufferArray);
    if (!buffer || buffer.byteLength < 1000)
      return c.json({ message: 'Plik audio jest za krotki.' }, 400);

    const contentType = c.req.header('content-type') || 'audio/webm';
    const profileId = `vp_${crypto.randomUUID().replace(/-/g, '')}`;
    const ext = contentType.includes('mp4')
      ? '.m4a'
      : contentType.includes('wav')
        ? '.wav'
        : '.webm';
    const audioPath = path.join(config.uploadDir, `${profileId}${ext}`);
    fs.writeFileSync(audioPath, buffer);

    let embedding: number[];
    try {
      embedding = requireVoiceProfileEmbedding(
        await transcriptionService.computeEmbedding(audioPath)
      );
    } catch (error) {
      try {
        fs.unlinkSync(audioPath);
      } catch (_) {}
      const failure =
        (error as any)?.code === 'embedding_failed'
          ? (error as ReturnType<typeof createVoiceProfileEmbeddingFailure>)
          : createVoiceProfileEmbeddingFailure(error);
      return c.json(
        {
          code: failure.code,
          stage: failure.stage,
          message: failure.message,
        },
        failure.statusCode
      );
    }

    const profile = await workspaceService.upsertVoiceProfile({
      id: profileId,
      userId: session.user_id,
      workspaceId: session.workspace_id,
      speakerName: speakerName.trim(),
      audioPath,
      embedding,
      source: VOICE_PROFILE_MANUAL_SOURCE,
      model: VOICE_PROFILE_EMBEDDING_MODEL,
      version: VOICE_PROFILE_EMBEDDING_VERSION,
      createdBy: session.user_id,
    });

    const sampleCount = profile.sample_count || 1;
    const status = sampleCount > 1 ? 200 : 201;
    return c.json(
      {
        id: profile.id,
        speakerName: profile.speaker_name,
        hasEmbedding: embedding.length > 0,
        createdAt: profile.created_at,
        sampleCount,
        threshold: typeof profile.threshold === 'number' ? profile.threshold : 0.82,
        isUpdate: Boolean(profile.isUpdate),
        ...voiceProfileMetadata(profile),
      },
      status
    );
  });

  router.patch('/voice-profiles/:id/threshold', async (c) => {
    const session = c.get('session') as any;
    const membership = await ensureWorkspaceAccess(c, session.workspace_id);
    if (!requireWorkspaceAdmin(membership)) {
      return c.json({ message: 'Tylko owner lub admin moze zmieniac threshold.' }, 403);
    }

    const body = await c.req.json().catch(() => ({}));
    const threshold = Number(body.threshold);
    if (!Number.isFinite(threshold) || threshold < 0.5 || threshold > 0.99) {
      return c.json({ message: 'threshold musi byc liczba w zakresie 0.50-0.99.' }, 400);
    }
    const updated = await workspaceService.updateVoiceProfileThreshold(
      c.req.param('id'),
      session.workspace_id,
      threshold
    );
    if (!updated) return c.json({ message: 'Profil nie znaleziony.' }, 404);
    return c.json({ id: updated.id, threshold: updated.threshold }, 200);
  });

  router.delete('/voice-profiles/:id', async (c) => {
    const session = c.get('session') as any;
    const membership = await ensureWorkspaceAccess(c, session.workspace_id);
    if (!requireWorkspaceAdmin(membership)) {
      return c.json({ message: 'Tylko owner lub admin moze usunac profil glosowy.' }, 403);
    }

    await workspaceService.deleteVoiceProfile(c.req.param('id'), session.workspace_id, {
      actorUserId: String(session?.user_id || ''),
      source: 'api',
    });
    return new Response(null, { status: 204 });
  });

  return router;
}
