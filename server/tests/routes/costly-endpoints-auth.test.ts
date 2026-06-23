import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp } from '../../app.ts';

describe('Costly endpoint auth contract', () => {
  let app: ReturnType<typeof createApp>;
  let transcriptionService: Record<string, ReturnType<typeof vi.fn>>;
  let authService: { getSession: ReturnType<typeof vi.fn> };
  let workspaceService: {
    getMembership: ReturnType<typeof vi.fn>;
    upsertVoiceProfile: ReturnType<typeof vi.fn>;
  };

  const authenticatedSession = {
    id: 'session_1',
    user_id: 'user_1',
    workspace_id: 'ws_allowed',
    role: 'member',
  };

  const mediaAsset = {
    id: 'rec_1',
    workspace_id: 'ws_forbidden',
    meeting_id: 'meeting_1',
    file_path: 'rec_1.webm',
    content_type: 'audio/webm',
    transcription_status: 'completed',
    transcript_json: JSON.stringify([{ text: 'Test', speakerId: 's1', timestamp: 0 }]),
    diarization_json: JSON.stringify({ summary: 'Test summary' }),
  };

  beforeEach(() => {
    transcriptionService = {
      startTranscriptionPipeline: vi.fn(),
      retryTranscription: vi.fn(),
      analyzeMeetingWithOpenAI: vi.fn(),
      generateVoiceCoaching: vi.fn(),
      rediarizeRecording: vi.fn(),
      diarizeFromTranscript: vi.fn(),
      saveTranscriptionResult: vi.fn(),
      ensureTranscriptionJob: vi.fn(),
      transcribeLiveChunk: vi.fn(),
      computeEmbedding: vi.fn(),
      queryRAG: vi.fn(),
      getMediaAsset: vi.fn().mockResolvedValue(mediaAsset),
    };
    authService = { getSession: vi.fn().mockResolvedValue(null) };
    workspaceService = {
      getMembership: vi.fn(),
      upsertVoiceProfile: vi.fn(),
    };

    app = createApp({
      authService: authService as any,
      workspaceService: workspaceService as any,
      transcriptionService: transcriptionService as any,
      db: null,
      config: { allowedOrigins: '*', trustProxy: true, uploadDir: process.cwd() },
    });
  });

  test.each([
    ['POST', '/media/recordings/rec_1/transcribe', JSON.stringify({ workspaceId: 'ws1' })],
    ['POST', '/media/recordings/rec_1/retry-transcribe', JSON.stringify({ workspaceId: 'ws1' })],
    ['POST', '/media/recordings/rec_1/voice-coaching', JSON.stringify({ workspaceId: 'ws1' })],
    ['POST', '/media/recordings/rec_1/rediarize', JSON.stringify({ workspaceId: 'ws1' })],
    ['POST', '/media/recordings/rec_1/sketchnote', JSON.stringify({ workspaceId: 'ws1' })],
    ['POST', '/media/analyze', JSON.stringify({ workspaceId: 'ws1', transcript: [] })],
    ['POST', '/transcribe/live', Buffer.alloc(2_000, 1)],
    ['POST', '/workspaces/ws1/rag/ask', JSON.stringify({ question: 'Co ustalono?' })],
    ['POST', '/voice-profiles', Buffer.alloc(2_000, 1)],
  ])('rejects anonymous %s %s before costly work starts', async (method, path, body) => {
    const response = await app.request(path, {
      method,
      headers: { 'Content-Type': typeof body === 'string' ? 'application/json' : 'audio/webm' },
      body,
    });

    expect(response.status).toBe(401);
    for (const fn of Object.values(transcriptionService)) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  test.each([
    ['POST', '/media/recordings/rec_1/transcribe', JSON.stringify({ workspaceId: 'ws_forbidden' })],
    [
      'POST',
      '/media/recordings/rec_1/retry-transcribe',
      JSON.stringify({ workspaceId: 'ws_forbidden' }),
    ],
    [
      'POST',
      '/media/recordings/rec_1/voice-coaching',
      JSON.stringify({ workspaceId: 'ws_forbidden', speakerId: 's1' }),
    ],
    ['POST', '/media/recordings/rec_1/rediarize', JSON.stringify({ workspaceId: 'ws_forbidden' })],
    ['POST', '/media/recordings/rec_1/sketchnote', JSON.stringify({ workspaceId: 'ws_forbidden' })],
    ['POST', '/media/analyze', JSON.stringify({ workspaceId: 'ws_forbidden', transcript: [] })],
    ['POST', '/transcribe/live', Buffer.alloc(2_000, 1)],
    ['POST', '/workspaces/ws_forbidden/rag/ask', JSON.stringify({ question: 'Co ustalono?' })],
    ['POST', '/voice-profiles', Buffer.alloc(2_000, 1)],
  ])('rejects authenticated %s %s without workspace access', async (method, path, body) => {
    authService.getSession.mockResolvedValue(authenticatedSession);
    workspaceService.getMembership.mockResolvedValue(null);

    const response = await app.request(path, {
      method,
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': typeof body === 'string' ? 'application/json' : 'audio/webm',
        'X-Speaker-Name': 'Iwo',
      },
      body,
    });

    expect(response.status).toBe(403);
    expect(workspaceService.getMembership).toHaveBeenCalled();
    expect(transcriptionService.startTranscriptionPipeline).not.toHaveBeenCalled();
    expect(transcriptionService.retryTranscription).not.toHaveBeenCalled();
    expect(transcriptionService.analyzeMeetingWithOpenAI).not.toHaveBeenCalled();
    expect(transcriptionService.generateVoiceCoaching).not.toHaveBeenCalled();
    expect(transcriptionService.rediarizeRecording).not.toHaveBeenCalled();
    expect(transcriptionService.diarizeFromTranscript).not.toHaveBeenCalled();
    expect(transcriptionService.transcribeLiveChunk).not.toHaveBeenCalled();
    expect(transcriptionService.computeEmbedding).not.toHaveBeenCalled();
    expect(transcriptionService.queryRAG).not.toHaveBeenCalled();
  });

  test('rate limits RAG answer generation before repeated costly archive queries', async () => {
    authService.getSession.mockResolvedValue(authenticatedSession);
    workspaceService.getMembership.mockResolvedValue({ member_role: 'member' });
    transcriptionService.queryRAG.mockResolvedValue([]);

    let lastResponse: Response | null = null;
    for (let index = 0; index < 11; index += 1) {
      lastResponse = await app.request('/workspaces/ws_allowed/rag/ask', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.77',
        },
        body: JSON.stringify({ question: `Pytanie ${index}` }),
      });
    }

    expect(lastResponse?.status).toBe(429);
    expect(transcriptionService.queryRAG).toHaveBeenCalledTimes(10);
  });
});
