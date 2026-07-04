import { afterAll, afterEach, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const sentryMocks = vi.hoisted(() => ({
  addPipelineBreadcrumb: vi.fn(),
  capturePipelineException: vi.fn(),
}));

const tracingMocks = vi.hoisted(() => ({
  withAudioSpan: vi.fn((name: string, context: unknown, callback: () => unknown) => callback()),
  appendTraceContext: vi.fn((context: unknown) => context),
}));

vi.mock('../../sentry.ts', () => ({
  addPipelineBreadcrumb: sentryMocks.addPipelineBreadcrumb,
  capturePipelineException: sentryMocks.capturePipelineException,
}));

vi.mock('../../tracing.ts', () => ({
  withAudioSpan: tracingMocks.withAudioSpan,
  appendTraceContext: tracingMocks.appendTraceContext,
}));

import { createApp } from '../../app.ts';
import { MAX_RAW_UPLOAD_BYTES, buildSegmentedMediaManifest } from '../../lib/mediaStoragePolicy.ts';
import { createProgressToken, resetProgressTokensForTests } from '../../lib/progressTokens.ts';

// Helper to control fs mock state between tests
function setFsState(overrides?: { existsSync?: boolean; statSyncSize?: number }) {
  (global as any).__TEST_FS_STATE__ = {
    existsSync: overrides?.existsSync ?? true,
    statSyncSize: overrides?.statSyncSize ?? 1234,
  };
}

describe('Media Routes', () => {
  let app: ReturnType<typeof createApp>;
  let mockTranscriptionService: any;
  let mockWorkspaceService: any;
  let testUploadDir: string;

  beforeAll(async () => {
    testUploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'voicelog-media-routes-'));
  });

  afterAll(async () => {
    if (testUploadDir) {
      await fs.rm(testUploadDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Reset fs state to default
    setFsState();

    mockTranscriptionService = {
      upsertMediaAsset: vi.fn(),
      upsertMediaAssetFromPath: vi.fn(),
      analyzeAudioQuality: vi.fn(),
      saveAudioQualityDiagnostics: vi.fn(),
      getMediaAsset: vi.fn(),
      deleteMediaAsset: vi.fn(),
      queueTranscription: vi.fn(),
      ensureTranscriptionJob: vi.fn(),
      queryRAG: vi.fn(),
      normalizeRecording: vi.fn(),
      createVoiceProfileFromSpeaker: vi.fn(),
      generateVoiceCoaching: vi.fn(),
      getSpeakerAcousticFeatures: vi.fn(),
      saveTranscriptionResult: vi.fn(),
      markTranscriptionFailure: vi.fn(),
      writeAuditLog: vi.fn(),
      analyzeMeetingWithOpenAI: vi.fn(),
      isTranscriptionJobActive: vi.fn(() => false),
      getTranscriptionRuntimeStatus: vi.fn(() => ({
        activeJob: false,
        queuedPosition: null,
        processingAgeMs: null,
        retryAfterMs: null,
      })),
      diarizeFromTranscript: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    };
    mockWorkspaceService = {
      getMembership: vi.fn().mockResolvedValue({ member_role: 'owner' }),
    };

    const mockAuthService = {
      getSession: vi.fn().mockResolvedValue({ user_id: 'user_1', workspace_id: 'ws_1' }),
    };

    app = createApp({
      authService: mockAuthService,
      workspaceService: mockWorkspaceService,
      transcriptionService: mockTranscriptionService,
      config: {
        allowedOrigins: 'http://localhost:3000',
        trustProxy: false,
        uploadDir: testUploadDir,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    sentryMocks.addPipelineBreadcrumb.mockClear();
    sentryMocks.capturePipelineException.mockClear();
    tracingMocks.withAudioSpan.mockClear();
    tracingMocks.appendTraceContext.mockClear();
    // Reset fs state to default after each test
    setFsState();
  });

  it('PUT /media/recordings/:recordingId/audio - upload success', async () => {
    mockTranscriptionService.upsertMediaAssetFromPath.mockResolvedValue({
      id: 'rec_new',
      workspace_id: 'ws_1',
      size_bytes: 512,
    });
    mockTranscriptionService.analyzeAudioQuality.mockResolvedValue({
      qualityLabel: 'fair',
      enhancementRecommended: true,
    });

    const res = await app.request('/media/recordings/rec_new/audio', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer fake_token',
        'Content-Type': 'audio/webm',
        'X-Workspace-Id': 'ws_1',
      },
      body: Buffer.from('small-audio-data'),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe('rec_new');
    expect(data.audioQuality).toBeNull();
    expect(mockTranscriptionService.upsertMediaAssetFromPath).toHaveBeenCalledWith(
      expect.objectContaining({
        recordingId: 'rec_new',
        workspaceId: 'ws_1',
        contentType: 'audio/webm',
      })
    );
    expect(tracingMocks.withAudioSpan.mock.calls.map((call) => call[0])).toEqual(
      expect.arrayContaining([
        'audio.upload.receive',
        'audio.upload.validate',
        'audio.upload.store',
      ])
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockTranscriptionService.saveAudioQualityDiagnostics).toHaveBeenCalledWith('rec_new', {
      qualityLabel: 'fair',
      enhancementRecommended: true,
    });
  });

  // ---------------------------------------------------------------
  // Issue #1234 - duplicate raw upload should be idempotent
  // Date: 2026-06-28
  // Bug: retrying a raw upload for an existing recording wrote through
  //      storage again instead of returning the existing media asset.
  // Fix: recordingId is the natural idempotency key and repeat uploads
  //      return the current asset response without mutating storage.
  // ---------------------------------------------------------------
  it('PUT /media/recordings/:recordingId/audio - duplicate upload returns existing asset without reupload', async () => {
    mockTranscriptionService.getMediaAsset.mockResolvedValue({
      id: 'rec_existing_upload',
      workspace_id: 'ws_1',
      size_bytes: 777,
      storage_mode: 'single',
      source_size_bytes: 777,
      normalized_size_bytes: 777,
    });
    mockTranscriptionService.upsertMediaAssetFromPath.mockResolvedValue({
      id: 'rec_existing_upload',
      workspace_id: 'ws_1',
      size_bytes: 999,
    });

    const res = await app.request('/media/recordings/rec_existing_upload/audio', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer fake_token',
        'Content-Type': 'audio/webm',
        'X-Workspace-Id': 'ws_1',
        'Idempotency-Key': 'raw-upload-retry-1',
      },
      body: Buffer.from('duplicate-audio-data'),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      id: 'rec_existing_upload',
      workspaceId: 'ws_1',
      sizeBytes: 777,
      storageMode: 'single',
      sourceSizeBytes: 777,
      normalizedSizeBytes: 777,
      idempotent: true,
      idempotencyKey: 'raw-upload-retry-1',
      idempotencyScope: 'recordingId',
    });
    expect(mockTranscriptionService.upsertMediaAssetFromPath).not.toHaveBeenCalled();
    expect(mockTranscriptionService.analyzeAudioQuality).not.toHaveBeenCalled();
  });

  it('PUT /media/recordings/:recordingId/audio - returns 507 when disk is full', async () => {
    mockTranscriptionService.upsertMediaAssetFromPath.mockRejectedValue(
      Object.assign(new Error('Brak miejsca na dysku'), { code: 'ENOSPC' })
    );

    const res = await app.request('/media/recordings/rec_disk_full/audio', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer fake_token',
        'Content-Type': 'audio/webm',
        'X-Workspace-Id': 'ws_1',
      },
      body: Buffer.from('small-audio-data'),
    });

    expect(res.status).toBe(507);
    const data = await res.json();
    expect(data.message).toBe('Brak miejsca na dysku serwera. Skontaktuj sie z administratorem.');
    expect(mockTranscriptionService.upsertMediaAssetFromPath).toHaveBeenCalledTimes(1);
  });

  it('PUT /media/recordings/:recordingId/audio - streams upload through tempfile without heap preflight rejection', async () => {
    const serverUtils = await import('../../lib/serverUtils.ts');
    const memPressureSpy = vi.spyOn(serverUtils, 'getMemoryPressure').mockReturnValue({
      ok: false,
      heapUsedMB: 1500,
      heapTotalMB: 1700,
      rssMB: 3000,
      ratio: 0.95,
    });

    mockTranscriptionService.upsertMediaAssetFromPath.mockResolvedValue({
      id: 'rec_transient',
      workspace_id: 'ws_1',
      size_bytes: 120,
    });
    mockTranscriptionService.analyzeAudioQuality.mockResolvedValue({
      qualityLabel: 'fair',
      enhancementRecommended: true,
    });

    const streamed = await app.request('/media/recordings/rec_transient/audio', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer fake_token',
        'Content-Type': 'audio/webm',
        'X-Workspace-Id': 'ws_1',
      },
      body: Buffer.from('small-audio-data'),
    });
    expect(streamed.status).toBe(200);
    const payload = await streamed.json();
    expect(payload.id).toBe('rec_transient');
    expect(memPressureSpy).not.toHaveBeenCalled();
    expect(mockTranscriptionService.upsertMediaAssetFromPath).toHaveBeenCalledTimes(1);
    expect(mockTranscriptionService.upsertMediaAssetFromPath).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: expect.stringContaining('rec_transient') })
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockTranscriptionService.saveAudioQualityDiagnostics).toHaveBeenCalledTimes(1);
  });

  it('PUT /media/recordings/:recordingId/audio - maps transient provider 429/503 and is retryable', async () => {
    const upstreamError = Object.assign(new Error('Upstream provider throttled request'), {
      statusCode: 503,
    });
    mockTranscriptionService.upsertMediaAssetFromPath
      .mockRejectedValueOnce(upstreamError)
      .mockResolvedValue({
        id: 'rec_retryable',
        workspace_id: 'ws_1',
        size_bytes: 123,
      });
    mockTranscriptionService.analyzeAudioQuality.mockResolvedValue({
      qualityLabel: 'good',
      enhancementRecommended: false,
    });

    const first = await app.request('/media/recordings/rec_retryable/audio', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer fake_token',
        'Content-Type': 'audio/webm',
        'X-Workspace-Id': 'ws_1',
      },
      body: Buffer.from('retryable-audio-data'),
    });
    expect(first.status).toBe(503);
    const firstPayload = await first.json();
    expect(firstPayload).toMatchObject({
      message: 'Upstream provider throttled request',
    });

    const second = await app.request('/media/recordings/rec_retryable/audio', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer fake_token',
        'Content-Type': 'audio/webm',
        'X-Workspace-Id': 'ws_1',
      },
      body: Buffer.from('retryable-audio-data'),
    });
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({
      id: 'rec_retryable',
      workspaceId: 'ws_1',
      sizeBytes: 123,
      audioQuality: null,
    });
    expect(mockTranscriptionService.upsertMediaAssetFromPath).toHaveBeenCalledTimes(2);
  });

  it('OPTIONS /media/recordings/:recordingId/audio - returns preview CORS headers for vercel origins', async () => {
    const previewOrigin = 'https://preview-app.vercel.app';
    const res = await app.request('/media/recordings/rec_new/audio', {
      method: 'OPTIONS',
      headers: {
        Origin: previewOrigin,
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers':
          'Authorization,Content-Type,X-Workspace-Id,X-Meeting-Id,X-Progress-Token',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(previewOrigin);
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('X-Workspace-Id');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('X-Meeting-Id');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('X-Progress-Token');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('PUT');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('OPTIONS');
    expect(res.headers.get('Vary')).toContain('Origin');
  });

  it('GET /media/recordings/:recordingId/progress - rejects expired progress token before SSE starts', async () => {
    resetProgressTokensForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-20T10:00:00.000Z'));
    const progressToken = createProgressToken('rec_progress_expired', 'user_1', 1000);
    vi.setSystemTime(new Date('2026-06-20T10:00:02.000Z'));

    const res = await app.request('/media/recordings/rec_progress_expired/progress', {
      method: 'GET',
      headers: { 'X-Progress-Token': progressToken },
    });

    expect(res.status).toBe(401);
    expect(mockTranscriptionService.on).not.toHaveBeenCalled();
    vi.useRealTimers();
    resetProgressTokensForTests();
  });

  it('POST /media/recordings/:recordingId/transcribe - queues job', async () => {
    mockTranscriptionService.getMediaAsset.mockResolvedValue({
      id: 'rec_1',
      workspace_id: 'ws_1',
      file_path: '/tmp/fake.webm',
      content_type: 'audio/webm',
      size_bytes: 1024,
      transcription_status: 'queued',
    });

    const res = await app.request('/media/recordings/rec_1/transcribe', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake_token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'ws_1' }),
    });

    expect(res.status).toBe(202);
    const data = await res.json();
    expect(data.recordingId).toBe('rec_1');
    expect(data.pipelineStatus).toBe('queued');
    expect(mockTranscriptionService.queueTranscription).toHaveBeenCalledWith(
      'rec_1',
      expect.objectContaining({ processingMode: 'fast' })
    );
  });

  it('POST /media/recordings/:recordingId/transcribe - validates body before asset lookup', async () => {
    const res = await app.request('/media/recordings/rec_invalid_mode/transcribe', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake_token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'ws_1', processingMode: 'turbo' }),
    });

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({
      code: 'validation_failed',
      stage: 'validation',
      details: expect.arrayContaining([expect.objectContaining({ path: 'processingMode' })]),
    });
    expect(mockTranscriptionService.getMediaAsset).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------
  // Issue #1234 - active transcription requests should be idempotent
  // Date: 2026-06-28
  // Bug: POST /transcribe could enqueue duplicate work for a recording
  //      that was already queued or processing.
  // Fix: active pipeline statuses return the current status contract
  //      without starting another transcription pipeline.
  // ---------------------------------------------------------------
  it('POST /media/recordings/:recordingId/transcribe - returns active status without starting duplicate pipeline', async () => {
    mockTranscriptionService.getMediaAsset.mockResolvedValue({
      id: 'rec_active_idem',
      workspace_id: 'ws_1',
      file_path: '/tmp/fake.webm',
      content_type: 'audio/webm',
      size_bytes: 1024,
      transcription_status: 'processing',
      diarization_json: '{}',
      transcript_json: '[]',
    });

    const res = await app.request('/media/recordings/rec_active_idem/transcribe', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer fake_token',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'transcribe-active-1',
      },
      body: JSON.stringify({ workspaceId: 'ws_1' }),
    });

    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toMatchObject({
      recordingId: 'rec_active_idem',
      pipelineStatus: 'processing',
      idempotent: true,
      idempotencyKey: 'transcribe-active-1',
      idempotencyScope: 'recordingId',
    });
    expect(mockTranscriptionService.queueTranscription).not.toHaveBeenCalled();
    expect(mockTranscriptionService.ensureTranscriptionJob).not.toHaveBeenCalled();
  });

  it('POST /media/recordings/:recordingId/transcribe - returns retry-friendly transient error then succeeds after retry', async () => {
    mockTranscriptionService.getMediaAsset.mockResolvedValue({
      id: 'rec_retry',
      workspace_id: 'ws_1',
      file_path: '/tmp/fake.webm',
      content_type: 'audio/webm',
      size_bytes: 1024,
      transcription_status: 'failed',
      diarization_json: JSON.stringify({ errorMessage: 'temporary downstream failure' }),
      transcript_json: '[]',
    });
    mockTranscriptionService.queueTranscription
      .mockRejectedValueOnce(Object.assign(new Error('provider unavailable'), { statusCode: 503 }))
      .mockResolvedValue(undefined);

    const firstAttempt = await app.request('/media/recordings/rec_retry/transcribe', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake_token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'ws_1' }),
    });

    expect(firstAttempt.status).toBe(503);
    const firstPayload = await firstAttempt.json();
    expect(firstPayload.message).toBe('provider unavailable');
    expect(firstPayload.recordingId).toBe('rec_retry');
    expect(mockTranscriptionService.queueTranscription).toHaveBeenCalledTimes(1);
    expect(mockTranscriptionService.ensureTranscriptionJob).toHaveBeenCalledTimes(0);

    const completedAsset = {
      id: 'rec_retry',
      workspace_id: 'ws_1',
      file_path: '/tmp/fake.webm',
      content_type: 'audio/webm',
      size_bytes: 1024,
      transcription_status: 'queued',
      diarization_json: JSON.stringify({}),
      transcript_json: '[]',
    };
    mockTranscriptionService.queueTranscription.mockResolvedValue(undefined);
    mockTranscriptionService.ensureTranscriptionJob.mockResolvedValue(completedAsset);
    mockTranscriptionService.getMediaAsset.mockResolvedValue(completedAsset);

    const secondAttempt = await app.request('/media/recordings/rec_retry/transcribe', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake_token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'ws_1' }),
    });

    expect(secondAttempt.status).toBe(202);
    const secondPayload = await secondAttempt.json();
    expect(secondPayload.recordingId).toBe('rec_retry');
    expect(secondPayload.pipelineStatus).toBe('queued');
    expect(mockTranscriptionService.queueTranscription).toHaveBeenCalledTimes(2);
    expect(mockTranscriptionService.ensureTranscriptionJob).toHaveBeenCalledTimes(1);
  });

  it('GET /media/recordings/:recordingId/transcribe - returns payload', async () => {
    mockTranscriptionService.getMediaAsset.mockResolvedValue({
      id: 'rec_2',
      workspace_id: 'ws_1',
      transcription_status: 'completed',
      diarization_json: JSON.stringify({
        speakerCount: 2,
        transcriptOutcome: 'empty',
        emptyReason: 'no_segments_from_stt',
        userMessage: 'Nie wykryto wypowiedzi w nagraniu.',
        pipelineVersion: '0.1.0',
        pipelineGitSha: 'abc1234',
        pipelineBuildTime: '2026-03-21T20:00:00.000Z',
      }),
      transcript_json: '[]',
    });

    const res = await app.request('/media/recordings/rec_2/transcribe', {
      method: 'GET',
      headers: { Authorization: 'Bearer fake_token' },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.recordingId).toBe('rec_2');
    expect(data.pipelineStatus).toBe('done');
    expect(data.diarization.speakerCount).toBe(2);
    expect(data.transcriptOutcome).toBe('empty');
    expect(data.emptyReason).toBe('no_segments_from_stt');
    expect(data.userMessage).toBe('Nie wykryto wypowiedzi w nagraniu.');
    expect(data.pipelineVersion).toBe('0.1.0');
    expect(data.pipelineGitSha).toBe('abc1234');
    expect(data.pipelineBuildTime).toBe('2026-03-21T20:00:00.000Z');
  });

  it('POST /media/recordings/:recordingId/retry-transcribe - requeues failed recording without reupload', async () => {
    mockTranscriptionService.getMediaAsset
      .mockResolvedValueOnce({
        id: 'rec_retry',
        workspace_id: 'ws_1',
        meeting_id: 'm_1',
        file_path: '/tmp/retry.webm',
        content_type: 'audio/webm',
        transcription_status: 'failed',
        diarization_json: JSON.stringify({ errorMessage: 'old failure' }),
        transcript_json: '[]',
      })
      .mockResolvedValueOnce({
        id: 'rec_retry',
        workspace_id: 'ws_1',
        meeting_id: 'm_1',
        file_path: '/tmp/retry.webm',
        content_type: 'audio/webm',
        transcription_status: 'queued',
        diarization_json: '{}',
        transcript_json: '[]',
      });

    const res = await app.request('/media/recordings/rec_retry/retry-transcribe', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake_token' },
    });

    expect(res.status).toBe(202);
    expect(mockTranscriptionService.queueTranscription).toHaveBeenCalledWith(
      'rec_retry',
      expect.objectContaining({
        workspaceId: 'ws_1',
        meetingId: 'm_1',
        contentType: 'audio/webm',
        processingMode: 'fast',
      })
    );
    expect(mockTranscriptionService.ensureTranscriptionJob).toHaveBeenCalledWith(
      'rec_retry',
      expect.objectContaining({ id: 'rec_retry' }),
      expect.objectContaining({
        workspaceId: 'ws_1',
        meetingId: 'm_1',
        contentType: 'audio/webm',
      })
    );
    expect(mockTranscriptionService.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws_1',
        actorUserId: 'user_1',
        action: 'recording.transcription.retry_requested',
        entityType: 'recording',
        entityId: 'rec_retry',
        metadata: expect.objectContaining({
          meetingId: 'm_1',
          previousStatus: 'failed',
          processingMode: 'fast',
          force: false,
          source: 'api',
          requestId: expect.any(String),
        }),
      })
    );
  });

  it('POST /media/recordings/:recordingId/retry-transcribe - returns same job id on repeated retries', async () => {
    mockTranscriptionService.getMediaAsset
      .mockResolvedValueOnce({
        id: 'rec_retry_idem',
        workspace_id: 'ws_1',
        meeting_id: 'm_1',
        file_path: '/tmp/retry-idem.webm',
        content_type: 'audio/webm',
        transcription_status: 'failed',
        diarization_json: '{}',
        transcript_json: '[]',
      })
      .mockResolvedValueOnce({
        id: 'rec_retry_idem',
        workspace_id: 'ws_1',
        meeting_id: 'm_1',
        file_path: '/tmp/retry-idem.webm',
        content_type: 'audio/webm',
        transcription_status: 'queued',
        diarization_json: '{}',
        transcript_json: '[]',
      })
      .mockResolvedValueOnce({
        id: 'rec_retry_idem',
        workspace_id: 'ws_1',
        meeting_id: 'm_1',
        file_path: '/tmp/retry-idem.webm',
        content_type: 'audio/webm',
        transcription_status: 'queued',
        diarization_json: '{}',
        transcript_json: '[]',
      });

    const first = await app.request('/media/recordings/rec_retry_idem/retry-transcribe', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake_token' },
    });
    expect(first.status).toBe(202);

    const second = await app.request('/media/recordings/rec_retry_idem/retry-transcribe', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake_token' },
    });
    expect(second.status).toBe(202);

    const secondPayload = await second.json();
    expect(secondPayload.recordingId).toBe('rec_retry_idem');
    expect(secondPayload.pipelineStatus).toBe('queued');
    expect(mockTranscriptionService.ensureTranscriptionJob).toHaveBeenNthCalledWith(
      1,
      'rec_retry_idem',
      expect.objectContaining({
        id: 'rec_retry_idem',
        workspace_id: 'ws_1',
        file_path: '/tmp/retry-idem.webm',
      }),
      expect.objectContaining({
        workspaceId: 'ws_1',
        contentType: 'audio/webm',
      })
    );
    expect(mockTranscriptionService.ensureTranscriptionJob).toHaveBeenNthCalledWith(
      2,
      'rec_retry_idem',
      expect.objectContaining({
        id: 'rec_retry_idem',
        workspace_id: 'ws_1',
        file_path: '/tmp/retry-idem.webm',
      }),
      expect.objectContaining({
        workspaceId: 'ws_1',
        contentType: 'audio/webm',
      })
    );
    expect(mockTranscriptionService.queueTranscription).toHaveBeenCalledTimes(1);
    expect(mockTranscriptionService.ensureTranscriptionJob).toHaveBeenCalledTimes(2);
  });

  it('GET /media/recordings/:recordingId/transcribe - handles race polling with empty transcript edge case', async () => {
    const staleDate = new Date(Date.now() - 40 * 60 * 1000).toISOString();
    const activeRuntime = {
      activeJob: true,
      queuedPosition: null,
      processingAgeMs: 120_000,
      retryAfterMs: 60_000,
    };
    const inactiveRuntime = {
      activeJob: false,
      queuedPosition: null,
      processingAgeMs: null,
      retryAfterMs: 60_000,
    };

    mockTranscriptionService.getTranscriptionRuntimeStatus
      .mockReturnValueOnce(activeRuntime)
      .mockReturnValueOnce(inactiveRuntime);
    mockTranscriptionService.markTranscriptionFailure.mockResolvedValue(undefined);
    mockTranscriptionService.getMediaAsset
      .mockResolvedValueOnce({
        id: 'rec_poll_race',
        workspace_id: 'ws_1',
        transcription_status: 'processing',
        transcript_json: '[]',
        diarization_json: '{}',
        updated_at: staleDate,
      })
      .mockResolvedValueOnce({
        id: 'rec_poll_race',
        workspace_id: 'ws_1',
        transcription_status: 'processing',
        transcript_json: '[]',
        diarization_json: '{}',
        updated_at: staleDate,
      })
      .mockResolvedValueOnce({
        id: 'rec_poll_race',
        workspace_id: 'ws_1',
        transcription_status: 'failed',
        transcript_json: '[]',
        diarization_json: JSON.stringify({
          errorMessage: 'Pipeline utknal w przetwarzaniu. Sprobuj ponownie.',
        }),
        updated_at: new Date().toISOString(),
      });

    const firstPoll = await app.request('/media/recordings/rec_poll_race/transcribe', {
      method: 'GET',
      headers: { Authorization: 'Bearer fake_token' },
    });

    expect(firstPoll.status).toBe(200);
    const firstPayload = await firstPoll.json();
    expect(firstPayload.pipelineStatus).toBe('processing');
    expect(firstPayload.activeJob).toBe(true);
    expect(mockTranscriptionService.markTranscriptionFailure).not.toHaveBeenCalled();

    const secondPoll = await app.request('/media/recordings/rec_poll_race/transcribe', {
      method: 'GET',
      headers: { Authorization: 'Bearer fake_token' },
    });

    expect(secondPoll.status).toBe(200);
    const secondPayload = await secondPoll.json();
    expect(secondPayload.pipelineStatus).toBe('failed');
    expect(secondPayload.activeJob).toBe(false);
    expect(mockTranscriptionService.markTranscriptionFailure).toHaveBeenCalledWith(
      'rec_poll_race',
      expect.stringContaining('Pipeline'),
      null,
      null
    );
    expect(secondPayload.recordingId).toBe('rec_poll_race');
  });

  it('POST /media/recordings/:recordingId/retry-transcribe - returns 409 when audio file is missing', async () => {
    mockTranscriptionService.getMediaAsset.mockResolvedValue({
      id: 'rec_retry_missing',
      workspace_id: 'ws_1',
      meeting_id: 'm_1',
      file_path: '/tmp/missing.webm',
      content_type: 'audio/webm',
      transcription_status: 'failed',
      diarization_json: '{}',
      transcript_json: '[]',
    });

    // Set fs.exists to return false for this specific test
    setFsState({ existsSync: false });

    const res = await app.request('/media/recordings/rec_retry_missing/retry-transcribe', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake_token' },
    });

    expect(res.status).toBe(409);
    expect(mockTranscriptionService.queueTranscription).not.toHaveBeenCalled();
  });

  it('POST /media/recordings/:recordingId/retry-transcribe - allows retry for completed empty transcript', async () => {
    mockTranscriptionService.getMediaAsset
      .mockResolvedValueOnce({
        id: 'rec_empty_retry',
        workspace_id: 'ws_1',
        meeting_id: 'm_1',
        file_path: '/tmp/retry.webm',
        content_type: 'audio/webm',
        transcription_status: 'completed',
        diarization_json: JSON.stringify({
          transcriptOutcome: 'empty',
          emptyReason: 'no_segments_from_stt',
          transcriptionDiagnostics: { chunksWithText: 0, chunksAttempted: 2 },
        }),
        transcript_json: '[]',
      })
      .mockResolvedValueOnce({
        id: 'rec_empty_retry',
        workspace_id: 'ws_1',
        meeting_id: 'm_1',
        file_path: '/tmp/retry.webm',
        content_type: 'audio/webm',
        transcription_status: 'queued',
        diarization_json: JSON.stringify({
          transcriptOutcome: 'empty',
          emptyReason: 'no_segments_from_stt',
          transcriptionDiagnostics: { chunksWithText: 0, chunksAttempted: 2 },
        }),
        transcript_json: '[]',
      });

    const res = await app.request('/media/recordings/rec_empty_retry/retry-transcribe', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake_token' },
    });

    expect(res.status).toBe(202);
    const payload = await res.json();
    expect(payload.transcriptionDiagnostics).toMatchObject({
      chunksWithText: 0,
      chunksAttempted: 2,
    });
    expect(mockTranscriptionService.queueTranscription).toHaveBeenCalledWith(
      'rec_empty_retry',
      expect.objectContaining({
        workspaceId: 'ws_1',
        meetingId: 'm_1',
      })
    );
  });

  it('POST /media/recordings/:recordingId/retry-transcribe - protects completed non-empty transcript from accidental retry', async () => {
    mockTranscriptionService.getMediaAsset.mockResolvedValue({
      id: 'rec_done_retry',
      workspace_id: 'ws_1',
      meeting_id: 'm_1',
      file_path: '/tmp/done.webm',
      content_type: 'audio/webm',
      transcription_status: 'completed',
      diarization_json: JSON.stringify({ transcriptOutcome: 'normal' }),
      transcript_json: JSON.stringify([{ text: 'Gotowy transcript', timestamp: 0 }]),
    });

    const res = await app.request('/media/recordings/rec_done_retry/retry-transcribe', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake_token' },
    });

    expect(res.status).toBe(409);
    const payload = await res.json();
    expect(payload.pipelineStatus).toBe('done');
    expect(mockTranscriptionService.queueTranscription).not.toHaveBeenCalled();
    expect(mockTranscriptionService.ensureTranscriptionJob).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------
  // Issue #0 - retry-transcribe should reconstruct canonical storage key
  // Date: 2026-04-04
  // Bug: when a local file disappeared after redeploy, retry-transcribe
  //      only checked the basename from file_path. If Supabase still
  //      stored audio under recordingId.ext, the retry returned 409.
  // Fix: retry-transcribe now reuses the same remote storage candidate
  //      reconstruction as GET /audio and swaps asset.file_path to the
  //      resolved remote key before queueing the pipeline.
  // ---------------------------------------------------------------
  it('POST /media/recordings/:recordingId/retry-transcribe - falls back to reconstructed Supabase key', async () => {
    mockTranscriptionService.getMediaAsset
      .mockResolvedValueOnce({
        id: 'rec_retry_remote',
        workspace_id: 'ws_1',
        meeting_id: 'm_1',
        file_path: '/tmp/archive/legacy-name.webm',
        content_type: 'audio/webm',
        transcription_status: 'failed',
        diarization_json: '{}',
        transcript_json: '[]',
      })
      .mockResolvedValueOnce({
        id: 'rec_retry_remote',
        workspace_id: 'ws_1',
        meeting_id: 'm_1',
        file_path: 'rec_retry_remote.webm',
        content_type: 'audio/webm',
        transcription_status: 'queued',
        diarization_json: '{}',
        transcript_json: '[]',
      });

    setFsState({ existsSync: false });

    const storageModule = await import('../../lib/supabaseStorage.ts');
    const downloadSpy = vi
      .spyOn(storageModule, 'downloadAudioFromStorage')
      .mockRejectedValueOnce(new Error('legacy key missing'))
      .mockResolvedValueOnce(new TextEncoder().encode('audio-data').buffer);

    const res = await app.request('/media/recordings/rec_retry_remote/retry-transcribe', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake_token' },
    });

    expect(res.status).toBe(202);
    expect(downloadSpy).toHaveBeenNthCalledWith(1, 'legacy-name.webm');
    expect(downloadSpy).toHaveBeenNthCalledWith(2, 'rec_retry_remote.webm');
    expect(mockTranscriptionService.ensureTranscriptionJob).toHaveBeenCalledWith(
      'rec_retry_remote',
      expect.objectContaining({
        file_path: 'rec_retry_remote.webm',
      }),
      expect.objectContaining({
        workspaceId: 'ws_1',
        meetingId: 'm_1',
        contentType: 'audio/webm',
      })
    );
  });

  it('POST /media/recordings/:recordingId/sketchnote - uses Gemini 3 Pro Image preview', async () => {
    mockTranscriptionService.getMediaAsset.mockResolvedValue({
      id: 'rec_sketchnote',
      workspace_id: 'ws_1',
      diarization_json: JSON.stringify({
        summary: 'Spotkanie o wdrożeniu nowego procesu.',
      }),
    });
    mockWorkspaceService.getMembership.mockResolvedValue({ member_role: 'owner' });

    const originalFetch = global.fetch;
    const originalGeminiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'image/png',
                      data: Buffer.from('fake-image').toString('base64'),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    ) as any;

    const res = await app.request('/media/recordings/rec_sketchnote/sketchnote', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake_token' },
    });

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.sketchnoteUrl).toContain('data:image/png;base64,');
    expect(mockTranscriptionService.getMediaAsset).toHaveBeenCalledWith('rec_sketchnote');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as any).mock.calls[0][0]).toContain(
      'gemini-3-pro-image-preview:generateContent'
    );
    expect(String((global.fetch as any).mock.calls[0][1].headers['x-goog-api-key'])).toBe(
      'test-key'
    );

    global.fetch = originalFetch;
    process.env.GEMINI_API_KEY = originalGeminiKey;
  });

  // Regression coverage note.
  // Issue #0 --- Sketchnote endpoint returns 500 for Gemini 429 quota errors
  // Date: 2026-03-30
  // Bug: Server always returned 500 for any Gemini error, even 429 (quota exceeded).
  //      Frontend's normalizeApiErrorMessage() never triggered the user-friendly
  //      "Zbyt wiele prob" message because it received 500 instead of 429.
  // Fix: Preserve Gemini's original status code (429, 503) in the response.
  // Regression coverage note.
  describe('Regression: Issue #0 --- Sketchnote preserves Gemini error status codes', () => {
    const setupSketchnoteTest = () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_sketchnote',
        workspace_id: 'ws_1',
        diarization_json: JSON.stringify({
          summary: 'Spotkanie o wdrożeniu nowego procesu.',
        }),
      });
      mockWorkspaceService.getMembership.mockResolvedValue({ member_role: 'owner' });

      const originalFetch = global.fetch;
      const originalGeminiKey = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = 'test-key';
      return { originalFetch, originalGeminiKey };
    };

    const teardownSketchnoteTest = (ctx: {
      originalFetch: typeof global.fetch;
      originalGeminiKey: string | undefined;
    }) => {
      global.fetch = ctx.originalFetch;
      process.env.GEMINI_API_KEY = ctx.originalGeminiKey;
    };

    it('returns 429 when Gemini responds with 429 quota exceeded', async () => {
      const ctx = setupSketchnoteTest();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 429,
              message: 'Resource has been exhausted. Quota exceeded.',
              status: 'RESOURCE_EXHAUSTED',
            },
          }),
          { status: 429, headers: { 'content-type': 'application/json' } }
        )
      ) as any;

      const res = await app.request('/media/recordings/rec_sketchnote/sketchnote', {
        method: 'POST',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(429);
      const payload = await res.json();
      expect(payload.message).toContain('429');
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      teardownSketchnoteTest(ctx);
    });

    it('returns 503 when Gemini responds with 503 overloaded', async () => {
      const ctx = setupSketchnoteTest();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: 503, message: 'The model is overloaded.' },
          }),
          { status: 503, headers: { 'content-type': 'application/json' } }
        )
      ) as any;

      const res = await app.request('/media/recordings/rec_sketchnote/sketchnote', {
        method: 'POST',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(503);
      const payload = await res.json();
      expect(payload.message).toContain('503');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ERROR] Gemini image gen error:',
        '{"error":{"code":503,"message":"The model is overloaded."}}'
      );

      teardownSketchnoteTest(ctx);
    });

    it('still returns 500 for other Gemini errors (e.g. 400 bad request)', async () => {
      const ctx = setupSketchnoteTest();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: 400, message: 'Invalid request.' },
          }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        )
      ) as any;

      const res = await app.request('/media/recordings/rec_sketchnote/sketchnote', {
        method: 'POST',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(500);
      const payload = await res.json();
      expect(payload.message).toContain('400');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ERROR] Gemini image gen error:',
        '{"error":{"code":400,"message":"Invalid request."}}'
      );

      teardownSketchnoteTest(ctx);
    });
  });

  // Regression coverage note.
  // Issue #0 --- Sketchnote Gemini 429 retry with exponential backoff
  // Date: 2026-04-04
  // Bug: Single 429 from Gemini immediately failed the request.
  // Fix: Added retry loop (MAX_RETRIES=2, delays 5s/15s, 10ms in test).
  //      After exhausting retries, the original error code is returned.
  // Regression coverage note.
  describe('Regression: Issue #0 --- Sketchnote retries on Gemini 429/503', () => {
    it('retries up to 2 times on 429 before returning error', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_sketchnote',
        workspace_id: 'ws_1',
        diarization_json: JSON.stringify({ summary: 'Test meeting.' }),
      });
      mockWorkspaceService.getMembership.mockResolvedValue({ member_role: 'owner' });

      const originalFetch = global.fetch;
      const originalGeminiKey = process.env.GEMINI_API_KEY;
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.GEMINI_API_KEY = 'test-key';
      process.env.NODE_ENV = 'test';

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 429, message: 'Quota exceeded.' } }), {
          status: 429,
          headers: { 'content-type': 'application/json' },
        })
      );
      global.fetch = fetchMock as any;

      const res = await app.request('/media/recordings/rec_sketchnote/sketchnote', {
        method: 'POST',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(429);
      // initial + 2 retries = 3 total fetch calls
      expect(fetchMock).toHaveBeenCalledTimes(3);

      global.fetch = originalFetch;
      process.env.GEMINI_API_KEY = originalGeminiKey;
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('succeeds on second attempt after initial 503', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_sketchnote',
        workspace_id: 'ws_1',
        diarization_json: JSON.stringify({ summary: 'Test meeting.' }),
      });
      mockWorkspaceService.getMembership.mockResolvedValue({ member_role: 'owner' });

      const originalFetch = global.fetch;
      const originalGeminiKey = process.env.GEMINI_API_KEY;
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.GEMINI_API_KEY = 'test-key';
      process.env.NODE_ENV = 'test';

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: { code: 503, message: 'Overloaded.' } }), {
            status: 503,
            headers: { 'content-type': 'application/json' },
          })
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [{ inlineData: { mimeType: 'image/png', data: 'dGVzdA==' } }],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        );
      global.fetch = fetchMock as any;

      const res = await app.request('/media/recordings/rec_sketchnote/sketchnote', {
        method: 'POST',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(200);
      // Regression coverage note.
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const payload = await res.json();
      expect(payload.sketchnoteUrl).toContain('data:image/png;base64,');

      global.fetch = originalFetch;
      process.env.GEMINI_API_KEY = originalGeminiKey;
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  it('PUT /media/recordings/:recordingId/audio - requires workspace header and rejects oversize upload', async () => {
    const previewOrigin = 'https://preview-app.vercel.app';
    const missingWorkspace = await app.request('/media/recordings/rec_missing/audio', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer fake_token',
        'Content-Type': 'audio/webm',
        Origin: previewOrigin,
      },
      body: Buffer.from('small-audio-data'),
    });

    expect(missingWorkspace.status).toBe(400);
    expect(missingWorkspace.headers.get('Access-Control-Allow-Origin')).toBe(previewOrigin);
    expect(missingWorkspace.headers.get('Vary')).toContain('Origin');

    const oversize = await app.request('/media/recordings/rec_large/audio', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer fake_token',
        'Content-Type': 'audio/webm',
        'Content-Length': String(MAX_RAW_UPLOAD_BYTES + 1),
        'X-Workspace-Id': 'ws_1',
        Origin: previewOrigin,
      },
      body: Buffer.from('oversized-by-header'),
    });

    expect(oversize.status).toBe(413);
    expect(oversize.headers.get('Access-Control-Allow-Origin')).toBe(previewOrigin);
    expect(oversize.headers.get('Vary')).toContain('Origin');
  });

  it('GET /media/recordings/:recordingId/audio - returns 404 for missing assets and files', async () => {
    mockTranscriptionService.getMediaAsset.mockResolvedValueOnce(null);
    const missingAsset = await app.request('/media/recordings/rec_missing/audio', {
      method: 'GET',
      headers: { Authorization: 'Bearer fake_token' },
    });
    expect(missingAsset.status).toBe(404);

    const storageModule = await import('../../lib/supabaseStorage.ts');
    vi.spyOn(storageModule, 'downloadAudioFromStorage').mockRejectedValue(
      new Error('missing in storage')
    );

    mockTranscriptionService.getMediaAsset.mockResolvedValueOnce({
      id: 'rec_file',
      workspace_id: 'ws_1',
      file_path: '/tmp/missing.webm',
      content_type: 'audio/webm',
    });

    // Set fs.exists to return false for this test
    setFsState({ existsSync: false });

    const missingFile = await app.request('/media/recordings/rec_file/audio', {
      method: 'GET',
      headers: { Authorization: 'Bearer fake_token' },
    });

    expect(missingFile.status).toBe(404);
  });

  it('GET /media/recordings/:recordingId/audio - falls back to reconstructed Supabase key', async () => {
    mockTranscriptionService.getMediaAsset.mockResolvedValue({
      id: 'rec_stream',
      workspace_id: 'ws_1',
      file_path: '/tmp/archive/legacy-name.webm',
      content_type: 'audio/webm',
    });

    setFsState({ existsSync: false });

    const storageModule = await import('../../lib/supabaseStorage.ts');
    const downloadSpy = vi
      .spyOn(storageModule, 'downloadAudioFromStorage')
      .mockRejectedValueOnce(new Error('legacy key missing'))
      .mockResolvedValueOnce(new TextEncoder().encode('audio-data').buffer);

    const res = await app.request('/media/recordings/rec_stream/audio', {
      method: 'GET',
      headers: { Authorization: 'Bearer fake_token' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/webm');
    expect(res.headers.get('Content-Length')).toBe(String('audio-data'.length));
    expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    expect(res.headers.get('Pragma')).toBe('no-cache');
    expect(res.headers.get('Expires')).toBe('0');
    expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin');
    expect(res.headers.get('Content-Disposition')).toBe('attachment');
    expect(downloadSpy).toHaveBeenNthCalledWith(1, 'legacy-name.webm');
    expect(downloadSpy).toHaveBeenNthCalledWith(2, 'rec_stream.webm');
  });

  it('GET /media/recordings/:recordingId/audio - writes a sanitized download audit event', async () => {
    mockTranscriptionService.getMediaAsset.mockResolvedValue({
      id: 'rec_audit_download',
      workspace_id: 'ws_1',
      meeting_id: 'm_audit',
      file_path: '/tmp/audit-download.webm',
      content_type: 'audio/webm',
      size_bytes: 1234,
      storage_mode: 'single',
    });

    const res = await app.request('/media/recordings/rec_audit_download/audio', {
      method: 'GET',
      headers: { Authorization: 'Bearer fake_token' },
    });

    expect(res.status).toBe(200);
    expect(mockTranscriptionService.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws_1',
        actorUserId: 'user_1',
        action: 'recording.audio.downloaded',
        entityType: 'recording',
        entityId: 'rec_audit_download',
        metadata: expect.objectContaining({
          meetingId: 'm_audit',
          contentType: 'audio/webm',
          storageMode: 'single',
          delivery: 'local',
          source: 'api',
          requestId: expect.any(String),
        }),
      })
    );
    const auditPayload = mockTranscriptionService.writeAuditLog.mock.calls[0][0];
    expect(JSON.stringify(auditPayload.metadata)).not.toContain('/tmp/audit-download.webm');
  });

  it('POST /media/recordings/:recordingId/normalize, /voice-coaching and /acoustic-features handle happy path', async () => {
    mockTranscriptionService.getMediaAsset.mockResolvedValue({
      id: 'rec_norm',
      workspace_id: 'ws_1',
      file_path: '/tmp/audio.webm',
      content_type: 'audio/webm',
    });
    mockTranscriptionService.generateVoiceCoaching.mockResolvedValue('Mow wolniej.');
    mockTranscriptionService.getSpeakerAcousticFeatures.mockResolvedValue({
      speakers: [{ speakerId: '0', speakerName: 'Anna', f0Hz: 198.2 }],
    });

    const normalizeRes = await app.request('/media/recordings/rec_norm/normalize', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake_token' },
    });
    const coachingRes = await app.request('/media/recordings/rec_norm/voice-coaching', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake_token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ speakerId: '0', segments: [{ text: 'Ala' }] }),
    });
    const acousticRes = await app.request('/media/recordings/rec_norm/acoustic-features', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake_token' },
    });

    expect(normalizeRes.status).toBe(200);
    expect(await normalizeRes.json()).toEqual({ ok: true });
    expect(mockTranscriptionService.normalizeRecording).toHaveBeenCalledWith(
      '/tmp/audio.webm',
      expect.objectContaining({ signal: expect.any(Object) })
    );

    expect(coachingRes.status).toBe(200);
    expect(await coachingRes.json()).toEqual({ coaching: 'Mow wolniej.' });
    expect(acousticRes.status).toBe(200);
    expect(await acousticRes.json()).toEqual({
      speakers: [{ speakerId: '0', speakerName: 'Anna', f0Hz: 198.2 }],
    });
  });

  it('POST /media/recordings/:recordingId/voice-profiles/from-speaker and /rediarize handle success and validation', async () => {
    mockTranscriptionService.getMediaAsset
      .mockResolvedValueOnce({
        id: 'rec_voice',
        workspace_id: 'ws_1',
        transcript_json: '[{"text":"hello","speakerId":"0","timestamp":0,"endTimestamp":1}]',
      })
      .mockResolvedValueOnce({
        id: 'rec_rediarize_missing',
        workspace_id: 'ws_1',
        transcript_json: '[]',
      })
      .mockResolvedValueOnce({
        id: 'rec_rediarize_ok',
        workspace_id: 'ws_1',
        transcript_json: '[{"id":"s1","text":"hello","timestamp":0,"endTimestamp":1}]',
      });
    mockTranscriptionService.createVoiceProfileFromSpeaker.mockResolvedValue({
      id: 'vp_1',
      speaker_name: 'Anna',
      created_at: '2026-06-30T20:00:00.000Z',
      updated_at: '2026-06-30T20:01:00.000Z',
      profile_source: 'transcript_speaker',
      embedding_model: 'voice-profile-embedding',
      embedding_version: '1',
      created_by: 'user_1',
      sample_count: 1,
      threshold: 0.82,
      embedding_json: '[0.1,0.2,0.3]',
    });
    mockTranscriptionService.diarizeFromTranscript.mockResolvedValue({
      speakerCount: 1,
      speakerNames: { '0': 'Speaker 1' },
      segments: [
        {
          id: 'seg1',
          text: 'hello',
          timestamp: 0,
          endTimestamp: 1,
          speakerId: 0,
          rawSpeakerLabel: 'A',
        },
      ],
    });

    const voiceRes = await app.request('/media/recordings/rec_voice/voice-profiles/from-speaker', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake_token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ speakerId: '0', speakerName: 'Anna' }),
    });
    expect(voiceRes.status).toBe(201);
    const voicePayload = await voiceRes.json();
    expect(voicePayload).toEqual({
      id: 'vp_1',
      speakerName: 'Anna',
      hasEmbedding: true,
      createdAt: '2026-06-30T20:00:00.000Z',
      updatedAt: '2026-06-30T20:01:00.000Z',
      source: 'transcript_speaker',
      model: 'voice-profile-embedding',
      version: '1',
      createdBy: 'user_1',
      sampleCount: 1,
      threshold: 0.82,
      isUpdate: false,
    });
    expect(voicePayload).not.toHaveProperty('embedding_json');
    expect(voicePayload).not.toHaveProperty('embeddingJson');
    expect(voicePayload).not.toHaveProperty('embedding');
    expect(voicePayload).not.toHaveProperty('vector');

    const noTranscriptRes = await app.request('/media/recordings/rec_rediarize_missing/rediarize', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake_token' },
    });
    expect(noTranscriptRes.status).toBe(400);

    const okRediarizeRes = await app.request('/media/recordings/rec_rediarize_ok/rediarize', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake_token' },
    });
    expect(okRediarizeRes.status).toBe(200);
    expect(mockTranscriptionService.saveTranscriptionResult).toHaveBeenCalledWith(
      'rec_rediarize_ok',
      expect.objectContaining({ pipelineStatus: 'completed' })
    );
  });

  // ---------------------------------------------------------------
  // Issue #1331 - transcript enrollment duplicated existing profiles
  // Date: 2026-06-30
  // Bug: repeated transcript enrollment returned a new-profile response.
  // Fix: reused profiles return update metadata and HTTP 200.
  // ---------------------------------------------------------------
  it('Regression: Issue #1331 - POST /media/recordings/:recordingId/voice-profiles/from-speaker returns update state for repeated enrollment', async () => {
    mockTranscriptionService.getMediaAsset.mockResolvedValue({
      id: 'rec_voice_repeat',
      workspace_id: 'ws_1',
      transcript_json: '[{"text":"hello","speakerId":"0","timestamp":0,"endTimestamp":1}]',
    });
    mockTranscriptionService.createVoiceProfileFromSpeaker.mockResolvedValue({
      id: 'vp_existing',
      speaker_name: 'Anna',
      created_at: '2026-06-30T20:00:00.000Z',
      updated_at: '2026-06-30T20:05:00.000Z',
      profile_source: 'transcript_speaker',
      embedding_model: 'voice-profile-embedding',
      embedding_version: '1',
      created_by: 'user_1',
      sample_count: 2,
      threshold: 0.91,
      isUpdate: true,
      embedding_json: '[0.1,0.2,0.3]',
    });

    const res = await app.request(
      '/media/recordings/rec_voice_repeat/voice-profiles/from-speaker',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer fake_token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ speakerId: '0', speakerName: 'Anna' }),
      }
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: 'vp_existing',
      speakerName: 'Anna',
      hasEmbedding: true,
      createdAt: '2026-06-30T20:00:00.000Z',
      updatedAt: '2026-06-30T20:05:00.000Z',
      source: 'transcript_speaker',
      model: 'voice-profile-embedding',
      version: '1',
      createdBy: 'user_1',
      sampleCount: 2,
      threshold: 0.91,
      isUpdate: true,
    });
  });

  it('POST /media/recordings/:recordingId/voice-profiles/from-speaker returns embedding_failed without saving unusable profile', async () => {
    mockTranscriptionService.getMediaAsset.mockResolvedValue({
      id: 'rec_empty_embedding',
      workspace_id: 'ws_1',
      transcript_json: '[{"text":"hello","speakerId":"0","timestamp":0,"endTimestamp":1}]',
    });
    mockTranscriptionService.createVoiceProfileFromSpeaker.mockRejectedValue(
      Object.assign(
        new Error('Nie udalo sie utworzyc profilu glosu. Sprobuj ponownie za chwile.'),
        {
          code: 'embedding_failed',
          stage: 'embedding',
          statusCode: 503,
        }
      )
    );

    const res = await app.request(
      '/media/recordings/rec_empty_embedding/voice-profiles/from-speaker',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer fake_token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ speakerId: '0', speakerName: 'Anna' }),
      }
    );

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual(
      expect.objectContaining({
        code: 'embedding_failed',
        stage: 'embedding',
        recordingId: 'rec_empty_embedding',
        speakerId: '0',
        speakerName: 'Anna',
      })
    );
  });

  it('POST /media/recordings/:recordingId/voice-profiles/from-speaker validates speaker payload before asset lookup', async () => {
    const res = await app.request(
      '/media/recordings/rec_voice_invalid/voice-profiles/from-speaker',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer fake_token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ speakerId: '', speakerName: '' }),
      }
    );

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({
      code: 'validation_failed',
      stage: 'validation',
      details: expect.arrayContaining([
        expect.objectContaining({ path: 'speakerId' }),
        expect.objectContaining({ path: 'speakerName' }),
      ]),
    });
    expect(mockTranscriptionService.getMediaAsset).not.toHaveBeenCalled();
  });

  it('POST /media/recordings/:recordingId/rediarize returns no_changes when diarization fails', async () => {
    mockTranscriptionService.getMediaAsset.mockResolvedValue({
      id: 'rec_rediarize_fail',
      workspace_id: 'ws_1',
      transcript_json: '[{"id":"s1","text":"hello","timestamp":0,"endTimestamp":1}]',
    });
    mockTranscriptionService.diarizeFromTranscript.mockResolvedValue(null);

    const res = await app.request('/media/recordings/rec_rediarize_fail/rediarize', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake_token' },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: 'no_changes',
      code: 'rediarization_unavailable',
      message: expect.any(String),
      speakerCount: 0,
      speakerNames: {},
      segments: [],
    });
    expect(mockTranscriptionService.saveTranscriptionResult).not.toHaveBeenCalled();
  });

  it('POST /media/analyze returns fallback when analysis service returns null', async () => {
    mockTranscriptionService.analyzeMeetingWithOpenAI = vi.fn().mockResolvedValue(null);

    const res = await app.request('/media/analyze', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake_token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'ws_1', meeting: {}, segments: [] }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(
      expect.objectContaining({
        mode: 'no-key',
        analysisSource: 'fallback',
        fallbackReason: 'no-key',
      })
    );
  });

  it('POST /media/analyze records fallback metrics and sanitized warning context', async () => {
    mockTranscriptionService.analyzeMeetingWithOpenAI = vi.fn().mockResolvedValue({
      mode: 'fallback',
      analysisSource: 'fallback',
      fallbackReason: 'provider-error',
    });

    const { MetricsService } = await import('../../services/MetricsService.ts');
    const metricsSpy = vi.spyOn(MetricsService, 'observeAiFallback');

    const res = await app.request('/media/analyze', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake_token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: 'ws_1',
        recordingId: 'rec_ai_fallback',
        meeting: { id: 'meeting_ai_fallback' },
        segments: [{ text: 'RAW TRANSCRIPT SHOULD NOT BE LOGGED' }],
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(
      expect.objectContaining({
        analysisSource: 'fallback',
        fallbackReason: 'provider-error',
      })
    );
    expect(metricsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws_1',
        endpoint: 'media.analyze',
        reason: 'provider-error',
        mode: 'fallback',
      })
    );
  });

  it('POST /media/analyze validates meeting payload before AI analysis', async () => {
    mockTranscriptionService.analyzeMeetingWithOpenAI = vi.fn();

    const res = await app.request('/media/analyze', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake_token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'ws_1', meeting: 'not-an-object', segments: 'raw text' }),
    });

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({
      code: 'validation_failed',
      stage: 'validation',
      details: expect.arrayContaining([
        expect.objectContaining({ path: 'meeting' }),
        expect.objectContaining({ path: 'segments' }),
      ]),
    });
    expect(mockTranscriptionService.analyzeMeetingWithOpenAI).not.toHaveBeenCalled();
  });

  it('POST /media/analyze writes a sanitized AI audit event without raw transcript text', async () => {
    mockTranscriptionService.analyzeMeetingWithOpenAI = vi.fn().mockResolvedValue({
      mode: 'openai',
      summary: 'Gotowe podsumowanie',
    });

    const res = await app.request('/media/analyze', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake_token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: 'ws_1',
        recordingId: 'rec_ai_audit',
        meeting: { id: 'm_ai_audit', title: 'Demo' },
        segments: [{ speaker: 'Anna', text: 'RAW TRANSCRIPT SECRET' }],
      }),
    });

    expect(res.status).toBe(200);
    expect(mockTranscriptionService.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws_1',
        actorUserId: 'user_1',
        action: 'recording.ai.analyzed',
        entityType: 'recording',
        entityId: 'rec_ai_audit',
        metadata: expect.objectContaining({
          meetingId: 'm_ai_audit',
          mode: 'openai',
          source: 'api',
          requestId: expect.any(String),
        }),
      })
    );
    const auditPayload = mockTranscriptionService.writeAuditLog.mock.calls[0][0];
    expect(JSON.stringify(auditPayload.metadata)).not.toContain('RAW TRANSCRIPT SECRET');
  });

  // Regression coverage note.
  // Issue #0 --- POST /transcribe returns 500 on unhandled pipeline error
  // Date: 2026-03-29 (updated 2026-03-30: changed default from 502 to 500)
  // Regression coverage note.
  // Fix: try-catch returning structured error; default status changed to 500
  // Regression coverage note.
  describe('Regression: #0 --- transcribe pipeline error returns structured error, not 502', () => {
    it('POST /transcribe returns error JSON when pipeline throws', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_err',
        workspace_id: 'ws_1',
        file_path: '/tmp/err.webm',
        content_type: 'audio/webm',
      });
      mockTranscriptionService.queueTranscription.mockRejectedValue(
        new Error('STT provider unreachable')
      );

      const res = await app.request('/media/recordings/rec_err/transcribe', {
        method: 'POST',
        headers: { Authorization: 'Bearer fake_token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: 'ws_1' }),
      });

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.message).toContain('STT provider unreachable');
      expect(data.recordingId).toBe('rec_err');
      expect(sentryMocks.capturePipelineException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          workspaceId: 'ws_1',
          recordingId: 'rec_err',
          pipelineStage: 'job_start_request',
          operation: 'transcription.start',
          errorCode: 'TRANSCRIPTION_START_FAILED',
          retryable: false,
        }),
        expect.objectContaining({
          level: 'error',
          fingerprint: ['audio-pipeline', 'transcription-start'],
        })
      );
    });

    it('POST /retry-transcribe returns error JSON when pipeline throws', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_retry_err',
        workspace_id: 'ws_1',
        file_path: '/tmp/retry_err.webm',
        content_type: 'audio/webm',
        meeting_id: 'mtg_1',
      });
      mockTranscriptionService.queueTranscription.mockRejectedValue(
        new Error('Database connection lost')
      );

      const res = await app.request('/media/recordings/rec_retry_err/retry-transcribe', {
        method: 'POST',
        headers: { Authorization: 'Bearer fake_token', 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.message).toContain('Database connection lost');
      expect(data.recordingId).toBe('rec_retry_err');
    });

    it('POST /transcribe returns custom status code from error', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_429',
        workspace_id: 'ws_1',
        file_path: '/tmp/rate.webm',
        content_type: 'audio/webm',
      });
      const rateLimitError: any = new Error('Rate limit exceeded');
      rateLimitError.statusCode = 429;
      mockTranscriptionService.queueTranscription.mockRejectedValue(rateLimitError);

      const res = await app.request('/media/recordings/rec_429/transcribe', {
        method: 'POST',
        headers: { Authorization: 'Bearer fake_token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: 'ws_1' }),
      });

      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.message).toContain('Rate limit exceeded');
    });
  });

  // Regression coverage note.
  // Issue #0 --- GET /transcribe stuck-processing detection
  // Date: 2026-03-30 (updated 2026-05-18: inactive orphan threshold raised to 30 min)
  // Bug: Pipeline stuck in 'processing' with empty segments, frontend polls forever
  // Fix: GET handler detects inactive orphaned state and marks as failed.
  //      Also added resetOrphanedJobs on bootstrap for crash recovery.
  // Regression coverage note.
  describe('Regression: #0 --- stuck processing detection in GET /transcribe', () => {
    it('marks inactive asset as failed when stuck in processing for >30 min with empty segments', async () => {
      const staleDate = new Date(Date.now() - 40 * 60 * 1000).toISOString();
      mockTranscriptionService.isTranscriptionJobActive.mockReturnValue(false);
      mockTranscriptionService.getMediaAsset
        .mockResolvedValueOnce({
          id: 'rec_stuck',
          workspace_id: 'ws_1',
          transcription_status: 'processing',
          transcript_json: '[]',
          diarization_json: '{}',
          updated_at: staleDate,
        })
        .mockResolvedValueOnce({
          id: 'rec_stuck',
          workspace_id: 'ws_1',
          transcription_status: 'failed',
          transcript_json: '[]',
          diarization_json: JSON.stringify({
            errorMessage: 'Pipeline utknal w przetwarzaniu. Sprobuj ponownie.',
          }),
          updated_at: new Date().toISOString(),
        });
      mockTranscriptionService.markTranscriptionFailure.mockResolvedValue(undefined);

      const res = await app.request('/media/recordings/rec_stuck/transcribe', {
        method: 'GET',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pipelineStatus).toBe('failed');
      expect(mockTranscriptionService.markTranscriptionFailure).toHaveBeenCalledWith(
        'rec_stuck',
        expect.stringContaining('Pipeline'),
        null,
        null
      );
    });

    it('does not mark active long-running processing job as failed', async () => {
      const staleDate = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      mockTranscriptionService.isTranscriptionJobActive.mockReturnValue(true);
      mockTranscriptionService.getTranscriptionRuntimeStatus.mockReturnValue({
        activeJob: true,
        queuedPosition: null,
        processingAgeMs: 20 * 60 * 1000,
        retryAfterMs: 60_000,
      });
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_active_long',
        workspace_id: 'ws_1',
        transcription_status: 'processing',
        transcript_json: '[]',
        diarization_json: '{}',
        updated_at: staleDate,
      });

      const res = await app.request('/media/recordings/rec_active_long/transcribe', {
        method: 'GET',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pipelineStatus).toBe('processing');
      expect(data).toMatchObject({
        activeJob: true,
        queuedPosition: null,
        processingAgeMs: 20 * 60 * 1000,
        retryAfterMs: 60_000,
      });
      expect(mockTranscriptionService.markTranscriptionFailure).not.toHaveBeenCalled();
    });

    it('does not mark stale processing as failed while a durable job is active', async () => {
      const staleDate = new Date(Date.now() - 40 * 60 * 1000).toISOString();
      mockTranscriptionService.getDurableTranscriptionJob = vi.fn().mockResolvedValue({
        status: 'queued',
      });
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_durable_active',
        workspace_id: 'ws_1',
        transcription_status: 'processing',
        transcript_json: '[]',
        diarization_json: '{}',
        updated_at: staleDate,
      });

      const res = await app.request('/media/recordings/rec_durable_active/transcribe', {
        method: 'GET',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toMatchObject({
        pipelineStatus: 'processing',
        activeJob: true,
        durableJobStatus: 'queued',
      });
      expect(mockTranscriptionService.markTranscriptionFailure).not.toHaveBeenCalled();
    });

    it('returns queued runtime diagnostics for pending jobs', async () => {
      mockTranscriptionService.getTranscriptionRuntimeStatus.mockReturnValue({
        activeJob: true,
        queuedPosition: 2,
        processingAgeMs: null,
        retryAfterMs: 60_000,
      });
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_queued_runtime',
        workspace_id: 'ws_1',
        transcription_status: 'queued',
        transcript_json: '[]',
        diarization_json: '{}',
        updated_at: new Date().toISOString(),
      });

      const res = await app.request('/media/recordings/rec_queued_runtime/transcribe', {
        method: 'GET',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toMatchObject({
        pipelineStatus: 'queued',
        activeJob: true,
        queuedPosition: 2,
        retryAfterMs: 60_000,
      });
    });

    it('returns segmented transcription part progress from manifest checkpoints', async () => {
      const manifest = buildSegmentedMediaManifest({
        recordingId: 'rec_parts',
        workspaceId: 'ws_1',
        sourceSizeBytes: 180 * 1024 * 1024,
        normalizedSizeBytes: 42 * 1024 * 1024,
        durationMs: 20 * 60 * 1000,
        parts: [
          {
            index: 0,
            path: 'ws_1/rec_parts/part-000.webm',
            startMs: 0,
            endMs: 10 * 60 * 1000,
            sizeBytes: 18 * 1024 * 1024,
            contentType: 'audio/webm',
            transcription: { status: 'completed', attempts: 1 },
          },
          {
            index: 1,
            path: 'ws_1/rec_parts/part-001.webm',
            startMs: 10 * 60 * 1000,
            endMs: 20 * 60 * 1000,
            sizeBytes: 17 * 1024 * 1024,
            contentType: 'audio/webm',
            transcription: { status: 'processing', attempts: 2 },
          },
          {
            index: 2,
            path: 'ws_1/rec_parts/part-002.webm',
            startMs: 20 * 60 * 1000,
            endMs: 30 * 60 * 1000,
            sizeBytes: 16 * 1024 * 1024,
            contentType: 'audio/webm',
            transcription: { status: 'failed', attempts: 2 },
          },
        ],
      });
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_parts',
        workspace_id: 'ws_1',
        transcription_status: 'processing',
        transcript_json: '[]',
        diarization_json: '{}',
        media_manifest_json: JSON.stringify(manifest),
        storage_mode: 'segmented',
        updated_at: new Date().toISOString(),
      });

      const res = await app.request('/media/recordings/rec_parts/transcribe', {
        method: 'GET',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.partProgress).toEqual({
        total: 3,
        completed: 1,
        failed: 1,
        processingIndex: 1,
      });
    });

    it('does not mark as failed when processing for <5 min', async () => {
      const recentDate = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_recent',
        workspace_id: 'ws_1',
        transcription_status: 'processing',
        transcript_json: '[]',
        diarization_json: '{}',
        updated_at: recentDate,
      });

      const res = await app.request('/media/recordings/rec_recent/transcribe', {
        method: 'GET',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pipelineStatus).toBe('processing');
      expect(mockTranscriptionService.markTranscriptionFailure).not.toHaveBeenCalled();
    });

    it('does not mark as failed when processing has segments', async () => {
      const staleDate = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_with_data',
        workspace_id: 'ws_1',
        transcription_status: 'processing',
        transcript_json: JSON.stringify([{ text: 'hello', start: 0, end: 1 }]),
        diarization_json: '{}',
        updated_at: staleDate,
      });

      const res = await app.request('/media/recordings/rec_with_data/transcribe', {
        method: 'GET',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(200);
      expect(mockTranscriptionService.markTranscriptionFailure).not.toHaveBeenCalled();
    });
  });

  // Regression coverage note.
  // Issue #0 --- DELETE /recordings/:id zwraca 204 dla nieistniejącego nagrania
  // Date: 2026-03-31
  // Regression coverage note.
  // Regression coverage note.
  // Regression coverage note.
  // Regression coverage note.
  // Regression coverage note.
  describe('DELETE /recordings/:recordingId --- Regression: nieistniejące nagranie', () => {
    it('zwraca 204, gdy nagranie nie istnieje w bazie', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue(null);

      const res = await app.request('/media/recordings/recording_nonexistent', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(204);
      expect(mockTranscriptionService.deleteMediaAsset).not.toHaveBeenCalled();
    });

    it('zwraca 204, gdy nagranie istnieje i zostanie usunięte', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_existing',
        workspace_id: 'ws_1',
      });
      mockTranscriptionService.deleteMediaAsset.mockResolvedValue(undefined);

      const res = await app.request('/media/recordings/rec_existing', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(204);
      expect(mockTranscriptionService.deleteMediaAsset).toHaveBeenCalledWith(
        'rec_existing',
        'ws_1',
        expect.objectContaining({ actorUserId: 'user_1' })
      );
    });

    // ---------------------------------------------------------------------
    // Issue #0 - DELETE recording audit actor was lost before cleanup
    // Date: 2026-06-23
    // Bug: the media route deleted recordings without passing the authenticated
    //      user to the cleanup layer, so audit logs could attribute deletion to
    //      the recording creator instead of the actual deleter.
    // Fix: DELETE passes session.user_id as actorUserId to deleteMediaAsset.
    // ---------------------------------------------------------------------
    it('passes the authenticated user as the recording deletion audit actor', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_audit_actor',
        workspace_id: 'ws_1',
      });
      mockTranscriptionService.deleteMediaAsset.mockResolvedValue(undefined);

      const res = await app.request('/media/recordings/rec_audit_actor', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(204);
      expect(mockTranscriptionService.deleteMediaAsset).toHaveBeenCalledWith(
        'rec_audit_actor',
        'ws_1',
        expect.objectContaining({ actorUserId: 'user_1' })
      );
    });

    it('zwraca 403, gdy użytkownik nie ma dostępu do workspace', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockWorkspaceService.getMembership.mockResolvedValue(null);
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_forbidden',
        workspace_id: 'ws_other',
      });

      const res = await app.request('/media/recordings/rec_forbidden', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(403);
      expect(mockTranscriptionService.deleteMediaAsset).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ERROR] APP ERROR STACK',
        expect.objectContaining({
          message: 'Nie masz dostepu do tego workspace.',
          statusCode: 403,
        })
      );
    });
  });
});
