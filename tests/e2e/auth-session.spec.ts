import { expect, test } from '@playwright/test';

test.describe('Authentication session scenarios', () => {
  // ─────────────────────────────────────────────────────────────────
  // Issue #1547 — AUTH-001: prevent duplicate login submissions
  // Date: 2026-07-22
  // Bug: the login action remains enabled while the remote request is pending.
  // Expected: one visible submission enters a non-interactive pending state.
  // ─────────────────────────────────────────────────────────────────
  test('AUTH-001 blocks a duplicate visible login submission while authentication is pending', async ({
    page,
  }) => {
    let loginRequests = 0;
    let resolveLogin: (() => void) | undefined;
    const loginPending = new Promise<void>((resolve) => {
      resolveLogin = resolve;
    });

    await page.route('**/auth/login', async (route) => {
      loginRequests += 1;
      await loginPending;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'e2e-session-token',
          user: { id: 'e2e-user', email: 'owner@example.test', name: 'QA Owner' },
          workspaceId: 'e2e-workspace',
        }),
      });
    });
    await page.route('**/state/bootstrap?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          workspaceId: 'e2e-workspace',
          users: [
            {
              id: 'e2e-user',
              email: 'owner@example.test',
              name: 'QA Owner',
              workspaceMemberRole: 'owner',
            },
          ],
          workspaces: [
            {
              id: 'e2e-workspace',
              name: 'QA Workspace',
              memberIds: ['e2e-user'],
              memberRoles: { 'e2e-user': 'owner' },
            },
          ],
        }),
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Logowanie' }).click();
    await page.getByLabel('Adres email').fill('owner@example.test');
    await page.getByLabel(/Has/i).fill('safe-e2e-password');

    const submit = page.getByRole('button', { name: /Zaloguj/i });
    await submit.click();
    await expect.poll(() => loginRequests).toBe(1);
    await expect(submit).toBeDisabled();
    await expect.poll(() => loginRequests).toBe(1);

    resolveLogin?.();
    await expect(page.locator('.auth-shell')).not.toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────
  // Issue #1549 — stop workspace polling after session expiry
  // Date: 2026-07-22
  // Bug: a controlled bootstrap 401 left repeated protected polling active.
  // Fix: one sync owner cancels bootstrap and poll timers until a new token exists.
  // ─────────────────────────────────────────────────────────────────
  test('Regression: Issue #1549 — one bootstrap 401 clears the session without further protected polls', async ({
    page,
  }) => {
    let sessionExpired = false;
    let bootstrapRequests = 0;
    let unauthorizedBootstrapRequests = 0;

    const user = { id: 'e2e-user', email: 'owner@example.test', name: 'QA Owner' };
    const workspace = {
      id: 'e2e-workspace',
      name: 'QA Workspace',
      memberIds: [user.id],
      memberRoles: { [user.id]: 'owner' },
    };
    const readyCapabilities = {
      ok: true,
      status: 'ready',
      capabilities: {},
      degradedCapabilities: [],
      telemetry: { fallbackModeUsed: false, fallbackModeCapabilities: [] },
    };

    await page.route('**/auth/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'e2e-session-token', user, workspaceId: workspace.id }),
      })
    );
    await page.route('**/state/bootstrap?*', (route) => {
      bootstrapRequests += 1;
      if (sessionExpired) {
        unauthorizedBootstrapRequests += 1;
        return route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Sesja wygasła.' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          workspaceId: workspace.id,
          users: [user],
          workspaces: [workspace],
          state: {
            meetings: [],
            manualTasks: [],
            manualPeople: [],
            taskState: {},
            taskBoards: {},
            calendarMeta: {},
            vocabulary: [],
          },
        }),
      });
    });
    await page.route('**/api/capabilities', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(readyCapabilities),
      })
    );
    await page.route('**/workspaces/*/capabilities', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(readyCapabilities),
      })
    );
    await page.route('**/voice-profiles', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ profiles: [] }),
      })
    );

    await page.goto('/');
    await page.getByRole('button', { name: 'Logowanie' }).click();
    await page.getByLabel('Adres email').fill(user.email);
    await page.getByLabel('Hasło').fill('safe-e2e-password');
    await page.getByRole('button', { name: 'Zaloguj się' }).click();
    await expect(page.locator('.app-shell-modern')).toBeVisible();
    await expect.poll(() => bootstrapRequests).toBeGreaterThanOrEqual(1);
    expect(bootstrapRequests).toBe(1);

    sessionExpired = true;
    const navItem = page.locator('.modern-nav-item').filter({ hasText: 'Nagrania' }).first();
    await expect(navItem).toBeVisible();
    await navItem.click();

    await expect.poll(() => unauthorizedBootstrapRequests, { timeout: 12_000 }).toBe(1);
    await expect(page.locator('.auth-shell')).toBeVisible();
    await expect(page.locator('.app-shell-modern')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Logowanie' })).toBeVisible();
    expect(
      await page.evaluate(() => {
        const session = JSON.parse(window.localStorage.getItem('voicelog.session.v3') || 'null');
        const workspaceStore = JSON.parse(
          window.localStorage.getItem('voicelog_workspace_store') || 'null'
        );
        return Boolean(session?.token || workspaceStore?.state?.session?.token);
      })
    ).toBe(false);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('button', { name: 'Logowanie' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
  });
});
