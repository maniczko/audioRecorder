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

test.describe('Studio - tworzenie i edycja spotkania', () => {
  test.beforeEach(async ({ page }) => {
    await seedLoggedInUser(page);
    await page.goto('/');
    await expect(page.locator('.modern-nav-item').filter({ hasText: 'Studio' })).toBeVisible();
  });

  test('utworzenie spotkania z tytulem zapisuje je do listy', async ({ page }) => {
    const meetingTitle = `E2E Spotkanie ${Date.now()}`;

    await page.getByRole('button', { name: 'Przygotuj brief' }).click();
    await expect(briefModal(page)).toBeVisible();

    await briefTitleInput(page).fill(meetingTitle);
    await briefSaveButton(page).click();

    await expect(page.locator('.ff-header-title')).toHaveText(meetingTitle);
  });

  test('przycisk zapisu jest nieaktywny gdy tytul jest pusty', async ({ page }) => {
    await page.getByRole('button', { name: 'Przygotuj brief' }).click();

    const titleInput = briefTitleInput(page);
    await titleInput.fill('');

    await expect(briefSaveButton(page)).toBeDisabled();
  });

  test('uzupelnienie terminu spotkania i zapis dziala poprawnie', async ({ page }) => {
    await page.getByRole('button', { name: 'Przygotuj brief' }).click();

    const meetingTitle = `Spotkanie z data ${Date.now()}`;
    await briefTitleInput(page).fill(meetingTitle);

    const dateInput = briefModal(page).locator("input[type='datetime-local']");
    await dateInput.fill('2026-06-15T10:00');

    await briefSaveButton(page).click();

    await expect(page.locator('.ff-header-title')).toHaveText(meetingTitle);
  });

  test('ponowne otwarcie briefu po anulowaniu pokazuje czysty formularz', async ({ page }) => {
    await page.getByRole('button', { name: 'Przygotuj brief' }).click();

    const titleInput = briefTitleInput(page);
    await titleInput.fill('Tymczasowy tytul');

    await briefModal(page).getByRole('button', { name: 'Anuluj' }).click();
    await expect(briefModal(page)).toBeHidden();

    await page.getByRole('button', { name: 'Przygotuj brief' }).click();
    await expect(briefTitleInput(page)).toHaveValue('');
  });

  test('klikniecie Anuluj zamyka boczny formularz', async ({ page }) => {
    await page.getByRole('button', { name: 'Przygotuj brief' }).click();

    await expect(briefModal(page)).toBeVisible();
    await briefModal(page).getByRole('button', { name: 'Anuluj' }).click();

    await expect(briefModal(page)).toBeHidden();
  });

  test('zapisanie spotkania zamyka boczny formularz', async ({ page }) => {
    const meetingTitle = `E2E Pomyslne Zamkniecie ${Date.now()}`;

    await page.getByRole('button', { name: 'Przygotuj brief' }).click();
    await expect(briefModal(page)).toBeVisible();

    await briefTitleInput(page).fill(meetingTitle);
    await briefSaveButton(page).click();

    await expect(briefModal(page)).toBeHidden();
    await expect(page.locator('.ff-header-title')).toHaveText(meetingTitle);
  });
});
