import { describe, expect, it, vi } from 'vitest';
import { createMiddlewares } from '../routes/middleware.ts';
import { createProgressToken, resetProgressTokensForTests } from '../lib/progressTokens.ts';

describe('route middleware', () => {
  it('authMiddleware rejects missing or invalid bearer token and stores valid session', async () => {
    const services = {
      authService: {
        getSession: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ user_id: 'u1', workspace_id: 'ws1' }),
      },
      workspaceService: {
        getMembership: vi.fn().mockResolvedValue({ member_role: 'owner' }),
      },
      config: { trustProxy: false },
    } as any;
    const { authMiddleware } = createMiddlewares(services);

    const missingCtx: any = {
      req: { header: vi.fn().mockReturnValue('') },
      json: vi.fn((body, status) => ({ body, status })),
    };
    const missingResult = await authMiddleware(missingCtx, vi.fn());
    expect(missingResult.status).toBe(401);

    const invalidCtx: any = {
      req: { header: vi.fn().mockReturnValue('Bearer token') },
      json: vi.fn((body, status) => ({ body, status })),
      set: vi.fn(),
    };
    const invalidResult = await authMiddleware(invalidCtx, vi.fn());
    expect(invalidResult.status).toBe(401);

    const validNext = vi.fn();
    const validCtx: any = {
      req: { header: vi.fn().mockReturnValue('Bearer token') },
      json: vi.fn(),
      set: vi.fn(),
    };
    await authMiddleware(validCtx, validNext);
    expect(validCtx.set).toHaveBeenCalledWith('session', { user_id: 'u1', workspace_id: 'ws1' });
    expect(validNext).toHaveBeenCalledTimes(1);
  });

  it('authMiddleware accepts token from query string for SSE-style requests', async () => {
    const services = {
      authService: {
        getSession: vi.fn().mockResolvedValue({ user_id: 'u1', workspace_id: 'ws1' }),
      },
      workspaceService: {
        getMembership: vi.fn().mockResolvedValue({ member_role: 'owner' }),
      },
      config: { trustProxy: false },
    } as any;
    const { authMiddleware } = createMiddlewares(services);
    const next = vi.fn();
    const ctx: any = {
      req: {
        header: vi.fn().mockReturnValue(''),
        query: vi.fn().mockImplementation((key: string) => (key === 'token' ? 'query-token' : '')),
      },
      json: vi.fn(),
      set: vi.fn(),
    };

    await authMiddleware(ctx, next);

    expect(services.authService.getSession).toHaveBeenCalledWith('query-token');
    expect(ctx.set).toHaveBeenCalledWith('session', { user_id: 'u1', workspace_id: 'ws1' });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('authMiddleware rejects query session token in production but keeps bearer auth working', async () => {
    const previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const services = {
      authService: {
        getSession: vi.fn().mockResolvedValue({ user_id: 'u1', workspace_id: 'ws1' }),
      },
      workspaceService: {
        getMembership: vi.fn().mockResolvedValue({ member_role: 'owner' }),
      },
      config: { trustProxy: false },
    } as any;
    const { authMiddleware } = createMiddlewares(services);

    const queryCtx: any = {
      req: {
        header: vi.fn().mockReturnValue(''),
        query: vi.fn().mockImplementation((key: string) => (key === 'token' ? 'query-token' : '')),
      },
      json: vi.fn((body, status) => ({ body, status })),
      set: vi.fn(),
    };

    const queryResult = await authMiddleware(queryCtx, vi.fn());
    expect(queryResult.status).toBe(401);
    expect(services.authService.getSession).not.toHaveBeenCalledWith('query-token');

    const next = vi.fn();
    const bearerCtx: any = {
      req: {
        header: vi
          .fn()
          .mockImplementation((name: string) =>
            name === 'Authorization' ? 'Bearer bearer-token' : ''
          ),
        query: vi.fn().mockReturnValue(''),
      },
      json: vi.fn(),
      set: vi.fn(),
    };
    await authMiddleware(bearerCtx, next);

    expect(services.authService.getSession).toHaveBeenCalledWith('bearer-token');
    expect(next).toHaveBeenCalledTimes(1);
    process.env.NODE_ENV = previousEnv;
  });

  it('authMiddleware accepts short-lived progress token only for matching recording', async () => {
    resetProgressTokensForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-18T10:00:00.000Z'));
    const services = {
      authService: { getSession: vi.fn() },
      workspaceService: { getMembership: vi.fn() },
      config: { trustProxy: false },
    } as any;
    const { authMiddleware } = createMiddlewares(services);
    const token = createProgressToken('rec-1', 'u1', 1000);

    const next = vi.fn();
    const validCtx: any = {
      req: {
        header: vi.fn().mockReturnValue(''),
        query: vi.fn().mockImplementation((key: string) => (key === 'progressToken' ? token : '')),
        param: vi.fn().mockImplementation((key: string) => (key === 'recordingId' ? 'rec-1' : '')),
      },
      json: vi.fn((body, status) => ({ body, status })),
      set: vi.fn(),
    };
    await authMiddleware(validCtx, next);

    expect(validCtx.set).toHaveBeenCalledWith(
      'session',
      expect.objectContaining({ user_id: 'u1', recording_id: 'rec-1', progress_token: true })
    );
    expect(next).toHaveBeenCalledTimes(1);

    const wrongCtx: any = {
      req: {
        header: vi.fn().mockReturnValue(''),
        query: vi.fn().mockImplementation((key: string) => (key === 'progressToken' ? token : '')),
        param: vi.fn().mockImplementation((key: string) => (key === 'recordingId' ? 'rec-2' : '')),
      },
      json: vi.fn((body, status) => ({ body, status })),
      set: vi.fn(),
    };
    const wrongResult = await authMiddleware(wrongCtx, vi.fn());
    expect(wrongResult.status).toBe(401);

    vi.setSystemTime(new Date('2026-06-18T10:00:02.000Z'));
    const expiredCtx: any = {
      req: {
        header: vi.fn().mockReturnValue(''),
        query: vi.fn().mockImplementation((key: string) => (key === 'progressToken' ? token : '')),
        param: vi.fn().mockImplementation((key: string) => (key === 'recordingId' ? 'rec-1' : '')),
      },
      json: vi.fn((body, status) => ({ body, status })),
      set: vi.fn(),
    };
    const expiredResult = await authMiddleware(expiredCtx, vi.fn());
    expect(expiredResult.status).toBe(401);
    vi.useRealTimers();
  });

  it('authMiddleware passes OPTIONS requests through without auth check', async () => {
    const services = {
      authService: { getSession: vi.fn() },
      workspaceService: { getMembership: vi.fn() },
      config: { trustProxy: false },
    } as any;
    const { authMiddleware } = createMiddlewares(services);
    const next = vi.fn();
    const ctx: any = {
      req: { method: 'OPTIONS', header: vi.fn().mockReturnValue('') },
      json: vi.fn(),
      set: vi.fn(),
    };

    await authMiddleware(ctx, next);

    expect(services.authService.getSession).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('ensureWorkspaceAccess throws 403 when membership is missing', async () => {
    const { ensureWorkspaceAccess } = createMiddlewares({
      authService: {},
      workspaceService: {
        getMembership: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ member_role: 'admin' }),
      },
      config: { trustProxy: true },
    } as any);

    await expect(
      ensureWorkspaceAccess({ get: vi.fn().mockReturnValue({ user_id: 'u1' }) } as any, 'ws1')
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      ensureWorkspaceAccess({ get: vi.fn().mockReturnValue({ user_id: 'u1' }) } as any, 'ws1')
    ).resolves.toEqual({ member_role: 'admin' });
  });
});
