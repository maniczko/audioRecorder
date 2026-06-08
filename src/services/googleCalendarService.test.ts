import { describe, expect, it, vi, beforeEach } from 'vitest';
import { apiRequest } from './httpClient';
import {
  disconnectGoogleCalendar,
  fetchGoogleCalendarEvents,
  getGoogleCalendarStatus,
  startGoogleCalendarConnect,
} from './googleCalendarService';

vi.mock('./httpClient', () => ({
  apiRequest: vi.fn(),
}));

describe('googleCalendarService', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('requests backend connection status for a workspace', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ connected: false });

    await getGoogleCalendarStatus('workspace 1');

    expect(apiRequest).toHaveBeenCalledWith(
      '/integrations/google/status?workspaceId=workspace%201'
    );
  });

  it('starts OAuth flow with an encoded return URL', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      url: 'https://accounts.google.com/o/oauth2/v2/auth',
    });

    await startGoogleCalendarConnect('workspace 1', 'http://127.0.0.1:3000/?tab=calendar');

    expect(apiRequest).toHaveBeenCalledWith(
      '/integrations/google/connect?workspaceId=workspace%201&returnTo=http%3A%2F%2F127.0.0.1%3A3000%2F%3Ftab%3Dcalendar'
    );
  });

  it('loads events through the backend proxy', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ items: [] });

    await fetchGoogleCalendarEvents({
      workspaceId: 'workspace 1',
      timeMin: '2026-06-01T00:00:00.000Z',
      timeMax: '2026-07-01T00:00:00.000Z',
    });

    expect(apiRequest).toHaveBeenCalledWith(
      '/integrations/google/events?workspaceId=workspace%201&timeMin=2026-06-01T00%3A00%3A00.000Z&timeMax=2026-07-01T00%3A00%3A00.000Z'
    );
  });

  it('disconnects the workspace integration', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ success: true });

    await disconnectGoogleCalendar('workspace 1');

    expect(apiRequest).toHaveBeenCalledWith('/integrations/google/disconnect', {
      method: 'POST',
      body: { workspaceId: 'workspace 1' },
    });
  });
});
