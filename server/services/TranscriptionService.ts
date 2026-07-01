import { EventEmitter } from 'node:events';
import { config } from '../config.ts';
import {
  getManifestPartProgress,
  normalizePartTranscriptionCheckpoint,
  parseMediaManifest,
} from '../lib/mediaStoragePolicy.ts';
import { requireVoiceProfileEmbedding } from '../lib/voiceProfileEmbedding.ts';

const VOICE_PROFILE_EMBEDDING_MODEL = 'voice-profile-embedding';
const VOICE_PROFILE_EMBEDDING_VERSION = '1';
const VOICE_PROFILE_TRANSCRIPT_SOURCE = 'transcript_speaker';

type VoiceProfileEnrollmentCode =
  | 'speaker_segment_not_found'
  | 'audio_source_unavailable'
  | 'clip_extraction_failed'
  | 'embedding_failed'
  | 'profile_save_failed';

type VoiceProfileEnrollmentStage =
  | 'transcript'
  | 'audio_source'
  | 'clip_extraction'
  | 'embedding'
  | 'profile_save';

function voiceProfileError(
  code: VoiceProfileEnrollmentCode,
  message: string,
  stage: VoiceProfileEnrollmentStage,
  statusCode: number,
  cause?: unknown
) {
  const error = new Error(message) as Error & {
    code: VoiceProfileEnrollmentCode;
    stage: VoiceProfileEnrollmentStage;
    statusCode: number;
    cause?: unknown;
  };
  error.code = code;
  error.stage = stage;
  error.statusCode = statusCode;
  if (cause !== undefined) error.cause = cause;
  return error;
}

function readVoiceProfileSegmentTime(segment: any, secondKeys: string[], msKeys: string[] = []) {
  for (const key of secondKeys) {
    const value = Number(segment?.[key]);
    if (Number.isFinite(value)) return value;
  }
  for (const key of msKeys) {
    const value = Number(segment?.[key]);
    if (Number.isFinite(value)) return value / 1000;
  }
  return NaN;
}

function inferVoiceProfileSegmentEnd(segments: any[], index: number, start: number, text: string) {
  const segment = segments[index];
  const explicitEnd = readVoiceProfileSegmentTime(
    segment,
    ['endTimestamp', 'end', 'endTime', 'endSeconds', 'stop'],
    ['endMs', 'end_ms']
  );
  if (Number.isFinite(explicitEnd) && explicitEnd > start) return explicitEnd;

  for (let nextIndex = index + 1; nextIndex < segments.length; nextIndex += 1) {
    const nextStart = readVoiceProfileSegmentTime(
      segments[nextIndex],
      ['timestamp', 'start', 'startTime', 'startTimestamp', 'startSeconds', 'time', 'offset'],
      ['startMs', 'start_ms']
    );
    if (Number.isFinite(nextStart) && nextStart > start) return nextStart;
  }

  return start + Math.min(15, Math.max(2, String(text || '').length / 14));
}

function normalizeVoiceProfileSegments(segments: any[]) {
  if (!Array.isArray(segments)) return [];
  return segments
    .map((segment, index) => {
      if (!segment) return null;
      const speakerId = String(segment?.speakerId ?? '').trim();
      const text = String(segment?.text || '').trim();
      if (!speakerId || !text) return null;

      const timestamp = readVoiceProfileSegmentTime(
        segment,
        ['timestamp', 'start', 'startTime', 'startTimestamp', 'startSeconds', 'time', 'offset'],
        ['startMs', 'start_ms']
      );
      const endTimestamp = inferVoiceProfileSegmentEnd(segments, index, timestamp, text);
      if (!Number.isFinite(timestamp) || !Number.isFinite(endTimestamp)) return null;
      if (timestamp < 0 || endTimestamp <= timestamp) return null;

      return {
        ...segment,
        speakerId,
        text,
        timestamp,
        endTimestamp,
      };
    })
    .filter(Boolean);
}

function parseVoiceProfileTranscriptSegments(value: unknown) {
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
  } catch (_) {}
  return [];
}

function classifyClipExtractionError(error: any) {
  const message = String(error?.message || '');
  const lower = message.toLowerCase();
  if (
    lower.includes('segment') ||
    lower.includes('znacznik') ||
    lower.includes('timestamp') ||
    lower.includes('valid segments')
  ) {
    return voiceProfileError(
      'speaker_segment_not_found',
      'Nie znaleziono poprawnego fragmentu wypowiedzi dla tej osoby.',
      'transcript',
      422,
      error
    );
  }
  if (
    lower.includes('pobrac') ||
    lower.includes('audio') ||
    lower.includes('plik') ||
    lower.includes('sciezk') ||
    lower.includes('storage')
  ) {
    return voiceProfileError(
      'audio_source_unavailable',
      'Audio nie jest dostepne na serwerze. Zaimportuj nagranie ponownie.',
      'audio_source',
      424,
      error
    );
  }
  return voiceProfileError(
    'clip_extraction_failed',
    'Nie udalo sie wyciac probki glosu z nagrania.',
    'clip_extraction',
    502,
    error
  );
}

function buildFailureDiagnostics(error: any) {
  const diagnostics =
    error?.transcriptionDiagnostics && typeof error.transcriptionDiagnostics === 'object'
      ? { ...error.transcriptionDiagnostics }
      : {};
  const errorCode = String(error?.errorCode || error?.code || diagnostics.errorCode || '').trim();
  if (errorCode) diagnostics.errorCode = errorCode;
  if (typeof error?.retryable === 'boolean') diagnostics.retryable = error.retryable;
  if (Number.isFinite(Number(error?.retryAfterMs)) && Number(error.retryAfterMs) > 0) {
    diagnostics.retryAfterMs = Number(error.retryAfterMs);
  }
  if (Array.isArray(error?.sttAttempts) && !Array.isArray(diagnostics.sttAttempts)) {
    diagnostics.sttAttempts = error.sttAttempts;
  }
  if (error?.audioValidation && typeof error.audioValidation === 'object') {
    diagnostics.audioValidation = error.audioValidation;
  }
  return Object.keys(diagnostics).length ? diagnostics : null;
}

// LangChain Document and RagVectorStore loaded lazily to reduce startup memory
let _Document: any = null;
let _RagVectorStore: any = null;
async function getDocument() {
  if (!_Document) {
    const mod = await import('@langchain/core/documents');
    _Document = mod.Document;
  }
  return _Document;
}
async function getRagVectorStore() {
  if (!_RagVectorStore) {
    const mod = await import('../lib/ragVectorStore.ts');
    _RagVectorStore = mod.RagVectorStore;
  }
  return _RagVectorStore;
}

export default class TranscriptionService extends EventEmitter {
  db: any;
  workspaceService: any;
  audioPipeline: any;
  speakerEmbedder: any;
  transcriptionJobs: Map<string, Promise<void>>;
  private _jobStartTimes: Map<string, number>;
  private _staleJobTimer: ReturnType<typeof setInterval> | null;
  private _durableWorkerTimer: ReturnType<typeof setInterval> | null = null;
  private _durableJobHeartbeats: Map<string, ReturnType<typeof setInterval>>;
  private _durableJobContext: Map<string, { asset: any; options: any }>;
  private _durableWorkerRunning = false;
  private _pendingQueue: Array<{ recordingId: string; asset: any; options: any }> = [];
  private readonly workerId: string;

  constructor(db: any, workspaceService: any, audioPipeline: any, speakerEmbedder: any) {
    super();
    this.db = db;
    this.workspaceService = workspaceService;
    this.audioPipeline = audioPipeline;
    this.speakerEmbedder = speakerEmbedder;
    this.transcriptionJobs = new Map();
    this._jobStartTimes = new Map();
    this._durableJobHeartbeats = new Map();
    this._durableJobContext = new Map();
    this._staleJobTimer = null;
    this.workerId = `transcription-worker-${process.pid}-${Math.random().toString(36).slice(2)}`;
    this._startStaleJobSweep();
    this._startDurableWorkerLoop();
  }

  private _startStaleJobSweep() {
    const MAX_JOB_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours
    this._staleJobTimer = setInterval(
      () => {
        const now = Date.now();
        for (const [id, startedAt] of this._jobStartTimes) {
          if (now - startedAt > MAX_JOB_AGE_MS) {
            this.transcriptionJobs.delete(id);
            this._jobStartTimes.delete(id);
          }
        }
      },
      10 * 60 * 1000
    ); // every 10 minutes
    if (this._staleJobTimer.unref) this._staleJobTimer.unref();
  }

  private _supportsDurableQueue() {
    return typeof this.db.acquireTranscriptionJobLease === 'function';
  }

  private _startDurableWorkerLoop() {
    if (!this._supportsDurableQueue()) return;
    this._durableWorkerTimer = setInterval(() => {
      this._processDurableQueueOnce().catch((error: any) => {
        console.error('[Pipeline] Durable worker tick failed:', error?.message || error);
      });
    }, 5000);
    if (this._durableWorkerTimer.unref) this._durableWorkerTimer.unref();
  }

  get pipeline() {
    if (this.audioPipeline && typeof this.audioPipeline.transcribeRecording === 'function') {
      return this.audioPipeline;
    }

    if (this.audioPipeline && Object.keys(this.audioPipeline).length === 0) {
      console.warn(
        '[TranscriptionService] audioPipeline looks like an empty object (circular dep?).'
      );
    }

    if (!this.audioPipeline) {
      throw new Error(
        'Critical: TranscriptionService.audioPipeline is null or undefined. Check bootstrap injection.'
      );
    }

    if (typeof this.audioPipeline.transcribeRecording !== 'function') {
      throw new Error(
        `Critical: TranscriptionService.audioPipeline is missing 'transcribeRecording'. Found: ${typeof this.audioPipeline.transcribeRecording}`
      );
    }

    return this.audioPipeline;
  }

  async upsertMediaAsset(data: any) {
    return await this.db.upsertMediaAsset(data);
  }

  async upsertMediaAssetFromPath(data: any) {
    if (typeof this.db.upsertMediaAssetFromPath === 'function') {
      return await this.db.upsertMediaAssetFromPath(data);
    }

    const fs = await import('node:fs/promises');
    return await this.db.upsertMediaAsset({
      ...data,
      buffer: await fs.readFile(data.filePath),
    });
  }

  async upsertMediaAssetFromPreparedAudio(data: any) {
    if (typeof this.db.upsertMediaAssetFromPreparedAudio === 'function') {
      return await this.db.upsertMediaAssetFromPreparedAudio(data);
    }
    return await this.upsertMediaAssetFromPath({
      ...data,
      filePath: data.normalizedFilePath,
      contentType: data.contentType || 'audio/webm',
    });
  }

  async getMediaAsset(recordingId: string) {
    return await this.db.getMediaAsset(recordingId);
  }

  async deleteMediaAsset(
    recordingId: string,
    workspaceId: string,
    options?: { actorUserId?: string; source?: string; requestId?: string }
  ) {
    return await this.db.deleteMediaAsset(recordingId, workspaceId, options);
  }

  async saveAudioQualityDiagnostics(recordingId: string, audioQuality: any) {
    return await this.db.saveAudioQualityDiagnostics(recordingId, audioQuality);
  }

  async updateTranscriptionMetadata(recordingId: string, updates: Record<string, unknown>) {
    if (typeof this.db.updateTranscriptionMetadata !== 'function') {
      return null;
    }
    return await this.db.updateTranscriptionMetadata(recordingId, updates);
  }

  async queueTranscription(recordingId: string, updates: any) {
    return await this.db.queueTranscription(recordingId, updates);
  }

  async startTranscriptionPipeline(recordingId: string, asset: any, options: any) {
    await this.queueTranscription(recordingId, options);
    await this.ensureTranscriptionJob(recordingId, asset, options);
    return await this.getMediaAsset(recordingId);
  }

  async markTranscriptionProcessing(recordingId: string) {
    return await this.db.markTranscriptionProcessing(recordingId);
  }

  isTranscriptionJobActive(recordingId: string) {
    return this.getTranscriptionRuntimeStatus(recordingId).activeJob;
  }

  getTranscriptionRuntimeStatus(recordingId: string) {
    const emptyStatus = {
      activeJob: false,
      queuedPosition: null as number | null,
      processingAgeMs: null as number | null,
      retryAfterMs: null as number | null,
    };
    if (!recordingId) return emptyStatus;

    const queuedIndex = this._pendingQueue.findIndex((item) => item.recordingId === recordingId);
    if (queuedIndex >= 0) {
      return {
        activeJob: true,
        queuedPosition: queuedIndex + 1,
        processingAgeMs: null,
        retryAfterMs: 60_000,
      };
    }

    if (this.transcriptionJobs.has(recordingId)) {
      const startedAt = this._jobStartTimes.get(recordingId);
      return {
        activeJob: true,
        queuedPosition: null,
        processingAgeMs: typeof startedAt === 'number' ? Math.max(0, Date.now() - startedAt) : null,
        retryAfterMs: 60_000,
      };
    }

    return emptyStatus;
  }

  async saveTranscriptionResult(recordingId: string, result: any) {
    return await this.db.saveTranscriptionResult(recordingId, result);
  }

  private _offsetSegments(segments: any[], offsetMs: number) {
    const offsetSeconds = Number(offsetMs || 0) / 1000;
    return (Array.isArray(segments) ? segments : []).map((segment) => {
      const next = { ...segment };
      for (const key of ['timestamp', 'start', 'end']) {
        if (typeof next[key] === 'number') next[key] += offsetSeconds;
      }
      if (typeof next.startMs === 'number') next.startMs += offsetMs;
      if (typeof next.endMs === 'number') next.endMs += offsetMs;
      return next;
    });
  }

  private _mergeSegmentedResults(
    partResults: Array<{ part: any; result: any }>,
    failedParts: number
  ) {
    const segments = partResults.flatMap(({ part, result }) =>
      this._offsetSegments(result?.segments || [], Number(part.startMs || 0))
    );
    const speakerNames = partResults.reduce((acc: Record<string, string>, { result }) => {
      const names = result?.diarization?.speakerNames || {};
      for (const [key, value] of Object.entries(names)) acc[key] = String(value);
      return acc;
    }, {});
    const confidences = partResults
      .map(({ result }) => Number(result?.diarization?.confidence))
      .filter((value) => Number.isFinite(value));
    const confidence = confidences.length
      ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
      : 0;
    const profileLabelingParts = partResults
      .map(({ result }) => result?.transcriptionDiagnostics?.voiceProfileLabeling)
      .filter((value) => value && typeof value === 'object');
    const matchedSpeakerCount = profileLabelingParts.reduce(
      (sum, item) => sum + Number(item.matchedSpeakerCount || 0),
      0
    );
    const attemptedSpeakerCount = profileLabelingParts.reduce(
      (sum, item) => sum + Number(item.attemptedSpeakerCount || 0),
      0
    );
    const profileCount = profileLabelingParts.reduce(
      (max, item) => Math.max(max, Number(item.profileCount || 0)),
      0
    );
    const appliedPartCount = profileLabelingParts.filter((item) => Boolean(item.applied)).length;
    const skippedPartCount = profileLabelingParts.filter(
      (item) => item.reason === 'disabled_by_processing_mode'
    ).length;
    const profileLabelingReason =
      appliedPartCount > 0
        ? 'matched'
        : profileLabelingParts.length === 0
          ? 'not_attempted'
          : skippedPartCount === profileLabelingParts.length
            ? 'disabled_by_processing_mode'
            : profileLabelingParts.some((item) => item.reason === 'no_eligible_speaker_audio')
              ? 'no_eligible_speaker_audio'
              : profileLabelingParts.some((item) => item.reason === 'no_speakers')
                ? 'no_speakers'
                : profileLabelingParts.some((item) => item.reason === 'no_voice_profiles')
                  ? 'no_voice_profiles'
                  : 'no_match';
    const voiceProfileLabeling = {
      applied: appliedPartCount > 0,
      reason: profileLabelingReason,
      mode: 'segmented',
      profileCount,
      attemptedSpeakerCount,
      matchedSpeakerCount,
      partCount: partResults.length + failedParts,
      appliedPartCount,
    };
    return {
      segments,
      diarization: {
        speakerNames,
        speakerCount: Object.keys(speakerNames).length,
        confidence,
      },
      transcriptionDiagnostics: {
        segmentedStorage: true,
        partCount: partResults.length + failedParts,
        completedParts: partResults.length,
        failedParts,
        voiceProfileLabeling,
      },
    };
  }

  private async transcribeSegmentedAsset(
    recordingId: string,
    asset: any,
    manifest: any,
    sharedOptions: any
  ) {
    const sortedParts = [...(manifest.parts || [])].sort((a, b) => a.index - b.index);
    const partResults: Array<{ part: any; result: any }> = [];
    let failedParts = 0;

    for (const part of sortedParts) {
      const checkpoint = normalizePartTranscriptionCheckpoint(part);
      if (checkpoint.status === 'completed' && checkpoint.payloadPath) {
        const savedPayload =
          typeof this.db.loadMediaPartTranscript === 'function'
            ? await this.db.loadMediaPartTranscript(recordingId, part.index)
            : null;
        if (savedPayload) {
          partResults.push({ part, result: savedPayload });
          continue;
        }
      }

      const attempts = Number(checkpoint.attempts || 0) + 1;
      if (typeof this.db.markMediaPartTranscription === 'function') {
        await this.db.markMediaPartTranscription(recordingId, part.index, {
          status: 'processing',
          attempts,
          startedAt: new Date().toISOString(),
          errorCode: '',
        });
      }
      this.emit(`progress-${recordingId}`, {
        progress: Math.min(
          95,
          35 + Math.round((part.index / Math.max(1, sortedParts.length)) * 55)
        ),
        message: `Transkrypcja czesci ${part.index + 1}/${sortedParts.length}`,
        partProgress: {
          ...(getManifestPartProgress(manifest) || {
            total: sortedParts.length,
            completed: partResults.length,
            failed: failedParts,
          }),
          processingIndex: part.index,
        },
      });

      try {
        const partAsset = {
          ...asset,
          file_path: part.path,
          content_type: part.contentType || asset.content_type || 'audio/webm',
          storage_mode: 'single',
          media_manifest_json: '{}',
          size_bytes: part.sizeBytes || asset.size_bytes || 0,
        };
        const result = await this.pipeline.transcribeRecording(partAsset, {
          ...sharedOptions,
          segmentedPart: part,
          skipEarlyPyannote: true,
          skipVoiceProfileMatch: true,
        });
        if (typeof this.db.saveMediaPartTranscript === 'function') {
          await this.db.saveMediaPartTranscript(recordingId, part.index, result, {
            status: 'completed',
            attempts,
            provider:
              result?.transcriptionDiagnostics?.sttProviderInfo?.providerId ||
              result?.transcriptionDiagnostics?.sttProviderInfo?.provider ||
              '',
            model: result?.transcriptionDiagnostics?.sttProviderInfo?.model || '',
          });
        }
        partResults.push({ part, result });
      } catch (error: any) {
        failedParts += 1;
        if (typeof this.db.markMediaPartTranscription === 'function') {
          await this.db.markMediaPartTranscription(recordingId, part.index, {
            status: 'failed',
            attempts,
            errorCode: error?.code || 'stt_part_failed',
            completedAt: new Date().toISOString(),
          });
        }
      }
    }

    if (!partResults.length) {
      throw new Error('Transkrypcja STT nie powiodla sie dla zadnej czesci audio.');
    }
    return this._mergeSegmentedResults(partResults, failedParts);
  }

  async markTranscriptionFailure(
    recordingId: string,
    errorMessage: string,
    transcriptionDiagnostics: any = null,
    audioQuality: any = null
  ) {
    return await this.db.markTranscriptionFailure(
      recordingId,
      errorMessage,
      transcriptionDiagnostics,
      audioQuality
    );
  }

  static MAX_CONCURRENT_JOBS = 1;
  static RSS_LIMIT_BYTES = 1_200_000_000; // 1.2 GB — reject new jobs above this to prevent OOM kills

  async ensureTranscriptionJob(recordingId: string, asset: any, options: any) {
    if (!recordingId || this.transcriptionJobs.has(recordingId)) {
      return;
    }

    const durableJob =
      typeof this.db.enqueueTranscriptionJob === 'function'
        ? await this.db.enqueueTranscriptionJob({
            recordingId,
            workspaceId: asset.workspace_id,
            meetingId: asset.meeting_id || '',
          })
        : null;
    if (durableJob) {
      this._durableJobContext.set(recordingId, { asset, options });
    }

    const rss = process.memoryUsage().rss;
    const atCapacity = this.transcriptionJobs.size >= TranscriptionService.MAX_CONCURRENT_JOBS;
    const memoryPressure = rss > TranscriptionService.RSS_LIMIT_BYTES;

    if (atCapacity || memoryPressure) {
      const reason = memoryPressure
        ? `RSS ${(rss / 1024 / 1024).toFixed(0)}MB exceeds limit`
        : `${this.transcriptionJobs.size} concurrent jobs (max ${TranscriptionService.MAX_CONCURRENT_JOBS})`;
      if (durableJob) {
        console.log(`[Pipeline] Durable job ${recordingId} remains queued (${reason}).`);
        if (memoryPressure && typeof global.gc === 'function') global.gc();
        return;
      }
      // Avoid duplicate queue entries for legacy/non-durable test doubles.
      if (!this._pendingQueue.some((item) => item.recordingId === recordingId)) {
        this._pendingQueue.push({ recordingId, asset, options });
        console.log(
          `[Pipeline] Queued job ${recordingId} (${reason}). Queue size: ${this._pendingQueue.length}`
        );
      }
      await this.queueTranscription(recordingId, options);
      if (memoryPressure && typeof global.gc === 'function') global.gc();
      return;
    }

    if (durableJob) {
      await this._processDurableQueueOnce({ recordingId });
      return;
    }

    this._startTranscriptionJob(recordingId, asset, options, null);
  }

  private _buildOptionsForDurableJob(job: any, asset: any, cachedOptions: any = {}) {
    return {
      workspaceId: job?.workspace_id || asset?.workspace_id || cachedOptions?.workspaceId,
      meetingId: job?.meeting_id || asset?.meeting_id || cachedOptions?.meetingId || '',
      contentType: asset?.content_type || cachedOptions?.contentType,
      ...cachedOptions,
    };
  }

  async _processDurableQueueOnce(filter: { recordingId?: string } = {}) {
    if (!this._supportsDurableQueue()) return false;
    if (this._durableWorkerRunning) return false;
    if (this.transcriptionJobs.size >= TranscriptionService.MAX_CONCURRENT_JOBS) return false;

    const rss = process.memoryUsage().rss;
    if (rss > TranscriptionService.RSS_LIMIT_BYTES) {
      if (typeof global.gc === 'function') global.gc();
      return false;
    }

    this._durableWorkerRunning = true;
    try {
      const leasedJob = await this.db.acquireTranscriptionJobLease({
        workerId: this.workerId,
        recordingId: filter.recordingId || '',
      });
      if (!leasedJob) return false;

      const recordingId = leasedJob.recording_id || filter.recordingId;
      if (!recordingId || this.transcriptionJobs.has(recordingId)) {
        if (typeof this.db.releaseTranscriptionJobLock === 'function') {
          await this.db.releaseTranscriptionJobLock(leasedJob.id, this.workerId);
        }
        return false;
      }

      const cached = this._durableJobContext.get(recordingId);
      const asset =
        cached?.asset ||
        (typeof this.db.getMediaAsset === 'function'
          ? await this.db.getMediaAsset(recordingId)
          : null);
      if (!asset) {
        if (typeof this.db.failTranscriptionJob === 'function') {
          await this.db.failTranscriptionJob(
            leasedJob.id,
            this.workerId,
            Object.assign(new Error('Media asset missing for durable transcription job.'), {
              code: 'MEDIA_ASSET_MISSING',
            })
          );
        }
        return false;
      }

      const options = this._buildOptionsForDurableJob(leasedJob, asset, cached?.options || {});
      this._startTranscriptionJob(recordingId, asset, options, leasedJob);
      return true;
    } finally {
      this._durableWorkerRunning = false;
    }
  }

  private _startDurableJobHeartbeat(job: any) {
    if (!job?.id || typeof this.db.heartbeatTranscriptionJob !== 'function') return;
    if (this._durableJobHeartbeats.has(job.id)) return;
    const timer = setInterval(() => {
      this.db.heartbeatTranscriptionJob(job.id, this.workerId).catch((error: any) => {
        console.warn('[Pipeline] Durable job heartbeat failed:', error?.message || error);
      });
    }, 60_000);
    if (timer.unref) timer.unref();
    this._durableJobHeartbeats.set(job.id, timer);
  }

  private _stopDurableJobHeartbeat(job: any) {
    if (!job?.id) return;
    const timer = this._durableJobHeartbeats.get(job.id);
    if (timer) clearInterval(timer);
    this._durableJobHeartbeats.delete(job.id);
  }

  private _startTranscriptionJob(recordingId: string, asset: any, options: any, activeJob: any) {
    if (!recordingId || this.transcriptionJobs.has(recordingId)) return;
    if (activeJob) this._startDurableJobHeartbeat(activeJob);

    const jobPromise = Promise.resolve()
      .then(async () => {
        const startSTT = performance.now();
        const reqId = options.requestId || 'internal-stt';
        const { logger } = await import('../logger.ts');
        const processingMode =
          options.processingMode === 'full' || options.processingMode === 'fast'
            ? options.processingMode
            : config.VOICELOG_PROCESSING_MODE_DEFAULT;
        // Disabled: runEnhancementPostProcess re-runs the ENTIRE pipeline with full mode
        // (re-downloads audio, re-preprocesses, re-transcribes with expensive model).
        // This doubles processing time and cost. Users can request 'full' mode explicitly.
        const shouldRunPostprocess = false;
        let localSourcePath = '';
        let cleanupLocalSource = async () => {};

        logger.info('[Pipeline] Starting transcription job.', {
          requestId: reqId,
          recordingId,
          processingMode,
        });

        const markProcessingPromise = this.markTranscriptionProcessing(recordingId);
        const [wsState, memberNames, voiceProfiles] = await Promise.all([
          this.db.getWorkspaceState(asset.workspace_id),
          this.workspaceService.getWorkspaceMemberNames(asset.workspace_id),
          this.db.getWorkspaceVoiceProfiles(asset.workspace_id),
        ]);
        await markProcessingPromise;

        const segmentedManifest =
          asset.storage_mode === 'segmented' ? parseMediaManifest(asset.media_manifest_json) : null;

        if (!segmentedManifest && typeof this.pipeline.materializeAssetToLocal === 'function') {
          const materialized = await this.pipeline.materializeAssetToLocal(asset, {
            signal: options.signal,
          });
          localSourcePath = materialized?.localPath || '';
          cleanupLocalSource =
            typeof materialized?.cleanup === 'function' ? materialized.cleanup : cleanupLocalSource;
        }

        const sharedOptions = {
          ...options,
          processingMode,
          localSourcePath,
          participants: [...(options.participants || []), ...memberNames],
          vocabulary: [
            ...(options.vocabulary ? [options.vocabulary] : []),
            ...(wsState.vocabulary || []),
          ].join(', '),
          voiceProfiles,
          onProgress: (payload: any) => {
            this.emit(`progress-${recordingId}`, payload);
          },
        };

        const result = segmentedManifest
          ? await this.transcribeSegmentedAsset(
              recordingId,
              asset,
              segmentedManifest,
              sharedOptions
            )
          : await this.pipeline.transcribeRecording(asset, {
              ...sharedOptions,
              skipEarlyPyannote: processingMode !== 'full',
              skipChunkVAD: processingMode !== 'full' || !config.VOICELOG_ENABLE_CHUNK_VAD,
              skipVoiceProfileMatch: processingMode !== 'full',
            });

        const isEmptyTranscript = result?.transcriptOutcome === 'empty';
        this.emit(`progress-${recordingId}`, {
          progress: 100,
          enhancementsPending: Boolean(result?.enhancementsPending),
          postprocessStage: result?.postprocessStage || '',
          message: isEmptyTranscript
            ? result?.userMessage || 'Nie wykryto wypowiedzi w nagraniu.'
            : 'Trener wymowy gotowy! (Zakonczono)',
        });

        await this.saveTranscriptionResult(recordingId, {
          ...result,
          pipelineStatus: 'completed',
        });
        if (activeJob && typeof this.db.completeTranscriptionJob === 'function') {
          await this.db.completeTranscriptionJob(activeJob.id, this.workerId);
        }

        if (shouldRunPostprocess && !isEmptyTranscript && !segmentedManifest) {
          this.runEnhancementPostProcess(
            recordingId,
            asset,
            {
              ...sharedOptions,
              processingMode: 'full',
            },
            cleanupLocalSource
          ).catch((err: any) => {
            console.error('[Pipeline] Background post-process failed:', err?.message || err);
          });
        } else {
          await cleanupLocalSource();
        }

        logger.info('[Metrics] Pipeline completed successfully.', {
          requestId: reqId,
          recordingId,
          durationMs: (performance.now() - startSTT).toFixed(2),
          confidence: result.diarization?.confidence || 0,
        });

        if (!isEmptyTranscript && result.segments && result.segments.length > 0) {
          this.vectorizeTranscriptionResultToRAG(
            asset.workspace_id,
            recordingId,
            result.segments
          ).catch((err) => {
            console.error('[RAG] Background vectorization failed:', err);
          });
        }
      })
      .catch(async (error: any) => {
        try {
          const failureDiagnostics = buildFailureDiagnostics(error);
          const currentJob =
            activeJob ||
            (typeof this.db.getTranscriptionJobByRecordingId === 'function'
              ? await this.db.getTranscriptionJobByRecordingId(recordingId)
              : null);
          if (currentJob && typeof this.db.failTranscriptionJob === 'function') {
            await this.db.failTranscriptionJob(currentJob.id, this.workerId, error);
          }
          await this.markTranscriptionFailure(
            recordingId,
            error?.message || String(error || 'Unknown pipeline error'),
            failureDiagnostics,
            error?.audioQuality && typeof error.audioQuality === 'object'
              ? error.audioQuality
              : null
          );
        } catch (markError: any) {
          console.error(
            '[Pipeline] Failed to mark transcription failure:',
            markError?.message || markError
          );
        }
      })
      .finally(() => {
        this._stopDurableJobHeartbeat(activeJob);
        this.transcriptionJobs.delete(recordingId);
        this._jobStartTimes.delete(recordingId);
        this._durableJobContext.delete(recordingId);
        // Trigger GC to release native memory held by ffmpeg/audio buffers
        if (typeof global.gc === 'function') global.gc();
        // Drain next queued job
        this._drainQueue();
        this._processDurableQueueOnce().catch((err: any) => {
          console.error('[Pipeline] Failed to drain durable queue:', err?.message || err);
        });
      });

    this.transcriptionJobs.set(recordingId, jobPromise);
    this._jobStartTimes.set(recordingId, Date.now());
  }

  private _drainQueue() {
    if (this._pendingQueue.length === 0) return;
    if (this.transcriptionJobs.size >= TranscriptionService.MAX_CONCURRENT_JOBS) return;
    const rss = process.memoryUsage().rss;
    if (rss > TranscriptionService.RSS_LIMIT_BYTES) {
      console.log(
        `[Pipeline] Queue drain deferred: RSS ${(rss / 1024 / 1024).toFixed(0)}MB still above limit. ${this._pendingQueue.length} jobs waiting.`
      );
      if (typeof global.gc === 'function') global.gc();
      setTimeout(() => this._drainQueue(), 5000);
      return;
    }
    const next = this._pendingQueue.shift()!;
    console.log(
      `[Pipeline] Draining queued job ${next.recordingId}. Remaining: ${this._pendingQueue.length}`
    );
    this.ensureTranscriptionJob(next.recordingId, next.asset, next.options).catch((err) => {
      console.error(`[Pipeline] Failed to start queued job ${next.recordingId}:`, err?.message);
    });
  }

  async runEnhancementPostProcess(
    recordingId: string,
    asset: any,
    options: any,
    cleanupLocalSource: () => Promise<void>
  ) {
    const reqId = options.requestId || 'internal-stt';
    const { logger } = await import('../logger.ts');

    try {
      await this.updateTranscriptionMetadata(recordingId, {
        enhancementsPending: true,
        postprocessStage: 'running',
      });
      this.emit(`progress-${recordingId}`, {
        progress: 100,
        enhancementsPending: true,
        postprocessStage: 'running',
        message: 'Trwa dopinanie diarization i dopasowania glosow...',
      });

      const fullResult = await this.pipeline.transcribeRecording(asset, {
        ...options,
        processingMode: 'full',
        skipEarlyPyannote: false,
        skipChunkVAD: !config.VOICELOG_ENABLE_CHUNK_VAD,
        skipVoiceProfileMatch: false,
      });

      await this.saveTranscriptionResult(recordingId, {
        ...fullResult,
        pipelineStatus: 'completed',
        enhancementsPending: false,
        postprocessStage: 'done',
      });

      this.emit(`progress-${recordingId}`, {
        progress: 100,
        enhancementsPending: false,
        postprocessStage: 'done',
        message: 'Dodatkowe przetwarzanie zakonczone.',
      });

      logger.info('[Pipeline] Background post-process completed.', {
        requestId: reqId,
        recordingId,
      });
    } catch (error: any) {
      await this.updateTranscriptionMetadata(recordingId, {
        enhancementsPending: false,
        postprocessStage: 'failed',
      });
      logger.warn('[Pipeline] Background post-process failed.', {
        requestId: reqId,
        recordingId,
        message: error?.message || String(error),
      });
    } finally {
      await cleanupLocalSource();
    }
  }

  async normalizeRecording(filePath: string, options = {}) {
    return this.pipeline.normalizeRecording(filePath, options);
  }

  async analyzeAudioQuality(filePath: string, options = {}) {
    if (typeof this.pipeline.analyzeAudioQuality !== 'function') {
      throw new Error('Audio pipeline nie wspiera analizy jakosci audio.');
    }
    return this.pipeline.analyzeAudioQuality(filePath, options);
  }

  async generateVoiceCoaching(asset: any, speakerId: string, segments: any[], options = {}) {
    return this.pipeline.generateVoiceCoaching(asset, speakerId, segments, options);
  }

  async getSpeakerAcousticFeatures(asset: any, options = {}) {
    if (typeof this.pipeline.analyzeAcousticFeatures !== 'function') {
      throw new Error('Audio pipeline nie wspiera metryk akustycznych.');
    }

    const fs = await import('node:fs/promises');

    let segments = [];
    let diarization = {};
    try {
      segments = JSON.parse(asset.transcript_json || '[]');
    } catch (_) {}
    try {
      diarization = JSON.parse(asset.diarization_json || '{}');
    } catch (_) {}
    if (!segments.length) throw new Error('Brak transkrypcji w bazie.');

    const speakerNames =
      typeof diarization === 'object' && diarization ? (diarization as any).speakerNames || {} : {};
    const uniqueSpeakerIds = [
      ...new Set(segments.map((segment: any) => String(segment?.speakerId ?? '')).filter(Boolean)),
    ];
    const speakers = new Array(uniqueSpeakerIds.length);
    const concurrency = Math.min(3, Math.max(1, uniqueSpeakerIds.length));
    let cursor = 0;

    const workers = Array.from({ length: concurrency }, async () => {
      while (cursor < uniqueSpeakerIds.length) {
        const index = cursor;
        cursor += 1;
        const speakerId = uniqueSpeakerIds[index];
        const clipPath = await this.pipeline.extractSpeakerAudioClip(
          asset,
          speakerId,
          segments,
          options
        );
        try {
          const metrics = await this.pipeline.analyzeAcousticFeatures(clipPath, options);
          speakers[index] = {
            speakerId,
            speakerName: String(
              speakerNames?.[speakerId] ||
                segments.find((segment: any) => String(segment?.speakerId ?? '') === speakerId)
                  ?.speakerName ||
                `Speaker ${Number(speakerId) + 1}`
            ),
            ...metrics,
          };
        } finally {
          try {
            await fs.unlink(clipPath);
          } catch (_) {}
        }
      }
    });

    await Promise.all(workers);
    return { speakers: speakers.filter(Boolean) };
  }

  async createVoiceProfileFromSpeaker(
    asset: any,
    speakerId: string,
    speakerName: string,
    userId: string,
    options = {}
  ) {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const crypto = await import('node:crypto');

    let segments = parseVoiceProfileTranscriptSegments(asset.transcript_json);
    if (
      Array.isArray((options as any)?.transcriptSegments) &&
      (options as any).transcriptSegments.length
    ) {
      segments = (options as any).transcriptSegments;
    }
    segments = normalizeVoiceProfileSegments(segments);
    if (!segments.length) {
      throw voiceProfileError(
        'speaker_segment_not_found',
        'Brak transkrypcji w bazie.',
        'transcript',
        422
      );
    }

    let clipPath: string;
    try {
      clipPath = await this.pipeline.extractSpeakerAudioClip(asset, speakerId, segments, options);
    } catch (error) {
      throw classifyClipExtractionError(error);
    }

    try {
      let embedding: number[] = [];
      try {
        embedding = requireVoiceProfileEmbedding(await this.computeEmbedding(clipPath));
      } catch (error) {
        throw voiceProfileError(
          'embedding_failed',
          'Nie udalo sie utworzyc profilu glosu. Sprobuj ponownie za chwile.',
          'embedding',
          503,
          error
        );
      }
      const profileId = `vp_${crypto.randomUUID().replace(/-/g, '')}`;
      const newPath = path.join(this.db.uploadDir, `${profileId}.wav`);

      fs.renameSync(clipPath, newPath);
      let profile;
      try {
        profile = await this.workspaceService.upsertVoiceProfile({
          id: profileId,
          userId,
          workspaceId: asset.workspace_id,
          speakerName,
          audioPath: newPath,
          embedding,
          source: VOICE_PROFILE_TRANSCRIPT_SOURCE,
          model: VOICE_PROFILE_EMBEDDING_MODEL,
          version: VOICE_PROFILE_EMBEDDING_VERSION,
          createdBy: userId,
        });
      } catch (error) {
        throw voiceProfileError(
          'profile_save_failed',
          'Nie udalo sie zapisac profilu glosu.',
          'profile_save',
          500,
          error
        );
      }
      return profile;
    } finally {
      try {
        fs.unlinkSync(clipPath);
      } catch (_) {}
    }
  }

  async diarizeFromTranscript(whisperLike: any[], options = {}) {
    return this.pipeline.diarizeFromTranscript(whisperLike, options);
  }

  async transcribeLiveChunk(tmpPath: string, contentType: string, options = {}) {
    return this.pipeline.transcribeLiveChunk(tmpPath, contentType, options);
  }

  async analyzeMeetingWithOpenAI(data: any) {
    return this.pipeline.analyzeMeetingWithOpenAI(data);
  }

  async computeEmbedding(audioPath: string) {
    if (!this.speakerEmbedder) {
      const { computeEmbedding } = await import('../speakerEmbedder.ts');
      this.speakerEmbedder = { computeEmbedding };
    }
    return this.speakerEmbedder.computeEmbedding(audioPath);
  }

  async vectorizeTranscriptionResultToRAG(
    workspaceId: string,
    recordingId: string,
    segments: any[]
  ) {
    if (!this.audioPipeline?.embedTextChunks) return;
    const crypto = await import('node:crypto');
    const Document = await getDocument();

    const chunks: any[] = [];
    for (let i = 0; i < segments.length; i += 3) {
      const slice = segments.slice(i, i + 3);
      if (!slice.length) continue;
      const text = slice.map((s) => s.text).join(' ');
      if (text.length < 15) continue;
      chunks.push(
        new Document({
          pageContent: text,
          metadata: {
            id: `rc_${crypto.randomUUID().replace(/-/g, '')}`,
            workspaceId,
            recordingId,
            recording_id: recordingId,
            speakerName: slice[0].speakerId || 'Nieznany',
            createdAt: new Date().toISOString(),
          },
        })
      );
    }

    if (!chunks.length) return;

    const RagVectorStore = await getRagVectorStore();
    const vectorStore = new RagVectorStore({
      workspaceId,
      db: this.db,
      embedTextChunks: this.audioPipeline.embedTextChunks.bind(this.audioPipeline),
    });
    await vectorStore.addDocuments(chunks);

    console.log(`[RAG] Pomyslnie zindeksowano ${chunks.length} wektorow na archiwum spotkania.`);
  }

  async queryRAG(workspaceId: string, question: string) {
    if (!this.audioPipeline?.embedTextChunks) return null;
    const RagVectorStore = await getRagVectorStore();
    const vectorStore = new RagVectorStore({
      workspaceId,
      db: this.db,
      embedTextChunks: this.audioPipeline.embedTextChunks.bind(this.audioPipeline),
    });

    const retriever = vectorStore.asRetriever({
      k: 15,
      tags: ['rag', 'retrieval'],
      metadata: { workspaceId, questionLength: question.length },
    });
    const docs = await retriever.invoke(question);
    if (!Array.isArray(docs) || docs.length === 0) return null;

    return docs.map((doc: any) => ({
      recording_id:
        doc.metadata?.recordingId || doc.metadata?.recording_id || doc.metadata?.id || '',
      speaker_name: doc.metadata?.speakerName || '',
      text: doc.pageContent || '',
      score: doc.metadata?.score || 0,
    }));
  }
}
