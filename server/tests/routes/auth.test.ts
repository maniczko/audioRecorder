import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { createApp } from '../../app.ts';
import { resetGoogleCertCacheForTests } from '../../lib/googleIdToken.ts';

describe('Auth Routes', () => {
  let app: ReturnType<typeof createApp>;
  let mockAuthService: any;
  let mockWorkspaceService: any;

  beforeEach(() => {
    mockAuthService = {
      registerUser: vi.fn(),
      loginUser: vi.fn(),
      getSession: vi.fn(),
      buildSessionPayload: vi.fn(),
      upsertGoogleUser: vi.fn(),
    };
    mockWorkspaceService = {
      getMembership: vi.fn().mockResolvedValue({ member_role: 'admin' }),
    };

    app = createApp({
      authService: mockAuthService,
      workspaceService: mockWorkspaceService,
      transcriptionService: {},
      config: {
        allowedOrigins: 'http://localhost:3000',
        trustProxy: false,
        uploadDir: '/tmp',
        googleClientId: 'google-client-id.test',
      },
    });
    resetGoogleCertCacheForTests();
  });

  function base64Url(input: Buffer | string) {
    return Buffer.from(input).toString('base64url');
  }

  function createGoogleIdToken(payloadOverrides: Record<string, unknown> = {}) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const header = { alg: 'RS256', typ: 'JWT', kid: 'test-kid' };
    const payload = {
      iss: 'https://accounts.google.com',
      aud: 'google-client-id.test',
      exp: Math.floor(Date.now() / 1000) + 3600,
      email_verified: true,
      email: 'google@example.com',
      sub: 'google-sub-123',
      name: 'Google User',
      ...payloadOverrides,
    };
    const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
    const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), privateKey);
    return {
      idToken: `${signingInput}.${signature.toString('base64url')}`,
      publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    };
  }

  const createRefreshAwareAuthApp = () => {
    const refreshMiddlewares = {
      authMiddleware: async (c: any, next: any) => {
        if (c.req.method === 'OPTIONS') {
          await next();
          return;
        }

        const authHeader = c.req.header('Authorization') || '';
        const refreshHeader = c.req.header('X-Refresh-Token');
        if (!authHeader.startsWith('Bearer ')) {
          return c.json({ message: 'Brak tokenu autoryzacyjnego.' }, 401);
        }
        const primaryToken = authHeader.slice(7).trim();
        let session = await mockAuthService.getSession(primaryToken);
        if (!session && refreshHeader) {
          session = await mockAuthService.getSession(refreshHeader);
        }
        if (!session) {
          return c.json({ message: 'Sesja wygasla lub jest nieprawidlowa.' }, 401);
        }
        c.set('session', session);
        await next();
      },
      ensureWorkspaceAccess: async () => ({ member_role: 'admin' }),
      applyRateLimit: () => async (_c: any, next: any) => next(),
    };

    return createApp(
      {
        authService: mockAuthService,
        workspaceService: mockWorkspaceService,
        transcriptionService: {},
        config: { allowedOrigins: 'http://localhost:3000', trustProxy: false, uploadDir: '/tmp' },
      },
      refreshMiddlewares
    );
  };

  it('POST /auth/register - happy path', async () => {
    mockAuthService.registerUser.mockResolvedValue({
      id: '123',
      email: 'test@example.com',
      token: 'abc',
    });

    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      }),
    });

    if (res.status !== 201) console.log('REGISTER ERROR:', await res.clone().json());
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.token).toBe('abc');
    expect(mockAuthService.registerUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@example.com' })
    );
  });

  it('POST /auth/login - missing password', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    if (res.status !== 400) console.log('LOGIN ERROR:', await res.clone().json());
    // Zod validation should fail
    expect(res.status).toBe(400);
  });

  it('POST /auth/login - happy path', async () => {
    mockAuthService.loginUser.mockResolvedValue({
      id: '123',
      email: 'test@example.com',
      token: 'valid_login_token',
    });

    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toBe('valid_login_token');
    expect(mockAuthService.loginUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@example.com' })
    );
  });

  it('POST /auth/login - hides database DNS failures from clients', async () => {
    mockAuthService.loginUser.mockRejectedValue(
      new Error('(ENOTFOUND) tenant/user postgres.jfvlwcjmsfewlugdhghq not found')
    );

    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    });

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.message).toBe('Serwer jest chwilowo niedostępny. Spróbuj ponownie za chwilę.');
    expect(JSON.stringify(data)).not.toMatch(/ENOTFOUND|postgres|tenant\/user/i);
  });

  it('OPTIONS /auth/login - returns CORS headers for vercel preview origins', async () => {
    const previewOrigin = 'https://audiorecorder-rggk30uoj-iwoczajka-2703s-projects.vercel.app';
    const res = await app.request('/auth/login', {
      method: 'OPTIONS',
      headers: {
        Origin: previewOrigin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,Authorization',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(previewOrigin);
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(res.headers.get('Vary')).toContain('Origin');
  });

  it('GET /auth/session - returns 401 on missing token', async () => {
    const res = await app.request('/auth/session', { method: 'GET' });
    expect(res.status).toBe(401);
  });

  it('GET /auth/session - transient getSession failure is recoverable by retry', async () => {
    mockAuthService.buildSessionPayload.mockResolvedValue({ user: { id: '123' }, workspaces: [] });

    let attempt = 0;
    mockAuthService.getSession.mockImplementation(async () => {
      attempt += 1;
      if (attempt === 1) {
        const err = Object.assign(new Error('ENOTFOUND auth service'), { statusCode: 503 });
        throw err;
      }

      return { user_id: '123', workspace_id: 'w123' };
    });

    const first = await app.request('/auth/session', {
      method: 'GET',
      headers: { Authorization: 'Bearer valid_token' },
    });
    expect(first.status).toBe(503);

    const second = await app.request('/auth/session', {
      method: 'GET',
      headers: { Authorization: 'Bearer valid_token' },
    });
    expect(second.status).toBe(200);

    const payload = await second.json();
    expect(payload).toEqual({ user: { id: '123' }, workspaces: [] });
    expect(mockAuthService.getSession).toHaveBeenCalledTimes(2);
  });

  it('GET /auth/session - 401 recovery using refresh token fallback and then retry success', async () => {
    mockAuthService.getSession.mockImplementation(async (token: string) => {
      if (token === 'expired-auth-token') return null;
      if (token === 'refresh-auth-token') return { user_id: 'u123', workspace_id: 'w123' };
      return null;
    });
    mockAuthService.buildSessionPayload.mockResolvedValue({
      user: { id: 'u123' },
      workspaces: [],
      workspaceId: 'w123',
      state: {},
    });

    const refreshAwareApp = createRefreshAwareAuthApp();
    const res = await refreshAwareApp.request('/auth/session', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer expired-auth-token',
        'X-Refresh-Token': 'refresh-auth-token',
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(
      expect.objectContaining({
        user: { id: 'u123' },
      })
    );
    expect(mockAuthService.getSession).toHaveBeenCalledWith('expired-auth-token');
    expect(mockAuthService.getSession).toHaveBeenCalledWith('refresh-auth-token');
    expect(mockAuthService.buildSessionPayload).toHaveBeenCalledWith('u123', 'w123');
  });

  it('GET /auth/session - token expires during polling and recovers on next request', async () => {
    let refreshAttempt = 0;
    mockAuthService.getSession.mockImplementation(async (token: string) => {
      if (token === 'expired-auth-token') return null;
      if (token === 'refresh-auth-token') {
        refreshAttempt += 1;
        if (refreshAttempt === 1) {
          return null;
        }
        return { user_id: 'u123', workspace_id: 'w123' };
      }
      return null;
    });
    mockAuthService.buildSessionPayload.mockResolvedValue({
      user: { id: 'u123' },
      workspaces: [],
      workspaceId: 'w123',
      state: {},
    });

    const refreshAwareApp = createRefreshAwareAuthApp();

    const first = await refreshAwareApp.request('/auth/session', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer expired-auth-token',
        'X-Refresh-Token': 'refresh-auth-token',
      },
    });
    expect(first.status).toBe(401);

    const second = await refreshAwareApp.request('/auth/session', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer expired-auth-token',
        'X-Refresh-Token': 'refresh-auth-token',
      },
    });
    expect(second.status).toBe(200);

    const payload = await second.json();
    expect(payload).toEqual(
      expect.objectContaining({
        user: { id: 'u123' },
      })
    );
    expect(mockAuthService.getSession).toHaveBeenNthCalledWith(1, 'expired-auth-token');
    expect(mockAuthService.getSession).toHaveBeenNthCalledWith(2, 'refresh-auth-token');
    expect(mockAuthService.getSession).toHaveBeenNthCalledWith(3, 'expired-auth-token');
    expect(mockAuthService.getSession).toHaveBeenNthCalledWith(4, 'refresh-auth-token');
    expect(mockAuthService.buildSessionPayload).toHaveBeenCalledWith('u123', 'w123');
  });

  it('POST /auth/login - transient network failure maps to temporary-unavailable, retry succeeds', async () => {
    let attempt = 0;
    mockAuthService.loginUser.mockImplementation(async () => {
      attempt += 1;
      if (attempt === 1) {
        const err = Object.assign(new Error('connect ETIMEDOUT'), { statusCode: 500 });
        throw err;
      }

      return { id: '123', email: 'test@example.com', token: 'valid_login_token' };
    });

    const first = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    });
    expect(first.status).toBe(503);

    const second = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    });
    const secondBody = await second.json();

    expect(second.status).toBe(200);
    expect(secondBody).toEqual(expect.objectContaining({ token: 'valid_login_token' }));
    expect(mockAuthService.loginUser).toHaveBeenCalledTimes(2);
  });

  it('POST /auth/google - rejects missing idToken', async () => {
    const res = await app.request('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    expect(mockAuthService.upsertGoogleUser).not.toHaveBeenCalled();
  });

  it('POST /auth/google - rejects fake idToken', async () => {
    const res = await app.request('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'not.a.jwt' }),
    });

    expect(res.status).toBe(401);
    expect(mockAuthService.upsertGoogleUser).not.toHaveBeenCalled();
  });

  it('POST /auth/google - rejects email/sub payload without idToken', async () => {
    const res = await app.request('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'attacker@example.com',
        sub: 'client-controlled-sub',
        name: 'Client Controlled',
      }),
    });

    expect(res.status).toBe(400);
    expect(mockAuthService.upsertGoogleUser).not.toHaveBeenCalled();
  });

  it('POST /auth/google - verifies mocked Google idToken before creating session', async () => {
    const { idToken, publicKeyPem } = createGoogleIdToken();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ 'test-kid': publicKeyPem }),
      })
    );
    mockAuthService.upsertGoogleUser.mockResolvedValue({
      token: 'google-session-token',
      user: { id: 'u-google', email: 'google@example.com' },
      workspaceId: 'ws-google',
    });

    const res = await app.request('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toBe('google-session-token');
    expect(mockAuthService.upsertGoogleUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'google@example.com',
        sub: 'google-sub-123',
        name: 'Google User',
      })
    );
  });
});
