import { beforeEach, describe, expect, it, vi } from 'vitest';
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
});
