// @ts-check
import { expect, test } from '@playwright/test';

const FRONTEND_URL =
  process.env.PRODUCTION_FRONTEND_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  'https://voicelog-audiorecorder.vercel.app';
const API_BASE_URL = process.env.PRODUCTION_API_BASE_URL || FRONTEND_URL;
const AUTH_TOKEN = process.env.PRODUCTION_SMOKE_AUTH_TOKEN || '';
const WORKSPACE_ID = process.env.PRODUCTION_SMOKE_WORKSPACE_ID || '';
const AUDIT_REQUIRED = process.env.PRODUCTION_SYSTEM_AUDIT_REQUIRED === 'true';
const AUDIT_PREFIX = 'audit_20260524_';

const coreTabs = ['Studio', 'Nagrania', 'Kalendarz', 'Zadania', 'Osoby', 'Notatki'];

function requireProductionAuditConfig() {
  const missing = [];
  if (!AUTH_TOKEN) missing.push('PRODUCTION_SMOKE_AUTH_TOKEN');
  if (!WORKSPACE_ID) missing.push('PRODUCTION_SMOKE_WORKSPACE_ID');

  if (missing.length > 0 && AUDIT_REQUIRED) {
    throw new Error(`Production system audit is missing required env: ${missing.join(', ')}`);
  }

  return missing.length === 0;
}

function apiUrl(path) {
  return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${AUTH_TOKEN}`,
    'X-Workspace-Id': WORKSPACE_ID,
  };
}

async function fetchProductionSession(request) {
  const response = await request.get(
    apiUrl(`/auth/session?workspaceId=${encodeURIComponent(WORKSPACE_ID)}`),
    {
      headers: authHeaders(),
    }
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
        : [
            {
              id: WORKSPACE_ID,
              name: 'Production smoke workspace',
              memberIds: [userId],
            },
          ];

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

async function fetchWorkspaceState(request) {
  const response = await request.get(
    apiUrl(`/state/bootstrap?workspaceId=${encodeURIComponent(WORKSPACE_ID)}`),
    {
      headers: authHeaders(),
    }
  );

  expect(response.status(), await response.text()).toBeLessThan(500);
  expect(response.ok(), await response.text()).toBe(true);

  const payload = await response.json();
  return payload.state || {};
}

async function patchWorkspaceState(request, delta) {
  const response = await request.patch(
    apiUrl(`/state/workspaces/${encodeURIComponent(WORKSPACE_ID)}`),
    {
      headers: authHeaders(),
      data: delta,
    }
  );

  expect(response.status(), await response.text()).toBeLessThan(500);
  expect(response.ok(), await response.text()).toBe(true);

  return response.json();
}

async function installProductionSession(page, request) {
  const sessionPayload = await fetchProductionSession(request);

  await page.addInitScript(({ users, workspaces, session }) => {
    localStorage.setItem('voicelog.session.v3', JSON.stringify(session));
    localStorage.setItem(
      'voicelog_workspace_store',
      JSON.stringify({
        state: {
          users,
          workspaces,
          session,
        },
        version: 0,
      })
    );
    localStorage.setItem('voicelog.e2e.production', 'true');
  }, sessionPayload);
}

function attachRuntimeGuard(page) {
  const failures = [];

  page.on('pageerror', (error) => {
    failures.push(`pageerror: ${error.message}`);
  });

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/ResizeObserver loop/i.test(text)) return;
    failures.push(`console error: ${text}`);
  });

  page.on('response', (response) => {
    const status = response.status();
    if (status < 400) return;

    const url = response.url();
    if (url.includes('/api/client-errors') && status < 500) return;
    failures.push(`network ${status}: ${url}`);
  });

  return {
    async assertClean() {
      await page.waitForTimeout(500);
      expect(failures).toEqual([]);
    },
  };
}

async function openShellTab(page, label) {
  const hamburger = page.locator('.modern-hamburger-btn');
  if (await hamburger.isVisible()) {
    await hamburger.click();
  }

  const navItem = page.locator('.modern-nav-item').filter({ hasText: label }).first();
  await expect(navItem).toBeVisible({ timeout: 15_000 });
  await navItem.click();
  await expect(page.locator('.modern-main, main').first()).toBeVisible();
}

test.describe('Production system audit', () => {
  test.skip(
    !AUDIT_REQUIRED && (!AUTH_TOKEN || !WORKSPACE_ID),
    'Production system audit requires PRODUCTION_SMOKE_AUTH_TOKEN and PRODUCTION_SMOKE_WORKSPACE_ID.'
  );

  test.beforeEach(async () => {
    requireProductionAuditConfig();
  });

  test('opens every core workspace tab with a real production session and no runtime errors', async ({
    page,
    request,
  }) => {
    await installProductionSession(page, request);
    const guard = attachRuntimeGuard(page);

    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.modern-main, main').first()).toBeVisible({ timeout: 20_000 });

    await page.locator('.modern-search-btn').click();
    await expect(page.locator('.command-palette')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByLabel('Powiadomienia').click();
    await expect(page.locator('.notification-panel, .notification-center').first()).toBeVisible();
    await page.keyboard.press('Escape');

    for (const tab of coreTabs) {
      await openShellTab(page, tab);
    }

    await guard.assertClean();
  });

  test('keeps production backend prefixes proxied instead of falling through to Vercel 404', async ({
    request,
  }) => {
    const aiResponse = await request.post(apiUrl('/ai/suggest-tasks'), {
      data: { transcript: [], people: [] },
    });
    expect(aiResponse.status(), await aiResponse.text()).toBe(200);

    const voiceProfilesResponse = await request.get(apiUrl('/voice-profiles'), {
      headers: authHeaders(),
    });
    expect(voiceProfilesResponse.status(), await voiceProfilesResponse.text()).not.toBe(404);
    expect(voiceProfilesResponse.status(), await voiceProfilesResponse.text()).toBeLessThan(500);
  });

  test('persists an audit task and confirms it does not return after refresh once deleted', async ({
    request,
  }) => {
    const now = new Date().toISOString();
    const taskId = `${AUDIT_PREFIX}task_${Date.now()}`;
    const taskTitle = `${AUDIT_PREFIX}task_persistence`;
    const task = {
      id: taskId,
      title: taskTitle,
      status: 'todo',
      priority: 'medium',
      owner: 'production-audit',
      tags: ['audit'],
      completed: false,
      createdAt: now,
      updatedAt: now,
      workspaceId: WORKSPACE_ID,
      createdByUserId: 'production-audit',
    };

    try {
      await patchWorkspaceState(request, {
        manualTasks: { upsert: [task] },
      });

      let state = await fetchWorkspaceState(request);
      expect(
        (state.manualTasks || []).some((candidate) => candidate.id === taskId),
        'audit task should be visible after production state write'
      ).toBe(true);

      await patchWorkspaceState(request, {
        manualTasks: { removeIds: [taskId] },
      });

      state = await fetchWorkspaceState(request);
      expect(
        (state.manualTasks || []).some((candidate) => candidate.id === taskId),
        'deleted audit task does not return after refresh'
      ).toBe(false);
    } finally {
      await patchWorkspaceState(request, {
        manualTasks: { removeIds: [taskId] },
      }).catch(() => {});
    }
  });
});
