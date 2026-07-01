import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from '../../app.ts';

describe('State Routes', () => {
  let app: ReturnType<typeof createApp>;
  let mockAuthService: any;
  let mockWorkspaceService: any;

  beforeEach(() => {
    mockAuthService = {
      getSession: vi.fn(),
      buildSessionPayload: vi.fn(),
    };
    mockWorkspaceService = {
      getMembership: vi.fn(),
      getWorkspaceState: vi.fn(),
      saveWorkspaceState: vi.fn(),
    };
    mockAuthService.getSession.mockResolvedValue({ user_id: 'u123', workspace_id: 'w123' });
    mockWorkspaceService.getMembership.mockResolvedValue({ member_role: 'admin' });

    // Replace the default auth middleware for testing
    const testMiddlewares = {
      authMiddleware: async (c: any, next: any) => {
        const authHeader = c.req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return c.json({ message: 'Brak tokenu' }, 401);
        }
        if (authHeader === 'Bearer invalid') {
          return c.json({ message: 'Nieprawidłowy token' }, 401);
        }
        c.set('session', { user_id: 'u123', workspace_id: 'w123' });
        await next();
      },
      ensureWorkspaceAccess: async (c: any, workspaceId: string) => {
        if (workspaceId !== 'w123') {
          return c.json({ message: 'Brak dostepu' }, 403);
        }
        return { member_role: 'admin' };
      },
      applyRateLimit: () => async (c: any, next: any) => next(),
    };

    app = createApp(
      {
        authService: mockAuthService,
        workspaceService: mockWorkspaceService,
        transcriptionService: {},
        config: { allowedOrigins: 'http://localhost:3000', trustProxy: false, uploadDir: '/tmp' },
      },
      testMiddlewares
    );
  });

  const createRefreshAwareStateApp = () => {
    const refreshMiddlewares = {
      authMiddleware: async (c: any, next: any) => {
        if (c.req.method === 'OPTIONS') {
          await next();
          return;
        }

        const authHeader = c.req.header('Authorization');
        const refreshHeader = c.req.header('X-Refresh-Token');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return c.json({ message: 'Brak tokenu' }, 401);
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
      ensureWorkspaceAccess: async (c: any, workspaceId: string) => {
        if (workspaceId !== 'w123') {
          const err = new Error('Brak dostepu') as any;
          err.statusCode = 403;
          throw err;
        }
        return { member_role: 'admin' };
      },
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

  it('GET /state/bootstrap - unauthorized without token', async () => {
    const res = await app.request('/state/bootstrap', { method: 'GET' });
    expect(res.status).toBe(401);
  });

  it('GET /health - returns build metadata without requiring auth', async () => {
    const previousSha = process.env.GITHUB_SHA;
    const previousVersion = process.env.APP_VERSION;
    const previousBuildTime = process.env.BUILD_TIME;
    process.env.GITHUB_SHA = 'health123';
    process.env.APP_VERSION = '2.0.0';
    process.env.BUILD_TIME = '2026-03-21T20:30:00.000Z';

    try {
      const res = await app.request('/health', { method: 'GET' });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(
        expect.objectContaining({
          ok: true,
          status: 'ok',
          gitSha: 'health123',
          appVersion: '2.0.0',
          buildTime: '2026-03-21T20:30:00.000Z',
        })
      );
    } finally {
      if (previousSha === undefined) delete process.env.GITHUB_SHA;
      else process.env.GITHUB_SHA = previousSha;
      if (previousVersion === undefined) delete process.env.APP_VERSION;
      else process.env.APP_VERSION = previousVersion;
      if (previousBuildTime === undefined) delete process.env.BUILD_TIME;
      else process.env.BUILD_TIME = previousBuildTime;
    }
  });

  it('OPTIONS /state/bootstrap - returns preview CORS headers for vercel origins', async () => {
    const previewOrigin = 'https://preview-app.vercel.app';
    const res = await app.request('/state/bootstrap?workspaceId=w123', {
      method: 'OPTIONS',
      headers: {
        Origin: previewOrigin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization,Content-Type,X-Workspace-Id,X-Meeting-Id',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(previewOrigin);
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('X-Workspace-Id');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('X-Meeting-Id');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('OPTIONS');
    expect(res.headers.get('Vary')).toContain('Origin');
  });

  it('GET /state/bootstrap - unauthorized response still keeps preview CORS headers', async () => {
    const previewOrigin = 'https://preview-app.vercel.app';
    const res = await app.request('/state/bootstrap?workspaceId=w123', {
      method: 'GET',
      headers: {
        Origin: previewOrigin,
      },
    });

    expect(res.status).toBe(401);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(previewOrigin);
    expect(res.headers.get('Vary')).toContain('Origin');
  });

  it('GET /state/bootstrap - success with valid token', async () => {
    mockAuthService.buildSessionPayload.mockResolvedValue({ user: { id: 'u123' }, workspaces: [] });

    const res = await app.request('/state/bootstrap?workspaceId=w123', {
      method: 'GET',
      headers: { Authorization: 'Bearer valid_test_token' },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.id).toBe('u123');
    expect(mockAuthService.buildSessionPayload).toHaveBeenCalledWith('u123', 'w123');
  });

  it('GET /state/bootstrap - transient buildSessionPayload failure is recoverable', async () => {
    let attempt = 0;
    mockAuthService.buildSessionPayload.mockImplementation(async () => {
      attempt += 1;
      if (attempt === 1) {
        throw new Error('temporary backend hiccup');
      }
      return { user: { id: 'u123' }, workspaces: [] };
    });

    const firstTry = await app.request('/state/bootstrap?workspaceId=w123', {
      method: 'GET',
      headers: { Authorization: 'Bearer valid_test_token' },
    });
    expect(firstTry.status).toBe(500);

    const secondTry = await app.request('/state/bootstrap?workspaceId=w123', {
      method: 'GET',
      headers: { Authorization: 'Bearer valid_test_token' },
    });
    expect(secondTry.status).toBe(200);
    const data = await secondTry.json();
    expect(data.user.id).toBe('u123');
    expect(mockAuthService.buildSessionPayload).toHaveBeenCalledTimes(2);
  });

  it('GET /state/bootstrap - recovers when primary token is expired using refresh token fallback', async () => {
    mockAuthService.getSession.mockImplementation(async (token: string) => {
      if (token === 'expired-token') return null;
      if (token === 'fresh-token') {
        return { user_id: 'u123', workspace_id: 'w123' };
      }
      return null;
    });
    mockAuthService.buildSessionPayload.mockResolvedValue({
      user: { id: 'u123' },
      users: [],
      workspaces: [],
      workspaceId: 'w123',
      state: {},
    });

    const refreshAwareApp = createRefreshAwareStateApp();
    const res = await refreshAwareApp.request('/state/bootstrap?workspaceId=w123', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer expired-token',
        'X-Refresh-Token': 'fresh-token',
      },
    });

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload).toEqual(
      expect.objectContaining({
        user: { id: 'u123' },
        workspaceId: 'w123',
        state: {},
      })
    );
    expect(mockAuthService.getSession).toHaveBeenCalledWith('expired-token');
    expect(mockAuthService.getSession).toHaveBeenCalledWith('fresh-token');
    expect(mockAuthService.buildSessionPayload).toHaveBeenCalledWith('u123', 'w123');
  });

  it('PUT /state/workspaces/:workspaceId - state update', async () => {
    mockWorkspaceService.saveWorkspaceState.mockResolvedValue({ meetings: [] });

    const res = await app.request('/state/workspaces/w123', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer valid_test_token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ meetings: [], manualTasks: [] }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.workspaceId).toBe('w123');
    expect(data.state.meetings).toEqual([]);
    expect(mockWorkspaceService.saveWorkspaceState).toHaveBeenCalledWith(
      'w123',
      expect.any(Object)
    );
  });

  it('PUT /state/workspaces/:workspaceId - allows retry after optimistic lock without data loss', async () => {
    const firstState = { meetings: [{ id: 'meeting_base', title: 'Base' }], manualTasks: [] };
    mockWorkspaceService.getWorkspaceState.mockResolvedValue(firstState);
    mockWorkspaceService.saveWorkspaceState
      .mockRejectedValueOnce(Object.assign(new Error('transient lock'), { statusCode: 409 }))
      .mockResolvedValueOnce({
        ...firstState,
        meetings: [...firstState.meetings, { id: 'meeting_retry', title: 'Retry' }],
      });

    const payload = { meetings: [...firstState.meetings, { id: 'meeting_retry', title: 'Retry' }] };
    const first = await app.request('/state/workspaces/w123', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer valid_test_token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    expect(first.status).toBe(409);

    const second = await app.request('/state/workspaces/w123', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer valid_test_token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    expect(second.status).toBe(200);

    const payloadData = await second.json();
    expect(payloadData).toEqual(
      expect.objectContaining({
        workspaceId: 'w123',
        state: expect.objectContaining({
          meetings: expect.arrayContaining([{ id: 'meeting_retry', title: 'Retry' }]),
        }),
      })
    );
    expect(mockWorkspaceService.saveWorkspaceState).toHaveBeenCalledTimes(2);
    expect(mockWorkspaceService.saveWorkspaceState).toHaveBeenNthCalledWith(1, 'w123', payload);
    expect(mockWorkspaceService.saveWorkspaceState).toHaveBeenNthCalledWith(2, 'w123', payload);
  });

  it('PATCH /state/workspaces/:workspaceId - delta update', async () => {
    mockWorkspaceService.getWorkspaceState.mockResolvedValue({
      meetings: [{ id: 'm1', title: 'Old' }],
      manualTasks: [],
      taskState: {},
      taskBoards: {},
      calendarMeta: {},
      vocabulary: [],
      updatedAt: '2026-03-22T00:00:00.000Z',
    });
    mockWorkspaceService.saveWorkspaceState.mockResolvedValue({
      meetings: [{ id: 'm1', title: 'New' }],
    });

    const res = await app.request('/state/workspaces/w123', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer valid_test_token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meetings: { upsert: [{ id: 'm1', title: 'New' }] },
      }),
    });

    expect(res.status).toBe(200);
    expect(mockWorkspaceService.getWorkspaceState).toHaveBeenCalledWith('w123');
    expect(mockWorkspaceService.saveWorkspaceState).toHaveBeenCalledWith(
      'w123',
      expect.objectContaining({
        meetings: [{ id: 'm1', title: 'New' }],
      })
    );
  });

  it('PATCH /state/workspaces/:workspaceId - serializes concurrent deltas without losing writes', async () => {
    const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    let persistedState = {
      meetings: [],
      manualTasks: [],
      taskState: {},
      taskBoards: {},
      calendarMeta: {},
      vocabulary: [],
      updatedAt: '2026-05-25T00:00:00.000Z',
    };

    mockWorkspaceService.getWorkspaceState.mockImplementation(async () => clone(persistedState));
    mockWorkspaceService.saveWorkspaceState.mockImplementation(
      async (_workspaceId: string, next) => {
        await delay(40);
        persistedState = clone({ ...next, updatedAt: '2026-05-25T00:00:01.000Z' });
        return clone(persistedState);
      }
    );

    const [taskResponse, meetingResponse] = await Promise.all([
      app.request('/state/workspaces/w123', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer valid_test_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          manualTasks: { upsert: [{ id: 'task_concurrent', title: 'Concurrent task' }] },
        }),
      }),
      app.request('/state/workspaces/w123', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer valid_test_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meetings: { upsert: [{ id: 'meeting_concurrent', title: 'Concurrent meeting' }] },
        }),
      }),
    ]);

    expect(taskResponse.status).toBe(200);
    expect(meetingResponse.status).toBe(200);
    expect(persistedState.manualTasks).toEqual([
      expect.objectContaining({ id: 'task_concurrent' }),
    ]);
    expect(persistedState.meetings).toEqual([
      expect.objectContaining({ id: 'meeting_concurrent' }),
    ]);
  });

  it('PATCH /state/workspaces/:workspaceId - allows retry after optimistic lock without data loss', async () => {
    mockWorkspaceService.getWorkspaceState.mockResolvedValue({
      meetings: [{ id: 'meeting_base', title: 'Base' }],
      manualTasks: [],
      taskState: {},
      taskBoards: {},
      calendarMeta: {},
      vocabulary: [],
      updatedAt: '2026-05-25T00:00:00.000Z',
    });

    const optimisticError = Object.assign(new Error('Optimistic lock conflict'), {
      statusCode: 409,
    });
    mockWorkspaceService.saveWorkspaceState
      .mockRejectedValueOnce(optimisticError)
      .mockResolvedValueOnce({
        meetings: [
          { id: 'meeting_base', title: 'Base' },
          { id: 'meeting_retry', title: 'Retry' },
        ],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
        updatedAt: '2026-05-26T00:00:00.000Z',
      });

    const first = await app.request('/state/workspaces/w123', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer valid_test_token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meetings: { upsert: [{ id: 'meeting_retry', title: 'Retry' }] },
      }),
    });
    expect(first.status).toBe(409);

    const second = await app.request('/state/workspaces/w123', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer valid_test_token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meetings: { upsert: [{ id: 'meeting_retry', title: 'Retry' }] },
      }),
    });
    expect(second.status).toBe(200);

    const payload = await second.json();
    expect(payload.state.meetings).toEqual(
      expect.arrayContaining([{ id: 'meeting_retry', title: 'Retry' }])
    );
    expect(mockWorkspaceService.saveWorkspaceState).toHaveBeenCalledTimes(2);
  });

  // ----------------------------------------------------------------
  // Issue #0 - Workspace state PATCH lock can hang production sync
  // Date: 2026-06-29
  // Bug: A never-settling state operation kept the per-workspace PATCH
  //      lock forever, so retries and production persistence checks hung.
  // Fix: PATCH operations time out and release the lock for a retry.
  // ----------------------------------------------------------------
  describe('Regression: Issue #0 - workspace PATCH lock timeout', () => {
    it('PATCH /state/workspaces/:workspaceId - releases lock after a hung operation', async () => {
      const previousTimeout = process.env.WORKSPACE_STATE_PATCH_LOCK_TIMEOUT_MS;
      process.env.WORKSPACE_STATE_PATCH_LOCK_TIMEOUT_MS = '15';
      const baseState = {
        meetings: [],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
        updatedAt: '2026-06-29T00:00:00.000Z',
      };
      const patch = (body: unknown) =>
        app.request('/state/workspaces/w123', {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer valid_test_token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
      const waitForResponse = async (promise: Promise<Response>, ms = 250) =>
        await Promise.race([
          promise,
          new Promise<'timed-out'>((resolve) => setTimeout(() => resolve('timed-out'), ms)),
        ]);

      try {
        mockWorkspaceService.getWorkspaceState.mockImplementationOnce(() => new Promise(() => {}));

        const timedOut = await waitForResponse(
          patch({ meetings: { upsert: [{ id: 'meeting_hung', title: 'Hung' }] } })
        );
        expect(timedOut).not.toBe('timed-out');
        expect((timedOut as Response).status).toBe(503);

        mockWorkspaceService.getWorkspaceState.mockResolvedValueOnce(baseState);
        mockWorkspaceService.saveWorkspaceState.mockResolvedValueOnce({
          ...baseState,
          meetings: [{ id: 'meeting_retry_after_timeout', title: 'Retry after timeout' }],
        });

        const retry = await waitForResponse(
          patch({
            meetings: {
              upsert: [{ id: 'meeting_retry_after_timeout', title: 'Retry after timeout' }],
            },
          }),
          500
        );
        expect(retry).not.toBe('timed-out');
        expect((retry as Response).status).toBe(200);
      } finally {
        if (previousTimeout === undefined) {
          delete process.env.WORKSPACE_STATE_PATCH_LOCK_TIMEOUT_MS;
        } else {
          process.env.WORKSPACE_STATE_PATCH_LOCK_TIMEOUT_MS = previousTimeout;
        }
      }
    });
  });
});
