import { apiRequest } from './httpClient';

export type GoogleCalendarStatusResponse = {
  configured: boolean;
  connected: boolean;
  writable: boolean;
  accountEmail?: string;
  scopes?: string;
  expiresAt?: string;
  lastSyncedAt?: string;
};

export async function getGoogleCalendarStatus(workspaceId: string) {
  return apiRequest(
    `/integrations/google/status?workspaceId=${encodeURIComponent(workspaceId)}`
  ) as Promise<GoogleCalendarStatusResponse>;
}

export async function startGoogleCalendarConnect(workspaceId: string, returnTo: string) {
  return apiRequest(
    `/integrations/google/connect?workspaceId=${encodeURIComponent(workspaceId)}&returnTo=${encodeURIComponent(
      returnTo
    )}`,
    { retries: 0 }
  ) as Promise<{ url: string }>;
}

export async function fetchGoogleCalendarEvents({
  workspaceId,
  timeMin,
  timeMax,
}: {
  workspaceId: string;
  timeMin: string;
  timeMax: string;
}) {
  return apiRequest(
    `/integrations/google/events?workspaceId=${encodeURIComponent(workspaceId)}&timeMin=${encodeURIComponent(
      timeMin
    )}&timeMax=${encodeURIComponent(timeMax)}`
  ) as Promise<{ items: any[] }>;
}

export async function disconnectGoogleCalendar(workspaceId: string) {
  return apiRequest('/integrations/google/disconnect', {
    method: 'POST',
    body: { workspaceId },
  }) as Promise<{ success: boolean }>;
}
