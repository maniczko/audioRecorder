import { describe, expect, it, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { createApp } from '../../app.ts';
import { resetGoogleCertCacheForTests } from '../../lib/googleIdToken.ts';

describe('Auth Routes Extended', () => {
  let app: ReturnType<typeof createApp>;
  let mockAuthService: any;
  let mockWorkspaceService: any;

  beforeEach(() => {
    mockAuthService = {
      registerUser: vi.fn(),
      loginUser: vi.fn(),
      requestPasswordReset: vi.fn(),
      resetPasswordWithCode: vi.fn(),
      upsertGoogleUser: vi.fn(),
      buildSessionPayload: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ user_id: 'u1', workspace_id: 'ws1' }),
    };
    mockWorkspaceService = {
      getMembership: vi.fn().mockResolvedValue({ member_role: 'owner' }),
    };

    app = createApp({
      authService: mockAuthService,
      workspaceService: mockWorkspaceService,
      transcriptionService: {},
      config: {
        allowedOrigins: '*',
        trustProxy: false,
        uploadDir: '/tmp',
        googleClientId: 'google-client-id.test',
      },
    });
    resetGoogleCertCacheForTests();
  });

  function createGoogleIdToken() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const header = Buffer.from(
      JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test-kid' })
    ).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        iss: 'https://accounts.google.com',
        aud: 'google-client-id.test',
        exp: Math.floor(Date.now() / 1000) + 3600,
        email_verified: true,
        email: 'test@example.com',
        sub: 'google-sub',
        name: 'Anna',
      })
    ).toString('base64url');
    const input = `${header}.${payload}`;
    const signature = crypto
      .sign('RSA-SHA256', Buffer.from(input), privateKey)
      .toString('base64url');
    return {
      idToken: `${input}.${signature}`,
      publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    };
  }

  it('handles password reset request/confirm and google login', async () => {
    mockAuthService.requestPasswordReset.mockResolvedValue({ ok: true });
    mockAuthService.resetPasswordWithCode.mockResolvedValue({ ok: true });
    mockAuthService.upsertGoogleUser.mockResolvedValue({ token: 'google-token' });
    const { idToken, publicKeyPem } = createGoogleIdToken();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ 'test-kid': publicKeyPem }),
      })
    );

    const requestRes = await app.request('/auth/password/reset/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    const confirmRes = await app.request('/auth/password/reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        code: '123456',
        newPassword: 'secret-123',
        confirmPassword: 'secret-123',
      }),
    });
    const googleRes = await app.request('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    expect(requestRes.status).toBe(200);
    expect(confirmRes.status).toBe(200);
    expect(googleRes.status).toBe(200);
  });

  it('returns session payload when auth and workspace access pass', async () => {
    mockAuthService.buildSessionPayload.mockResolvedValue({ user: { id: 'u1' }, workspaces: [] });

    const res = await app.request('/auth/session?workspaceId=ws1', {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-token' },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: { id: 'u1' }, workspaces: [] });
    expect(mockAuthService.buildSessionPayload).toHaveBeenCalledWith('u1', 'ws1');
  });
});
