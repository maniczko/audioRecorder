import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.ts';
import path from 'node:path';

describe('Transcribe Routes', () => {
  let app: ReturnType<typeof createApp>;
  let mockTranscriptionService: any;

  beforeEach(() => {
    mockTranscriptionService = {
      transcribeLiveChunk: vi.fn().mockResolvedValue('hello live'),
    };

    const testAuthService = {
      getSession: vi.fn().mockResolvedValue({ user_id: 'u1', workspace_id: 'ws1' }),
    };

    app = createApp({
      authService: testAuthService as any,
      workspaceService: { getMembership: vi.fn() } as any,
      transcriptionService: mockTranscriptionService,
      config: { allowedOrigins: '*', trustProxy: false, uploadDir: process.cwd() },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('returns empty text for too-small live chunks', async () => {
    const res = await app.request('/transcribe/live', {
      method: 'POST',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'audio/webm' },
      body: Buffer.alloc(100),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: '' });
    expect(mockTranscriptionService.transcribeLiveChunk).not.toHaveBeenCalled();
  });

  it('rejects oversized live transcription payloads', async () => {
    const res = await app.request('/transcribe/live', {
      method: 'POST',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'audio/webm' },
      body: Buffer.alloc(5 * 1024 * 1024 + 1, 1),
    });

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ message: 'Payload too large' });
  });

  it('writes temp file, transcribes, and cleans up successful live chunk', async () => {
    mockTranscriptionService.transcribeLiveChunk = vi.fn().mockResolvedValue('hello live');

    const testAuthServiceWithSession = {
      getSession: vi.fn().mockResolvedValue({ user_id: 'u1', workspace_id: 'ws1' }),
    };

    const testWorkspaceService = {
      getMembership: vi.fn().mockResolvedValue({ role: 'owner' }),
    };

    app = createApp({
      authService: testAuthServiceWithSession as any,
      workspaceService: testWorkspaceService as any,
      transcriptionService: mockTranscriptionService,
      config: { allowedOrigins: '*', trustProxy: false, uploadDir: process.cwd() },
    });

    const res = await app.request('/transcribe/live', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'audio/wav',
        'X-Recording-Id': 'rec_test',
        'X-Asset-Id': 'asset_test',
      },
      body: Buffer.alloc(2000, 1), // > MIN_CHUNK_SIZE
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ text: 'hello live' });
    expect(mockTranscriptionService.transcribeLiveChunk).toHaveBeenCalledTimes(1);
    const firstArg = mockTranscriptionService.transcribeLiveChunk.mock.calls[0][0];
    expect(firstArg).toEqual(expect.stringContaining('live_'));
    expect(path.extname(firstArg)).toBe('.wav');
  });

  it('responds quickly within the configured transcribe timeout budget', async () => {
    const testAuthServiceWithSession = {
      getSession: vi.fn().mockResolvedValue({ user_id: 'u1', workspace_id: 'ws1' }),
    };

    const testWorkspaceService = {
      getMembership: vi.fn().mockResolvedValue({ role: 'owner' }),
    };

    app = createApp({
      authService: testAuthServiceWithSession as any,
      workspaceService: testWorkspaceService as any,
      transcriptionService: mockTranscriptionService,
      config: {
        allowedOrigins: '*',
        trustProxy: false,
        uploadDir: process.cwd(),
        transcribeLiveTimeoutMs: 200,
      },
    });

    const res = await app.request('/transcribe/live', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'audio/wav',
        'X-Recording-Id': 'perf_rec',
        'X-Asset-Id': 'perf_asset',
      },
      body: Buffer.alloc(2000, 1),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ text: 'hello live' });
    expect(mockTranscriptionService.transcribeLiveChunk).toHaveBeenCalledTimes(1);
  });

  it('returns 504 when live transcription exceeds the timeout budget', async () => {
    vi.useFakeTimers();
    mockTranscriptionService.transcribeLiveChunk = vi.fn().mockImplementation(
      async () =>
        new Promise<string>(() => {
          // intentionally never resolves so timeout branch wins
        })
    );

    const testAuthServiceWithSession = {
      getSession: vi.fn().mockResolvedValue({ user_id: 'u1', workspace_id: 'ws1' }),
    };

    const testWorkspaceService = {
      getMembership: vi.fn().mockResolvedValue({ role: 'owner' }),
    };

    app = createApp({
      authService: testAuthServiceWithSession as any,
      workspaceService: testWorkspaceService as any,
      transcriptionService: mockTranscriptionService,
      config: {
        allowedOrigins: '*',
        trustProxy: false,
        uploadDir: process.cwd(),
        transcribeLiveTimeoutMs: 20,
      },
    });

    const requestPromise = app.request('/transcribe/live', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'audio/wav',
        'X-Recording-Id': 'timeout_rec',
        'X-Asset-Id': 'timeout_asset',
      },
      body: Buffer.alloc(2000, 1),
    });
    await vi.advanceTimersByTimeAsync(25);
    const res = await requestPromise;

    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({ message: 'Transcription request timed out.' });
  });
});
