import { expect, test } from '@playwright/test';
import { seedLoggedInUser, seedQueueItem } from './helpers/seed.js';

async function openShellTab(page, label: string) {
  const hamburger = page.locator('.modern-hamburger-btn');
  const navItem = page.locator('.modern-nav-item').filter({ hasText: label }).first();

  if (!(await navItem.isVisible().catch(() => false)) && (await hamburger.isVisible())) {
    await hamburger.click();
  }

  await expect(navItem).toBeVisible();
  await navItem.click();
}

test.describe('Recordings queue smoke', () => {
  test('keeps a fresh local recording visible when navigating Studio -> Nagrania', async ({
    page,
  }) => {
    await seedLoggedInUser(page);
    await seedQueueItem(page, {
      id: 'queue_smoke_recording',
      recordingId: 'recording_smoke_local',
      meetingId: 'meeting_smoke_local',
      workspaceId: 'ws_e2e',
      meetingTitle: 'Ad hoc smoke queue recording',
      meetingSnapshot: {
        id: 'meeting_smoke_local',
        workspaceId: 'ws_e2e',
        title: 'Ad hoc smoke queue recording',
      },
      mimeType: 'audio/webm',
      rawSegments: [],
      duration: 4,
      status: 'queued',
      uploaded: false,
      attempts: 0,
      retryCount: 0,
      backoffUntil: 0,
      lastErrorMessage: '',
      errorMessage: '',
      createdAt: '2026-06-15T13:26:00.000Z',
      updatedAt: '2026-06-15T13:26:00.000Z',
    });

    await page.route('**/auth/session**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user_e2e',
            email: 'e2e@voicelog.test',
            name: 'E2E Tester',
            provider: 'local',
            defaultWorkspaceId: 'ws_e2e',
            workspaceIds: ['ws_e2e'],
            workspaceMemberRole: 'owner',
          },
          workspaceId: 'ws_e2e',
          state: { meetings: [], manualTasks: [], manualPeople: [] },
        }),
      });
    });
    await page.route('**/state/bootstrap**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          workspaceId: 'ws_e2e',
          state: { meetings: [], manualTasks: [], manualPeople: [] },
        }),
      });
    });
    await page.route('**/voice-profiles**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ profiles: [] }),
      });
    });

    await page.goto('/');
    await openShellTab(page, 'Studio');
    await expect(page.locator('.modern-main')).toBeVisible();

    await openShellTab(page, 'Nagrania');
    await expect(page.getByRole('heading', { name: /Baza nagra/i })).toBeVisible();

    const rowTitle = page.getByText('Ad hoc smoke queue recording').first();
    await expect(rowTitle).toBeVisible();
    const row = page.locator('tr', { hasText: 'Ad hoc smoke queue recording' }).first();
    await expect(row).toContainText(/Wgrywanie|Wgrane|Transkrypcja|Gotowe|Brak mowy|Blad|Błąd/);
  });
});
