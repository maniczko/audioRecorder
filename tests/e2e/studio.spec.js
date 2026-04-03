// @ts-check
import { test, expect } from '@playwright/test';
import { seedLoggedInUser } from './helpers/seed.js';

test.describe('StudioMeetingView — zakładki i AI', () => {
  test.beforeEach(async ({ page }) => {
    await seedLoggedInUser(page);
    await page.goto('/');
    // We navigate to Studio Tab by creating a quick meeting and opening it
    const meetingTitle = `E2E Studio Check ${Date.now()}`;
    await page.getByRole('button', { name: 'Przygotuj brief' }).click();
    await page
      .locator(".workspace-sidebar input[placeholder='np. Spotkanie z klientem']")
      .fill(meetingTitle);
    await page.locator('.brief-actions .primary-button').click();
    await expect(page.locator('.ff-header-title')).toHaveText(meetingTitle);
  });

  test('Podsumowanie spotkania is the default active tab', async ({ page }) => {
    // Default tab is 'summary' (Podsumowanie spotkania) per studioAnalysisTab useState('summary')
    const activeTab = page.locator('.ff-int-tab.active');
    await expect(activeTab).toHaveText('Podsumowanie spotkania');
  });

  test('Clicking Podsumowanie switches away from Zadania', async ({ page }) => {
    // Click 'Podsumowanie spotkania'
    await page.locator('.ff-int-tab').filter({ hasText: 'Podsumowanie spotkania' }).click();

    // Check it's the new active tab
    const activeTab = page.locator('.ff-int-tab.active');
    await expect(activeTab).toHaveText('Podsumowanie spotkania');

    // The Ai task suggestions panel should be hidden now
    await expect(page.locator('.ai-task-suggestions-panel')).toBeHidden();
  });
});
