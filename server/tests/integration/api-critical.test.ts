/**
 * Integration Tests — Critical API Paths
 *
 * Tests the full request lifecycle through the Hono app stack:
 * - Middleware chain (CORS, rate limiting, auth)
 * - Route handlers with validation
 * - Service layer integration
 * - Error handling and recovery
 *
 * Run: npx vitest run -c server/vitest.config.ts server/tests/integration/api-critical.test.ts
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Integration — Critical API Paths', () => {
  let app: any;
  let mockAuthService: any;
  let mockWorkspaceService: any;
  let mockTranscriptionService: any;

  beforeEach(async () => {
    vi.resetModules();

    // ── Mock Services ──────────────────────────────────────────────
    mockAuthService = {
      registerUser: vi.fn().mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
        name: 'Test User',
        workspace_id: 'ws1',
      }),
      loginUser: vi.fn().mockImplementation(async ({ email, password }) => {
        if (password === 'wrong') return { ok: false, error: 'Invalid credentials' };
        return {
          ok: true,
          token: 'token-123',
          user: { id: 'u1', email, name: 'Test User' },
        };
      }),
      getSession: vi.fn().mockResolvedValue({
        user_id: 'u1',
        workspace_id: 'ws1',
        email: 'test@example.com',
        name: 'Test User',
      }),
      buildSessionPayload: vi.fn().mockResolvedValue({
        user: { id: 'u1', email: 'test@example.com', name: 'Test User' },
        workspace: { id: 'ws1', name: 'My Workspace', role: 'owner' },
      }),
      requestPasswordReset: vi.fn().mockResolvedValue({ ok: true }),
      resetPasswordWithCode: vi.fn().mockResolvedValue({ ok: true }),
      upsertGoogleUser: vi.fn().mockResolvedValue({
        id: 'u1',
        email: 'test@gmail.com',
        name: 'Google User',
      }),
      updateUserProfile: vi.fn().mockResolvedValue({ ok: true }),
      changeUserPassword: vi.fn().mockResolvedValue({ ok: true }),
    };

    mockWorkspaceService = {
      getMembership: vi
        .fn()
        .mockResolvedValue({ role: 'owner', user_id: 'u1', workspace_id: 'ws1' }),
      getWorkspaceState: vi.fn().mockResolvedValue({ meetings: [], tasks: [], state: {} }),
      saveWorkspaceState: vi.fn().mockResolvedValue({ ok: true }),
      getWorkspaceVoiceProfiles: vi.fn().mockResolvedValue([]),
      updateWorkspaceMemberRole: vi.fn().mockResolvedValue({ ok: true }),
    };

    mockTranscriptionService = {
      transcribeLiveChunk: vi.fn().mockResolvedValue({ text: 'Hello world', segments: [] }),
      analyzeAudioQuality: vi.fn().mockResolvedValue({ snr: 25, volume: -12 }),
      generateVoiceCoaching: vi.fn().mockResolvedValue({ text: 'Good job!' }),
      analyzeAcousticFeatures: vi.fn().mockResolvedValue({ pitch: 120, energy: 0.5 }),
      vectorizeTranscriptionResultToRAG: vi.fn().mockResolvedValue({ ok: true }),
    };

    const { createApp } = await import('../../app.ts');
    app = createApp({
      authService: mockAuthService,
      workspaceService: mockWorkspaceService,
      transcriptionService: mockTranscriptionService,
      db: {
        init: vi.fn().mockResolvedValue(undefined),
        checkHealth: vi.fn().mockResolvedValue({ ok: true, type: 'sqlite' }),
      },
      config: {
        allowedOrigins: '*',
        trustProxy: false,
        uploadDir: '/tmp/test-uploads',
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────
  // Health & Readiness
  // ─────────────────────────────────────────────────────────────────

  describe('GET /health', () => {
    test('returns 200 with health status', async () => {
      const res = await app.request('/health');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('ok', true);
      expect(body).toHaveProperty('status');
    });

    test('health endpoint does not require auth', async () => {
      const res = await app.request('/health');
      expect(res.status).toBe(200);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Authentication Flow
  // ─────────────────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    test('registers new user and returns 201', async () => {
      const res = await app.request('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'new@example.com',
          password: 'SecurePass123!',
          name: 'New User',
        }),
      });
      expect(res.status).toBe(201);
      expect(mockAuthService.registerUser).toHaveBeenCalled();
    });

    test('returns 400 for missing fields', async () => {
      const res = await app.request('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'incomplete' }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    test('logs in with valid credentials and returns token', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'correct',
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('token');
    });

    test('returns ok:false for wrong password', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'wrong',
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('ok', false);
      expect(body).toHaveProperty('error');
    });

    test('returns 400 for missing fields', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'only-email' }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /auth/session', () => {
    test('returns session data with valid token', async () => {
      const res = await app.request('/auth/session', {
        method: 'GET',
        headers: { Authorization: 'Bearer valid-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('user');
      expect(body).toHaveProperty('workspace');
    });

    test('returns 401 without token', async () => {
      const res = await app.request('/auth/session');
      expect(res.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Voice Profiles
  // ─────────────────────────────────────────────────────────────────

  describe('GET /voice-profiles', () => {
    test('returns profile list with valid auth', async () => {
      const res = await app.request('/voice-profiles', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer valid-token',
          'X-Workspace-Id': 'ws1',
        },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('profiles');
      expect(Array.isArray(body.profiles)).toBe(true);
    });

    test('returns 401 without auth', async () => {
      const res = await app.request('/voice-profiles');
      expect(res.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // State Management
  // ─────────────────────────────────────────────────────────────────

  describe('GET /state/bootstrap', () => {
    test('returns bootstrap data with valid auth', async () => {
      const res = await app.request('/state/bootstrap', {
        method: 'GET',
        headers: { Authorization: 'Bearer valid-token' },
      });
      expect(res.status).toBe(200);
    });

    test('returns 401 without auth', async () => {
      const res = await app.request('/state/bootstrap');
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /state/workspaces/:id', () => {
    test('updates workspace state with valid auth', async () => {
      const res = await app.request('/state/workspaces/ws1', {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
          'X-Workspace-Id': 'ws1',
        },
        body: JSON.stringify({ meetings: [] }),
      });
      expect(res.status).toBe(200);
    });

    test('returns 401 without auth', async () => {
      const res = await app.request('/state/workspaces/ws1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetings: [] }),
      });
      expect(res.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Client Error Reporting
  // ─────────────────────────────────────────────────────────────────

  describe('POST /api/client-errors', () => {
    test('accepts error report from client', async () => {
      const res = await app.request('/api/client-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Something broke',
          type: 'runtime',
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('ok', true);
      expect(body.received).toBe(1);
    });

    test('accepts array of errors', async () => {
      const res = await app.request('/api/client-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          { message: 'Error 1', type: 'runtime' },
          { message: 'Error 2', type: 'network' },
        ]),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.received).toBe(2);
    });

    test('returns 400 for too many errors', async () => {
      const errors = Array.from({ length: 60 }, (_, i) => ({
        message: `Error ${i}`,
        type: 'runtime',
      }));
      const res = await app.request('/api/client-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errors),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/client-errors', () => {
    test('returns stored errors with count', async () => {
      const res = await app.request('/api/client-errors');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('count');
      expect(body).toHaveProperty('errors');
      expect(Array.isArray(body.errors)).toBe(true);
    });
  });

  describe('DELETE /api/client-errors', () => {
    test('clears all stored errors', async () => {
      const res = await app.request('/api/client-errors', { method: 'DELETE' });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ok: true, cleared: true });
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Transcription
  // ─────────────────────────────────────────────────────────────────

  describe('POST /transcribe/live', () => {
    test('transcribes audio chunk and returns text', async () => {
      const res = await app.request('/transcribe/live', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
          'X-Workspace-Id': 'ws1',
        },
        body: createMockAudioFormData(),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('text');
    });

    test('returns 401 without auth', async () => {
      const res = await app.request('/transcribe/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: 'small-body',
      });
      expect(res.status).toBe(401);
    });
  });
});

// ───────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────

function createMockAudioFormData(): FormData {
  const form = new FormData();
  form.append('audio', new Blob(['mock-audio-data'], { type: 'audio/wav' }), 'test.wav');
  form.append('workspaceId', 'ws1');
  return form;
}
