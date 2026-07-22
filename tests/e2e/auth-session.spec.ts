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
});
