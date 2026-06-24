// @ts-check
import { expect, test } from '@playwright/test';
import { seedLoggedInUser, seedMeeting } from './helpers/seed.js';

function briefDialog(page) {
  return page.getByRole('dialog', { name: /Nowe spotkanie|Edytuj spotkanie/i });
}

async function createTaskFromModal(page, title) {
  await page
    .getByRole('button', { name: /Dodaj zadanie/i })
    .first()
    .click();
  const dialog = page.getByRole('dialog', { name: 'Nowe zadanie' });
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('Wpisz tytuł zadania...').fill(title);
  await dialog.getByRole('button', { name: 'Dodaj zadanie' }).click();
}

async function mockRegistrationBackend(page) {
  const user = {
    id: 'user_smoke_register',
    email: 'smoke@example.com',
    name: 'Smoke Tester',
    provider: 'local',
    defaultWorkspaceId: 'ws_smoke_register',
    workspaceIds: ['ws_smoke_register'],
    workspaceMemberRole: 'owner',
  };
  const workspace = {
    id: 'ws_smoke_register',
    name: 'Smoke Workspace',
    role: 'owner',
    memberIds: [user.id],
    memberRoles: { [user.id]: 'owner' },
  };
  const authPayload = {
    user,
    users: [user],
    workspace,
    workspaces: [workspace],
    workspaceId: workspace.id,
    token: 'smoke-register-token',
    session: {
      userId: user.id,
      workspaceId: workspace.id,
      token: 'smoke-register-token',
    },
    state: {
      meetings: [],
      manualTasks: [],
      taskState: {},
      taskBoards: {},
      calendarMeta: {},
      vocabulary: [],
      storedMeetingDrafts: {},
    },
  };

  const json = async (route, body = authPayload, status = 200) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  };

  await page.route('**/auth/register', async (route) => json(route, authPayload, 201));
  await page.route('**/auth/session**', async (route) => json(route));
  await page.route('**/state/bootstrap**', async (route) => json(route));
  await page.route('**/state/workspaces/**', async (route) => json(route, workspace));
}

test.describe.configure({ timeout: 90_000 });

test.describe('Smoke product flows', () => {
  test('login via registration opens the app', async ({ page }) => {
    await mockRegistrationBackend(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'Rejestracja' }).click();
    await page.getByPlaceholder('np. Anna Nowak').fill('Smoke Tester');
    await page.getByPlaceholder('name@company.com').fill(`smoke.${Date.now()}@example.com`);
    await page.getByLabel(/Has/).fill('haslo123');
    await page.getByLabel(/Nazwa nowej przestrzeni/).fill('Smoke Workspace');
    await page.getByRole('button', { name: /Wejd.*do aplikacji/i }).click();

    await expect(
      page.locator('.modern-nav-item').filter({ hasText: 'Studio' }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('creates a meeting from studio', async ({ page }) => {
    await seedLoggedInUser(page);
    await page.goto('/');

    const meetingTitle = `Smoke meeting ${Date.now()}`;

    await page.getByRole('button', { name: 'Przygotuj brief' }).click();
    await briefDialog(page).getByPlaceholder('np. Spotkanie z klientem').fill(meetingTitle);
    await briefDialog(page).locator('.brief-actions .primary-button').click();

    await expect(page.locator('.ff-header-title')).toHaveText(meetingTitle, { timeout: 15_000 });
  });

  test('adds a task from tasks tab', async ({ page }) => {
    await seedLoggedInUser(page);
    await page.goto('/');

    const taskTitle = `Smoke task ${Date.now()}`;

    await page.locator('.modern-nav-item').filter({ hasText: 'Zadania' }).click();
    await createTaskFromModal(page, taskTitle);

    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 15_000 });
  });

  test('opens recording view for a meeting with recordings', async ({ page }) => {
    await seedLoggedInUser(page);
    await seedMeeting(page, {
      id: 'meeting_recording_smoke',
      title: 'Meeting with recording',
      recordings: [
        {
          id: 'recording_smoke_1',
          createdAt: '2026-03-20T10:00:00.000Z',
          duration: 320,
          pipelineStatus: 'done',
          transcript: [],
          analysis: { summary: 'OK' },
        },
      ],
    });

    await page.goto('/');
    await page.locator('.modern-nav-item').filter({ hasText: 'Nagrania' }).click();

    await expect(page.getByText('Meeting with recording').first()).toBeVisible({ timeout: 15_000 });
  });
});
