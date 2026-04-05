// @ts-check
import { test, expect } from '@playwright/test';
import { seedLoggedInUser } from './helpers/seed.js';

function briefModal(page) {
  return page.getByRole('dialog', { name: /Nowe spotkanie|Edytuj spotkanie/i });
}

function briefTitleInput(page) {
  return briefModal(page).getByPlaceholder('np. Spotkanie z klientem');
}

function briefSaveButton(page) {
  return briefModal(page).locator('.brief-actions .primary-button');
}

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
    await expect(briefModal(page)).toBeVisible();

    // Fill in the title
    await briefTitleInput(page).fill(meetingTitle);

    // Save
    await briefSaveButton(page).click();

    // The meeting title should now appear in the header
    await expect(page.locator('.ff-header-title')).toHaveText(meetingTitle);
  });

  // ── Create meeting — error: empty title ──────────────────────────────────
  test('przycisk zapisu jest nieaktywny gdy tytul jest pusty', async ({ page }) => {
    await page.getByRole('button', { name: 'Przygotuj brief' }).click();

    // Clear the title field (should be empty by default for a new draft)
    const titleInput = briefTitleInput(page);
    await titleInput.fill('');

    // The save button should be disabled
    await expect(briefSaveButton(page)).toBeDisabled();
  });

  // ── Create meeting — fill datetime ────────────────────────────────────────
  test('uzupelnienie terminu spotkania i zapis dziala poprawnie', async ({ page }) => {
    await page.getByRole('button', { name: 'Przygotuj brief' }).click();

    const meetingTitle = `Spotkanie z datą ${Date.now()}`;
    await briefTitleInput(page).fill(meetingTitle);

    // Set a start time using datetime-local input
    const dateInput = briefModal(page).locator("input[type='datetime-local']");
    await dateInput.fill('2026-06-15T10:00');

    await briefSaveButton(page).click();

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
    await expect(briefModal(page)).toBeVisible();

    // Click cancel
    await briefModal(page).getByRole('button', { name: 'Anuluj' }).click();

    // The sidebar meeting form should be hidden
    await expect(briefModal(page)).toBeHidden();
  });

  // ── Create meeting — verify form closes on save ─────────────────────────
  test('zapisanie spotkania zamyka boczny formularz', async ({ page }) => {
    const meetingTitle = `E2E Pomyślne Zamknięcie ${Date.now()}`;

    await page.getByRole('button', { name: 'Przygotuj brief' }).click();
    await expect(briefModal(page)).toBeVisible();

    await briefTitleInput(page).fill(meetingTitle);

    // Save
    await briefSaveButton(page).click();

    // Form should hide and header text should appear
    await expect(briefModal(page)).toBeHidden();
    await expect(page.locator('.ff-header-title')).toHaveText(meetingTitle);
  });
});
