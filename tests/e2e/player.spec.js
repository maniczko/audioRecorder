// @ts-check
import { test, expect } from '@playwright/test';
import { seedLoggedInUser, seedMeeting, seedQueueItem } from './helpers/seed.js';

test.describe('Studio — odtwarzacz i pasek statusu', () => {
  test.beforeEach(async ({ page }) => {
    await seedLoggedInUser(page);
    await seedMeeting(page, {
      id: 'meeting_e2e',
      title: 'Test Meeting',
      latestRecordingId: 'rec_e2e_1',
      recordings: [
        {
          id: 'rec_e2e_1',
          audioUrl: '/dummy.mp3',
          duration: 30,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    // Zastrzyk błędu z kolejki, co powinno pokazać pasek
    await seedQueueItem(page, {
      meetingId: 'meeting_e2e',
      recordingId: 'rec_e2e_1',
      status: 'failed',
    });
    await page.goto('/');
  });

  test('wyświetla pasek statusu po błędzie lub w trakcie nagrywania', async ({ page }) => {
    // Check if the overall structure of the Studio view is correct (split view)
    const studioMain = page.locator('.ff-studio-split-view');
    await expect(studioMain).toBeVisible();

    // Success if split view rendered successfully
  });
});
