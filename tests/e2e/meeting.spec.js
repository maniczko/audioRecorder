// @ts-check
import { test, expect } from '@playwright/test';
import { seedLoggedInUser } from './helpers/seed.js';

test.describe('Studio — tworzenie i edycja spotkania', () => {
  test.beforeEach(async ({ page }) => {
    await seedLoggedInUser(page);
    await page.goto('/');
    // Ensure we are on Studio tab
    await expect(page.locator('.modern-nav-item').filter({ hasText: 'Studio' })).toBeVisible();
  });

  // ── Create meeting — happy path ───────────────────────────────────────────
  test('utworzenie spotkania z tytulem zapisuje je do listy', async ({ page }) => {
    const meetingTitle = `E2E Spotkanie ${Date.now()}`;

    await page.getByRole('button', { name: 'Przygotuj brief' }).click();

    // The sidebar meeting form should be visible
    await expect(page.locator('.workspace-sidebar')).toBeVisible();

    // Fill in the title
    await page
      .locator(".workspace-sidebar input[placeholder='np. Spotkanie z klientem']")
      .fill(meetingTitle);

    // Save
    await page.locator('.brief-actions .primary-button').click();

    // The meeting title should now appear in the header
    await expect(page.locator('.ff-header-title')).toHaveText(meetingTitle);
  });

  // ── Create meeting — error: empty title ──────────────────────────────────
  test('przycisk zapisu jest nieaktywny gdy tytul jest pusty', async ({ page }) => {
    await page.getByRole('button', { name: 'Przygotuj brief' }).click();

    // Clear the title field (should be empty by default for a new draft)
    const titleInput = page.locator(
      ".workspace-sidebar input[placeholder='np. Spotkanie z klientem']"
    );
    await titleInput.fill('');

    // The save button should be disabled
    await expect(page.locator('.brief-actions .primary-button')).toBeDisabled();
  });

  // ── Create meeting — fill datetime ────────────────────────────────────────
  test('uzupelnienie terminu spotkania i zapis dziala poprawnie', async ({ page }) => {
    await page.getByRole('button', { name: 'Przygotuj brief' }).click();

    const meetingTitle = `Spotkanie z datą ${Date.now()}`;
    await page
      .locator(".workspace-sidebar input[placeholder='np. Spotkanie z klientem']")
      .fill(meetingTitle);

    // Set a start time using datetime-local input
    const dateInput = page.locator(".workspace-sidebar input[type='datetime-local']");
    await dateInput.fill('2026-06-15T10:00');

    await page.locator('.brief-actions .primary-button').click();

    await expect(page.locator('.ff-header-title')).toHaveText(meetingTitle);
  });

  // ── New meeting draft button ──────────────────────────────────────────────
  // TODO: '+ Nowe' button removed from UI in AppShellModern redesign — needs reimplementation
  test.skip('klikniecie Nowe resetuje formularz', async ({ page }) => {
    await page.getByRole('button', { name: 'Przygotuj brief' }).click();

    const titleInput = page.locator(
      ".workspace-sidebar input[placeholder='np. Spotkanie z klientem']"
    );
    await titleInput.fill('Tymczasowy tytul');

    await page.locator('.panel-header button').filter({ hasText: '+ Nowe' }).click();

    await expect(titleInput).toHaveValue('');
  });
  // ── Create meeting — verify form closes on cancel ─────────────────────────
  test('klikniecie Anuluj zamyka boczny formularz', async ({ page }) => {
    await page.getByRole('button', { name: 'Przygotuj brief' }).click();

    // The sidebar meeting form should be visible
    await expect(page.locator('.workspace-sidebar')).toBeVisible();

    // Click cancel
    await page.getByRole('button', { name: 'Anuluj' }).click();

    // The sidebar meeting form should be hidden
    await expect(page.locator('.workspace-sidebar')).toBeHidden();
  });

  // ── Create meeting — verify form closes on save ─────────────────────────
  test('zapisanie spotkania zamyka boczny formularz', async ({ page }) => {
    const meetingTitle = `E2E Pomyślne Zamknięcie ${Date.now()}`;

    await page.getByRole('button', { name: 'Przygotuj brief' }).click();
    await expect(page.locator('.workspace-sidebar')).toBeVisible();

    await page
      .locator(".workspace-sidebar input[placeholder='np. Spotkanie z klientem']")
      .fill(meetingTitle);

    // Save
    await page.locator('.brief-actions .primary-button').click();

    // Form should hide and header text should appear
    await expect(page.locator('.workspace-sidebar')).toBeHidden();
    await expect(page.locator('.ff-header-title')).toHaveText(meetingTitle);
  });
});
