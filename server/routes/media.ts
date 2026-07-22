import {
  existsSync,
  createReadStream,
  createWriteStream,
  statSync,
  mkdirSync,
  readdirSync,
  statfsSync,
} from 'node:fs';
import { unlink, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { finished } from 'node:stream/promises';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { AppServices, AppMiddlewares } from './middleware.ts';
import { normalizeTranscriptionStatusPayload } from '../../src/shared/contracts.ts';
import { workspaceMembershipCan } from '../../src/shared/workspacePermissions.ts';
import { normalizeSourceLinkedAnalysis } from '../../src/shared/sourceLinkedAnalysis.ts';
import type { MediaAsset } from '../lib/types.ts';
import {
  aiAnalyzeRequestSchema,
  chunkFinalizeRequestSchema,
  liveTranscriptionHeadersSchema,
  transcriptionRetryRequestSchema,
  transcriptionStartRequestSchema,
  voiceCoachingRequestSchema,
  voiceProfileFromSpeakerRequestSchema,
} from '../lib/apiRequestSchemas.ts';
import { getMemoryPressure } from '../lib/serverUtils.ts';
import { createProgressToken } from '../lib/progressTokens.ts';
import { validateJsonBody, validatePayload } from '../lib/requestValidation.ts';
import {
  buildProviderQuotaChecks,
  buildProviderQuotaExceededBody,
  createAiQuotaStore,
  type ProviderQuotaKind,
} from '../lib/aiQuotaStore.ts';
import { DISK_SPACE_BLOCK_UPLOAD_BYTES } from '../lib/diskSpace.ts';
import {
  MAX_RAW_UPLOAD_BYTES,
  createUploadPolicy,
  getManifestPartProgress,
  parseMediaManifest,
  shouldUseSegmentedStorage,
  validateAudioMimeType,
  validateRawUploadSize,
} from '../lib/mediaStoragePolicy.ts';
import {
  MediaStoragePipelineError,
  materializeAssetToLocal,
  normalizeAudioForStorage,
  splitNormalizedAudioIntoParts,
  validateAudioForTranscription,
} from '../lib/mediaStoragePipeline.ts';
import { addPipelineBreadcrumb, capturePipelineException } from '../sentry.ts';
import { withAudioSpan } from '../tracing.ts';
import { logger } from '../logger.ts';
import { MetricsService } from '../services/MetricsService.ts';
import { isProductionDeployment } from '../config.ts';
import {
  readRecordingConsentFromAsset,
  validateRecordingConsent,
  type ValidatedRecordingConsent,
} from '../lib/recordingConsent.ts';

const AUDIO_CONTENT_TYPE_EXTENSIONS: Record<string, string[]> = {
  'audio/webm': ['.webm'],
  'audio/mpeg': ['.mp3'],
  'audio/mp4': ['.mp4', '.m4a'],
  'audio/wav': ['.wav'],
  'audio/ogg': ['.ogg', '.oga'],
  'audio/flac': ['.flac'],
  'application/octet-stream': ['.webm'],
};

const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
const ACTIVE_TRANSCRIPTION_STATUSES = new Set(['processing', 'diarization']);

function getClientIp(c: any) {
  return (
    String(c.req.header('x-forwarded-for') || '')
      .split(',')[0]
      .trim() ||
    String(c.req.header('x-real-ip') || '').trim() ||
    'local'
  );
}

function normalizeAnalysisPayload(result: any, segments: any[] = []) {
  if (result && typeof result === 'object') {
    const resultWithEvidence = normalizeSourceLinkedAnalysis(result, segments);
    const mode = String(result.mode || '').trim();
    const fallbackReason = String(result.fallbackReason || '').trim();
    const analysisSource =
      result.analysisSource ||
      (fallbackReason || /fallback|no-key|disabled/i.test(mode) ? 'fallback' : 'provider');
    return {
      ...resultWithEvidence,
      analysisSource,
      ...(analysisSource === 'fallback'
        ? { fallbackReason: fallbackReason || (mode === 'no-key' ? 'no-key' : 'provider-error') }
        : {}),
    };
  }

  return {
    mode: 'no-key',
    analysisSource: 'fallback',
    fallbackReason: 'no-key',
    generatedBy: 'server',
  };
}

async function getWorkspaceFeatureFlags(workspaceService: any, workspaceId: string) {
  if (typeof workspaceService?.getWorkspaceState !== 'function') {
    return {};
  }
  const state = await workspaceService.getWorkspaceState(workspaceId);
  return state?.featureFlags || {};
}

function getIdempotencyKey(c: any): string | undefined {
  const key = String(c.req.header(IDEMPOTENCY_KEY_HEADER) || '').trim();
  return key ? key.slice(0, 160) : undefined;
}

function withIdempotencyMetadata<T extends object>(
  payload: T,
  c: any,
  idempotencyScope: string,
  idempotent = true
): T & { idempotent: boolean; idempotencyKey?: string; idempotencyScope: string } {
  return {
    ...payload,
    idempotent,
    idempotencyKey: getIdempotencyKey(c),
    idempotencyScope,
  };
}

function buildExistingMediaAssetResponse(asset: MediaAsset & { duration_ms?: number | null }) {
  return {
    id: asset.id,
    workspaceId: asset.workspace_id,
    sizeBytes: asset.size_bytes,
    storageMode: asset.storage_mode || 'single',
    partCount: asset.storage_mode === 'segmented' ? undefined : 0,
    sourceSizeBytes: asset.source_size_bytes || asset.size_bytes,
    normalizedSizeBytes: asset.normalized_size_bytes || asset.size_bytes,
    durationMs: asset.duration_ms || 0,
    audioValidation: null,
    audioQuality: null,
  };
}

function isActiveTranscriptionStatus(asset: MediaAsset, isRuntimeActive = false) {
  const status = String(asset.transcription_status || '')
    .trim()
    .toLowerCase();
  return ACTIVE_TRANSCRIPTION_STATUSES.has(status) || (status === 'queued' && isRuntimeActive);
}

function extractLeafPathSegment(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).pop() ?? filePath;
}

function sanitizeRecordingId(recordingId: string): string {
  return String(recordingId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function streamRequestBodyToFile({
  request,
  filePath,
  maxBytes,
}: {
  request: Request;
  filePath: string;
  maxBytes: number;
}) {
  if (!request.body) {
    const error = new Error('Brak danych audio w zadaniu uploadu.') as any;
    error.statusCode = 400;
    throw error;
  }

  let received = 0;
  const reader = request.body.getReader();
  const output = createWriteStream(filePath);
  let cleaned = false;

  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    output.destroy();
    try {
      await unlink(filePath);
    } catch (_) {}
  };

  const abortPromise = new Promise<never>((_, reject) => {
    request.signal.addEventListener(
      'abort',
      () => {
        reject(Object.assign(new Error('Upload audio zostal przerwany.'), { statusCode: 499 }));
      },
      { once: true }
    );
  });

  try {
    while (true) {
      const read = await Promise.race([reader.read(), abortPromise]);
      if (read.done) break;

      const chunk = Buffer.from(read.value);
      received += chunk.byteLength;
      if (received > maxBytes) {
        throw Object.assign(new Error('Przeslany plik przekracza maksymalny rozmiar.'), {
          statusCode: 413,
          code: 'audio_too_large',
        });
      }

      if (!output.write(chunk)) {
        await new Promise<void>((resolve, reject) => {
          output.once('drain', resolve);
          output.once('error', reject);
        });
      }
    }

    output.end();
    await finished(output);
    return { bytesWritten: received };
  } catch (error) {
    await cleanup();
    throw error;
  } finally {
    try {
      reader.releaseLock();
    } catch (_) {}
  }
}

function deriveAudioExtensions(filePath: string, contentType?: string): string[] {
  const candidates = new Set<string>();
  const fileName = extractLeafPathSegment(filePath || '');
  const explicitExt = path.extname(fileName);
  if (explicitExt) {
    candidates.add(explicitExt.toLowerCase());
  }

  const normalizedType = String(contentType || '').toLowerCase();
  for (const extension of AUDIO_CONTENT_TYPE_EXTENSIONS[normalizedType] || []) {
    candidates.add(extension);
  }

  if (candidates.size === 0) {
    candidates.add('.webm');
  }

  return [...candidates];
}

function parseTranscriptJsonSegments(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value || '[]'));
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.segments)) return parsed.segments;
    if (parsed && typeof parsed === 'object') {
      return Object.keys(parsed)
        .filter((key) => /^\d+$/.test(key))
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => parsed[key]);
    }
    return [];
  } catch (_) {
    return [];
  }
}

function isVoiceProfileTranscriptPending(asset: any, segments: any[]) {
  if (segments.length > 0) return false;
  const status = String(asset?.transcription_status || asset?.pipelineStatus || '')
    .trim()
    .toLowerCase();
  return ['uploading', 'queued', 'processing', 'diarization', 'review'].includes(status);
}

function normalizeSpeakerName(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function countVoiceProfileSegmentsForSpeaker(segments: any[], speakerId: string, speakerName = '') {
  const speakerKey = String(speakerId || '').trim();
  const speakerNameKey = normalizeSpeakerName(speakerName);
  return segments.filter((segment) => {
    if (!String(segment?.text || '').trim()) return false;
    if (String(segment?.speakerId ?? '').trim() === speakerKey) return true;
    return Boolean(speakerNameKey && normalizeSpeakerName(segment?.speakerName) === speakerNameKey);
  }).length;
}

function readSegmentTimestamp(
  segment: any,
  secondKeys: string[],
  millisecondKeys: string[] = []
): number {
  for (const key of secondKeys) {
    const value = Number(segment?.[key]);
    if (Number.isFinite(value)) return value;
  }
  for (const key of millisecondKeys) {
    const value = Number(segment?.[key]);
    if (Number.isFinite(value)) return value / 1000;
  }
  return NaN;
}

function inferSegmentEndTimestamp(
  segments: any[],
  index: number,
  start: number,
  text: string
): number {
  const explicitEnd = readSegmentTimestamp(
    segments[index],
    ['endTimestamp', 'end', 'endTime', 'endSeconds', 'stop'],
    ['endMs', 'end_ms']
  );
  if (Number.isFinite(explicitEnd) && explicitEnd > start) return explicitEnd;

  for (let nextIndex = index + 1; nextIndex < segments.length; nextIndex += 1) {
    const nextStart = readSegmentTimestamp(
      segments[nextIndex],
      ['timestamp', 'start', 'startTime', 'startTimestamp', 'startSeconds', 'time', 'offset'],
      ['startMs', 'start_ms']
    );
    if (Number.isFinite(nextStart) && nextStart > start) return nextStart;
  }

  const estimatedDuration = Math.min(15, Math.max(2, text.length / 14));
  return start + estimatedDuration;
}

function normalizeVoiceProfileTranscriptSegments(
  value: unknown,
  options: { requestedSpeakerId?: string; requestedSpeakerName?: string } = {}
): any[] {
  if (!Array.isArray(value)) return [];
  const requestedSpeakerId = String(options.requestedSpeakerId || '').trim();
  const requestedSpeakerName = normalizeSpeakerName(options.requestedSpeakerName);
  return value
    .map((segment, index, segments) => {
      if (!segment) return null;
      let speakerId = String(segment?.speakerId ?? '').trim();
      const text = String(segment?.text || '').trim();
      const speakerName = String(segment?.speakerName || '').trim();
      if (
        requestedSpeakerId &&
        requestedSpeakerName &&
        normalizeSpeakerName(speakerName) === requestedSpeakerName
      ) {
        speakerId = requestedSpeakerId;
      }
      const timestamp = readSegmentTimestamp(
        segment,
        ['timestamp', 'start', 'startTime', 'startTimestamp', 'startSeconds', 'time', 'offset'],
        ['startMs', 'start_ms']
      );
      const endTimestamp = inferSegmentEndTimestamp(segments, index, timestamp, text);
      if (!speakerId || !text) return null;
      if (!Number.isFinite(timestamp) || !Number.isFinite(endTimestamp)) return null;
      if (endTimestamp <= timestamp || timestamp < 0) return null;
      const normalizedSegment: any = {
        id: String(segment?.id || '').trim() || undefined,
        speakerId,
        text,
        timestamp,
        endTimestamp,
      };
      if (speakerName) normalizedSegment.speakerName = speakerName;
      if (!normalizedSegment.id) delete normalizedSegment.id;
      return normalizedSegment;
    })
    .filter(Boolean)
    .slice(0, 50);
}

function buildVoiceProfileErrorBody(input: {
  code: string;
  message: string;
  stage: string;
  recordingId: string;
  speakerId?: string;
  speakerName?: string;
  segmentCount?: number;
  matchedSegmentCount?: number;
  requestId?: string;
  retryable?: boolean;
  userAction?: string;
}) {
  const defaults = getVoiceProfileErrorDefaults(input.code);
  return {
    code: input.code,
    message: input.message,
    stage: input.stage,
    retryable: input.retryable ?? defaults.retryable,
    userAction: input.userAction || defaults.userAction,
    recordingId: input.recordingId,
    speakerId: input.speakerId || undefined,
    speakerName: input.speakerName || undefined,
    segmentCount: input.segmentCount ?? 0,
    matchedSegmentCount: input.matchedSegmentCount ?? 0,
    requestId: input.requestId || 'unknown',
  };
}

function getVoiceProfileErrorDefaults(code: string) {
  const defaults: Record<string, { retryable: boolean; userAction: string }> = {
    missing_speaker_id: { retryable: false, userAction: 'select_speaker' },
    missing_speaker_name: { retryable: false, userAction: 'select_speaker' },
    recording_not_found: { retryable: false, userAction: 'refresh_recording' },
    transcription_not_ready: { retryable: true, userAction: 'wait_for_transcription' },
    speaker_segment_not_found: { retryable: false, userAction: 'select_speaker_segment' },
    audio_source_unavailable: { retryable: false, userAction: 'reimport_audio' },
    embedding_failed: { retryable: true, userAction: 'retry_later' },
    profile_save_failed: { retryable: true, userAction: 'retry' },
  };
  return defaults[code] || { retryable: false, userAction: 'contact_support' };
}

type VoiceProfileEnrollmentErrorDetails = {
  code: string;
  stage: string;
  status: number;
  message: string;
  retryable?: boolean;
  userAction?: string;
};

function classifyVoiceProfileEnrollmentError(error: any): VoiceProfileEnrollmentErrorDetails {
  const message = String(error?.message || '');
  const lower = message.toLowerCase();
  if (error?.code && error?.stage) {
    return {
      code: String(error.code),
      stage: String(error.stage),
      status: Number(error.statusCode || error.status || 500) || 500,
      message,
      retryable: typeof error.retryable === 'boolean' ? error.retryable : undefined,
      userAction: typeof error.userAction === 'string' ? error.userAction : undefined,
    };
  }
  if (
    lower.includes('transkrypc') ||
    lower.includes('segment') ||
    lower.includes('znacznik') ||
    lower.includes('valid segments')
  ) {
    return {
      code: 'speaker_segment_not_found',
      stage: 'transcript',
      status: 422,
      message: 'Nie znaleziono przypisanego fragmentu wypowiedzi dla tej osoby.',
    };
  }
  if (
    lower.includes('pobrac') ||
    lower.includes('audio') ||
    lower.includes('plik') ||
    lower.includes('sciezk') ||
    lower.includes('storage')
  ) {
    return {
      code: 'audio_source_unavailable',
      stage: 'audio_source',
      status: 424,
      message: 'Audio nie jest dostepne na serwerze. Zaimportuj nagranie ponownie.',
    };
  }
  if (lower.includes('embedding')) {
    return {
      code: 'embedding_failed',
      stage: 'embedding',
      status: 503,
      message: 'Nie udalo sie utworzyc profilu glosu. Sprobuj ponownie za chwile.',
    };
  }
  return {
    code: 'profile_save_failed',
    stage: 'profile_save',
    status: 500,
    message: 'Nie udalo sie zapisac profilu glosu.',
  };
}

function hasVoiceProfileEmbedding(profile: any) {
  if (Array.isArray(profile?.embedding)) return profile.embedding.length > 0;
  const raw = profile?.embedding_json ?? profile?.embeddingJson;
  if (Array.isArray(raw)) return raw.length > 0;
  if (typeof raw !== 'string') return false;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch (_) {
    return false;
  }
}

const VOICE_PROFILE_EMBEDDING_VERSION = '1';

function voiceProfileMetadata(profile: any) {
  const fallbackCreatedAt = profile?.created_at ?? profile?.createdAt;
  const fallbackUserId = profile?.user_id ?? profile?.userId ?? '';
  return {
    source: profile?.profile_source ?? profile?.source ?? 'unknown',
    model: profile?.embedding_model ?? profile?.model ?? 'unknown',
    version: profile?.embedding_version ?? profile?.version ?? VOICE_PROFILE_EMBEDDING_VERSION,
    createdBy: profile?.created_by ?? profile?.createdBy ?? fallbackUserId,
    updatedAt: profile?.updated_at ?? profile?.updatedAt ?? fallbackCreatedAt,
  };
}

function buildVoiceProfileResponse(profile: any) {
  const sampleCount = Number.isFinite(Number(profile?.sample_count ?? profile?.sampleCount))
    ? Number(profile?.sample_count ?? profile?.sampleCount)
    : 1;

  return {
    id: profile?.id,
    speakerName: profile?.speaker_name ?? profile?.speakerName,
    hasEmbedding: hasVoiceProfileEmbedding(profile),
    createdAt: profile?.created_at ?? profile?.createdAt,
    sampleCount,
    threshold: typeof profile?.threshold === 'number' ? profile.threshold : 0.82,
    isUpdate: Boolean(profile?.isUpdate),
    ...voiceProfileMetadata(profile),
  };
}

export function buildRemoteAudioStorageCandidates(
  recordingId: string,
  asset: Pick<MediaAsset, 'file_path' | 'content_type'>
): string[] {
  const rawPath = String(asset.file_path || '').trim();
  if (!rawPath) return [];

  const candidates = new Set<string>();
  const leafName = extractLeafPathSegment(rawPath);
  const looksAbsoluteLocalPath = path.isAbsolute(rawPath) || /^[a-zA-Z]:[\\/]/.test(rawPath);

  if (rawPath && !rawPath.includes('\\') && !looksAbsoluteLocalPath) {
    candidates.add(rawPath);
  }

  if (leafName) {
    candidates.add(leafName);
  }

  const safeRecordingId = sanitizeRecordingId(recordingId);
  for (const extension of deriveAudioExtensions(rawPath, asset.content_type)) {
    candidates.add(`${safeRecordingId}${extension}`);
  }

  return [...candidates];
}

async function downloadAudioFromStorageCandidates(
  recordingId: string,
  asset: Pick<MediaAsset, 'file_path' | 'content_type'>
): Promise<{ arrayBuffer: ArrayBuffer; storagePath: string }> {
  const { downloadAudioFromStorage } = await import('../lib/supabaseStorage.js');
  let lastError: Error | null = null;

  for (const storagePath of buildRemoteAudioStorageCandidates(recordingId, asset)) {
    try {
      const arrayBuffer = await downloadAudioFromStorage(storagePath);
      return { arrayBuffer, storagePath };
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error('Audio asset not found in remote storage.');
}

async function findRemoteAudioStoragePath(
  recordingId: string,
  asset: Pick<MediaAsset, 'file_path' | 'content_type'>
): Promise<string> {
  const { audioExistsInStorage } = await import('../lib/supabaseStorage.js');
  let lastError: Error | null = null;

  for (const storagePath of buildRemoteAudioStorageCandidates(recordingId, asset)) {
    try {
      if (await audioExistsInStorage(storagePath)) {
        return storagePath;
      }
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error('Audio asset not found in remote storage.');
}

async function resolveVoiceProfileAudioSource(
  recordingId: string,
  asset: Pick<MediaAsset, 'file_path' | 'content_type'>
): Promise<{ ready: true; source: 'local' | 'remote'; storagePath?: string } | { ready: false }> {
  const rawPath = String(asset.file_path || '').trim();
  if (!rawPath) return { ready: false };

  const isLocalishPath = rawPath.includes('/') || rawPath.includes('\\');
  if (isLocalishPath && existsSync(rawPath)) {
    return { ready: true, source: 'local' };
  }

  try {
    const storagePath = await findRemoteAudioStoragePath(recordingId, asset);
    return { ready: true, source: 'remote', storagePath };
  } catch (_) {
    return { ready: false };
  }
}

/**
 * Checks available disk space and returns true if there's enough space.
 * Returns false if disk space is critically low for accepting new uploads.
 */
function checkDiskSpace(
  uploadDir: string,
  minBytes: number = DISK_SPACE_BLOCK_UPLOAD_BYTES
): { ok: boolean; freeBytes?: number } {
  try {
    const stats = typeof statfsSync === 'function' ? statfsSync(uploadDir) : null;

    if (stats) {
      const freeBytes = stats.bavail * stats.bsize;
      return { ok: freeBytes >= minBytes, freeBytes };
    }

    // Fallback: assume OK if we can't check
    return { ok: true };
  } catch (error) {
    console.warn('[checkDiskSpace] Unable to check disk space:', error);
    return { ok: true };
  }
}

/**
 * Cleans up old chunk files older than maxAgeHours.
 * Returns number of files deleted and bytes freed.
 */
async function cleanupOldChunks(
  uploadDir: string,
  maxAgeHours: number = 24
): Promise<{ deleted: number; bytesFreed: number }> {
  const chunksDir = path.join(uploadDir, 'chunks');

  if (!existsSync(chunksDir)) {
    return { deleted: 0, bytesFreed: 0 };
  }

  const now = Date.now();
  const maxAge = maxAgeHours * 60 * 60 * 1000;
  let deleted = 0;
  let bytesFreed = 0;

  try {
    const files = readdirSync(chunksDir);
    for (const file of files) {
      if (!file.endsWith('.chunk')) continue;

      const filePath = path.join(chunksDir, file);
      const stats = statSync(filePath);
      const age = now - stats.mtimeMs;

      if (age > maxAge) {
        bytesFreed += stats.size;
        await unlink(filePath);
        deleted++;
      }
    }

    if (deleted > 0) {
      const { logger } = await import('../logger.ts');
      logger.info(`[Cleanup] Deleted ${deleted} old chunk files, freed ${bytesFreed} bytes`);
    }
  } catch (error) {
    console.warn('[cleanupOldChunks] Error:', error);
  }

  return { deleted, bytesFreed };
}

export function createMediaRoutes(services: AppServices, middlewares: AppMiddlewares) {
  const router = new Hono<{ Variables: { session: any; user: any; reqId: string } }>();
  const { transcriptionService, workspaceService, config } = services;
  const { authMiddleware, applyRateLimit, ensureWorkspaceAccess } = middlewares;
  const quotaStore = createAiQuotaStore({ db: services.db });
  const startTranscriptionPipeline =
    typeof transcriptionService.startTranscriptionPipeline === 'function'
      ? transcriptionService.startTranscriptionPipeline.bind(transcriptionService)
      : async (recordingId: string, asset: any, options: any) => {
          await transcriptionService.queueTranscription(recordingId, options);
          await transcriptionService.ensureTranscriptionJob(recordingId, asset, options);
          return transcriptionService.getMediaAsset(recordingId);
        };
  const uploadDir = config.uploadDir || process.env.VOICELOG_UPLOAD_DIR || './server/data/uploads';

  async function enforceProviderQuota(
    c: any,
    input: {
      kind: ProviderQuotaKind;
      endpoint: string;
      workspaceId?: string;
    }
  ) {
    const session = c.get('session') as any;
    const userId = String(session?.user_id || session?.userId || '').trim();
    if (!userId) {
      return c.json({ message: 'Brak uzytkownika w sesji.' }, 401);
    }

    const exceeded = await quotaStore.increment(
      buildProviderQuotaChecks({
        kind: input.kind,
        endpoint: input.endpoint,
        userId,
        workspaceId: input.workspaceId,
        ip: getClientIp(c),
      })
    );
    if (!exceeded) return null;

    c.header('Retry-After', String(exceeded.retryAfter));
    logger.warn('[provider quota] quota exceeded', {
      requestId: c.get('reqId') || 'unknown',
      userId,
      workspaceId: input.workspaceId || undefined,
      providerFamily: input.kind,
      endpoint: input.endpoint,
      quotaKey: exceeded.key,
      limit: exceeded.limit,
      retryAfter: exceeded.retryAfter,
    });
    return c.json(
      buildProviderQuotaExceededBody({
        kind: input.kind,
        endpoint: input.endpoint,
        exceeded,
      }),
      429
    );
  }

  async function assertWorkspacePermission(c: any, workspaceId: string, permission: string) {
    const membership = await ensureWorkspaceAccess(c, workspaceId);
    return workspaceMembershipCan(membership, permission);
  }

  async function writeAuditEvent(
    c: any,
    {
      workspaceId,
      action,
      entityType,
      entityId,
      metadata = {},
    }: {
      workspaceId: string;
      action: string;
      entityType: string;
      entityId: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    const auditTarget =
      typeof transcriptionService.writeAuditLog === 'function' ? transcriptionService : services.db;
    if (typeof auditTarget?.writeAuditLog !== 'function') {
      return;
    }

    const session = c.get('session') as any;
    try {
      await auditTarget.writeAuditLog({
        workspaceId,
        actorUserId: String(session?.user_id || ''),
        action,
        entityType,
        entityId,
        metadata: {
          ...metadata,
          requestId: String(c.get('reqId') || ''),
        },
      });
    } catch (error: any) {
      const { logger } = await import('../logger.ts');
      logger.warn('[audit] Failed to persist audit event', {
        workspaceId,
        action,
        entityType,
        entityId,
        error: error?.message || String(error),
      });
    }
  }

  async function writeRecordingAuditEvent(
    c: any,
    asset: any,
    action: string,
    metadata: Record<string, unknown> = {}
  ) {
    await writeAuditEvent(c, {
      workspaceId: String(asset?.workspace_id || ''),
      action,
      entityType: 'recording',
      entityId: String(asset?.id || ''),
      metadata: {
        meetingId: String(asset?.meeting_id || ''),
        source: 'api',
        ...metadata,
      },
    });
  }

  function getSessionActorUserId(c: any): string {
    const session = c.get('session') as any;
    return String(session?.user_id || session?.userId || '').trim();
  }

  function recordingConsentInvalidResponse(c: any, recordingId: string) {
    return c.json(
      {
        code: 'recording_consent_invalid',
        message: 'Brak aktualnej zgody na przetwarzanie nagrania.',
        recordingId,
      },
      422
    );
  }

  function validateProductionRecordingConsent(
    c: any,
    recordingId: string,
    workspaceId: string,
    input: unknown,
    preserveRecordedActor = false
  ): ValidatedRecordingConsent | null | Response {
    if (!isProductionDeployment()) return null;
    const validation = validateRecordingConsent(input, {
      workspaceId,
      actorUserId: getSessionActorUserId(c),
      preserveRecordedActor,
    });
    return validation.valid ? validation.consent : recordingConsentInvalidResponse(c, recordingId);
  }

  async function recordConsentAuditEvent(c: any, asset: any, consent: ValidatedRecordingConsent) {
    await writeRecordingAuditEvent(c, asset, 'recording.transcription.consent_recorded', {
      policyVersion: consent.policyVersion,
      acceptedAt: consent.acceptedAt,
      providerCategories: consent.providers
        .filter((provider) => provider.enabled)
        .map((provider) => provider.id),
    });
  }

  function resolveProcessingMode(input: any) {
    return input === 'full' || input === 'fast'
      ? input
      : config.VOICELOG_PROCESSING_MODE_DEFAULT || 'fast';
  }

  function hasTranscriptSegments(asset: any) {
    try {
      const segments = JSON.parse(String(asset?.transcript_json || '[]'));
      return Array.isArray(segments) && segments.length > 0;
    } catch {
      return false;
    }
  }

  function getTranscriptionRuntimeStatus(recordingId: string) {
    const fallback = {
      activeJob: false,
      queuedPosition: null,
      processingAgeMs: null,
      retryAfterMs: null,
    };
    if (typeof transcriptionService.getTranscriptionRuntimeStatus !== 'function') {
      return fallback;
    }

    const status = transcriptionService.getTranscriptionRuntimeStatus(recordingId) || {};
    return {
      activeJob: Boolean(status.activeJob),
      queuedPosition: typeof status.queuedPosition === 'number' ? status.queuedPosition : null,
      processingAgeMs: typeof status.processingAgeMs === 'number' ? status.processingAgeMs : null,
      retryAfterMs: typeof status.retryAfterMs === 'number' ? status.retryAfterMs : null,
    };
  }

  function scheduleAudioQuality(recordingId: string, asset: MediaAsset) {
    if (asset.storage_mode === 'segmented') {
      return;
    }
    Promise.resolve()
      .then(async () => {
        const audioQuality = await transcriptionService.analyzeAudioQuality(asset.file_path, {
          contentType: asset.content_type,
        });
        await transcriptionService.saveAudioQualityDiagnostics(recordingId, audioQuality);
      })
      .catch((error: any) => {
        console.warn(
          `[mediaRoutes] Audio quality analysis failed for ${recordingId}:`,
          error?.message || error
        );
      });
  }

  function audioValidationErrorBody(error: any) {
    return {
      code: error?.code || 'audio_invalid_or_empty',
      message:
        error?.message ||
        'Plik audio jest pusty, uszkodzony albo nie zawiera dekodowalnej sciezki audio.',
      audioValidation: error?.audioValidation || null,
    };
  }

  function audioValidationErrorStatus(error: any) {
    return (Number(error?.status || error?.statusCode || 422) || 422) as any;
  }

  async function assembleChunksToTempFile(chunksDir: string, safeId: string, total: number) {
    const chunkPaths: string[] = [];
    for (let i = 0; i < total; i += 1) {
      const chunkPath = path.join(chunksDir, `${safeId}_${i}.chunk`);
      if (!existsSync(chunkPath)) {
        throw new Error(`Brakuje chunka ${i} z ${total}.`);
      }
      chunkPaths.push(chunkPath);
    }

    const tempPath = path.join(chunksDir, `${safeId}_assembled_${crypto.randomUUID()}.bin`);
    mkdirSync(path.dirname(tempPath), { recursive: true });
    const output = createWriteStream(tempPath);

    try {
      for (const chunkPath of chunkPaths) {
        await new Promise<void>((resolve, reject) => {
          const input = createReadStream(chunkPath);
          input.on('error', reject);
          output.on('error', reject);
          input.on('end', resolve);
          input.pipe(output, { end: false });
        });
      }

      output.end();
      await finished(output);
      return tempPath;
    } catch (error) {
      output.destroy();
      try {
        await unlink(tempPath);
      } catch (_) {}
      throw error;
    }
  }

  async function cleanupChunkFiles(chunksDir: string, safeId: string, total: number) {
    for (let i = 0; i < total; i++) {
      try {
        await unlink(path.join(chunksDir, `${safeId}_${i}.chunk`));
      } catch (_) {}
    }
  }

  router.get('/upload-policy', (c) => c.json(createUploadPolicy(), 200));

  router.get('/quota/usage', authMiddleware, async (c) => {
    const session = c.get('session') as any;
    const workspaceId = String(
      c.req.query('workspaceId') ||
        c.req.header('X-Workspace-Id') ||
        session?.workspace_id ||
        session?.workspaceId ||
        ''
    ).trim();
    if (!workspaceId) {
      return c.json({ message: 'Brakuje workspaceId.' }, 400);
    }

    const allowed = await assertWorkspacePermission(c, workspaceId, 'quota:read');
    if (!allowed) {
      return c.json({ message: 'Tylko owner, admin lub operator moze przegladac limity.' }, 403);
    }

    const entries = quotaStore.snapshot
      ? await quotaStore.snapshot({ contains: `:workspace:${workspaceId}:` })
      : [];
    return c.json(
      {
        workspaceId,
        counters: entries.map((entry) => ({
          key: entry.key,
          count: entry.count,
          resetAt: new Date(entry.resetAt).toISOString(),
          updatedAt: entry.updatedAt,
        })),
      },
      200
    );
  });

  // --- Media & Processing ---
  router.use('/recordings', authMiddleware);
  router.use('/recordings/*', authMiddleware);
  router.put('/recordings/:recordingId/audio', async (c) => {
    const uploadStart = performance.now();
    const reqId = c.get('reqId');
    const session = c.get('session') as any;
    const recordingId = c.req.param('recordingId');
    const workspaceId = c.req.header('X-Workspace-Id') || '';
    const meetingId = c.req.header('X-Meeting-Id') || '';
    if (!workspaceId) return c.json({ message: 'Brakuje X-Workspace-Id.' }, 400);
    const membership = await ensureWorkspaceAccess(c, workspaceId);
    if (!workspaceMembershipCan(membership, 'recordings:upload')) {
      return c.json({ message: 'Nie masz uprawnien do wgrywania nagran.' }, 403);
    }

    const existingAsset =
      typeof transcriptionService.getMediaAsset === 'function'
        ? await transcriptionService.getMediaAsset(recordingId)
        : null;
    if (existingAsset?.workspace_id === workspaceId) {
      return c.json(
        withIdempotencyMetadata(buildExistingMediaAssetResponse(existingAsset), c, 'recordingId'),
        200
      );
    }

    // Early rejection based on Content-Length to avoid buffering oversized uploads
    const contentLength = parseInt(c.req.header('content-length') || '0', 10);
    if (contentLength > MAX_RAW_UPLOAD_BYTES) {
      const sizeValidation = validateRawUploadSize(contentLength);
      capturePipelineException(
        Object.assign(
          new Error(
            sizeValidation.ok === false ? sizeValidation.message : 'Audio upload too large.'
          ),
          {
            code: sizeValidation.ok === false ? sizeValidation.code : 'audio_too_large',
            statusCode: 413,
          }
        ),
        {
          requestId: reqId,
          workspaceId,
          recordingId,
          pipelineStage: 'upload_validation',
          operation: 'media.upload',
          errorCode: sizeValidation.ok === false ? sizeValidation.code : 'audio_too_large',
          contentLength,
        },
        { level: 'warning', fingerprint: ['audio-upload-validation', 'size'] }
      );
      if (sizeValidation.ok !== false) {
        return c.json({ code: 'audio_too_large', message: 'Plik audio przekracza limit.' }, 413);
      }
      return c.json(
        {
          code: sizeValidation.code,
          message: sizeValidation.message,
        },
        413
      );
    }

    const mimeValidation = validateAudioMimeType(c.req.header('content-type') || '');
    if (!mimeValidation.ok) {
      capturePipelineException(
        Object.assign(new Error(mimeValidation.message), {
          code: mimeValidation.code,
          statusCode: mimeValidation.status,
        }),
        {
          requestId: reqId,
          workspaceId,
          recordingId,
          pipelineStage: 'upload_validation',
          operation: 'media.upload',
          errorCode: mimeValidation.code,
          contentType: c.req.header('content-type') || '',
        },
        { level: 'warning', fingerprint: ['audio-upload-validation', mimeValidation.code] }
      );
      return c.json(
        { code: mimeValidation.code, message: mimeValidation.message },
        mimeValidation.status
      );
    }

    let asset: MediaAsset;
    let audioValidation: Awaited<ReturnType<typeof validateAudioForTranscription>> | null = null;
    const preflightDir = path.join(config.uploadDir, 'preflight');
    const preflightPath = path.join(
      preflightDir,
      `${sanitizeRecordingId(recordingId)}_${crypto.randomUUID()}.upload`
    );
    try {
      mkdirSync(preflightDir, { recursive: true });
      const streamed = await withAudioSpan(
        'audio.upload.receive',
        {
          requestId: reqId,
          workspaceId,
          recordingId,
          pipelineStage: 'upload_receive',
          operation: 'media.upload',
          contentType: mimeValidation.normalized.contentType,
          contentLength,
        },
        () =>
          streamRequestBodyToFile({
            request: c.req.raw,
            filePath: preflightPath,
            maxBytes: MAX_RAW_UPLOAD_BYTES,
          })
      );
      const sizeValidation = validateRawUploadSize(streamed.bytesWritten);
      if (sizeValidation.ok === false) {
        return c.json(
          { code: sizeValidation.code, message: sizeValidation.message },
          sizeValidation.status
        );
      }
      audioValidation = await withAudioSpan(
        'audio.upload.validate',
        {
          requestId: reqId,
          workspaceId,
          recordingId,
          pipelineStage: 'upload_validation',
          operation: 'media.upload',
          contentType: mimeValidation.normalized.contentType,
          sizeBytes: streamed.bytesWritten,
        },
        () =>
          validateAudioForTranscription({
            filePath: preflightPath,
            contentType: mimeValidation.normalized.contentType,
            signal: c.req.raw.signal,
          })
      );
      if (typeof transcriptionService.upsertMediaAssetFromPath !== 'function') {
        throw Object.assign(new Error('Streaming upload storage adapter is unavailable.'), {
          statusCode: 500,
        });
      }
      asset = await withAudioSpan(
        'audio.upload.store',
        {
          requestId: reqId,
          workspaceId,
          recordingId,
          meetingId,
          pipelineStage: 'upload_store',
          operation: 'media.upload',
          contentType: mimeValidation.normalized.contentType,
          sizeBytes: streamed.bytesWritten,
        },
        () =>
          transcriptionService.upsertMediaAssetFromPath({
            recordingId,
            workspaceId,
            meetingId,
            contentType: mimeValidation.normalized.contentType,
            filePath: preflightPath,
            createdByUserId: session.user_id,
          })
      );
    } catch (uploadErr: any) {
      if (uploadErr instanceof MediaStoragePipelineError) {
        capturePipelineException(
          uploadErr,
          {
            requestId: reqId,
            workspaceId,
            recordingId,
            pipelineStage: 'upload_validation',
            operation: 'media.upload',
            errorCode: uploadErr.code || 'audio_validation_failed',
            retryable: false,
          },
          { level: 'warning', fingerprint: ['audio-upload-validation', uploadErr.code] }
        );
        return c.json(audioValidationErrorBody(uploadErr), audioValidationErrorStatus(uploadErr));
      }
      if (
        (uploadErr as any).code === 'ENOSPC' ||
        String(uploadErr.message).includes('Brak miejsca na dysku')
      ) {
        capturePipelineException(
          uploadErr,
          {
            requestId: reqId,
            workspaceId,
            recordingId,
            pipelineStage: 'upload_storage',
            operation: 'media.upload',
            errorCode: 'ENOSPC',
          },
          { level: 'error', fingerprint: ['audio-upload-storage', 'ENOSPC'] }
        );
        return c.json(
          { message: 'Brak miejsca na dysku serwera. Skontaktuj sie z administratorem.' },
          507
        );
      }
      throw uploadErr;
    } finally {
      try {
        await unlink(preflightPath);
      } catch (_) {}
    }
    scheduleAudioQuality(recordingId, asset);

    // R04 Metrics
    const { logger } = await import('../logger.ts');
    logger.info(`[Metrics] Uploaded audio chunk`, {
      requestId: reqId,
      recordingId,
      workspaceId,
      sizeBytes: asset.size_bytes,
      durationMs: (performance.now() - uploadStart).toFixed(2),
    });
    addPipelineBreadcrumb('Audio upload completed.', {
      requestId: reqId,
      workspaceId,
      recordingId,
      pipelineStage: 'upload',
      operation: 'media.upload',
      sizeBytes: asset.size_bytes,
      durationMs: (performance.now() - uploadStart).toFixed(2),
    });

    return c.json(
      withIdempotencyMetadata(
        {
          id: asset.id,
          workspaceId: asset.workspace_id,
          sizeBytes: asset.size_bytes,
          audioValidation,
          audioQuality: null,
        },
        c,
        'recordingId',
        false
      ),
      200
    );
  });

  router.get('/recordings/:recordingId/audio/manifest', async (c) => {
    const recordingId = c.req.param('recordingId');
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
    const membership = await ensureWorkspaceAccess(c, asset.workspace_id);
    if (!workspaceMembershipCan(membership, 'recordings:download')) {
      return c.json({ message: 'Nie masz uprawnien do pobierania nagran.' }, 403);
    }

    const manifest =
      asset.storage_mode === 'segmented' && asset.media_manifest_json
        ? JSON.parse(asset.media_manifest_json)
        : {
            version: 1,
            storageMode: 'single',
            recordingId: asset.id,
            workspaceId: asset.workspace_id,
            sourceSizeBytes: asset.source_size_bytes || asset.size_bytes,
            normalizedSizeBytes: asset.normalized_size_bytes || asset.size_bytes,
            durationMs: 0,
            contentType: asset.content_type,
            parts: [
              {
                index: 0,
                path: asset.file_path,
                startMs: 0,
                endMs: 0,
                sizeBytes: asset.size_bytes,
                contentType: asset.content_type,
              },
            ],
          };

    return c.json(manifest, 200);
  });

  router.get('/recordings/:recordingId/audio', async (c) => {
    try {
      const recordingId = c.req.param('recordingId');
      const asset = await transcriptionService.getMediaAsset(recordingId);
      if (!asset) {
        console.warn('[media] Audio 404 - no media_assets row', { recordingId });
        return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
      }
      const membership = await ensureWorkspaceAccess(c, asset.workspace_id);
      if (!workspaceMembershipCan(membership, 'recordings:download')) {
        return c.json({ message: 'Nie masz uprawnien do pobierania nagran.' }, 403);
      }

      const ALLOWED = new Set([
        'audio/webm',
        'audio/mpeg',
        'audio/mp4',
        'audio/wav',
        'audio/ogg',
        'audio/flac',
        'application/octet-stream',
      ]);
      const safeType = ALLOWED.has(String(asset.content_type || '').toLowerCase())
        ? asset.content_type
        : 'application/octet-stream';

      if (asset.storage_mode === 'segmented') {
        try {
          const materialized = await materializeAssetToLocal(asset, {
            workDir: path.join(uploadDir, '.materialized'),
            signal: c.req.raw.signal,
            purpose: 'download',
          });
          const stream = createReadStream(materialized.localPath);
          const cleanup = () => {
            Promise.resolve(materialized.cleanup()).catch(() => {});
          };
          stream.on('close', cleanup);
          stream.on('error', cleanup);
          const contentLength = statSync(materialized.localPath).size;
          c.header(
            'Content-Type',
            safeType === 'application/octet-stream' ? 'audio/webm' : safeType
          );
          c.header('Content-Length', String(contentLength));
          c.header('Content-Disposition', 'attachment');
          await writeRecordingAuditEvent(
            c,
            { ...asset, id: recordingId },
            'recording.audio.downloaded',
            {
              contentType: safeType,
              storageMode: String(asset.storage_mode || 'segmented'),
              sizeBytes: contentLength,
              delivery: 'segmented',
            }
          );
          return c.body(stream as any, 200);
        } catch (err: any) {
          console.error('[media] Segmented audio materialization failed', {
            recordingId,
            error: err.message,
          });
          return c.json({ message: 'Nie udalo sie przygotowac nagrania do odtworzenia.' }, 500);
        }
      }

      // Supabase remote path - no OS path separator means it's a short Supabase key
      if (asset.file_path && !asset.file_path.includes('/') && !asset.file_path.includes('\\')) {
        try {
          const { arrayBuffer, storagePath } = await downloadAudioFromStorageCandidates(
            recordingId,
            asset
          );

          c.header('Content-Type', safeType);
          c.header('Content-Length', String(arrayBuffer.byteLength));
          c.header('Content-Disposition', 'attachment');
          if (storagePath !== asset.file_path) {
            console.info('[media] Served audio from reconstructed Supabase key', {
              recordingId,
              requestedPath: asset.file_path,
              resolvedPath: storagePath,
            });
          }
          await writeRecordingAuditEvent(
            c,
            { ...asset, id: recordingId },
            'recording.audio.downloaded',
            {
              contentType: safeType,
              storageMode: String(asset.storage_mode || 'single'),
              sizeBytes: arrayBuffer.byteLength,
              delivery: storagePath === asset.file_path ? 'remote' : 'remote-fallback',
            }
          );
          return c.body(arrayBuffer as any, 200);
        } catch (err: any) {
          console.error('[media] Supabase download failed', {
            recordingId,
            filePath: asset.file_path,
            error: err.message,
          });
          return c.json(
            {
              message: 'Błąd podczas pobierania nagrania z remote storage.',
              error: err.message,
            },
            500
          );
        }
      } else {
        // Local file path - try local first, then fall back to Supabase with basename
        if (existsSync(asset.file_path)) {
          const stream = createReadStream(asset.file_path);
          const contentLength = statSync(asset.file_path).size;
          c.header('Content-Type', safeType);
          c.header('Content-Length', String(contentLength));
          c.header('Content-Disposition', 'attachment');
          await writeRecordingAuditEvent(
            c,
            { ...asset, id: recordingId },
            'recording.audio.downloaded',
            {
              contentType: safeType,
              storageMode: String(asset.storage_mode || 'single'),
              sizeBytes: contentLength,
              delivery: 'local',
            }
          );
          return c.body(stream as any, 200);
        }

        // Local file missing (e.g. after redeploy) - try Supabase with just the filename
        try {
          const { arrayBuffer, storagePath } = await downloadAudioFromStorageCandidates(
            recordingId,
            asset
          );
          console.info('[media] Local file missing, served from Supabase fallback', {
            recordingId,
            localPath: asset.file_path,
            supabasePath: storagePath,
          });

          c.header('Content-Type', safeType);
          c.header('Content-Length', String(arrayBuffer.byteLength));
          c.header('Content-Disposition', 'attachment');
          await writeRecordingAuditEvent(
            c,
            { ...asset, id: recordingId },
            'recording.audio.downloaded',
            {
              contentType: safeType,
              storageMode: String(asset.storage_mode || 'single'),
              sizeBytes: arrayBuffer.byteLength,
              delivery: 'remote-fallback',
            }
          );
          return c.body(arrayBuffer as any, 200);
        } catch {
          console.warn('[media] Audio 404 - local file missing, Supabase fallback failed', {
            recordingId,
            filePath: asset.file_path,
          });
          return c.json({ message: 'Plik audio nie istnieje.' }, 404);
        }
      }
    } catch (err: any) {
      console.error(`[audio] Error:`, err?.message);
      const status = err?.statusCode || err?.status || 500;
      return c.json({ message: err?.message || 'Blad pobierania audio.' }, status);
    }
  });

  router.get('/recordings', async (c) => {
    const workspaceId = c.req.query('workspaceId');
    if (!workspaceId) return c.json({ message: 'Brakuje workspaceId.' }, 400);
    await ensureWorkspaceAccess(c, workspaceId);
    const recordings = await transcriptionService.getMediaRecordings(workspaceId);
    return c.json({ recordings: recordings || [] }, 200);
  });

  router.delete('/recordings/:recordingId', async (c) => {
    const recordingId = c.req.param('recordingId');
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) {
      // DELETE is intentionally idempotent. The frontend may hold stale IndexedDB
      // queue entries for assets already removed from Supabase, and surfacing 404
      // here creates a false production error while no server cleanup is needed.
      return c.body(null, 204);
    }

    // Ensure the user has rights to delete from this workspace
    const membership = await ensureWorkspaceAccess(c, asset.workspace_id);
    if (!workspaceMembershipCan(membership, 'recordings:delete')) {
      return c.json({ message: 'Nie masz uprawnien do usuwania nagran.' }, 403);
    }

    try {
      // Note: transcriptionService is Database instance here
      const session = c.get('session');
      await transcriptionService.deleteMediaAsset(recordingId, asset.workspace_id, {
        actorUserId: String(session?.user_id || ''),
        requestId: String(c.get('reqId') || ''),
      });
      return c.body(null, 204);
    } catch (err: any) {
      return c.json({ message: 'Błąd podczas usuwania nagrania.', error: err.message }, 500);
    }
  });

  router.post(
    '/recordings/:recordingId/transcribe',
    applyRateLimit('transcription-start', 5),
    async (c) => {
      const recordingId = c.req.param('recordingId');
      const bodyValidation = await validateJsonBody(c, transcriptionStartRequestSchema);
      if (bodyValidation.ok === false) return bodyValidation.response;
      const body = bodyValidation.data;
      const asset = await transcriptionService.getMediaAsset(recordingId);
      if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
      const workspaceId = asset.workspace_id;
      if (body.workspaceId && body.workspaceId !== workspaceId) {
        return recordingConsentInvalidResponse(c, recordingId);
      }
      const membership = await ensureWorkspaceAccess(c, workspaceId);
      if (!workspaceMembershipCan(membership, 'recordings:process')) {
        return c.json({ message: 'Nie masz uprawnien do przetwarzania nagran.' }, 403);
      }
      const featureFlags = await getWorkspaceFeatureFlags(workspaceService, workspaceId);
      if (featureFlags.sttProvider === 'disabled') {
        return c.json(
          {
            message: 'Transkrypcja STT jest wylaczona dla tego workspace.',
            code: 'workspace_stt_disabled',
            recordingId,
          },
          403
        );
      }

      const runtimeActive =
        typeof transcriptionService.isTranscriptionJobActive === 'function'
          ? Boolean(transcriptionService.isTranscriptionJobActive(recordingId))
          : false;
      if (isActiveTranscriptionStatus(asset, runtimeActive)) {
        return c.json(
          withIdempotencyMetadata(normalizeTranscriptionStatusPayload(asset), c, 'recordingId'),
          202
        );
      }

      const validatedConsent = validateProductionRecordingConsent(
        c,
        recordingId,
        workspaceId,
        body.recordingConsent
      );
      if (validatedConsent instanceof Response) return validatedConsent;

      const quotaResponse = await enforceProviderQuota(c, {
        kind: 'stt',
        endpoint: 'recording-transcribe',
        workspaceId,
      });
      if (quotaResponse) return quotaResponse;

      // Guard against OOM - reject when memory is already tight
      const memPressure = getMemoryPressure();
      if (!memPressure.ok) {
        console.warn(
          `[memory] Rejecting transcription ${recordingId}: heap ${memPressure.heapUsedMB}/${memPressure.heapTotalMB} MB (${(memPressure.ratio * 100).toFixed(0)}%)`
        );
        return c.json(
          { message: 'Serwer jest chwilowo przeciążony. Spróbuj ponownie za chwilę.' },
          503
        );
      }

      try {
        addPipelineBreadcrumb('Transcription start requested.', {
          requestId: c.get('reqId'),
          workspaceId: body.workspaceId || asset.workspace_id,
          recordingId,
          pipelineStage: 'job_start_request',
          operation: 'transcription.start',
        });
        const result = await withAudioSpan(
          'audio.transcription.request',
          {
            requestId: c.get('reqId'),
            workspaceId: body.workspaceId || asset.workspace_id,
            recordingId,
            pipelineStage: 'job_start_request',
            operation: 'transcription.start',
            processingMode: resolveProcessingMode(body.processingMode),
          },
          () =>
            startTranscriptionPipeline(recordingId, asset, {
              ...body,
              workspaceId,
              recordingConsent: validatedConsent || body.recordingConsent,
              processingMode: resolveProcessingMode(body.processingMode),
              requestId: c.get('reqId'),
            })
        );

        if (validatedConsent) {
          await recordConsentAuditEvent(c, { ...asset, id: recordingId }, validatedConsent);
        }

        return c.json(
          withIdempotencyMetadata(
            normalizeTranscriptionStatusPayload(result),
            c,
            'recordingId',
            false
          ),
          202
        );
      } catch (err: any) {
        console.error(`[transcribe] Pipeline error for ${recordingId}:`, err?.message);
        const status = err?.statusCode || err?.status || 500;
        capturePipelineException(
          err,
          {
            requestId: c.get('reqId'),
            workspaceId: body.workspaceId || asset.workspace_id,
            recordingId,
            pipelineStage: 'job_start_request',
            operation: 'transcription.start',
            errorCode: err?.errorCode || err?.code || 'TRANSCRIPTION_START_FAILED',
            retryable: status === 429 || status === 503,
          },
          {
            level: status === 429 || status === 503 ? 'warning' : 'error',
            fingerprint: ['audio-pipeline', 'transcription-start'],
          }
        );
        return c.json(
          { message: err?.message || 'Błąd przetwarzania transkrypcji.', recordingId },
          status
        );
      }
    }
  );

  router.post(
    '/recordings/:recordingId/retry-transcribe',
    applyRateLimit('transcription-retry', 5),
    async (c) => {
      const recordingId = c.req.param('recordingId');
      const bodyValidation = await validateJsonBody(c, transcriptionRetryRequestSchema);
      if (bodyValidation.ok === false) return bodyValidation.response;
      const body = bodyValidation.data;
      const asset = await transcriptionService.getMediaAsset(recordingId);
      if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
      await ensureWorkspaceAccess(c, asset.workspace_id);
      const storedConsent = readRecordingConsentFromAsset(asset);
      const validatedConsent = validateProductionRecordingConsent(
        c,
        recordingId,
        asset.workspace_id,
        storedConsent,
        true
      );
      if (validatedConsent instanceof Response) return validatedConsent;
      const featureFlags = await getWorkspaceFeatureFlags(workspaceService, asset.workspace_id);
      if (featureFlags.sttProvider === 'disabled') {
        return c.json(
          {
            message: 'Transkrypcja STT jest wylaczona dla tego workspace.',
            code: 'workspace_stt_disabled',
            recordingId,
          },
          403
        );
      }

      if (
        asset.transcription_status === 'completed' &&
        hasTranscriptSegments(asset) &&
        body.force !== true
      ) {
        return c.json(
          withIdempotencyMetadata(
            {
              code: 'transcription_already_completed',
              message: 'Transkrypcja jest juz gotowa. Wymus ponowne przetwarzanie tylko swiadomie.',
              recordingId,
              pipelineStatus: 'done',
            },
            c,
            'recordingId'
          ),
          409
        );
      }

      if (!asset.file_path) {
        return c.json({ message: 'Brak \u015Bcie\u017Cki pliku do ponownego przetworzenia.' }, 409);
      }

      const status = String(asset.transcription_status || '').trim();
      const processingMode = resolveProcessingMode(body.processingMode);
      if (['queued', 'processing', 'diarization'].includes(status)) {
        await transcriptionService.ensureTranscriptionJob(
          recordingId,
          {
            id: recordingId,
            workspace_id: asset.workspace_id,
            meeting_id: asset.meeting_id,
            content_type: asset.content_type,
            file_path: asset.file_path,
            ...asset,
          },
          {
            workspaceId: asset.workspace_id,
            meetingId: asset.meeting_id,
            contentType: asset.content_type,
            recordingConsent: validatedConsent || storedConsent,
            processingMode,
            requestId: c.get('reqId'),
          }
        );

        const currentAsset = await transcriptionService.getMediaAsset(recordingId);
        await writeRecordingAuditEvent(
          c,
          { ...asset, id: recordingId },
          'recording.transcription.retry_requested',
          {
            previousStatus: status || 'unknown',
            processingMode,
            force: body.force === true,
          }
        );
        return c.json(
          withIdempotencyMetadata(
            normalizeTranscriptionStatusPayload(currentAsset || asset),
            c,
            'recordingId'
          ),
          202
        );
      }

      const quotaResponse = await enforceProviderQuota(c, {
        kind: 'stt',
        endpoint: 'retry-transcribe',
        workspaceId: asset.workspace_id,
      });
      if (quotaResponse) return quotaResponse;
      // If the local file is gone (e.g. after Railway redeploy), try the same
      // reconstructed remote candidates as the audio download endpoint.
      if (
        (asset.file_path.includes('/') || asset.file_path.includes('\\')) &&
        !existsSync(asset.file_path)
      ) {
        try {
          const { storagePath } = await downloadAudioFromStorageCandidates(recordingId, asset);
          console.info('[retry-transcribe] Local file missing, using Supabase fallback', {
            recordingId,
            localPath: asset.file_path,
            supabasePath: storagePath,
          });
          // Update asset to use the resolved Supabase key so pipeline downloads it.
          asset.file_path = storagePath;
        } catch {
          return c.json({ message: 'Lokalny plik audio nie istnieje.' }, 409);
        }
      }

      try {
        addPipelineBreadcrumb('Transcription retry requested.', {
          requestId: c.get('reqId'),
          workspaceId: asset.workspace_id,
          recordingId,
          pipelineStage: 'retry',
          operation: 'transcription.retry',
          previousStatus: status || 'unknown',
        });
        const result = await withAudioSpan(
          'audio.transcription.retry',
          {
            requestId: c.get('reqId'),
            workspaceId: asset.workspace_id,
            recordingId,
            pipelineStage: 'retry',
            operation: 'transcription.retry',
            processingMode,
          },
          () =>
            startTranscriptionPipeline(recordingId, asset, {
              workspaceId: asset.workspace_id,
              meetingId: asset.meeting_id,
              contentType: asset.content_type,
              recordingConsent: validatedConsent || storedConsent,
              processingMode,
              requestId: c.get('reqId'),
            })
        );

        await writeRecordingAuditEvent(
          c,
          { ...asset, id: recordingId },
          'recording.transcription.retry_requested',
          {
            previousStatus: status || 'unknown',
            processingMode,
            force: body.force === true,
          }
        );
        return c.json(
          withIdempotencyMetadata(
            normalizeTranscriptionStatusPayload(result),
            c,
            'recordingId',
            false
          ),
          202
        );
      } catch (err: any) {
        console.error(`[retry-transcribe] Pipeline error for ${recordingId}:`, err?.message);
        const status = err?.statusCode || err?.status || 500;
        capturePipelineException(
          err,
          {
            requestId: c.get('reqId'),
            workspaceId: asset.workspace_id,
            recordingId,
            pipelineStage: 'retry',
            operation: 'transcription.retry',
            errorCode: err?.errorCode || err?.code || 'TRANSCRIPTION_RETRY_FAILED',
            retryable: status === 429 || status === 503,
          },
          {
            level: status === 429 || status === 503 ? 'warning' : 'error',
            fingerprint: ['audio-pipeline', 'transcription-retry'],
          }
        );
        return c.json(
          { message: err?.message || 'Błąd przetwarzania transkrypcji.', recordingId },
          status
        );
      }
    }
  );

  router.get('/recordings/:recordingId/transcribe', async (c) => {
    try {
      const recordingId = c.req.param('recordingId');
      const asset = await transcriptionService.getMediaAsset(recordingId);
      if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
      await ensureWorkspaceAccess(c, asset.workspace_id);
      const runtimeStatus = getTranscriptionRuntimeStatus(recordingId);
      const durableJob =
        typeof transcriptionService.getDurableTranscriptionJob === 'function'
          ? await transcriptionService.getDurableTranscriptionJob(recordingId)
          : null;
      const durableJobActive = ['queued', 'running', 'retryable_failed'].includes(
        String(durableJob?.status || '')
      );

      // Detect true orphaned processing. Active long-audio jobs can run well
      // past five minutes, so only inactive stale assets are marked failed.
      const STUCK_THRESHOLD_MS = 30 * 60 * 1000;
      if (
        ['processing', 'queued'].includes(asset.transcription_status) &&
        asset.updated_at &&
        Date.now() - new Date(asset.updated_at).getTime() > STUCK_THRESHOLD_MS &&
        !runtimeStatus.activeJob &&
        !durableJobActive
      ) {
        if (!hasTranscriptSegments(asset)) {
          console.warn(
            `[transcribe-status] Recording ${recordingId} stuck in '${asset.transcription_status}' since ${asset.updated_at}. Marking as failed.`
          );
          await transcriptionService.markTranscriptionFailure(
            recordingId,
            'Pipeline utknął w przetwarzaniu. Spróbuj ponownie.',
            null,
            null
          );
          const failedAsset = await transcriptionService.getMediaAsset(recordingId);
          return c.json(normalizeTranscriptionStatusPayload(failedAsset || asset), 200);
        }
      }

      const manifest =
        asset.storage_mode === 'segmented' ? parseMediaManifest(asset.media_manifest_json) : null;
      const partProgress = getManifestPartProgress(manifest);

      return c.json(
        {
          ...normalizeTranscriptionStatusPayload(asset),
          ...runtimeStatus,
          ...(durableJobActive ? { activeJob: true, durableJobStatus: durableJob.status } : {}),
          ...(partProgress ? { partProgress } : {}),
        },
        200
      );
    } catch (err: any) {
      console.error(`[transcribe-status] Error:`, err?.message);
      const status = err?.statusCode || err?.status || 500;
      return c.json({ message: err?.message || 'Błąd pobierania statusu transkrypcji.' }, status);
    }
  });

  router.post('/recordings/:recordingId/progress-token', async (c) => {
    try {
      const recordingId = c.req.param('recordingId');
      const session = c.get('session') as any;
      const asset = await transcriptionService.getMediaAsset(recordingId);
      if (asset?.workspace_id) {
        await ensureWorkspaceAccess(c, asset.workspace_id);
      }
      const token = createProgressToken(recordingId, session.user_id || session.userId);
      return c.json({ token, expiresInSeconds: 300 }, 200);
    } catch (err: any) {
      const status = err?.statusCode || err?.status || 500;
      return c.json({ message: err?.message || 'Nie mozna utworzyc tokenu postepu.' }, status);
    }
  });

  router.get('/recordings/:recordingId/progress', async (c) => {
    try {
      const recordingId = c.req.param('recordingId');

      return streamSSE(c, async (stream) => {
        let active = true;

        const cleanup = () => {
          if (!active) return;
          active = false;
          clearInterval(pingId);
          clearTimeout(maxLifetimeId);
          transcriptionService.removeListener(`progress-${recordingId}`, progressCallback);
        };

        const progressCallback = async (data: any) => {
          if (!active) return;
          try {
            await stream.writeSSE({
              data: JSON.stringify(data),
              event: 'progress',
            });
          } catch {
            cleanup();
          }
        };

        transcriptionService.on(`progress-${recordingId}`, progressCallback);

        const pingId = setInterval(async () => {
          if (active) {
            await stream
              .writeSSE({ data: JSON.stringify({ ping: 'stay-alive' }), event: 'ping' })
              .catch(() => cleanup());
          }
        }, 15000);

        // Safety: force-close SSE after 2 hours to prevent leaked connections
        const maxLifetimeId = setTimeout(() => cleanup(), 2 * 60 * 60 * 1000);

        c.req.raw.signal.addEventListener('abort', () => cleanup());

        await new Promise(() => {});
      });
    } catch (err: any) {
      console.error(`[progress] SSE error:`, err?.message);
      return c.json({ message: err?.message || 'Błąd strumienia postępu.' }, 500);
    }
  });

  router.post('/recordings/:recordingId/normalize', async (c) => {
    try {
      const recordingId = c.req.param('recordingId');
      const asset = await transcriptionService.getMediaAsset(recordingId);
      if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
      await ensureWorkspaceAccess(c, asset.workspace_id);
      await transcriptionService.normalizeRecording(asset.file_path, { signal: c.req.raw.signal });
      return c.json({ ok: true }, 200);
    } catch (err: any) {
      console.error(`[normalize] Error:`, err?.message);
      const status = err?.statusCode || err?.status || 500;
      return c.json({ message: err?.message || 'Blad normalizacji.' }, status);
    }
  });

  router.post('/recordings/:recordingId/voice-profiles/from-speaker/preflight', async (c) => {
    const requestId = c.get('reqId') || crypto.randomUUID();
    const recordingId = c.req.param('recordingId');
    const bodyValidation = await validateJsonBody(c, voiceProfileFromSpeakerRequestSchema);
    if (bodyValidation.ok === false) return bodyValidation.response;
    const body = bodyValidation.data;
    const speakerId = String(body?.speakerId ?? '').trim();
    const speakerName = String(body?.speakerName ?? '').trim();
    if (!speakerId) {
      return c.json(
        {
          ready: false,
          ...buildVoiceProfileErrorBody({
            code: 'missing_speaker_id',
            message: 'Brakuje speakerId.',
            stage: 'validation',
            recordingId,
            speakerName,
            requestId,
          }),
        },
        200
      );
    }
    if (!speakerName) {
      return c.json(
        {
          ready: false,
          ...buildVoiceProfileErrorBody({
            code: 'missing_speaker_name',
            message: 'Brakuje speakerName.',
            stage: 'validation',
            recordingId,
            speakerId,
            requestId,
          }),
        },
        200
      );
    }

    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) {
      return c.json(
        {
          ready: false,
          ...buildVoiceProfileErrorBody({
            code: 'recording_not_found',
            message: 'Nie znaleziono nagrania.',
            stage: 'recording_lookup',
            recordingId,
            speakerId,
            speakerName,
            requestId,
          }),
        },
        200
      );
    }
    await ensureWorkspaceAccess(c, asset.workspace_id);

    const transcriptSegments = parseTranscriptJsonSegments(asset.transcript_json);
    const storedSegments = normalizeVoiceProfileTranscriptSegments(transcriptSegments, {
      requestedSpeakerId: speakerId,
      requestedSpeakerName: speakerName,
    });
    const overrideSegments = normalizeVoiceProfileTranscriptSegments(body?.segments, {
      requestedSpeakerId: speakerId,
      requestedSpeakerName: speakerName,
    });
    if (isVoiceProfileTranscriptPending(asset, transcriptSegments)) {
      return c.json(
        {
          ready: false,
          ...buildVoiceProfileErrorBody({
            code: 'transcription_not_ready',
            message: 'Profil glosu mozna zapisac dopiero po gotowej transkrypcji.',
            stage: 'transcript',
            recordingId,
            speakerId,
            speakerName,
            requestId,
          }),
        },
        200
      );
    }

    const voiceProfileSegments =
      overrideSegments.length > 0
        ? overrideSegments
        : storedSegments.length > 0
          ? storedSegments
          : transcriptSegments;
    const segmentCount = Array.isArray(voiceProfileSegments) ? voiceProfileSegments.length : 0;
    const matchedSegmentCount = countVoiceProfileSegmentsForSpeaker(
      voiceProfileSegments,
      speakerId,
      speakerName
    );
    if (matchedSegmentCount <= 0) {
      return c.json(
        {
          ready: false,
          ...buildVoiceProfileErrorBody({
            code: 'speaker_segment_not_found',
            message: 'Brak wypowiedzi tego mowcy w gotowej transkrypcji.',
            stage: 'transcript',
            recordingId,
            speakerId,
            speakerName,
            segmentCount,
            matchedSegmentCount,
            requestId,
          }),
        },
        200
      );
    }

    const audioSource = await resolveVoiceProfileAudioSource(recordingId, asset);
    if (!audioSource.ready) {
      return c.json(
        {
          ready: false,
          ...buildVoiceProfileErrorBody({
            code: 'audio_source_unavailable',
            message: 'Audio nie jest dostepne na serwerze. Zaimportuj nagranie ponownie.',
            stage: 'audio_source',
            recordingId,
            speakerId,
            speakerName,
            segmentCount,
            matchedSegmentCount,
            requestId,
          }),
        },
        200
      );
    }

    return c.json(
      {
        ready: true,
        code: 'ready',
        stage: 'ready',
        recordingId,
        speakerId,
        speakerName,
        segmentCount,
        matchedSegmentCount,
        source: audioSource.source,
      },
      200
    );
  });

  router.post('/recordings/:recordingId/voice-profiles/from-speaker', async (c) => {
    const session = c.get('session') as any;
    const requestId = c.get('reqId') || crypto.randomUUID();
    const recordingId = c.req.param('recordingId');
    const bodyValidation = await validateJsonBody(c, voiceProfileFromSpeakerRequestSchema);
    if (bodyValidation.ok === false) return bodyValidation.response;
    const body = bodyValidation.data;
    const speakerId = String(body?.speakerId ?? '').trim();
    const speakerName = String(body?.speakerName ?? '').trim();
    if (!speakerId) {
      return c.json(
        buildVoiceProfileErrorBody({
          code: 'missing_speaker_id',
          message: 'Brakuje speakerId.',
          stage: 'validation',
          recordingId,
          speakerName,
          requestId,
        }),
        400
      );
    }
    if (!speakerName) {
      return c.json(
        buildVoiceProfileErrorBody({
          code: 'missing_speaker_name',
          message: 'Brakuje speakerName.',
          stage: 'validation',
          recordingId,
          speakerId,
          requestId,
        }),
        400
      );
    }

    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) {
      return c.json(
        buildVoiceProfileErrorBody({
          code: 'recording_not_found',
          message: 'Nie znaleziono nagrania.',
          stage: 'recording_lookup',
          recordingId,
          speakerId,
          speakerName,
          requestId,
        }),
        404
      );
    }
    await ensureWorkspaceAccess(c, asset.workspace_id);

    const transcriptSegments = parseTranscriptJsonSegments(asset.transcript_json);
    const storedSegments = normalizeVoiceProfileTranscriptSegments(transcriptSegments, {
      requestedSpeakerId: speakerId,
      requestedSpeakerName: speakerName,
    });
    const overrideSegments = normalizeVoiceProfileTranscriptSegments(body?.segments, {
      requestedSpeakerId: speakerId,
      requestedSpeakerName: speakerName,
    });
    if (isVoiceProfileTranscriptPending(asset, transcriptSegments)) {
      return c.json(
        buildVoiceProfileErrorBody({
          code: 'transcription_not_ready',
          message: 'Profil glosu mozna zapisac dopiero po gotowej transkrypcji.',
          stage: 'transcript',
          recordingId,
          speakerId,
          speakerName,
          requestId,
        }),
        409
      );
    }
    const voiceProfileSegments =
      overrideSegments.length > 0
        ? overrideSegments
        : storedSegments.length > 0
          ? storedSegments
          : transcriptSegments;
    const segmentCount = Array.isArray(voiceProfileSegments) ? voiceProfileSegments.length : 0;
    const matchedSegmentCount = countVoiceProfileSegmentsForSpeaker(
      voiceProfileSegments,
      speakerId,
      speakerName
    );
    if (matchedSegmentCount <= 0) {
      return c.json(
        buildVoiceProfileErrorBody({
          code: 'speaker_segment_not_found',
          message: 'Brak wypowiedzi tego mowcy w gotowej transkrypcji.',
          stage: 'transcript',
          recordingId,
          speakerId,
          speakerName,
          segmentCount,
          matchedSegmentCount,
          requestId,
        }),
        422
      );
    }

    const featureFlags = await getWorkspaceFeatureFlags(workspaceService, asset.workspace_id);
    if (featureFlags.embeddings === false) {
      return c.json(
        {
          code: 'workspace_embeddings_disabled',
          message: 'Embeddingi sa wylaczone dla tego workspace.',
          stage: 'embedding',
          recordingId,
          speakerId,
          speakerName,
        },
        403
      );
    }

    const quotaResponse = await enforceProviderQuota(c, {
      kind: 'embedding',
      endpoint: 'voice-profile',
      workspaceId: asset.workspace_id,
    });
    if (quotaResponse) return quotaResponse;

    try {
      const options = overrideSegments.length > 0 ? { transcriptSegments: overrideSegments } : {};
      const profile = await transcriptionService.createVoiceProfileFromSpeaker(
        asset,
        speakerId,
        speakerName,
        session.user_id,
        options
      );
      const payload = buildVoiceProfileResponse(profile);
      const status = payload.isUpdate || payload.sampleCount > 1 ? 200 : 201;
      return c.json(payload, status);
    } catch (err: any) {
      const details = classifyVoiceProfileEnrollmentError(err);
      const body = buildVoiceProfileErrorBody({
        code: details.code,
        message: details.message,
        stage: details.stage,
        recordingId,
        speakerId,
        speakerName,
        segmentCount,
        matchedSegmentCount,
        requestId,
        retryable: details.retryable,
        userAction: details.userAction,
      });
      console.warn('[voice-profile] Enrollment failed', body);
      return c.json(body, details.status as any);
    }
  });

  router.post(
    '/recordings/:recordingId/voice-coaching',
    applyRateLimit('voice-coaching', 10),
    async (c) => {
      try {
        const recordingId = c.req.param('recordingId');
        const bodyValidation = await validateJsonBody(c, voiceCoachingRequestSchema);
        if (bodyValidation.ok === false) return bodyValidation.response;
        const body = bodyValidation.data;
        const asset = await transcriptionService.getMediaAsset(recordingId);
        if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
        await ensureWorkspaceAccess(c, asset.workspace_id);
        const quotaResponse = await enforceProviderQuota(c, {
          kind: 'ai',
          endpoint: 'voice-coaching',
          workspaceId: asset.workspace_id,
        });
        if (quotaResponse) return quotaResponse;
        const coaching = await transcriptionService.generateVoiceCoaching(
          asset,
          String(body.speakerId),
          body?.segments || [],
          {}
        );
        return c.json({ coaching }, 200);
      } catch (err: any) {
        console.error(`[voice-coaching] Error:`, err?.message);
        const status = err?.statusCode || err?.status || 500;
        return c.json({ message: err?.message || 'Blad generowania voice coaching.' }, status);
      }
    }
  );

  router.post('/recordings/:recordingId/acoustic-features', async (c) => {
    try {
      const recordingId = c.req.param('recordingId');
      const asset = await transcriptionService.getMediaAsset(recordingId);
      if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
      await ensureWorkspaceAccess(c, asset.workspace_id);
      const payload = await transcriptionService.getSpeakerAcousticFeatures(asset, {
        signal: c.req.raw.signal,
      });
      return c.json(payload, 200);
    } catch (err: any) {
      console.error(`[acoustic-features] Error:`, err?.message);
      const status = err?.statusCode || err?.status || 500;
      return c.json({ message: err?.message || 'Blad analizy akustycznej.' }, status);
    }
  });

  router.post('/recordings/:recordingId/rediarize', applyRateLimit('rediarize', 10), async (c) => {
    try {
      const recordingId = c.req.param('recordingId');
      const asset = await transcriptionService.getMediaAsset(recordingId);
      if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
      await ensureWorkspaceAccess(c, asset.workspace_id);

      let stored = [] as any[];
      try {
        stored = JSON.parse(asset.transcript_json || '[]');
      } catch (_) {}
      if (!stored.length) return c.json({ message: 'Brak transkrypcji.' }, 400);

      const whisperLike = stored
        .map((s) => ({ text: s.text, start: s.timestamp, end: s.endTimestamp || s.timestamp }))
        .filter((s) => s.text);
      const diarization = await transcriptionService.diarizeFromTranscript(whisperLike);
      if (!diarization) {
        return c.json(
          {
            status: 'no_changes',
            code: 'rediarization_unavailable',
            message: 'Nie uda?o si? wykry? nowych m?wc?w. Transkrypt pozostaje bez zmian.',
            speakerCount: 0,
            speakerNames: {},
            segments: [],
          },
          200
        );
      }

      const updated = diarization.segments.map((seg: any, idx: number) => ({
        ...(stored[idx] || {}),
        id: stored[idx]?.id || seg.id,
        text: seg.text,
        timestamp: seg.timestamp,
        endTimestamp: seg.endTimestamp,
        speakerId: seg.speakerId,
        rawSpeakerLabel: seg.rawSpeakerLabel,
      }));
      await transcriptionService.saveTranscriptionResult(recordingId, {
        segments: updated,
        diarization,
        pipelineStatus: 'completed',
      });
      return c.json(
        {
          speakerCount: diarization.speakerCount,
          speakerNames: diarization.speakerNames,
          segments: updated,
        },
        200
      );
    } catch (err: any) {
      console.error(`[rediarize] Error:`, err?.message);
      const status = err?.statusCode || err?.status || 500;
      return c.json({ message: err?.message || 'Blad rediaryzacji.' }, status);
    }
  });

  router.post(
    '/recordings/:recordingId/sketchnote',
    applyRateLimit('sketchnote-image', 5),
    async (c) => {
      const recordingId = c.req.param('recordingId');
      const asset = await transcriptionService.getMediaAsset(recordingId);
      if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
      await ensureWorkspaceAccess(c, asset.workspace_id);

      let diarization: any = {};
      try {
        diarization = JSON.parse(asset.diarization_json || '{}');
      } catch (_) {}

      // Accept analysis data from request body (frontend state) or fall back to stored diarization_json
      const body: any = await c.req.json().catch(() => ({}));

      const summaryText =
        body?.summary || diarization?.reviewSummary?.summary || diarization?.summary;
      if (!summaryText)
        return c.json({ message: 'Brak podsumowania do wygenerowania sketchnotki.' }, 400);

      const featureFlags = await getWorkspaceFeatureFlags(workspaceService, asset.workspace_id);
      if (featureFlags.imageGeneration === false) {
        return c.json(
          {
            message: 'Generowanie obrazow jest wylaczone dla tego workspace.',
            code: 'workspace_image_generation_disabled',
          },
          403
        );
      }

      const asList = (value: any) =>
        (Array.isArray(value) ? value : [])
          .map((item) =>
            String(
              typeof item === 'object'
                ? item?.title || item?.text || item?.value || item?.label || ''
                : item || ''
            ).trim()
          )
          .filter(Boolean);
      const decisions = asList(body?.decisions || diarization?.decisions);
      const actionItems = asList(
        body?.actionItems || diarization?.actionItems || diarization?.tasks
      );
      const followUps = asList(body?.followUps || diarization?.followUps);
      const risks = asList(body?.risks || diarization?.risks);
      const blockers = asList(body?.blockers || diarization?.blockers);
      const quotes = asList(body?.keyQuotes || diarization?.keyQuotes).slice(0, 2);

      if (!process.env.GEMINI_API_KEY) {
        return c.json({ message: 'Brak klucza GEMINI_API_KEY w konfiguracji środowiska.' }, 400);
      }

      const quotaResponse = await enforceProviderQuota(c, {
        kind: 'image',
        endpoint: 'sketchnote',
        workspaceId: asset.workspace_id,
      });
      if (quotaResponse) return quotaResponse;

      try {
        const { logger } = await import('../logger.ts');
        logger.info(`Generating Gemini 3 Pro Image sketchnote for recording ${recordingId}...`);

        const prompt = `Create a polished hand-drawn sketchnote poster in Polish that summarizes this meeting.
Style requirements:
- white or warm paper background
- bold black hand-lettered headings
- thick marker outlines
- soft yellow highlights
- a few doodles, arrows, speech bubbles, sticky-note callouts
- clear hierarchy with 4-6 large visual zones
- generous spacing and strong visual rhythm
- readable Polish text with large headings
- thick black contours and marker shading
- feel like a real workshop whiteboard/sketchnote, not a generic infographic
- use a friendly, handcrafted, imperfect look
- balance text blocks, icons, and bubbles like a social-media sketchnote
- do not make it look corporate or sterile

Layout suggestion:
- top left: bold title block
- top right: small icon cluster or quick theme callout
- middle: 2 or 3 boxed sections for key content
- lower area: action plan / next steps / risks
- add doodle arrows connecting the sections

Content to include:
Meeting summary:
${summaryText.substring(0, 1200)}

Decisions:
${decisions.length ? decisions.map((item) => `- ${item}`).join('\n') : '- none'}

Action items:
${actionItems.length ? actionItems.map((item) => `- ${item}`).join('\n') : '- none'}

Next steps:
${followUps.length ? followUps.map((item) => `- ${item}`).join('\n') : '- none'}

Risks / blockers:
${[...risks, ...blockers].length ? [...risks, ...blockers].map((item) => `- ${item}`).join('\n') : '- none'}

Key quotes:
${quotes.length ? quotes.map((item) => `- ${item}`).join('\n') : '- none'}

Important:
- make it look like a handcrafted visual note
- do not use photorealism
- do not include tiny unreadable text
- use a 4:3 composition
- prioritize visual clarity over dense text`;

        const geminiUrl =
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent';
        const geminiBody = JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: {
              aspectRatio: '4:3',
              imageSize: '4K',
            },
            thinkingConfig: {
              thinkingLevel: 'medium',
            },
          },
        });
        const geminiHeaders = {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY,
        };

        const MAX_RETRIES = 2;
        const RETRY_DELAYS = process.env.NODE_ENV === 'test' ? [10, 10] : [5000, 15000];
        let lastRes: Response | null = null;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          lastRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: geminiHeaders,
            body: geminiBody,
          });

          if (lastRes.ok || (lastRes.status !== 429 && lastRes.status !== 503)) break;

          if (attempt < MAX_RETRIES) {
            const delay = RETRY_DELAYS[attempt] || 15000;
            logger.warn(
              `Gemini ${lastRes.status} for recording ${recordingId}, retry ${attempt + 1}/${MAX_RETRIES} in ${delay / 1000}s`
            );
            await new Promise((r) => setTimeout(r, delay));
          }
        }

        const res = lastRes!;

        if (!res.ok) {
          const errBody = await res.text();
          let detail = '';
          try {
            const parsed = JSON.parse(errBody);
            detail = parsed?.error?.message || errBody.slice(0, 200);
          } catch {
            detail = errBody.slice(0, 200);
          }
          const passthrough = [429, 503] as const;
          const status = passthrough.includes(res.status as any) ? res.status : 500;
          if (res.status === 429) {
            logger.warn(`Gemini quota exceeded for recording ${recordingId}: ${detail}`);
          } else {
            logger.error('Gemini image gen error:', errBody);
          }
          return c.json({ message: `Błąd Gemini (${res.status}): ${detail}` }, status as any);
        }

        const data = await res.json();
        const inlineImage = data.candidates?.[0]?.content?.parts?.find(
          (part: any) => part?.inlineData?.data
        )?.inlineData;
        if (!inlineImage?.data) {
          return c.json({ message: 'Model Gemini nie wygenerował obrazu.' }, 500);
        }

        const mimeType = String(inlineImage.mimeType || 'image/png').trim() || 'image/png';
        const imageUrl = `data:${mimeType};base64,${inlineImage.data}`;

        if (imageUrl) {
          diarization.sketchnoteUrl = imageUrl;
          if (typeof transcriptionService._execute === 'function') {
            await transcriptionService._execute(
              'UPDATE media_assets SET diarization_json = ?, updated_at = ? WHERE id = ?',
              [JSON.stringify(diarization), new Date().toISOString(), recordingId]
            );
          }
        }

        return c.json({ sketchnoteUrl: imageUrl }, 200);
      } catch (e: any) {
        console.error('Sketchnote generation exception:', e);
        return c.json({ message: `Błąd Gemini: ${e?.message || 'nieznany błąd'}` }, 500);
      }
    }
  );

  router.post('/analyze', authMiddleware, applyRateLimit('analyze', 10), async (c) => {
    const bodyValidation = await validateJsonBody(c, aiAnalyzeRequestSchema);
    if (bodyValidation.ok === false) return bodyValidation.response;
    const body = bodyValidation.data;
    const workspaceId = String(body.workspaceId || c.req.header('X-Workspace-Id') || '').trim();
    if (!workspaceId) {
      return c.json({ message: 'Brakuje workspaceId.' }, 400);
    }
    const membership = await ensureWorkspaceAccess(c, workspaceId);
    if (!workspaceMembershipCan(membership, 'ai:analyze')) {
      return c.json({ message: 'Nie masz uprawnien do analizy AI.' }, 403);
    }

    const featureFlags = await getWorkspaceFeatureFlags(workspaceService, workspaceId);
    if (featureFlags.meetingAnalysis === false) {
      return c.json(
        {
          mode: 'disabled-feature-flag',
          analysisSource: 'fallback',
          fallbackReason: 'disabled-feature-flag',
          generatedBy: 'server',
        },
        200
      );
    }

    const quotaResponse = await enforceProviderQuota(c, {
      kind: 'ai',
      endpoint: 'media-analyze',
      workspaceId,
    });
    if (quotaResponse) return quotaResponse;

    const result = await transcriptionService.analyzeMeetingWithOpenAI({ ...body, workspaceId });
    const payload = normalizeAnalysisPayload(
      result,
      Array.isArray(body?.segments) ? body.segments : []
    );
    const meeting = body?.meeting && typeof body.meeting === 'object' ? body.meeting : {};
    const recordingId = String(
      body.recordingId ||
        body.recording_id ||
        meeting.recordingId ||
        meeting.recording_id ||
        meeting.mediaAssetId ||
        meeting.media_asset_id ||
        body.meetingId ||
        meeting.id ||
        workspaceId
    ).trim();
    MetricsService.observeAiAnalysis({
      workspaceId,
      endpoint: 'media.analyze',
      source: String((payload as any)?.analysisSource || 'provider'),
    });
    await writeAuditEvent(c, {
      workspaceId,
      action: 'recording.ai.analyzed',
      entityType: 'recording',
      entityId: recordingId,
      metadata: {
        meetingId: String(body.meetingId || meeting.id || ''),
        mode: String((payload as any)?.mode || 'analysis'),
        analysisSource: String((payload as any)?.analysisSource || 'provider'),
        fallbackReason: String((payload as any)?.fallbackReason || ''),
        source: 'api',
      },
    });
    if ((payload as any)?.analysisSource === 'fallback') {
      const reason = String((payload as any)?.fallbackReason || 'provider-error');
      const mode = String((payload as any)?.mode || 'fallback');
      MetricsService.observeAiFallback({
        workspaceId,
        endpoint: 'media.analyze',
        reason,
        mode,
      });
      logger.warn(
        '[AI] Meeting analysis fallback used',
        {
          workspaceId,
          recordingId,
          meetingId: String(body.meetingId || meeting.id || ''),
          fallbackReason: reason,
          mode,
        },
        {
          sentryLevel:
            reason === 'no-key' || reason === 'disabled-feature-flag' ? 'info' : 'warning',
          fingerprint: ['ai-analysis-fallback', reason],
        }
      );
    }
    return c.json(payload, 200);
  });

  // Chunked upload: PUT /recordings/:id/audio/chunk?index=N&total=M
  router.get(
    '/recordings/:recordingId/audio/chunk-status',
    applyRateLimit('upload-status', 120),
    async (c) => {
      const recordingId = c.req.param('recordingId');
      const workspaceId = c.req.header('X-Workspace-Id') || '';
      if (!workspaceId) return c.json({ message: 'Brakuje X-Workspace-Id.' }, 400);
      await ensureWorkspaceAccess(c, workspaceId);

      const total = parseInt(c.req.query('total') || '', 10);
      if (isNaN(total) || total <= 0) {
        return c.json({ message: 'Brakuje poprawnego parametru total.' }, 400);
      }

      const chunksDir = path.join(config.uploadDir, 'chunks');
      const safeId = String(recordingId).replace(/[^a-zA-Z0-9_-]/g, '_');
      if (!existsSync(chunksDir)) {
        return c.json({ nextIndex: 0, uploaded: 0, total, resumable: false }, 200);
      }

      let nextIndex = 0;
      for (let i = 0; i < total; i++) {
        const chunkPath = path.join(chunksDir, `${safeId}_${i}.chunk`);
        if (!existsSync(chunkPath)) {
          break;
        }
        nextIndex = i + 1;
      }

      return c.json(
        {
          nextIndex,
          uploaded: nextIndex,
          total,
          resumable: nextIndex > 0 && nextIndex < total,
        },
        200
      );
    }
  );

  router.put(
    '/recordings/:recordingId/audio/chunk',
    applyRateLimit('upload-chunk', 300),
    async (c) => {
      const recordingId = c.req.param('recordingId');
      const workspaceId = c.req.header('X-Workspace-Id') || '';
      if (!workspaceId) return c.json({ message: 'Brakuje X-Workspace-Id.' }, 400);
      await ensureWorkspaceAccess(c, workspaceId);

      const index = parseInt(c.req.query('index') || '', 10);
      const total = parseInt(c.req.query('total') || '', 10);
      if (isNaN(index) || isNaN(total) || index < 0 || total <= 0 || index >= total) {
        return c.json({ message: 'Nieprawidłowe parametry chunka (index/total).' }, 400);
      }
      if (total > 600) return c.json({ message: 'Za dużo chunków (max 600, ~1.2GB).' }, 400);

      const chunksDir = path.join(config.uploadDir, 'chunks');
      mkdirSync(chunksDir, { recursive: true });

      const safeId = String(recordingId).replace(/[^a-zA-Z0-9_-]/g, '_');
      const chunkPath = path.join(chunksDir, `${safeId}_${index}.chunk`);
      if (getIdempotencyKey(c) && existsSync(chunkPath)) {
        return c.json(withIdempotencyMetadata({ index, total }, c, 'recordingId:chunkIndex'), 200);
      }

      const buffer = await c.req.arrayBuffer();
      if (buffer.byteLength > 6 * 1024 * 1024)
        return c.json({ message: 'Chunk jest zbyt duży (max 6MB).' }, 413);

      // Check disk space before writing
      const diskSpace = checkDiskSpace(uploadDir, DISK_SPACE_BLOCK_UPLOAD_BYTES);
      if (!diskSpace.ok) {
        const { logger } = await import('../logger.ts');
        logger.error(`[ENOSPC] Disk space critically low: ${diskSpace.freeBytes} bytes free`);
        return c.json(
          {
            message:
              'Brak miejsca na dysku serwera. Zwolnij miejsce lub skontaktuj z administratorem.',
            freeBytes: diskSpace.freeBytes,
          },
          507
        );
      }

      try {
        await writeFile(chunkPath, Buffer.from(buffer));
      } catch (writeErr: any) {
        if (writeErr.code === 'ENOSPC') {
          const { logger } = await import('../logger.ts');
          logger.error(
            `[ENOSPC] Failed to write chunk ${index}/${total} for recording ${recordingId}`
          );
          // Cleanup partial write
          try {
            await unlink(chunkPath);
          } catch (_) {}
          return c.json({ message: 'Brak miejsca na dysku podczas zapisu chunka.' }, 507);
        }
        throw writeErr;
      }

      return c.json(
        withIdempotencyMetadata({ index, total }, c, 'recordingId:chunkIndex', false),
        200
      );
    }
  );

  // Chunked upload finalize: POST /recordings/:id/audio/finalize
  router.post(
    '/recordings/:recordingId/audio/finalize',
    applyRateLimit('upload-finalize', 30),
    async (c) => {
      const recordingId = c.req.param('recordingId');
      const session = c.get('session') as any;
      const bodyValidation = await validateJsonBody(c, chunkFinalizeRequestSchema);
      if (bodyValidation.ok === false) return bodyValidation.response;
      const body = bodyValidation.data;
      const workspaceId = body.workspaceId || c.req.header('X-Workspace-Id') || '';
      const meetingId = body.meetingId || c.req.header('X-Meeting-Id') || '';
      const contentType = body.contentType || 'application/octet-stream';
      const total = body.total;

      if (!workspaceId) return c.json({ message: 'Brakuje workspaceId.' }, 400);
      if (!total || total <= 0) return c.json({ message: 'Brakuje total w ciele żądania.' }, 400);
      await ensureWorkspaceAccess(c, workspaceId);

      const existingAsset =
        typeof transcriptionService.getMediaAsset === 'function'
          ? await transcriptionService.getMediaAsset(recordingId)
          : null;
      if (existingAsset?.workspace_id === workspaceId) {
        return c.json(
          withIdempotencyMetadata(buildExistingMediaAssetResponse(existingAsset), c, 'recordingId'),
          200
        );
      }

      const chunksDir = path.join(config.uploadDir, 'chunks');
      const safeId = String(recordingId).replace(/[^a-zA-Z0-9_-]/g, '_');

      let assembledPath = '';
      try {
        assembledPath = await assembleChunksToTempFile(chunksDir, safeId, total);
      } catch (error: any) {
        return c.json({ message: error?.message || 'Nie udało się złożyć chunków.' }, 400);
      }

      const fullStats = await stat(assembledPath);
      const sizeValidation = validateRawUploadSize(fullStats.size);
      if (sizeValidation.ok === false) {
        try {
          await unlink(assembledPath);
        } catch (_) {}
        await cleanupChunkFiles(chunksDir, safeId, total);
        return c.json(
          { code: sizeValidation.code, message: sizeValidation.message },
          sizeValidation.status
        );
      }

      const mimeValidation = validateAudioMimeType(contentType);
      if (!mimeValidation.ok) {
        try {
          await unlink(assembledPath);
        } catch (_) {}
        await cleanupChunkFiles(chunksDir, safeId, total);
        return c.json(
          { code: mimeValidation.code, message: mimeValidation.message },
          mimeValidation.status
        );
      }

      let normalizedAudio: Awaited<ReturnType<typeof normalizeAudioForStorage>> | null = null;
      let localParts: Awaited<ReturnType<typeof splitNormalizedAudioIntoParts>> = [];
      let audioValidation: Awaited<ReturnType<typeof validateAudioForTranscription>> | null = null;
      let asset: MediaAsset;
      try {
        normalizedAudio = await withAudioSpan(
          'audio.upload.normalize',
          {
            requestId: c.get('reqId'),
            workspaceId,
            recordingId,
            meetingId,
            pipelineStage: 'upload_normalize',
            operation: 'media.upload.finalize',
            contentType,
            sourceSizeBytes: fullStats.size,
          },
          () =>
            normalizeAudioForStorage({
              sourcePath: assembledPath,
              workDir: path.join(config.uploadDir, 'normalized'),
              recordingId,
              signal: c.req.raw.signal,
            })
        );
        audioValidation = await withAudioSpan(
          'audio.upload.validate',
          {
            requestId: c.get('reqId'),
            workspaceId,
            recordingId,
            meetingId,
            pipelineStage: 'upload_validation',
            operation: 'media.upload.finalize',
            contentType: normalizedAudio.contentType,
            normalizedSizeBytes: normalizedAudio.sizeBytes,
            durationMs: normalizedAudio.durationMs,
          },
          () =>
            validateAudioForTranscription({
              filePath: normalizedAudio.path,
              contentType: normalizedAudio.contentType,
              signal: c.req.raw.signal,
            })
        );

        if (shouldUseSegmentedStorage(normalizedAudio.sizeBytes)) {
          localParts = await withAudioSpan(
            'audio.upload.split_parts',
            {
              requestId: c.get('reqId'),
              workspaceId,
              recordingId,
              meetingId,
              pipelineStage: 'upload_split',
              operation: 'media.upload.finalize',
              normalizedSizeBytes: normalizedAudio.sizeBytes,
              durationMs: normalizedAudio.durationMs,
            },
            () =>
              splitNormalizedAudioIntoParts({
                normalizedPath: normalizedAudio.path,
                workDir: path.join(config.uploadDir, 'parts'),
                recordingId,
                durationMs: normalizedAudio.durationMs,
                signal: c.req.raw.signal,
              })
          );
        }

        const upsertPrepared =
          typeof transcriptionService.upsertMediaAssetFromPreparedAudio === 'function'
            ? transcriptionService.upsertMediaAssetFromPreparedAudio.bind(transcriptionService)
            : null;

        asset = await withAudioSpan(
          'audio.upload.store',
          {
            requestId: c.get('reqId'),
            workspaceId,
            recordingId,
            meetingId,
            pipelineStage: 'upload_store',
            operation: 'media.upload.finalize',
            contentType: normalizedAudio.contentType,
            sourceSizeBytes: fullStats.size,
            normalizedSizeBytes: normalizedAudio.sizeBytes,
            durationMs: normalizedAudio.durationMs,
            partCount: localParts.length,
          },
          () =>
            upsertPrepared
              ? upsertPrepared({
                  recordingId,
                  workspaceId,
                  meetingId,
                  contentType: normalizedAudio.contentType,
                  normalizedFilePath: normalizedAudio.path,
                  sourceSizeBytes: fullStats.size,
                  normalizedSizeBytes: normalizedAudio.sizeBytes,
                  durationMs: normalizedAudio.durationMs,
                  parts: localParts,
                  createdByUserId: session.user_id,
                })
              : transcriptionService.upsertMediaAssetFromPath({
                  recordingId,
                  workspaceId,
                  meetingId,
                  contentType: normalizedAudio.contentType,
                  filePath: normalizedAudio.path,
                  createdByUserId: session.user_id,
                })
        );
      } catch (err: any) {
        try {
          await unlink(assembledPath);
        } catch (_) {}
        if (normalizedAudio?.path) {
          try {
            await unlink(normalizedAudio.path);
          } catch (_) {}
        }
        for (const part of localParts) {
          try {
            await unlink(part.localPath);
          } catch (_) {}
        }
        if (
          err instanceof MediaStoragePipelineError ||
          err?.code === 'audio_normalization_failed'
        ) {
          await cleanupChunkFiles(chunksDir, safeId, total);
          return c.json(audioValidationErrorBody(err), audioValidationErrorStatus(err));
        }
        if (
          (err as any).code === 'ENOSPC' ||
          String(err.message).includes('Brak miejsca na dysku')
        ) {
          return c.json(
            { message: 'Brak miejsca na dysku serwera. Skontaktuj sie z administratorem.' },
            507
          );
        }
        throw err;
      }

      await cleanupChunkFiles(chunksDir, safeId, total);
      try {
        await unlink(assembledPath);
      } catch (_) {}
      if (normalizedAudio?.path) {
        try {
          await unlink(normalizedAudio.path);
        } catch (_) {}
      }
      for (const part of localParts) {
        try {
          await unlink(part.localPath);
        } catch (_) {}
      }

      scheduleAudioQuality(recordingId, asset);

      return c.json(
        withIdempotencyMetadata(
          {
            id: asset.id,
            workspaceId: asset.workspace_id,
            sizeBytes: asset.size_bytes,
            storageMode: asset.storage_mode || (localParts.length ? 'segmented' : 'single'),
            partCount: localParts.length,
            sourceSizeBytes: fullStats.size,
            normalizedSizeBytes: normalizedAudio?.sizeBytes || asset.size_bytes,
            durationMs: normalizedAudio?.durationMs || 0,
            audioValidation,
            audioQuality: null,
          },
          c,
          'recordingId',
          false
        ),
        200
      );
    }
  );

  // Disk space management endpoints
  router.get('/disk-space/status', async (c) => {
    const diskSpace = checkDiskSpace(uploadDir, 0); // Check without minimum
    return c.json({
      ok: diskSpace.ok,
      freeBytes: diskSpace.freeBytes || null,
      freeMB: diskSpace.freeBytes ? Math.round(diskSpace.freeBytes / 1024 / 1024) : null,
      timestamp: new Date().toISOString(),
    });
  });

  router.post('/disk-space/cleanup', authMiddleware, async (c) => {
    const session = c.get('session') as any;
    // Only allow admin users
    if (!session || session.role !== 'admin') {
      return c.json({ message: 'Wymagane uprawnienia administratora.' }, 403);
    }

    const maxAgeHours = parseInt(c.req.query('maxAge') || '24', 10);
    const result = await cleanupOldChunks(uploadDir, Math.min(maxAgeHours, 168)); // Max 1 week

    return c.json({
      success: true,
      deleted: result.deleted,
      bytesFreed: result.bytesFreed,
      mbFreed: Math.round(result.bytesFreed / 1024 / 1024),
    });
  });

  return router;
}

export function createTranscribeRoutes(services: AppServices, middlewares: AppMiddlewares) {
  const router = new Hono<{ Variables: { session: any; user: any } }>();
  const { transcriptionService, workspaceService, config } = services;
  const { authMiddleware, applyRateLimit, ensureWorkspaceAccess } = middlewares;
  const quotaStore = createAiQuotaStore({ db: services.db });
  const liveTranscribeTimeoutMs = () => {
    if (config?.transcribeLiveTimeoutMs && config.transcribeLiveTimeoutMs > 0) {
      return Number(config.transcribeLiveTimeoutMs);
    }

    const envTimeout = Number(process.env.VOICELOG_TRANSCRIBE_LIVE_TIMEOUT_MS);
    if (Number.isFinite(envTimeout) && envTimeout > 0) {
      return envTimeout;
    }

    return 30_000;
  };

  router.post('/live', authMiddleware, applyRateLimit('live-transcribe', 60), async (c) => {
    const session = c.get('session') as any;
    const workspaceId = String(
      session?.workspace_id || c.req.header('X-Workspace-Id') || ''
    ).trim();
    if (!workspaceId) {
      return c.json({ message: 'Brakuje workspaceId.' }, 400);
    }
    await ensureWorkspaceAccess(c, workspaceId);
    const featureFlags = await getWorkspaceFeatureFlags(workspaceService, workspaceId);
    if (featureFlags.liveTranscription === false) {
      return c.json(
        {
          message: 'Transkrypcja live jest wylaczona dla tego workspace.',
          code: 'workspace_live_transcription_disabled',
        },
        403
      );
    }

    const sessionUserId = String(session?.user_id || session?.userId || '').trim();
    if (!sessionUserId) {
      return c.json({ message: 'Brak uzytkownika w sesji.' }, 401);
    }
    const exceeded = await quotaStore.increment(
      buildProviderQuotaChecks({
        kind: 'live-transcription',
        endpoint: 'live',
        userId: sessionUserId,
        workspaceId,
        ip: getClientIp(c),
      })
    );
    if (exceeded) {
      c.header('Retry-After', String(exceeded.retryAfter));
      return c.json(
        buildProviderQuotaExceededBody({
          kind: 'live-transcription',
          endpoint: 'live',
          exceeded,
        }),
        429
      );
    }

    const contentType = c.req.header('content-type') || 'audio/webm';
    const headerValidation = validatePayload(
      c,
      liveTranscriptionHeadersSchema,
      { contentType },
      'headers'
    );
    if (headerValidation.ok === false) return headerValidation.response;
    const bufferArray = await c.req.arrayBuffer();
    if (bufferArray.byteLength > 5 * 1024 * 1024)
      return c.json({ message: 'Payload too large' }, 413);
    const buffer = Buffer.from(bufferArray);
    if (!buffer || buffer.byteLength < 500) return c.json({ text: '' }, 200);

    const ext = contentType.includes('mp4')
      ? '.m4a'
      : contentType.includes('wav')
        ? '.wav'
        : '.webm';
    const tmpPath = path.join(
      config.uploadDir,
      `live_${crypto.randomUUID().replace(/-/g, '')}${ext}`
    );
    try {
      await writeFile(tmpPath, buffer);
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const text = await Promise.race([
        transcriptionService.transcribeLiveChunk(tmpPath, contentType, {}),
        new Promise<string>((_, reject) => {
          timeoutId = setTimeout(() => {
            const err: any = new Error('Transcription request timed out.');
            err.statusCode = 504;
            reject(err);
          }, liveTranscribeTimeoutMs());
        }),
      ]);
      clearTimeout(timeoutId);
      return c.json({ text }, 200);
    } finally {
      try {
        await unlink(tmpPath);
      } catch (_) {}
    }
  });

  return router;
}
