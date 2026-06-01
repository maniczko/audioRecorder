import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { createApp } from '../../app.ts';
import { mkdirSync, writeFileSync, existsSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

describe('Media Routes - Additional Coverage', () => {
  let app: ReturnType<typeof createApp>;
  let mockTranscriptionService: Record<string, ReturnType<typeof vi.fn>>;
  let mockWorkspaceService: { getMembership: ReturnType<typeof vi.fn> };
  let testUploadDir: string;
  let actualFs: typeof import('node:fs');

  beforeEach(async () => {
    actualFs = await vi.importActual<typeof import('node:fs')>('node:fs');
    const fsMock = (globalThis as any).__mockFs;
    fsMock.existsSync.mockImplementation((filePath?: string) =>
      typeof filePath === 'string' ? actualFs.existsSync(filePath) : false
    );
    fsMock.createReadStream.mockImplementation((...args: any[]) =>
      actualFs.createReadStream(...(args as Parameters<typeof actualFs.createReadStream>))
    );
    fsMock.readFileSync.mockImplementation((...args: any[]) =>
      actualFs.readFileSync(...(args as Parameters<typeof actualFs.readFileSync>))
    );
    fsMock.readdirSync.mockImplementation((...args: any[]) =>
      actualFs.readdirSync(...(args as Parameters<typeof actualFs.readdirSync>))
    );
    fsMock.mkdirSync.mockImplementation((...args: any[]) =>
      actualFs.mkdirSync(...(args as Parameters<typeof actualFs.mkdirSync>))
    );
    fsMock.rmSync.mockImplementation((...args: any[]) =>
      actualFs.rmSync(...(args as Parameters<typeof actualFs.rmSync>))
    );

    // Create a unique temporary upload directory for tests
    testUploadDir = actualFs.mkdtempSync(path.join(os.tmpdir(), 'media-test-'));
    actualFs.mkdirSync(testUploadDir, { recursive: true });

    mockTranscriptionService = {
      upsertMediaAsset: vi.fn(),
      upsertMediaAssetFromPath: vi.fn(),
      analyzeAudioQuality: vi.fn(),
      saveAudioQualityDiagnostics: vi.fn(),
      getMediaAsset: vi.fn(),
      deleteMediaAsset: vi.fn(),
      getMediaRecordings: vi.fn(),
      queueTranscription: vi.fn(),
      ensureTranscriptionJob: vi.fn(),
      normalizeRecording: vi.fn(),
      createVoiceProfileFromSpeaker: vi.fn(),
      generateVoiceCoaching: vi.fn(),
      getSpeakerAcousticFeatures: vi.fn(),
      saveTranscriptionResult: vi.fn(),
      markTranscriptionFailure: vi.fn(),
      diarizeFromTranscript: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
      _execute: vi.fn(),
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
    // Cleanup test upload directory
    try {
      actualFs.rmSync(testUploadDir, { recursive: true, force: true });
    } catch (_) {}
  });

  describe('GET /media/recordings', () => {
    it('returns recordings list when workspaceId is provided', async () => {
      mockTranscriptionService.getMediaRecordings.mockResolvedValue([
        { id: 'rec1', workspace_id: 'ws_1' },
        { id: 'rec2', workspace_id: 'ws_1' },
      ]);

      const res = await app.request('/media/recordings?workspaceId=ws_1', {
        method: 'GET',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.recordings).toHaveLength(2);
      expect(mockTranscriptionService.getMediaRecordings).toHaveBeenCalledWith('ws_1');
    });

    it('returns 400 when workspaceId is missing', async () => {
      const res = await app.request('/media/recordings', {
        method: 'GET',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toContain('Brakuje workspaceId');
    });
  });

  describe('DELETE /media/recordings/:recordingId', () => {
    it('returns 204 when asset is successfully deleted', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_to_delete',
        workspace_id: 'ws_1',
        file_path: '/tmp/audio.webm',
      });
      mockTranscriptionService.deleteMediaAsset.mockResolvedValue(undefined);

      const res = await app.request('/media/recordings/rec_to_delete', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(204);
      expect(mockTranscriptionService.deleteMediaAsset).toHaveBeenCalledWith(
        'rec_to_delete',
        'ws_1'
      );
    });

    it('returns 204 when asset does not exist so stale client deletes stay idempotent', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue(null);

      const res = await app.request('/media/recordings/rec_nonexistent', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(204);
      expect(mockTranscriptionService.deleteMediaAsset).not.toHaveBeenCalled();
    });

    it('returns 500 when deletion fails', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_error',
        workspace_id: 'ws_1',
        file_path: '/tmp/audio.webm',
      });
      mockTranscriptionService.deleteMediaAsset.mockRejectedValue(new Error('DB error'));

      const res = await app.request('/media/recordings/rec_error', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.message).toContain('Błąd podczas usuwania');
    });
  });

  describe('POST /media/recordings/:recordingId/normalize', () => {
    it('returns 200 when normalization succeeds', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_norm',
        workspace_id: 'ws_1',
        file_path: '/tmp/audio.webm',
      });
      mockTranscriptionService.normalizeRecording.mockResolvedValue(undefined);

      const res = await app.request('/media/recordings/rec_norm/normalize', {
        method: 'POST',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(mockTranscriptionService.normalizeRecording).toHaveBeenCalled();
    });

    it('returns 404 when asset does not exist', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue(null);

      const res = await app.request('/media/recordings/rec_missing/normalize', {
        method: 'POST',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /media/recordings/:recordingId/voice-coaching', () => {
    it('returns 200 with coaching data when speakerId is provided', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_voice',
        workspace_id: 'ws_1',
        file_path: '/tmp/audio.webm',
      });
      mockTranscriptionService.generateVoiceCoaching.mockResolvedValue({
        tips: ['Speak louder', 'Slow down'],
      });

      const res = await app.request('/media/recordings/rec_voice/voice-coaching', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer fake_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ speakerId: '0', segments: [] }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.coaching).toEqual({ tips: ['Speak louder', 'Slow down'] });
    });

    it('returns 400 when speakerId is missing', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_voice',
        workspace_id: 'ws_1',
        file_path: '/tmp/audio.webm',
      });

      const res = await app.request('/media/recordings/rec_voice/voice-coaching', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer fake_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toContain('Brakuje speakerId');
    });

    it('returns 404 when asset does not exist', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue(null);

      const res = await app.request('/media/recordings/rec_missing/voice-coaching', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer fake_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ speakerId: '0' }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /media/recordings/:recordingId/acoustic-features', () => {
    it('returns 200 with acoustic features when analysis succeeds', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_acoustic',
        workspace_id: 'ws_1',
        file_path: '/tmp/audio.webm',
      });
      mockTranscriptionService.getSpeakerAcousticFeatures.mockResolvedValue({
        pitch: 120,
        jitter: 0.005,
        shimmer: 0.03,
      });

      const res = await app.request('/media/recordings/rec_acoustic/acoustic-features', {
        method: 'POST',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pitch).toBe(120);
    });

    it('returns 404 when asset does not exist', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue(null);

      const res = await app.request('/media/recordings/rec_missing/acoustic-features', {
        method: 'POST',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /media/recordings/:recordingId/rediarize', () => {
    it('returns 200 with updated segments when rediarization succeeds', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_rediarize',
        workspace_id: 'ws_1',
        file_path: '/tmp/audio.webm',
        transcript_json: JSON.stringify([
          { text: 'Hello', timestamp: 0, endTimestamp: 1 },
          { text: 'World', timestamp: 1, endTimestamp: 2 },
        ]),
      });
      mockTranscriptionService.diarizeFromTranscript.mockResolvedValue({
        segments: [
          { text: 'Hello', timestamp: 0, endTimestamp: 1, speakerId: 0, rawSpeakerLabel: 'S1' },
          { text: 'World', timestamp: 1, endTimestamp: 2, speakerId: 1, rawSpeakerLabel: 'S2' },
        ],
        speakerCount: 2,
        speakerNames: { '0': 'Alice', '1': 'Bob' },
      });
      mockTranscriptionService.saveTranscriptionResult.mockResolvedValue(undefined);

      const res = await app.request('/media/recordings/rec_rediarize/rediarize', {
        method: 'POST',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.speakerCount).toBe(2);
      expect(data.speakerNames).toEqual({ '0': 'Alice', '1': 'Bob' });
      expect(data.segments).toHaveLength(2);
    });

    it('returns 400 when no transcription exists', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_empty',
        workspace_id: 'ws_1',
        file_path: '/tmp/audio.webm',
        transcript_json: '[]',
      });

      const res = await app.request('/media/recordings/rec_empty/rediarize', {
        method: 'POST',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toContain('Brak transkrypcji');
    });

    it('returns 200 no_changes when diarization cannot produce updated speakers', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_fail',
        workspace_id: 'ws_1',
        file_path: '/tmp/audio.webm',
        transcript_json: JSON.stringify([{ text: 'Hello', timestamp: 0 }]),
      });
      mockTranscriptionService.diarizeFromTranscript.mockResolvedValue(null);

      const res = await app.request('/media/recordings/rec_fail/rediarize', {
        method: 'POST',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        status: 'no_changes',
        code: 'rediarization_unavailable',
        message: 'Nie udało się wykryć nowych mówców. Transkrypt pozostaje bez zmian.',
        speakerCount: 0,
        speakerNames: {},
        segments: [],
      });
      expect(mockTranscriptionService.saveTranscriptionResult).not.toHaveBeenCalled();
    });

    it('returns 404 when asset does not exist', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue(null);

      const res = await app.request('/media/recordings/rec_missing/rediarize', {
        method: 'POST',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /media/analyze', () => {
    it('returns analysis result when transcription service returns data', async () => {
      const mockAnalyzeMeetingWithOpenAI = vi.fn().mockResolvedValue({
        summary: 'Test meeting',
        actionItems: ['Task 1'],
      });

      // Create app with the mock
      const testApp = createApp({
        authService: { getSession: vi.fn().mockResolvedValue({ user_id: 'user_1' }) },
        workspaceService: { getMembership: vi.fn().mockResolvedValue({ member_role: 'owner' }) },
        transcriptionService: {
          ...mockTranscriptionService,
          analyzeMeetingWithOpenAI: mockAnalyzeMeetingWithOpenAI,
        },
        config: { allowedOrigins: 'http://localhost:3000', trustProxy: false, uploadDir: '/tmp' },
      });

      const res = await testApp.request('/media/analyze', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer fake_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workspaceId: 'ws_1', meeting: { title: 'Test' } }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.summary).toBe('Test meeting');
      expect(mockAnalyzeMeetingWithOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: 'ws_1' })
      );
    });

    it('returns no-key mode when analysis returns null', async () => {
      const mockAnalyzeMeetingWithOpenAI = vi.fn().mockResolvedValue(null);

      const testApp = createApp({
        authService: { getSession: vi.fn().mockResolvedValue({ user_id: 'user_1' }) },
        workspaceService: { getMembership: vi.fn().mockResolvedValue({ member_role: 'owner' }) },
        transcriptionService: {
          ...mockTranscriptionService,
          analyzeMeetingWithOpenAI: mockAnalyzeMeetingWithOpenAI,
        },
        config: { allowedOrigins: 'http://localhost:3000', trustProxy: false, uploadDir: '/tmp' },
      });

      const res = await testApp.request('/media/analyze', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer fake_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workspaceId: 'ws_1', meeting: { title: 'Test' } }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.mode).toBe('no-key');
    });

    it('rejects anonymous requests before calling analysis service', async () => {
      const mockAnalyzeMeetingWithOpenAI = vi.fn().mockResolvedValue({
        summary: 'Should not run',
      });
      const testApp = createApp({
        authService: { getSession: vi.fn().mockResolvedValue(null) },
        workspaceService: { getMembership: vi.fn().mockResolvedValue({ member_role: 'owner' }) },
        transcriptionService: {
          ...mockTranscriptionService,
          analyzeMeetingWithOpenAI: mockAnalyzeMeetingWithOpenAI,
        },
        config: { allowedOrigins: 'http://localhost:3000', trustProxy: false, uploadDir: '/tmp' },
      });

      const res = await testApp.request('/media/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: 'ws_1', meeting: { title: 'Test' } }),
      });

      expect(res.status).toBe(401);
      expect(mockAnalyzeMeetingWithOpenAI).not.toHaveBeenCalled();
    });

    it('rejects requests without workspaceId before calling analysis service', async () => {
      const mockAnalyzeMeetingWithOpenAI = vi.fn().mockResolvedValue({
        summary: 'Should not run',
      });
      const testApp = createApp({
        authService: { getSession: vi.fn().mockResolvedValue({ user_id: 'user_1' }) },
        workspaceService: { getMembership: vi.fn().mockResolvedValue({ member_role: 'owner' }) },
        transcriptionService: {
          ...mockTranscriptionService,
          analyzeMeetingWithOpenAI: mockAnalyzeMeetingWithOpenAI,
        },
        config: { allowedOrigins: 'http://localhost:3000', trustProxy: false, uploadDir: '/tmp' },
      });

      const res = await testApp.request('/media/analyze', {
        method: 'POST',
        headers: { Authorization: 'Bearer fake_token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting: { title: 'Test' } }),
      });

      expect(res.status).toBe(400);
      expect(mockAnalyzeMeetingWithOpenAI).not.toHaveBeenCalled();
    });

    it('rejects requests for workspaces the user cannot access', async () => {
      const mockAnalyzeMeetingWithOpenAI = vi.fn().mockResolvedValue({
        summary: 'Should not run',
      });
      const testApp = createApp({
        authService: { getSession: vi.fn().mockResolvedValue({ user_id: 'user_1' }) },
        workspaceService: { getMembership: vi.fn().mockResolvedValue(null) },
        transcriptionService: {
          ...mockTranscriptionService,
          analyzeMeetingWithOpenAI: mockAnalyzeMeetingWithOpenAI,
        },
        config: { allowedOrigins: 'http://localhost:3000', trustProxy: false, uploadDir: '/tmp' },
      });

      const res = await testApp.request('/media/analyze', {
        method: 'POST',
        headers: { Authorization: 'Bearer fake_token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: 'foreign_ws', meeting: { title: 'Test' } }),
      });

      expect(res.status).toBe(403);
      expect(mockAnalyzeMeetingWithOpenAI).not.toHaveBeenCalled();
    });
  });

  describe('Chunked upload endpoints', () => {
    type UpsertMediaAssetFromPathInput = {
      recordingId: string;
      workspaceId: string;
      meetingId: string;
      contentType: string;
      filePath: string;
      createdByUserId: string;
    };

    const safeRecordingId = (recordingId: string) =>
      String(recordingId).replace(/[^a-zA-Z0-9_-]/g, '_');

    const chunkPathFor = (recordingId: string, index: number) =>
      path.join(testUploadDir, 'chunks', `${safeRecordingId(recordingId)}_${index}.chunk`);

    const listAssembledFiles = (recordingId: string) => {
      const chunksDir = path.join(testUploadDir, 'chunks');
      if (!existsSync(chunksDir)) return [];
      return readdirSync(chunksDir).filter((fileName) =>
        fileName.startsWith(`${safeRecordingId(recordingId)}_assembled_`)
      );
    };

    const uploadChunk = async (recordingId: string, index: number, total: number, body: Buffer) => {
      const res = await app.request(
        `/media/recordings/${recordingId}/audio/chunk?index=${index}&total=${total}`,
        {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer fake_token',
            'X-Workspace-Id': 'ws_1',
            'Content-Type': 'audio/webm',
          },
          body,
        }
      );
      expect(res.status).toBe(200);
      return res;
    };

    const finalizeUpload = (recordingId: string, total: number) =>
      app.request(`/media/recordings/${recordingId}/audio/finalize`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer fake_token',
          'Content-Type': 'application/json',
          'X-Workspace-Id': 'ws_1',
        },
        body: JSON.stringify({
          workspaceId: 'ws_1',
          meetingId: 'meeting_1',
          contentType: 'audio/webm',
          total,
        }),
      });

    const mockSuccessfulPathUpsert = () => {
      let assembledContent = '';
      let capturedInput: UpsertMediaAssetFromPathInput | null = null;

      mockTranscriptionService.upsertMediaAssetFromPath.mockImplementation(
        async (input: UpsertMediaAssetFromPathInput) => {
          capturedInput = input;
          assembledContent = readFileSync(input.filePath, 'utf8');

          return {
            id: input.recordingId,
            workspace_id: input.workspaceId,
            size_bytes: Buffer.byteLength(assembledContent),
            file_path: input.filePath,
            content_type: input.contentType,
            transcription_status: 'uploaded',
          };
        }
      );

      return {
        getCapturedInput: () => capturedInput,
        getAssembledContent: () => assembledContent,
      };
    };

    describe('GET /media/recordings/:recordingId/audio/chunk-status', () => {
      it('returns 400 when workspaceId is missing', async () => {
        const res = await app.request(
          '/media/recordings/rec_chunkstat_001/audio/chunk-status?total=5',
          {
            method: 'GET',
            headers: { Authorization: 'Bearer fake_token' },
          }
        );

        expect(res.status).toBe(400);
      });

      it('returns 400 when total parameter is missing or invalid', async () => {
        const res = await app.request('/media/recordings/rec_chunkstat_002/audio/chunk-status', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer fake_token',
            'X-Workspace-Id': 'ws_1',
          },
        });

        expect(res.status).toBe(400);
      });

      it('starts chunk-status tests with an isolated chunks directory', async () => {
        const chunksDir = path.join(testUploadDir, 'chunks');
        // The route should not see chunks from earlier tests.
        expect(existsSync(chunksDir)).toBe(false);
      });
    });

    describe('GET /media/recordings/:recordingId/audio/chunk-status integration', () => {
      it('returns isolated status with nextIndex when no chunks exist', async () => {
        const res = await app.request(
          '/media/recordings/rec_chunkstat_003/audio/chunk-status?total=5',
          {
            method: 'GET',
            headers: {
              Authorization: 'Bearer fake_token',
              'X-Workspace-Id': 'ws_1',
            },
          }
        );

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({
          nextIndex: 0,
          uploaded: 0,
          total: 5,
          resumable: false,
        });
      });

      it('returns isolated status with correct nextIndex when some chunks exist', async () => {
        const recordingId = 'rec_chunkstat_004';
        await uploadChunk(recordingId, 0, 4, Buffer.from('first'));
        await uploadChunk(recordingId, 1, 4, Buffer.from('second'));

        const res = await app.request(
          `/media/recordings/${recordingId}/audio/chunk-status?total=4`,
          {
            method: 'GET',
            headers: {
              Authorization: 'Bearer fake_token',
              'X-Workspace-Id': 'ws_1',
            },
          }
        );

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({
          nextIndex: 2,
          uploaded: 2,
          total: 4,
          resumable: true,
        });
      });
    });

    describe('PUT /media/recordings/:recordingId/audio/chunk', () => {
      it('returns 400 when workspaceId is missing', async () => {
        const res = await app.request('/media/recordings/rec1/audio/chunk?index=0&total=5', {
          method: 'PUT',
          headers: { Authorization: 'Bearer fake_token' },
          body: Buffer.from('chunk-data'),
        });

        expect(res.status).toBe(400);
      });

      it('returns 400 when index/total parameters are invalid', async () => {
        const res = await app.request('/media/recordings/rec1/audio/chunk?index=abc&total=5', {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer fake_token',
            'X-Workspace-Id': 'ws_1',
          },
          body: Buffer.from('chunk-data'),
        });

        expect(res.status).toBe(400);
      });

      it('returns 400 when total > 600', async () => {
        const res = await app.request('/media/recordings/rec1/audio/chunk?index=0&total=601', {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer fake_token',
            'X-Workspace-Id': 'ws_1',
          },
          body: Buffer.from('chunk-data'),
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.message).toContain('Za dużo chunków');
      });

      it('returns 413 when chunk > 6MB', async () => {
        const largeChunk = Buffer.alloc(6 * 1024 * 1024 + 1, 0);
        const res = await app.request('/media/recordings/rec1/audio/chunk?index=0&total=5', {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer fake_token',
            'X-Workspace-Id': 'ws_1',
          },
          body: largeChunk,
        });

        expect(res.status).toBe(413);
      });

      it('returns 200 and saves chunk when valid', async () => {
        const res = await app.request('/media/recordings/rec1/audio/chunk?index=0&total=5', {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer fake_token',
            'X-Workspace-Id': 'ws_1',
          },
          body: Buffer.from('test-chunk-data'),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.index).toBe(0);
        expect(data.total).toBe(5);

        // Verify chunk file was created
        const chunksDir = path.join(testUploadDir, 'chunks');
        const chunkPath = path.join(chunksDir, 'rec1_0.chunk');
        expect(existsSync(chunkPath)).toBe(true);
      });
    });

    describe('POST /media/recordings/:recordingId/audio/finalize', () => {
      it('returns 401 when not authenticated', async () => {
        const res = await app.request('/media/recordings/rec1/audio/finalize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Workspace-Id': 'ws_1',
          },
          body: JSON.stringify({ workspaceId: 'ws_1', total: 2 }),
        });

        expect(res.status).toBe(401);
      });

      it('returns 400 when workspaceId is missing', async () => {
        const res = await app.request('/media/recordings/rec1/audio/finalize', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer fake_token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ total: 2 }),
        });

        expect(res.status).toBe(400);
      });

      it('returns 400 when total is missing or invalid', async () => {
        const res = await app.request('/media/recordings/rec1/audio/finalize', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer fake_token',
            'Content-Type': 'application/json',
            'X-Workspace-Id': 'ws_1',
          },
          body: JSON.stringify({ workspaceId: 'ws_1' }),
        });

        expect(res.status).toBe(400);
      });

      it('returns 400 when chunk assembly fails (missing chunks)', async () => {
        const recordingId = 'rec1';
        const res = await app.request('/media/recordings/rec1/audio/finalize', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer fake_token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workspaceId: 'ws_1',
            total: 3,
          }),
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.message).toBeTruthy(); // Error varies by Node.js stream implementation
        expect(listAssembledFiles(recordingId)).toEqual([]);
      });

      it('returns 200, creates asset, and cleans up chunk files when all chunks are present', async () => {
        const recordingId = 'rec_finalize_success';
        const total = 3;
        const upsertCapture = mockSuccessfulPathUpsert();

        await uploadChunk(recordingId, 0, total, Buffer.from('voice-'));
        await uploadChunk(recordingId, 1, total, Buffer.from('log-'));
        await uploadChunk(recordingId, 2, total, Buffer.from('payload'));

        const res = await finalizeUpload(recordingId, total);

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toMatchObject({
          id: recordingId,
          workspaceId: 'ws_1',
          sizeBytes: Buffer.byteLength('voice-log-payload'),
          audioQuality: null,
        });
        expect(upsertCapture.getCapturedInput()).toMatchObject({
          recordingId,
          workspaceId: 'ws_1',
          meetingId: 'meeting_1',
          contentType: 'audio/webm',
          createdByUserId: 'user_1',
        });
        expect(upsertCapture.getAssembledContent()).toBe('voice-log-payload');
        expect(existsSync(chunkPathFor(recordingId, 0))).toBe(false);
        expect(existsSync(chunkPathFor(recordingId, 1))).toBe(false);
        expect(existsSync(chunkPathFor(recordingId, 2))).toBe(false);
        expect(listAssembledFiles(recordingId)).toEqual([]);
      });

      it('Regression: #0 - finalizes large normalized audio as segmented storage', async () => {
        const recordingId = 'rec_finalize_segmented';
        const total = 5;
        let capturedInput: any = null;

        mockTranscriptionService.upsertMediaAssetFromPreparedAudio = vi.fn(async (input: any) => {
          capturedInput = input;
          return {
            id: input.recordingId,
            workspace_id: input.workspaceId,
            size_bytes: input.normalizedSizeBytes,
            file_path: 'ws_1/rec_finalize_segmented/manifest.json',
            content_type: 'audio/webm',
            storage_mode: 'segmented',
            media_manifest_json: JSON.stringify({
              version: 1,
              storageMode: 'segmented',
              parts: input.parts.map((part: any) => ({
                index: part.index,
                path: `ws_1/rec_finalize_segmented/part-${String(part.index).padStart(3, '0')}.webm`,
                sizeBytes: part.sizeBytes,
              })),
            }),
            transcription_status: 'queued',
          };
        });

        const chunk = Buffer.alloc(5 * 1024 * 1024 + 1, 1);
        for (let index = 0; index < total; index += 1) {
          await uploadChunk(recordingId, index, total, chunk);
        }

        const res = await finalizeUpload(recordingId, total);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data).toMatchObject({
          id: recordingId,
          workspaceId: 'ws_1',
          storageMode: 'segmented',
          partCount: 2,
        });
        expect(mockTranscriptionService.upsertMediaAssetFromPath).not.toHaveBeenCalled();
        expect(mockTranscriptionService.upsertMediaAssetFromPreparedAudio).toHaveBeenCalledOnce();
        expect(capturedInput).toMatchObject({
          recordingId,
          workspaceId: 'ws_1',
          meetingId: 'meeting_1',
          contentType: 'audio/webm',
          createdByUserId: 'user_1',
        });
        expect(capturedInput.normalizedSizeBytes).toBeGreaterThan(24 * 1024 * 1024);
        expect(capturedInput.parts).toHaveLength(2);
        expect(capturedInput.parts.every((part: any) => part.sizeBytes <= 20 * 1024 * 1024)).toBe(
          true
        );
      });

      it('keeps uploaded chunks retryable and removes assembled temp file after storage error', async () => {
        const recordingId = 'rec_finalize_retry';
        const total = 2;
        const upsertCapture = mockSuccessfulPathUpsert();
        const storageError = Object.assign(new Error('Brak miejsca na dysku'), {
          code: 'ENOSPC',
        });
        mockTranscriptionService.upsertMediaAssetFromPath.mockRejectedValueOnce(storageError);

        await uploadChunk(recordingId, 0, total, Buffer.from('retry-'));
        await uploadChunk(recordingId, 1, total, Buffer.from('payload'));

        const failedRes = await finalizeUpload(recordingId, total);

        expect(failedRes.status).toBe(507);
        expect(existsSync(chunkPathFor(recordingId, 0))).toBe(true);
        expect(existsSync(chunkPathFor(recordingId, 1))).toBe(true);
        expect(listAssembledFiles(recordingId)).toEqual([]);

        const retryRes = await finalizeUpload(recordingId, total);

        expect(retryRes.status).toBe(200);
        expect(upsertCapture.getAssembledContent()).toBe('retry-payload');
        expect(existsSync(chunkPathFor(recordingId, 0))).toBe(false);
        expect(existsSync(chunkPathFor(recordingId, 1))).toBe(false);
        expect(listAssembledFiles(recordingId)).toEqual([]);
      });
    });
  });

  describe('Disk space management', () => {
    it('GET /media/disk-space/status returns disk space info', async () => {
      const res = await app.request('/media/disk-space/status', {
        method: 'GET',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('ok');
      expect(data).toHaveProperty('timestamp');
    });

    it('POST /media/disk-space/cleanup returns 403 for non-admin users', async () => {
      const res = await app.request('/media/disk-space/cleanup', {
        method: 'POST',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.message).toContain('uprawnienia administratora');
    });

    it.skip('POST /media/disk-space/cleanup cleans up old chunks for admin', async () => {
      // TODO: Create integration test for admin cleanup with proper session mocking.
      // SKIP: Complex to mock session/role properly — covered by integration tests.
      // The 403 case for non-admin is already tested above.
      expect(true).toBe(true);
    });
  });

  // ── POST /media/recordings/:recordingId/voice-profiles/from-speaker ──────

  describe('POST /media/recordings/:recordingId/voice-profiles/from-speaker', () => {
    it('returns 201 when voice profile is created successfully', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_vp',
        workspace_id: 'ws_1',
        file_path: '/tmp/audio.webm',
        transcript_json: JSON.stringify([
          { text: 'hello', speakerId: '0', timestamp: 0, endTimestamp: 1 },
        ]),
      });
      mockTranscriptionService.createVoiceProfileFromSpeaker.mockResolvedValue({
        id: 'vp_new',
        speaker_name: 'Anna',
      });

      const res = await app.request('/media/recordings/rec_vp/voice-profiles/from-speaker', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer fake_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ speakerId: '0', speakerName: 'Anna' }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBe('vp_new');
      expect(mockTranscriptionService.createVoiceProfileFromSpeaker).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'rec_vp' }),
        '0',
        'Anna',
        'user_1',
        {}
      );
    });

    it('preflights a stale local audio source without creating a voice profile', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_vp_stale_audio',
        workspace_id: 'ws_1',
        file_path: path.join(testUploadDir, 'missing-audio.mp3'),
        content_type: 'audio/mpeg',
        transcription_status: 'completed',
        transcript_json: JSON.stringify([
          { text: 'fragment do probki', speakerId: '0', timestamp: 0, endTimestamp: 3 },
        ]),
      });

      const res = await app.request(
        '/media/recordings/rec_vp_stale_audio/voice-profiles/from-speaker/preflight',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer fake_token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ speakerId: '0', speakerName: 'Anna' }),
        }
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toMatchObject({
        ready: false,
        code: 'audio_source_unavailable',
        stage: 'audio_source',
        recordingId: 'rec_vp_stale_audio',
        speakerId: '0',
        speakerName: 'Anna',
        segmentCount: 1,
        matchedSegmentCount: 1,
      });
      expect(mockTranscriptionService.createVoiceProfileFromSpeaker).not.toHaveBeenCalled();
    });

    it('preflights an available local audio source before voice profile creation', async () => {
      const audioPath = path.join(testUploadDir, 'available-audio.mp3');
      actualFs.writeFileSync(audioPath, Buffer.from('fake-audio'));
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_vp_available_audio',
        workspace_id: 'ws_1',
        file_path: audioPath,
        content_type: 'audio/mpeg',
        transcription_status: 'completed',
        transcript_json: JSON.stringify([
          { text: 'fragment do probki', speakerId: '0', timestamp: 0, endTimestamp: 3 },
        ]),
      });

      const res = await app.request(
        '/media/recordings/rec_vp_available_audio/voice-profiles/from-speaker/preflight',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer fake_token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ speakerId: '0', speakerName: 'Anna' }),
        }
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toMatchObject({
        ready: true,
        stage: 'ready',
        recordingId: 'rec_vp_available_audio',
        speakerId: '0',
        speakerName: 'Anna',
        segmentCount: 1,
        matchedSegmentCount: 1,
      });
      expect(mockTranscriptionService.createVoiceProfileFromSpeaker).not.toHaveBeenCalled();
    });

    it('Regression: accepts production transcript_json objects keyed by segment index', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_vp_object_segments',
        workspace_id: 'ws_1',
        file_path: '/tmp/audio.webm',
        transcription_status: 'completed',
        transcript_json: JSON.stringify({
          0: { text: 'pierwszy mowca', speakerId: 0, timestamp: 0, endTimestamp: 4 },
          1: { text: 'drugi mowca', speakerId: 1, timestamp: 5, endTimestamp: 9 },
        }),
      });
      mockTranscriptionService.createVoiceProfileFromSpeaker.mockResolvedValue({
        id: 'vp_object_segments',
        speaker_name: 'Smoke Speaker',
      });

      const res = await app.request(
        '/media/recordings/rec_vp_object_segments/voice-profiles/from-speaker',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer fake_token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ speakerId: '1', speakerName: 'Smoke Speaker' }),
        }
      );

      expect(res.status).toBe(201);
      expect(mockTranscriptionService.createVoiceProfileFromSpeaker).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'rec_vp_object_segments' }),
        '1',
        'Smoke Speaker',
        'user_1',
        {}
      );
    });

    it('uses provided transcript segments for manually reassigned speaker samples', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_vp_manual',
        workspace_id: 'ws_1',
        file_path: '/tmp/audio.webm',
        transcript_json: JSON.stringify([
          { text: 'old speaker', speakerId: '0', timestamp: 0, endTimestamp: 1 },
        ]),
      });
      mockTranscriptionService.createVoiceProfileFromSpeaker.mockResolvedValue({
        id: 'vp_manual',
        speaker_name: 'Barbara',
      });
      const segments = [
        {
          id: 's1',
          text: 'manual assignment sample',
          speakerId: '99',
          timestamp: 1,
          endTimestamp: 7,
        },
      ];

      const res = await app.request('/media/recordings/rec_vp_manual/voice-profiles/from-speaker', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer fake_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ speakerId: '99', speakerName: 'Barbara', segments }),
      });

      expect(res.status).toBe(201);
      expect(mockTranscriptionService.createVoiceProfileFromSpeaker).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'rec_vp_manual' }),
        '99',
        'Barbara',
        'user_1',
        { transcriptSegments: segments }
      );
    });

    it('Regression: infers clip end time for reassigned speaker segments without endTimestamp', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_vp_infer_end',
        workspace_id: 'ws_1',
        file_path: '/tmp/audio.webm',
        transcript_json: JSON.stringify([
          { text: 'old speaker', speakerId: '0', timestamp: 0, endTimestamp: 1 },
        ]),
      });
      mockTranscriptionService.createVoiceProfileFromSpeaker.mockResolvedValue({
        id: 'vp_infer_end',
        speaker_name: 'Barbara',
      });
      const segments = [
        {
          id: 's1',
          text: 'manual assignment sample',
          speakerId: '99',
          timestamp: 1,
        },
        {
          id: 's2',
          text: 'next speaker starts later',
          speakerId: '0',
          timestamp: 8,
        },
      ];

      const res = await app.request(
        '/media/recordings/rec_vp_infer_end/voice-profiles/from-speaker',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer fake_token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ speakerId: '99', speakerName: 'Barbara', segments }),
        }
      );

      expect(res.status).toBe(201);
      expect(mockTranscriptionService.createVoiceProfileFromSpeaker).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'rec_vp_infer_end' }),
        '99',
        'Barbara',
        'user_1',
        {
          transcriptSegments: expect.arrayContaining([
            expect.objectContaining({ id: 's1', speakerId: '99', timestamp: 1, endTimestamp: 8 }),
          ]),
        }
      );
    });

    it('returns 404 when asset does not exist', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue(null);

      const res = await app.request('/media/recordings/rec_missing/voice-profiles/from-speaker', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer fake_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ speakerId: '0', speakerName: 'Anna' }),
      });

      expect(res.status).toBe(404);
    });

    it('returns 400 without calling creation when speakerId is missing', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_vp_missing_speaker',
        workspace_id: 'ws_1',
        file_path: '/tmp/audio.webm',
        transcript_json: JSON.stringify([
          { text: 'hello', speakerId: '0', timestamp: 0, endTimestamp: 1 },
        ]),
      });

      const res = await app.request(
        '/media/recordings/rec_vp_missing_speaker/voice-profiles/from-speaker',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer fake_token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ speakerName: 'Anna' }),
        }
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toContain('speakerId');
      expect(data.code).toBe('missing_speaker_id');
      expect(data.stage).toBe('validation');
      expect(data.recordingId).toBe('rec_vp_missing_speaker');
      expect(data.requestId).toEqual(expect.any(String));
      expect(mockTranscriptionService.createVoiceProfileFromSpeaker).not.toHaveBeenCalled();
    });

    it('returns coded validation error when speakerName is missing', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_vp_missing_name',
        workspace_id: 'ws_1',
        file_path: '/tmp/audio.webm',
        transcript_json: JSON.stringify([
          { text: 'hello', speakerId: '0', timestamp: 0, endTimestamp: 1 },
        ]),
      });

      const res = await app.request(
        '/media/recordings/rec_vp_missing_name/voice-profiles/from-speaker',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer fake_token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ speakerId: '0' }),
        }
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toEqual(
        expect.objectContaining({
          code: 'missing_speaker_name',
          stage: 'validation',
          recordingId: 'rec_vp_missing_name',
          speakerId: '0',
        })
      );
      expect(mockTranscriptionService.createVoiceProfileFromSpeaker).not.toHaveBeenCalled();
    });

    it('returns 409 without calling creation while transcription is not ready', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_vp_processing',
        workspace_id: 'ws_1',
        file_path: '/tmp/audio.webm',
        transcription_status: 'processing',
        transcript_json: '[]',
      });

      const res = await app.request(
        '/media/recordings/rec_vp_processing/voice-profiles/from-speaker',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer fake_token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ speakerId: '0', speakerName: 'Anna' }),
        }
      );

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.message).toContain('transkrypcji');
      expect(mockTranscriptionService.createVoiceProfileFromSpeaker).not.toHaveBeenCalled();
    });

    it('returns 422 without calling creation when requested speaker has no transcript segments', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_vp_wrong_speaker',
        workspace_id: 'ws_1',
        file_path: '/tmp/audio.webm',
        transcription_status: 'completed',
        transcript_json: JSON.stringify([
          { text: 'hello', speakerId: '0', timestamp: 0, endTimestamp: 1 },
        ]),
      });

      const res = await app.request(
        '/media/recordings/rec_vp_wrong_speaker/voice-profiles/from-speaker',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer fake_token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ speakerId: '99', speakerName: 'Nobody' }),
        }
      );

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.message).toContain('wypowiedzi');
      expect(data).toEqual(
        expect.objectContaining({
          code: 'speaker_segment_not_found',
          stage: 'transcript',
          recordingId: 'rec_vp_wrong_speaker',
          speakerId: '99',
          speakerName: 'Nobody',
          segmentCount: 1,
          matchedSegmentCount: 0,
        })
      );
      expect(mockTranscriptionService.createVoiceProfileFromSpeaker).not.toHaveBeenCalled();
    });

    it('normalizes speakerName-matched override segments to the requested speakerId', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_vp_name_match',
        workspace_id: 'ws_1',
        file_path: '/tmp/audio.webm',
        transcription_status: 'completed',
        transcript_json: JSON.stringify([
          { text: 'old label', speakerId: 'speaker_1', timestamp: 0, endTimestamp: 1 },
        ]),
      });
      mockTranscriptionService.createVoiceProfileFromSpeaker.mockResolvedValue({
        id: 'vp_name_match',
        speaker_name: 'Barbara',
      });

      const res = await app.request(
        '/media/recordings/rec_vp_name_match/voice-profiles/from-speaker',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer fake_token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            speakerId: 'speaker_2',
            speakerName: 'Barbara',
            segments: [
              {
                id: 's1',
                text: 'Fragment przypisany do Barbary',
                speakerId: 'speaker_1',
                speakerName: 'Barbara',
                startTime: 2,
                endTime: 8,
              },
            ],
          }),
        }
      );

      expect(res.status).toBe(201);
      expect(mockTranscriptionService.createVoiceProfileFromSpeaker).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'rec_vp_name_match' }),
        'speaker_2',
        'Barbara',
        'user_1',
        {
          transcriptSegments: [
            expect.objectContaining({
              id: 's1',
              speakerId: 'speaker_2',
              speakerName: 'Barbara',
              timestamp: 2,
              endTimestamp: 8,
            }),
          ],
        }
      );
    });

    it('returns diagnostic audio_source_unavailable when creation cannot load audio', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_vp_fail',
        workspace_id: 'ws_1',
        file_path: '/tmp/audio.webm',
        transcript_json: JSON.stringify([
          { text: 'short clip', speakerId: '99', timestamp: 0, endTimestamp: 0.5 },
        ]),
      });
      mockTranscriptionService.createVoiceProfileFromSpeaker.mockRejectedValue(
        new Error('Nie mozna pobrac pliku audio do probki glosu.')
      );

      const res = await app.request('/media/recordings/rec_vp_fail/voice-profiles/from-speaker', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer fake_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ speakerId: '99', speakerName: 'Nobody' }),
      });

      expect(res.status).toBe(424);
      const data = await res.json();
      expect(data).toEqual(
        expect.objectContaining({
          code: 'audio_source_unavailable',
          message: 'Audio nie jest dostepne na serwerze. Zaimportuj nagranie ponownie.',
          stage: 'audio_source',
          recordingId: 'rec_vp_fail',
          speakerId: '99',
          speakerName: 'Nobody',
          segmentCount: 1,
          matchedSegmentCount: 1,
          requestId: expect.any(String),
        })
      );
      expect(JSON.stringify(data)).not.toContain('/tmp/audio.webm');
      expect(JSON.stringify(data)).not.toContain('signed');
    });

    it('returns diagnostic embedding_failed instead of a generic 400', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_vp_embedding_fail',
        workspace_id: 'ws_1',
        file_path: '/tmp/audio.webm',
        transcript_json: JSON.stringify([
          { text: 'voice sample', speakerId: '2', timestamp: 0, endTimestamp: 4 },
        ]),
      });
      const error = Object.assign(new Error('Embedding provider unavailable'), {
        code: 'embedding_failed',
        stage: 'embedding',
        statusCode: 503,
      });
      mockTranscriptionService.createVoiceProfileFromSpeaker.mockRejectedValue(error);

      const res = await app.request(
        '/media/recordings/rec_vp_embedding_fail/voice-profiles/from-speaker',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer fake_token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ speakerId: '2', speakerName: 'Barbara' }),
        }
      );

      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data).toEqual(
        expect.objectContaining({
          code: 'embedding_failed',
          stage: 'embedding',
          recordingId: 'rec_vp_embedding_fail',
          speakerId: '2',
          speakerName: 'Barbara',
        })
      );
    });
  });
});
