import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.ts';

// vi.hoisted ensures the variable exists before vi.mock's hoisted factory runs
const { mockGenerateRagAnswer } = vi.hoisted(() => ({
  mockGenerateRagAnswer: vi.fn(),
}));
vi.mock('../../lib/ragAnswer.ts', async () => {
  const actual = await vi.importActual('../../lib/ragAnswer.ts');
  return {
    ...actual,
    generateRagAnswer: mockGenerateRagAnswer,
  };
});

describe('Workspace Routes', () => {
  let app: ReturnType<typeof createApp>;
  let mockAuthService: any;
  let mockWorkspaceService: any;
  let mockTranscriptionService: any;
  const originalFetch = global.fetch;

  function buildMiddlewares(memberRole = 'owner') {
    return {
      authMiddleware: async (c: any, next: any) => {
        c.set('session', { user_id: 'u1', workspace_id: 'ws1' });
        await next();
      },
      ensureWorkspaceAccess: async (_c: any, workspaceId: string) => {
        if (workspaceId !== 'ws1') {
          const err = new Error('Forbidden') as any;
          err.statusCode = 403;
          throw err;
        }
        return { member_role: memberRole };
      },
      applyRateLimit: () => async (_c: any, next: any) => next(),
    };
  }

  beforeEach(() => {
    mockAuthService = {
      updateUserProfile: vi.fn(),
      buildSessionPayload: vi.fn(),
      changeUserPassword: vi.fn(),
      getSession: vi.fn(),
    };
    mockWorkspaceService = {
      saveWorkspaceState: vi.fn(),
      updateWorkspaceMemberRole: vi.fn(),
      getMembership: vi.fn(),
    };
    mockTranscriptionService = {
      queryRAG: vi.fn(),
    };
    global.fetch = vi.fn();
    mockGenerateRagAnswer.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('PUT /users/:userId/profile updates only current user profile', async () => {
    mockAuthService.updateUserProfile.mockResolvedValue({ id: 'u1', name: 'Anna' });
    mockAuthService.buildSessionPayload.mockResolvedValue({ users: [{ id: 'u1', name: 'Anna' }] });
    app = createApp(
      {
        authService: mockAuthService,
        workspaceService: mockWorkspaceService,
        transcriptionService: mockTranscriptionService,
        config: { allowedOrigins: '*', trustProxy: false, uploadDir: '/tmp', OPENAI_API_KEY: '' },
      },
      buildMiddlewares()
    );

    const res = await app.request('/users/u1/profile?workspaceId=ws1', {
      method: 'PUT',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Anna', company: 'VoiceLog' }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: { id: 'u1', name: 'Anna' },
      users: [{ id: 'u1', name: 'Anna' }],
    });
    expect(mockAuthService.updateUserProfile).toHaveBeenCalledWith('u1', {
      name: 'Anna',
      company: 'VoiceLog',
    });
    expect(mockAuthService.buildSessionPayload).toHaveBeenCalledWith('u1', 'ws1');
  });

  it('blocks profile and password changes for other users', async () => {
    app = createApp(
      {
        authService: mockAuthService,
        workspaceService: mockWorkspaceService,
        transcriptionService: mockTranscriptionService,
        config: { allowedOrigins: '*', trustProxy: false, uploadDir: '/tmp', OPENAI_API_KEY: '' },
      },
      buildMiddlewares()
    );

    const profileRes = await app.request('/users/u2/profile', {
      method: 'PUT',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Blocked' }),
    });
    const passwordRes = await app.request('/users/u2/password', {
      method: 'POST',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'a', newPassword: 'b' }),
    });

    expect(profileRes.status).toBe(403);
    expect(passwordRes.status).toBe(403);
    expect(mockAuthService.updateUserProfile).not.toHaveBeenCalled();
    expect(mockAuthService.changeUserPassword).not.toHaveBeenCalled();
  });

  it('updates workspace member roles only for owner/admin memberships', async () => {
    mockWorkspaceService.updateWorkspaceMemberRole.mockResolvedValue({
      workspaceId: 'ws1',
      userId: 'u2',
      memberRole: 'admin',
    });
    app = createApp(
      {
        authService: mockAuthService,
        workspaceService: mockWorkspaceService,
        transcriptionService: mockTranscriptionService,
        config: { allowedOrigins: '*', trustProxy: false, uploadDir: '/tmp', OPENAI_API_KEY: '' },
      },
      buildMiddlewares('owner')
    );

    const okRes = await app.request('/workspaces/ws1/members/u2/role', {
      method: 'PUT',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberRole: 'admin' }),
    });

    expect(okRes.status).toBe(200);
    expect(mockWorkspaceService.updateWorkspaceMemberRole).toHaveBeenCalledWith(
      'ws1',
      'u2',
      'admin'
    );

    app = createApp(
      {
        authService: mockAuthService,
        workspaceService: mockWorkspaceService,
        transcriptionService: mockTranscriptionService,
        config: { allowedOrigins: '*', trustProxy: false, uploadDir: '/tmp', OPENAI_API_KEY: '' },
      },
      buildMiddlewares('member')
    );

    const forbiddenRes = await app.request('/workspaces/ws1/members/u2/role', {
      method: 'PUT',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberRole: 'viewer' }),
    });

    expect(forbiddenRes.status).toBe(403);
  });

  it('handles RAG ask validation, no-results and LLM failure paths', async () => {
    app = createApp(
      {
        authService: mockAuthService,
        workspaceService: mockWorkspaceService,
        transcriptionService: mockTranscriptionService,
        config: { allowedOrigins: '*', trustProxy: false, uploadDir: '/tmp', OPENAI_API_KEY: '' },
      },
      buildMiddlewares()
    );

    const invalidRes = await app.request('/workspaces/ws1/rag/ask', {
      method: 'POST',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: '   ' }),
    });
    expect(invalidRes.status).toBe(400);

    mockTranscriptionService.queryRAG.mockResolvedValueOnce([]);
    const emptyRes = await app.request('/workspaces/ws1/rag/ask', {
      method: 'POST',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Co ustalono?' }),
    });
    expect(emptyRes.status).toBe(200);
    expect((await emptyRes.json()).answer).toMatch(/Brak danych/);

    mockTranscriptionService.queryRAG.mockResolvedValueOnce([
      { recording_id: 'rec1', speaker_name: 'Anna', text: 'Ustalono plan.' },
    ]);
    mockGenerateRagAnswer.mockRejectedValueOnce(new Error('Brak klucza API do RAG LLMa.'));
    const errorRes = await app.request('/workspaces/ws1/rag/ask', {
      method: 'POST',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Co ustalono?' }),
    });
    expect(errorRes.status).toBe(200);
    const errorPayload = await errorRes.json();
    expect(errorPayload.fallback).toBe(true);
    expect(errorPayload.answer).toMatch(/Model AI jest chwilowo niedostepny/i);
    expect(errorPayload.answer).toMatch(/Ustalono plan\./i);
  });

  it('returns LLM answer when RAG generation succeeds', async () => {
    mockTranscriptionService.queryRAG.mockResolvedValue([
      { recording_id: 'rec1', speaker_name: 'Anna', text: 'Ustalono plan.' },
    ]);
    mockGenerateRagAnswer.mockResolvedValueOnce('Odpowiedz z RAG.');
    app = createApp(
      {
        authService: mockAuthService,
        workspaceService: mockWorkspaceService,
        transcriptionService: mockTranscriptionService,
        config: {
          allowedOrigins: '*',
          trustProxy: false,
          uploadDir: '/tmp',
          OPENAI_API_KEY: 'key-1',
          OPENAI_BASE_URL: 'https://api.example.test',
        },
      },
      buildMiddlewares()
    );

    const res = await app.request('/workspaces/ws1/rag/ask', {
      method: 'POST',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Co ustalono?' }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ answer: 'Odpowiedz z RAG.' });
    expect(mockGenerateRagAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        question: 'Co ustalono?',
        chunks: [{ recording_id: 'rec1', speaker_name: 'Anna', text: 'Ustalono plan.' }],
        workspaceId: 'ws1',
      })
    );
  });
});
