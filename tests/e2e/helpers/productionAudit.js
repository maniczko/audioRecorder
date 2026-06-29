// @ts-check
import { expect } from '@playwright/test';

export const FRONTEND_URL =
  process.env.PRODUCTION_FRONTEND_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  'https://voicelog-audiorecorder.vercel.app';
export const API_BASE_URL = process.env.PRODUCTION_API_BASE_URL || FRONTEND_URL;
export const AUTH_TOKEN = process.env.PRODUCTION_SMOKE_AUTH_TOKEN || '';
export const WORKSPACE_ID = process.env.PRODUCTION_SMOKE_WORKSPACE_ID || '';
export const AUDIT_REQUIRED = process.env.PRODUCTION_SYSTEM_AUDIT_REQUIRED === 'true';
export const AUDIT_PREFIX = process.env.PRODUCTION_AUDIT_PREFIX || 'audit_20260529_';
const API_REQUEST_TIMEOUT_MS = Number(process.env.PRODUCTION_AUDIT_REQUEST_TIMEOUT_MS || 45_000);

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function hasProductionAuditConfig() {
  const missing = [];
  if (!AUTH_TOKEN) missing.push('PRODUCTION_SMOKE_AUTH_TOKEN');
  if (!WORKSPACE_ID) missing.push('PRODUCTION_SMOKE_WORKSPACE_ID');
  if (!FRONTEND_URL) missing.push('PRODUCTION_FRONTEND_URL');
  if (!API_BASE_URL) missing.push('PRODUCTION_API_BASE_URL');

  if (missing.length > 0 && AUDIT_REQUIRED) {
    throw new Error(`Production audit is missing required env: ${missing.join(', ')}`);
  }

  return missing.length === 0;
}

export function apiUrl(path) {
  return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
}

export function authHeaders() {
  return {
    Authorization: `Bearer ${AUTH_TOKEN}`,
    'X-Workspace-Id': WORKSPACE_ID,
  };
}

export async function fetchProductionSession(request) {
  const response = await request.get(
    apiUrl(`/auth/session?workspaceId=${encodeURIComponent(WORKSPACE_ID)}`),
    { headers: authHeaders() }
  );

  expect(response.status(), await response.text()).toBeLessThan(500);
  expect(response.ok(), await response.text()).toBe(true);

  const payload = await response.json();
  const user = payload.user || payload.users?.[0] || null;
  const userId = user?.id || payload.userId || payload.session?.userId || payload.session?.user_id;
  expect(userId, 'production auth session must resolve a user id').toBeTruthy();

  const workspaces =
    Array.isArray(payload.workspaces) && payload.workspaces.length > 0
      ? payload.workspaces
      : payload.workspace
        ? [payload.workspace]
        : [{ id: WORKSPACE_ID, name: 'Production audit workspace', memberIds: [userId] }];

  return {
    users: Array.isArray(payload.users) && payload.users.length > 0 ? payload.users : [user],
    workspaces,
    session: {
      userId,
      workspaceId: payload.workspaceId || WORKSPACE_ID,
      token: AUTH_TOKEN,
    },
  };
}

export async function installProductionSession(page, request) {
  const sessionPayload = await fetchProductionSession(request);
  await page.addInitScript(({ users, workspaces, session }) => {
    localStorage.setItem('voicelog.session.v3', JSON.stringify(session));
    localStorage.setItem(
      'voicelog_workspace_store',
      JSON.stringify({ state: { users, workspaces, session }, version: 0 })
    );
    localStorage.setItem('voicelog.e2e.production', 'true');
  }, sessionPayload);
}

export async function fetchWorkspaceState(request) {
  const response = await request.get(
    apiUrl(`/state/bootstrap?workspaceId=${encodeURIComponent(WORKSPACE_ID)}`),
    { headers: authHeaders() }
  );

  expect(response.status(), await response.text()).toBeLessThan(500);
  expect(response.ok(), await response.text()).toBe(true);

  const payload = await response.json();
  return payload.state || {};
}

export async function patchWorkspaceState(request, delta, options = {}) {
  const attempts = options.attempts || 3;
  const timeout = options.timeout || API_REQUEST_TIMEOUT_MS;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await request.patch(
        apiUrl(`/state/workspaces/${encodeURIComponent(WORKSPACE_ID)}`),
        {
          headers: authHeaders(),
          data: delta,
          timeout,
        }
      );
      const text = await response.text();
      expect(response.status(), text).toBeLessThan(500);
      expect(response.ok(), text).toBe(true);
      return text ? JSON.parse(text) : {};
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await sleep(attempt * 2_000);
    }
  }

  throw lastError || new Error('Production workspace patch failed.');
}

export function createAuditMeeting(id, title, overrides = {}) {
  const now = new Date().toISOString();
  return {
    id,
    title,
    context: `${title} context`,
    startsAt: now,
    durationMinutes: 30,
    attendees: [],
    tags: ['audit'],
    needs: [],
    desiredOutputs: [],
    recordings: [],
    workspaceId: WORKSPACE_ID,
    createdByUserId: 'production-audit',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function attachRuntimeGuard(page, { allow = [] } = {}) {
  const failures = [];

  const isAllowed = (entry) => allow.some((pattern) => pattern.test(entry));

  page.on('pageerror', (error) => {
    const entry = `pageerror: ${error.message}`;
    if (!isAllowed(entry)) failures.push(entry);
  });

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/ResizeObserver loop/i.test(text)) return;
    const entry = `console error: ${text}`;
    if (!isAllowed(entry)) failures.push(entry);
  });

  page.on('response', (response) => {
    const status = response.status();
    if (status < 400) return;
    const entry = `network ${status}: ${response.url()}`;
    if (!isAllowed(entry)) failures.push(entry);
  });

  return {
    failures,
    async assertClean() {
      await page.waitForTimeout(250);
      expect(failures).toEqual([]);
    },
  };
}
