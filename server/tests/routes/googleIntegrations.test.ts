import { beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config.ts';
import { createGoogleIntegrationRoutes } from '../../routes/googleIntegrations.ts';

function createTestApp(db: any) {
  return createGoogleIntegrationRoutes(
    { db } as any,
    {
      authMiddleware: async (c: any, next: any) => {
        c.set('session', {
          user_id: 'user-1',
          workspace_id: 'workspace-1',
          email: 'owner@example.com',
        });
        await next();
      },
      ensureWorkspaceAccess: vi.fn(async () => ({ member_role: 'owner' })),
    } as any
  );
}

describe('googleIntegrations routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    config.GOOGLE_CLIENT_ID = 'client-id';
    config.GOOGLE_CLIENT_SECRET = 'client-secret';
    config.GOOGLE_OAUTH_REDIRECT_URI = 'http://127.0.0.1:4000/integrations/google/callback';
    config.GOOGLE_CALENDAR_SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';
  });

  it('returns connected status without exposing tokens', async () => {
    const db = {
      _get: vi.fn(async () => ({
        provider_account_email: 'owner@example.com',
        scopes: 'https://www.googleapis.com/auth/calendar.readonly',
        expires_at: '2026-06-08T12:00:00.000Z',
        updated_at: '2026-06-08T11:00:00.000Z',
      })),
      _execute: vi.fn(),
    };
    const app = createTestApp(db);

    const response = await app.request('/status?workspaceId=workspace-1');
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      connected: true,
      writable: false,
      accountEmail: 'owner@example.com',
    });
    expect(JSON.stringify(payload)).not.toContain('access_token');
  });

  it('fetches calendar events through the stored backend token', async () => {
    const db = {
      _get: vi.fn(async () => ({
        user_id: 'user-1',
        workspace_id: 'workspace-1',
        access_token: 'access-token',
        refresh_token: '',
        expires_at: '2999-01-01T00:00:00.000Z',
        scopes: 'https://www.googleapis.com/auth/calendar.readonly',
      })),
      _execute: vi.fn(),
    };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ items: [{ id: 'event-1' }] }), { status: 200 })
      );
    const app = createTestApp(db);

    const response = await app.request(
      '/events?workspaceId=workspace-1&timeMin=2026-06-01T00%3A00%3A00.000Z&timeMax=2026-07-01T00%3A00%3A00.000Z'
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.items).toEqual([{ id: 'event-1' }]);
    expect(fetchMock).toHaveBeenCalledWith(expect.any(URL), {
      headers: { Authorization: 'Bearer access-token' },
    });
  });

  it('creates an OAuth state and returns a Google authorization URL', async () => {
    const db = {
      _get: vi.fn(),
      _execute: vi.fn(),
    };
    const app = createTestApp(db);

    const response = await app.request(
      '/connect?workspaceId=workspace-1&returnTo=http%3A%2F%2F127.0.0.1%3A3000%2Fcalendar'
    );
    const payload = await response.json();
    const authUrl = new URL(payload.url);

    expect(response.status).toBe(200);
    expect(authUrl.origin + authUrl.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(authUrl.searchParams.get('client_id')).toBe('client-id');
    expect(authUrl.searchParams.get('scope')).toBe(
      'https://www.googleapis.com/auth/calendar.readonly'
    );
    expect(db._execute).toHaveBeenCalledWith(expect.stringContaining('google_oauth_states'), [
      expect.any(String),
      'user-1',
      'workspace-1',
      'http://127.0.0.1:3000/calendar',
      expect.any(String),
      expect.any(String),
      '',
    ]);
  });

  it('falls back to the safe local app URL for invalid returnTo values', async () => {
    const db = {
      _get: vi.fn(),
      _execute: vi.fn(),
    };
    const app = createTestApp(db);

    const response = await app.request('/connect?workspaceId=workspace-1&returnTo=not-a-url');
    const payload = await response.json();
    const authUrl = new URL(payload.url);
    const state = authUrl.searchParams.get('state');

    expect(response.status).toBe(200);
    expect(state).toBeTruthy();
    expect(db._execute).toHaveBeenCalledWith(expect.stringContaining('google_oauth_states'), [
      state,
      'user-1',
      'workspace-1',
      'http://127.0.0.1:3000/',
      expect.any(String),
      expect.any(String),
      '',
    ]);
  });

  it('returns a clear status when Google backend credentials are missing', async () => {
    config.GOOGLE_CLIENT_SECRET = '';
    const db = {
      _get: vi.fn(),
      _execute: vi.fn(),
    };
    const app = createTestApp(db);

    const response = await app.request('/connect?workspaceId=workspace-1');
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.message).toContain('Google Calendar');
  });

  it('exchanges callback code and stores tokens before redirecting to the app', async () => {
    const stateRow = {
      state: 'state-1',
      user_id: 'user-1',
      workspace_id: 'workspace-1',
      return_to: 'http://127.0.0.1:3000/calendar',
      expires_at: '2999-01-01T00:00:00.000Z',
      used_at: '',
    };
    const db = {
      _get: vi
        .fn()
        .mockResolvedValueOnce(stateRow)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          user_id: 'user-1',
          workspace_id: 'workspace-1',
          access_token: 'access-token',
        }),
      _execute: vi.fn(),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
          scope: 'https://www.googleapis.com/auth/calendar.readonly',
        }),
        { status: 200 }
      )
    );
    const app = createTestApp(db);

    const response = await app.request('/callback?code=code-1&state=state-1');

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'http://127.0.0.1:3000/calendar?googleCalendar=connected'
    );
    expect(db._execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO google_integrations'),
      expect.arrayContaining(['user-1', 'workspace-1', 'google_calendar', 'access-token'])
    );
  });

  it('redirects callback errors back to a safe app URL', async () => {
    const db = {
      _get: vi.fn(async () => null),
      _execute: vi.fn(),
    };
    const app = createTestApp(db);

    const response = await app.request('/callback?code=code-1&state=missing');

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('http://127.0.0.1:3000/?googleCalendar=error');
  });

  it('redirects callback to error when Google rejects the token exchange', async () => {
    const db = {
      _get: vi.fn(async () => ({
        state: 'state-1',
        user_id: 'user-1',
        workspace_id: 'workspace-1',
        return_to: 'http://127.0.0.1:3000/calendar',
        expires_at: '2999-01-01T00:00:00.000Z',
        used_at: '',
      })),
      _execute: vi.fn(),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error_description: 'invalid code' }), { status: 400 })
    );
    const app = createTestApp(db);

    const response = await app.request('/callback?code=bad-code&state=state-1');

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'http://127.0.0.1:3000/calendar?googleCalendar=error'
    );
  });

  it('rejects event loading without a complete time range', async () => {
    const db = {
      _get: vi.fn(),
      _execute: vi.fn(),
    };
    const app = createTestApp(db);

    const response = await app.request('/events?workspaceId=workspace-1&timeMin=2026-06-01');
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toContain('timeMin');
  });

  it('returns 404 when events are requested before connecting Google Calendar', async () => {
    const db = {
      _get: vi.fn(async () => null),
      _execute: vi.fn(),
    };
    const app = createTestApp(db);

    const response = await app.request(
      '/events?workspaceId=workspace-1&timeMin=2026-06-01T00%3A00%3A00.000Z&timeMax=2026-07-01T00%3A00%3A00.000Z'
    );

    expect(response.status).toBe(404);
  });

  it('refreshes an expired access token before fetching events', async () => {
    const expiredIntegration = {
      user_id: 'user-1',
      workspace_id: 'workspace-1',
      access_token: 'old-token',
      refresh_token: 'refresh-token',
      expires_at: '2000-01-01T00:00:00.000Z',
      scopes: 'https://www.googleapis.com/auth/calendar.readonly',
      provider_account_email: 'owner@example.com',
    };
    const refreshedIntegration = {
      ...expiredIntegration,
      access_token: 'new-token',
      expires_at: '2999-01-01T00:00:00.000Z',
    };
    const db = {
      _get: vi
        .fn()
        .mockResolvedValueOnce(expiredIntegration)
        .mockResolvedValueOnce(expiredIntegration)
        .mockResolvedValueOnce(refreshedIntegration),
      _execute: vi.fn(),
    };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'new-token', expires_in: 3600 }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    const app = createTestApp(db);

    const response = await app.request(
      '/events?workspaceId=workspace-1&timeMin=2026-06-01T00%3A00%3A00.000Z&timeMax=2026-07-01T00%3A00%3A00.000Z'
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenLastCalledWith(expect.any(URL), {
      headers: { Authorization: 'Bearer new-token' },
    });
    expect(db._execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE google_integrations'),
      expect.arrayContaining(['new-token'])
    );
  });

  it('surfaces provider errors when Google event loading fails', async () => {
    const db = {
      _get: vi.fn(async () => ({
        user_id: 'user-1',
        workspace_id: 'workspace-1',
        access_token: 'access-token',
        refresh_token: '',
        expires_at: '2999-01-01T00:00:00.000Z',
        scopes: 'https://www.googleapis.com/auth/calendar.readonly',
      })),
      _execute: vi.fn(),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'calendar unavailable' } }), {
        status: 503,
      })
    );
    const app = createTestApp(db);

    await expect(
      app.request(
        '/events?workspaceId=workspace-1&timeMin=2026-06-01T00%3A00%3A00.000Z&timeMax=2026-07-01T00%3A00%3A00.000Z'
      )
    ).rejects.toThrow('calendar unavailable');
  });

  it('surfaces refresh token errors before fetching events', async () => {
    const db = {
      _get: vi.fn(async () => ({
        user_id: 'user-1',
        workspace_id: 'workspace-1',
        access_token: 'old-token',
        refresh_token: 'refresh-token',
        expires_at: '2000-01-01T00:00:00.000Z',
        scopes: 'https://www.googleapis.com/auth/calendar.readonly',
      })),
      _execute: vi.fn(),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error_description: 'refresh denied' }), { status: 400 })
    );
    const app = createTestApp(db);

    await expect(
      app.request(
        '/events?workspaceId=workspace-1&timeMin=2026-06-01T00%3A00%3A00.000Z&timeMax=2026-07-01T00%3A00%3A00.000Z'
      )
    ).rejects.toThrow('refresh denied');
  });

  it('disconnects the stored Google Calendar integration', async () => {
    const db = {
      _get: vi.fn(),
      _execute: vi.fn(),
    };
    const app = createTestApp(db);

    const response = await app.request('/disconnect', {
      method: 'POST',
      body: JSON.stringify({ workspaceId: 'workspace-1' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(db._execute).toHaveBeenCalledWith(
      'DELETE FROM google_integrations WHERE user_id = ? AND workspace_id = ? AND provider = ?',
      ['user-1', 'workspace-1', 'google_calendar']
    );
  });
});
