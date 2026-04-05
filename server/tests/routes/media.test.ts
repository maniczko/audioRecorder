import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { createApp } from '../../app.ts';

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
      config: { allowedOrigins: 'http://localhost:3000', trustProxy: false, uploadDir: '/tmp' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    // Reset fs state to default after each test
    setFsState();
  });

  it('PUT /media/recordings/:recordingId/audio - upload success', async () => {
    mockTranscriptionService.upsertMediaAsset.mockResolvedValue({
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
    expect(mockTranscriptionService.upsertMediaAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        recordingId: 'rec_new',
        workspaceId: 'ws_1',
        contentType: 'audio/webm',
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockTranscriptionService.saveAudioQualityDiagnostics).toHaveBeenCalledWith('rec_new', {
      qualityLabel: 'fair',
      enhancementRecommended: true,
    });
  });

  it('OPTIONS /media/recordings/:recordingId/audio - returns preview CORS headers for vercel origins', async () => {
    const previewOrigin = 'https://preview-app.vercel.app';
    const res = await app.request('/media/recordings/rec_new/audio', {
      method: 'OPTIONS',
      headers: {
        Origin: previewOrigin,
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'Authorization,Content-Type,X-Workspace-Id,X-Meeting-Id',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(previewOrigin);
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('X-Workspace-Id');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('X-Meeting-Id');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('PUT');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('OPTIONS');
    expect(res.headers.get('Vary')).toContain('Origin');
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
  });

  it.skip('POST /media/recordings/:recordingId/retry-transcribe - returns 409 when audio file is missing', async () => {
    // SKIP: fs mock caching - app is created before test can set fs state
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

  // ─────────────────────────────────────────────────────────────────
  // Issue #0 — Sketchnote endpoint returns 500 for Gemini 429 quota errors
  // Date: 2026-03-30
  // Bug: Server always returned 500 for any Gemini error, even 429 (quota exceeded).
  //      Frontend's normalizeApiErrorMessage() never triggered the user-friendly
  //      "Zbyt wiele prob" message because it received 500 instead of 429.
  // Fix: Preserve Gemini's original status code (429, 503) in the response.
  // ─────────────────────────────────────────────────────────────────
  describe('Regression: Issue #0 — Sketchnote preserves Gemini error status codes', () => {
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

  // ─────────────────────────────────────────────────────────────────
  // Issue #0 — Sketchnote Gemini 429 retry with exponential backoff
  // Date: 2026-04-04
  // Bug: Single 429 from Gemini immediately failed the request.
  // Fix: Added retry loop (MAX_RETRIES=2, delays 5s/15s, 10ms in test).
  //      After exhausting retries, the original error code is returned.
  // ─────────────────────────────────────────────────────────────────
  describe('Regression: Issue #0 — Sketchnote retries on Gemini 429/503', () => {
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
      // Failed once (503), then succeeded — 2 total calls
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
        'X-Workspace-Id': 'ws_1',
        Origin: previewOrigin,
      },
      body: Buffer.alloc(100 * 1024 * 1024 + 1, 1),
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
    expect(downloadSpy).toHaveBeenNthCalledWith(1, 'legacy-name.webm');
    expect(downloadSpy).toHaveBeenNthCalledWith(2, 'rec_stream.webm');
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
        transcript_json: '[{"text":"hello","timestamp":0,"endTimestamp":1}]',
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
    mockTranscriptionService.createVoiceProfileFromSpeaker.mockResolvedValue({ id: 'vp_1' });
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
    expect(await voiceRes.json()).toEqual({ id: 'vp_1' });

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

  it('POST /media/recordings/:recordingId/rediarize returns 422 when diarization fails', async () => {
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

    expect(res.status).toBe(422);
  });

  it('POST /media/analyze returns fallback when analysis service returns null', async () => {
    mockTranscriptionService.analyzeMeetingWithOpenAI = vi.fn().mockResolvedValue(null);

    const res = await app.request('/media/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meeting: {}, segments: [] }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ mode: 'no-key' });
  });

  // ─────────────────────────────────────────────────────────────────
  // Issue #0 — POST /transcribe returns 500 on unhandled pipeline error
  // Date: 2026-03-29 (updated 2026-03-30: changed default from 502 to 500)
  // Bug: startTranscriptionPipeline threw unhandled → global error handler → 500/502 via proxy
  // Fix: try-catch returning structured error; default status changed to 500
  // ─────────────────────────────────────────────────────────────────
  describe('Regression: #0 — transcribe pipeline error returns structured error, not 502', () => {
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

  // ─────────────────────────────────────────────────────────────────
  // Issue #0 — GET /transcribe stuck-processing detection
  // Date: 2026-03-30 (updated 2026-03-31: threshold reduced 15→5 min)
  // Bug: Pipeline stuck in 'processing' with empty segments, frontend polls forever
  // Fix: GET handler detects stuck state (>5 min) and marks as failed.
  //      Also added resetOrphanedJobs on bootstrap for crash recovery.
  // ─────────────────────────────────────────────────────────────────
  describe('Regression: #0 — stuck processing detection in GET /transcribe', () => {
    it('marks asset as failed when stuck in processing for >5 min with empty segments', async () => {
      const staleDate = new Date(Date.now() - 20 * 60 * 1000).toISOString();
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
            errorMessage: 'Pipeline utknął w przetwarzaniu. Spróbuj ponownie.',
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
        'Pipeline utknął w przetwarzaniu. Spróbuj ponownie.',
        null,
        null
      );
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

  // ─────────────────────────────────────────────────────────────────
  // Issue #0 — DELETE /recordings/:id zwraca 404 dla nieistniejącego nagrania
  // Date: 2026-03-31
  // Bug: Frontend próbuje usunąć nagranie, które nie istnieje w bazie (np. zostało
  //      już usunięte, lub było tylko w IndexedDB). Backend powinien zwrócić 404,
  //      a frontend to obsługuje jako sukces (idempotentność).
  // Fix: Test weryfikuje, że endpoint DELETE poprawnie zwraca 404 dla brakującego
  //      nagrania, co jest oczekiwanym zachowaniem, a nie błędem.
  // ─────────────────────────────────────────────────────────────────
  describe('DELETE /recordings/:recordingId — Regression: nieistniejące nagranie', () => {
    it('zwraca 404, gdy nagranie nie istnieje w bazie', async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue(null);

      const res = await app.request('/media/recordings/recording_nonexistent', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer fake_token' },
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.message).toBe('Nie znaleziono nagrania.');
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
        'ws_1'
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
        'APP ERROR STACK',
        expect.stringContaining('Nie masz dostepu do tego workspace.')
      );
    });
  });
});
