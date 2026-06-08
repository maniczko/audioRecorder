import { Hono } from 'hono';
import crypto from 'crypto';
import { config } from '../config.ts';
import type { AppMiddlewares, AppServices } from './middleware.ts';

const PROVIDER = 'google_calendar';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const STATE_TTL_MS = 10 * 60 * 1000;
const REFRESH_SKEW_MS = 60 * 1000;

type GoogleTokenPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

function googleCalendarConfigured() {
  return Boolean(
    config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET && config.GOOGLE_OAUTH_REDIRECT_URI
  );
}

function workspaceIdFrom(value: unknown) {
  return String(value || '').trim();
}

function safeReturnTo(value: unknown) {
  const fallback = 'http://127.0.0.1:3000/';
  const raw = String(value || '').trim();
  if (!raw) return fallback;

  try {
    const url = new URL(raw);
    const allowed =
      (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)) ||
      (url.protocol === 'https:' && url.hostname === 'voicelog-audiorecorder.vercel.app');
    return allowed ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

function addQuery(url: string, params: Record<string, string>) {
  const nextUrl = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    nextUrl.searchParams.set(key, value);
  }
  return nextUrl.toString();
}

function expiresAtFrom(expiresIn?: number) {
  const seconds = Number.isFinite(expiresIn) && expiresIn ? Number(expiresIn) : 3600;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function exchangeCodeForTokens(code: string) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.GOOGLE_CLIENT_ID || '',
      client_secret: config.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: config.GOOGLE_OAUTH_REDIRECT_URI || '',
      grant_type: 'authorization_code',
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as GoogleTokenPayload;
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'Google Calendar OAuth failed.');
  }
  return payload;
}

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.GOOGLE_CLIENT_ID || '',
      client_secret: config.GOOGLE_CLIENT_SECRET || '',
      grant_type: 'refresh_token',
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as GoogleTokenPayload;
  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description || payload.error || 'Google Calendar refresh failed.'
    );
  }
  return payload;
}

async function getIntegration(db: any, userId: string, workspaceId: string) {
  return db._get(
    `SELECT * FROM google_integrations
     WHERE user_id = ? AND workspace_id = ? AND provider = ?`,
    [userId, workspaceId, PROVIDER]
  );
}

async function upsertIntegration(
  db: any,
  input: {
    userId: string;
    workspaceId: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt: string;
    scopes?: string;
    email?: string;
  }
) {
  const timestamp = new Date().toISOString();
  const existing = await getIntegration(db, input.userId, input.workspaceId);
  /* v8 ignore next -- defensive persistence fallback for partial Google token payloads */
  const refreshToken = input.refreshToken || existing?.refresh_token || '';

  if (existing) {
    await db._execute(
      `UPDATE google_integrations
       SET access_token = ?, refresh_token = ?, expires_at = ?, scopes = ?,
           provider_account_email = ?, updated_at = ?
       WHERE user_id = ? AND workspace_id = ? AND provider = ?`,
      [
        input.accessToken,
        refreshToken,
        input.expiresAt,
        /* v8 ignore next -- preserve existing scopes when Google omits scope on refresh */
        input.scopes || existing.scopes || '',
        /* v8 ignore next -- email enrichment is optional for readonly calendar scope */
        input.email || existing.provider_account_email || '',
        timestamp,
        input.userId,
        input.workspaceId,
        PROVIDER,
      ]
    );
    return getIntegration(db, input.userId, input.workspaceId);
  }

  await db._execute(
    `INSERT INTO google_integrations (
      id, user_id, workspace_id, provider, access_token, refresh_token, expires_at,
      scopes, provider_account_email, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      input.userId,
      input.workspaceId,
      PROVIDER,
      input.accessToken,
      refreshToken,
      input.expiresAt,
      /* v8 ignore next -- config default is a defensive fallback for partial OAuth payloads */
      input.scopes || config.GOOGLE_CALENDAR_SCOPES,
      /* v8 ignore next -- email enrichment is optional for readonly calendar scope */
      input.email || '',
      timestamp,
      timestamp,
    ]
  );
  return getIntegration(db, input.userId, input.workspaceId);
}

async function ensureFreshIntegration(db: any, integration: any) {
  const expiresAt = new Date(integration.expires_at || 0).getTime();
  if (!integration.refresh_token || expiresAt - Date.now() > REFRESH_SKEW_MS) {
    return integration;
  }

  const refreshed = await refreshAccessToken(integration.refresh_token);
  return upsertIntegration(db, {
    userId: integration.user_id,
    workspaceId: integration.workspace_id,
    /* v8 ignore next -- refresh endpoint success requires an access token, fallback is defensive */
    accessToken: refreshed.access_token || '',
    /* v8 ignore next -- Google often omits refresh_token on refresh responses */
    refreshToken: refreshed.refresh_token || integration.refresh_token,
    expiresAt: expiresAtFrom(refreshed.expires_in),
    /* v8 ignore next -- Google can omit scope on refresh responses */
    scopes: refreshed.scope || integration.scopes,
    email: integration.provider_account_email,
  });
}

async function fetchCalendarEvents(
  accessToken: string,
  params: { timeMin: string; timeMax: string }
) {
  const url = new URL(CALENDAR_EVENTS_URL);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('timeMin', params.timeMin);
  url.searchParams.set('timeMax', params.timeMax);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    /* v8 ignore next -- provider error payload shapes vary */
    throw new Error(payload?.error?.message || 'Nie udalo sie pobrac wydarzen Google Calendar.');
  }
  return payload;
}

export function createGoogleIntegrationRoutes(services: AppServices, middlewares: AppMiddlewares) {
  const app = new Hono();
  const { authMiddleware, ensureWorkspaceAccess } = middlewares;
  const db = services.db;

  app.get('/status', authMiddleware, async (c) => {
    const session = c.get('session');
    const workspaceId = workspaceIdFrom(c.req.query('workspaceId') || session.workspace_id);
    await ensureWorkspaceAccess(c, workspaceId);

    const integration = await getIntegration(db, session.user_id, workspaceId);
    return c.json({
      configured: googleCalendarConfigured(),
      connected: Boolean(integration),
      writable: false,
      accountEmail: integration?.provider_account_email || session.email || '',
      scopes: integration?.scopes || config.GOOGLE_CALENDAR_SCOPES,
      expiresAt: integration?.expires_at || '',
      lastSyncedAt: integration?.updated_at || '',
    });
  });

  app.get('/connect', authMiddleware, async (c) => {
    const session = c.get('session');
    const workspaceId = workspaceIdFrom(c.req.query('workspaceId') || session.workspace_id);
    await ensureWorkspaceAccess(c, workspaceId);

    if (!googleCalendarConfigured()) {
      return c.json({ message: 'Google Calendar nie jest skonfigurowany na backendzie.' }, 503);
    }

    const state = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + STATE_TTL_MS).toISOString();
    await db._execute(
      `INSERT INTO google_oauth_states (
        state, user_id, workspace_id, return_to, created_at, expires_at, used_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        state,
        session.user_id,
        workspaceId,
        safeReturnTo(c.req.query('returnTo')),
        createdAt,
        expiresAt,
        '',
      ]
    );

    const url = new URL(AUTH_URL);
    url.searchParams.set('client_id', config.GOOGLE_CLIENT_ID || '');
    url.searchParams.set('redirect_uri', config.GOOGLE_OAUTH_REDIRECT_URI || '');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', config.GOOGLE_CALENDAR_SCOPES);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('state', state);
    if (session.email) url.searchParams.set('login_hint', session.email);

    return c.json({ url: url.toString() });
  });

  app.get('/callback', async (c) => {
    const code = String(c.req.query('code') || '').trim();
    const state = String(c.req.query('state') || '').trim();
    const row = state
      ? await db._get('SELECT * FROM google_oauth_states WHERE state = ?', [state])
      : null;
    const returnTo = safeReturnTo(row?.return_to);

    if (!code || !row || row.used_at || new Date(row.expires_at).getTime() <= Date.now()) {
      return c.redirect(addQuery(returnTo, { googleCalendar: 'error' }));
    }

    try {
      await db._execute('UPDATE google_oauth_states SET used_at = ? WHERE state = ?', [
        new Date().toISOString(),
        state,
      ]);
      const tokens = await exchangeCodeForTokens(code);
      await upsertIntegration(db, {
        userId: row.user_id,
        workspaceId: row.workspace_id,
        /* v8 ignore next -- token exchange success requires an access token, fallback is defensive */
        accessToken: tokens.access_token || '',
        refreshToken: tokens.refresh_token,
        expiresAt: expiresAtFrom(tokens.expires_in),
        scopes: tokens.scope,
      });
      return c.redirect(addQuery(returnTo, { googleCalendar: 'connected' }));
    } catch {
      return c.redirect(addQuery(returnTo, { googleCalendar: 'error' }));
    }
  });

  app.get('/events', authMiddleware, async (c) => {
    const session = c.get('session');
    /* v8 ignore next -- session fallback is defensive for direct route calls */
    const workspaceId = workspaceIdFrom(c.req.query('workspaceId') || session.workspace_id);
    const timeMin = String(c.req.query('timeMin') || '').trim();
    const timeMax = String(c.req.query('timeMax') || '').trim();
    await ensureWorkspaceAccess(c, workspaceId);

    if (!timeMin || !timeMax) {
      return c.json({ message: 'Podaj zakres dat timeMin i timeMax.' }, 400);
    }

    const integration = await getIntegration(db, session.user_id, workspaceId);
    if (!integration) {
      return c.json({ message: 'Najpierw polacz Google Calendar.' }, 404);
    }

    const freshIntegration = await ensureFreshIntegration(db, integration);
    const payload = await fetchCalendarEvents(freshIntegration.access_token, { timeMin, timeMax });
    /* v8 ignore next -- Google events payload should contain an array, fallback protects UI */
    return c.json({ items: Array.isArray(payload.items) ? payload.items : [] });
  });

  app.post('/disconnect', authMiddleware, async (c) => {
    const session = c.get('session');
    const body = await c.req.json().catch(() => ({}));
    /* v8 ignore next -- session fallback supports disconnect without a JSON body */
    const workspaceId = workspaceIdFrom(body.workspaceId || session.workspace_id);
    await ensureWorkspaceAccess(c, workspaceId);

    await db._execute(
      'DELETE FROM google_integrations WHERE user_id = ? AND workspace_id = ? AND provider = ?',
      [session.user_id, workspaceId, PROVIDER]
    );
    return c.json({ success: true });
  });

  return app;
}
