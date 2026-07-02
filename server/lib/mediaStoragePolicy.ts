export const MAX_RAW_UPLOAD_BYTES = 200 * 1024 * 1024;
export const CLIENT_CHUNK_BYTES = 4 * 1024 * 1024;
export const SINGLE_OBJECT_MAX_BYTES = 24 * 1024 * 1024;
export const SEGMENT_PART_MAX_BYTES = 20 * 1024 * 1024;
export const SEGMENT_MAX_DURATION_MS = 10 * 60 * 1000;
export const STORAGE_CONTENT_TYPE = 'audio/webm';
export const STORAGE_EXTENSION = '.webm';

export type MediaStorageMode = 'single' | 'segmented';
export type MediaPartTranscriptionStatus =
  'pending' | 'processing' | 'completed' | 'failed' | 'review';

export interface MediaPartTranscriptionCheckpoint {
  status: MediaPartTranscriptionStatus;
  attempts?: number;
  provider?: string;
  model?: string;
  startedAt?: string;
  completedAt?: string;
  errorCode?: string;
  payloadPath?: string;
  segmentCount?: number;
  textLength?: number;
}

export interface NormalizedAudioMime {
  contentType: string;
  extension: string;
  supported: boolean;
}

export interface MediaManifestPart {
  index: number;
  path: string;
  startMs: number;
  endMs: number;
  sizeBytes: number;
  contentType: string;
  status?: 'queued' | 'processing' | 'completed' | 'failed' | 'review' | 'low-confidence';
  transcription?: MediaPartTranscriptionCheckpoint;
}

export interface MediaManifest {
  version: 1;
  storageMode: 'segmented';
  recordingId: string;
  workspaceId: string;
  sourceSizeBytes: number;
  normalizedSizeBytes: number;
  durationMs: number;
  contentType: typeof STORAGE_CONTENT_TYPE;
  parts: MediaManifestPart[];
}

export interface UploadPolicy {
  maxRawUploadBytes: number;
  clientChunkBytes: number;
  singleObjectMaxBytes: number;
  segmentPartMaxBytes: number;
  segmentMaxDurationMs: number;
  storageContentType: typeof STORAGE_CONTENT_TYPE;
  storageExtension: typeof STORAGE_EXTENSION;
  supportedMimeTypes: string[];
}

export interface UploadPolicyError {
  ok: false;
  status: 413 | 415 | 422;
  code: 'audio_too_large' | 'unsupported_audio_type' | 'audio_normalization_failed';
  message: string;
}

export interface UploadPolicyOk {
  ok: true;
}

const MIME_ALIASES: Record<string, NormalizedAudioMime> = {
  'audio/webm': { contentType: 'audio/webm', extension: '.webm', supported: true },
  'audio/ogg': { contentType: 'audio/ogg', extension: '.ogg', supported: true },
  'audio/oga': { contentType: 'audio/ogg', extension: '.ogg', supported: true },
  'audio/mpeg': { contentType: 'audio/mpeg', extension: '.mp3', supported: true },
  'audio/mp3': { contentType: 'audio/mpeg', extension: '.mp3', supported: true },
  'audio/mp4': { contentType: 'audio/mp4', extension: '.m4a', supported: true },
  'audio/x-m4a': { contentType: 'audio/mp4', extension: '.m4a', supported: true },
  'audio/m4a': { contentType: 'audio/mp4', extension: '.m4a', supported: true },
  'audio/wav': { contentType: 'audio/wav', extension: '.wav', supported: true },
  'audio/wave': { contentType: 'audio/wav', extension: '.wav', supported: true },
  'audio/x-wav': { contentType: 'audio/wav', extension: '.wav', supported: true },
  'audio/flac': { contentType: 'audio/flac', extension: '.flac', supported: true },
  'application/octet-stream': {
    contentType: 'application/octet-stream',
    extension: '.webm',
    supported: true,
  },
};

export function normalizeAudioMimeType(input: string | null | undefined): NormalizedAudioMime {
  const baseType = String(input || '')
    .toLowerCase()
    .split(';')[0]
    .trim();
  return (
    MIME_ALIASES[baseType] || {
      contentType: baseType || 'application/octet-stream',
      extension: '.webm',
      supported: false,
    }
  );
}

export function createUploadPolicy(): UploadPolicy {
  return {
    maxRawUploadBytes: MAX_RAW_UPLOAD_BYTES,
    clientChunkBytes: CLIENT_CHUNK_BYTES,
    singleObjectMaxBytes: SINGLE_OBJECT_MAX_BYTES,
    segmentPartMaxBytes: SEGMENT_PART_MAX_BYTES,
    segmentMaxDurationMs: SEGMENT_MAX_DURATION_MS,
    storageContentType: STORAGE_CONTENT_TYPE,
    storageExtension: STORAGE_EXTENSION,
    supportedMimeTypes: Object.keys(MIME_ALIASES),
  };
}

export function validateRawUploadSize(sizeBytes: number): UploadPolicyOk | UploadPolicyError {
  if (Number(sizeBytes) > MAX_RAW_UPLOAD_BYTES) {
    return {
      ok: false,
      status: 413,
      code: 'audio_too_large',
      message: 'Plik audio przekracza limit 200 MB.',
    };
  }
  return { ok: true };
}

export function validateAudioMimeType(contentType: string | null | undefined) {
  const normalized = normalizeAudioMimeType(contentType);
  if (!normalized.supported) {
    return {
      ok: false as const,
      status: 415 as const,
      code: 'unsupported_audio_type' as const,
      message: 'Ten format audio nie jest obslugiwany.',
      normalized,
    };
  }
  return { ok: true as const, normalized };
}

export function shouldUseSegmentedStorage(normalizedSizeBytes: number): boolean {
  return Number(normalizedSizeBytes || 0) > SINGLE_OBJECT_MAX_BYTES;
}

export function sanitizeStoragePathSegment(value: string): string {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function buildMediaObjectPrefix(workspaceId: string, recordingId: string): string {
  const safeWorkspaceId = sanitizeStoragePathSegment(workspaceId);
  const safeRecordingId = sanitizeStoragePathSegment(recordingId);
  if (!safeWorkspaceId || !safeRecordingId) {
    throw new Error('Missing workspaceId or recordingId for storage path.');
  }
  return `${safeWorkspaceId}/${safeRecordingId}`;
}

export function buildSingleStoragePath(workspaceId: string, recordingId: string): string {
  return `${buildMediaObjectPrefix(workspaceId, recordingId)}/audio${STORAGE_EXTENSION}`;
}

export function buildManifestStoragePath(workspaceId: string, recordingId: string): string {
  return `${buildMediaObjectPrefix(workspaceId, recordingId)}/manifest.json`;
}

export function buildPartStoragePath(
  workspaceId: string,
  recordingId: string,
  index: number
): string {
  return `${buildMediaObjectPrefix(workspaceId, recordingId)}/part-${String(index).padStart(3, '0')}${STORAGE_EXTENSION}`;
}

export function buildPartTranscriptPath(
  workspaceId: string,
  recordingId: string,
  index: number
): string {
  return `${buildMediaObjectPrefix(workspaceId, recordingId)}/transcripts/part-${String(index).padStart(3, '0')}.json`;
}

export function normalizePartTranscriptionCheckpoint(
  part: Partial<MediaManifestPart>
): MediaPartTranscriptionCheckpoint {
  const raw = (part.transcription || {}) as Partial<MediaPartTranscriptionCheckpoint>;
  const legacyStatus =
    part.status === 'queued' || part.status === 'low-confidence' ? 'pending' : part.status;
  const status = ['pending', 'processing', 'completed', 'failed', 'review'].includes(
    String(raw.status || legacyStatus || '')
  )
    ? ((raw.status || legacyStatus) as MediaPartTranscriptionStatus)
    : 'pending';
  return {
    ...raw,
    status,
    attempts: Math.max(0, Number(raw.attempts || 0)),
  };
}

export function buildSegmentedMediaManifest(input: {
  recordingId: string;
  workspaceId: string;
  sourceSizeBytes: number;
  normalizedSizeBytes: number;
  durationMs: number;
  parts: MediaManifestPart[];
}): MediaManifest {
  const parts = input.parts.map((part, index) => ({
    ...part,
    index: typeof part.index === 'number' ? part.index : index,
    contentType: part.contentType || STORAGE_CONTENT_TYPE,
    transcription: normalizePartTranscriptionCheckpoint(part),
  }));
  const oversizedPart = parts.find((part) => Number(part.sizeBytes || 0) > SEGMENT_PART_MAX_BYTES);
  if (oversizedPart) {
    throw new Error(`Segment ${oversizedPart.index} exceeds the 20 MB storage policy.`);
  }

  return {
    version: 1,
    storageMode: 'segmented',
    recordingId: input.recordingId,
    workspaceId: input.workspaceId,
    sourceSizeBytes: input.sourceSizeBytes,
    normalizedSizeBytes: input.normalizedSizeBytes,
    durationMs: input.durationMs,
    contentType: STORAGE_CONTENT_TYPE,
    parts,
  };
}

export function updateManifestPartTranscription(
  manifest: MediaManifest,
  partIndex: number,
  patch: Partial<MediaPartTranscriptionCheckpoint>
): MediaManifest {
  return {
    ...manifest,
    parts: manifest.parts.map((part) => {
      if (part.index !== partIndex) return part;
      const current = normalizePartTranscriptionCheckpoint(part);
      return {
        ...part,
        transcription: {
          ...current,
          ...patch,
          status: (patch.status || current.status || 'pending') as MediaPartTranscriptionStatus,
        },
      };
    }),
  };
}

export function getManifestPartProgress(manifest: MediaManifest | null | undefined) {
  const parts = Array.isArray(manifest?.parts) ? manifest.parts : [];
  if (!parts.length) return null;
  let completed = 0;
  let failed = 0;
  let processingIndex: number | null = null;
  for (const part of parts) {
    const checkpoint = normalizePartTranscriptionCheckpoint(part);
    if (checkpoint.status === 'completed') completed += 1;
    if (checkpoint.status === 'failed') failed += 1;
    if (checkpoint.status === 'processing' && processingIndex === null) {
      processingIndex = part.index;
    }
  }
  return {
    total: parts.length,
    completed,
    failed,
    processingIndex,
  };
}

export function parseMediaManifest(value: unknown): MediaManifest | null {
  if (!value) return null;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.version === 1 &&
      parsed.storageMode === 'segmented' &&
      Array.isArray(parsed.parts)
    ) {
      return parsed as MediaManifest;
    }
  } catch (_) {
    return null;
  }
  return null;
}
