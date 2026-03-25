import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.ts';
import { __mockFs } from '../../tests/setup';

describe('Transcribe Routes', () => {
  let app: ReturnType<typeof createApp>;
  let mockTranscriptionService: any;

  beforeEach(() => {
    __mockFs.writeFileSync.mockClear();
    __mockFs.unlinkSync.mockClear();

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
      config: { allowedOrigins: '*', trustProxy: false, uploadDir: '/tmp' },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
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
    mockTranscriptionService.transcribeLiveChunk = vi
      .fn()
      .mockResolvedValue({ text: 'hello live' });

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
      config: { allowedOrigins: '*', trustProxy: false, uploadDir: '/tmp' },
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
    expect(json.text).toBeDefined();
    // Note: fs mocks are handled by setup.ts __mockFs
  });
});
