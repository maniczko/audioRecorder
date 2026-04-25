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

    it('returns 404 when asset does not exist', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue(null);

      const res = await app.request('/media/recordings/rec_nonexistent', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(404);
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

    it('returns 422 when diarization fails', async () => {
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

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.message).toContain('Diaryzacja nie powiodla sie');
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
        body: JSON.stringify({ meeting: { title: 'Test' } }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.summary).toBe('Test meeting');
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
        body: JSON.stringify({ meeting: { title: 'Test' } }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.mode).toBe('no-key');
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

    it('returns 400 when creation fails', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: 'rec_vp_fail',
        workspace_id: 'ws_1',
        file_path: '/tmp/audio.webm',
        transcript_json: '[]',
      });
      mockTranscriptionService.createVoiceProfileFromSpeaker.mockRejectedValue(
        new Error('No valid segments for speaker 99')
      );

      const res = await app.request('/media/recordings/rec_vp_fail/voice-profiles/from-speaker', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer fake_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ speakerId: '99', speakerName: 'Nobody' }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toContain('No valid segments');
    });
  });
});
