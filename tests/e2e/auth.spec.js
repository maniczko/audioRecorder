// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Auth — rejestracja i logowanie', () => {
  test.beforeEach(async ({ page }) => {
    // Start from a clean, logged-out state
    await page.goto('/');
  });

  // ── Registration — happy path ─────────────────────────────────────────────
  test('rejestracja nowego uzytkownika otwiera aplikacje', async ({ page }) => {
    // Switch to registration mode
    await page.getByRole('button', { name: 'Rejestracja' }).click();

    // Fill in the registration form
    await page.getByPlaceholder('np. Anna Nowak').fill('Jan Testowy');
    await page.getByPlaceholder('name@company.com').fill('jan.testowy@example.com');
    await page.getByPlaceholder('minimum 6 znakow').fill('haslo123');
    await page.getByPlaceholder('np. Zespol sprzedazy').fill('Test Workspace');

    await page.getByRole('button', { name: 'Wejdz do workspace' }).click();

    // After successful registration the auth screen disappears and
    // the main app with the Studio tab should be visible.
    await expect(page.locator('.tab-pill').filter({ hasText: 'Studio' })).toBeVisible();
  });

  // ── Registration — error: duplicate email ────────────────────────────────
  test('rejestracja z istniejacym emailem pokazuje blad', async ({ page }) => {
    // Seed current persisted workspace state used by zustand.
    await page.addInitScript(() => {
      const user = {
        id: 'user_existing',
        email: 'jan.testowy@example.com',
        name: 'Existing User',
        provider: 'local',
        passwordHash: 'hash',
        workspaceIds: [],
        defaultWorkspaceId: '',
      };
      localStorage.setItem(
        'voicelog_workspace_store',
        JSON.stringify({
          state: {
            users: [user],
            workspaces: [],
            session: null,
          },
          version: 0,
        })
      );
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Rejestracja' }).click();

    await page.getByPlaceholder('np. Anna Nowak').fill('Jan Testowy');
    await page.getByPlaceholder('name@company.com').fill('jan.testowy@example.com');
    await page.getByPlaceholder('minimum 6 znakow').fill('haslo123');
    await page.getByPlaceholder('np. Zespol sprzedazy').fill('Test Workspace');

    await page.getByRole('button', { name: 'Wejdz do workspace' }).click();

    await expect(page.locator('.inline-alert.error')).toBeVisible();
    // Auth screen should still be showing
    await expect(page.locator('.auth-shell')).toBeVisible();
  });

  // ── Login — happy path ────────────────────────────────────────────────────
  test('logowanie poprawnym haslem otwiera aplikacje', async ({ page }) => {
    // Register first, then log out, then log back in
    await page.getByRole('button', { name: 'Rejestracja' }).click();

    await page.getByPlaceholder('np. Anna Nowak').fill('Login Tester');
    await page.getByPlaceholder('name@company.com').fill('login@example.com');
    await page.getByPlaceholder('minimum 6 znakow').fill('haslo123');
    await page.getByPlaceholder('np. Zespol sprzedazy').fill('Login WS');
    await page.getByRole('button', { name: 'Wejdz do workspace' }).click();

    // Should be logged in now — wait for main app
    await expect(page.locator('.tab-pill').filter({ hasText: 'Studio' })).toBeVisible();

    // Log out via Profile
    await page.locator('.settings-button').click();
    await page.getByRole('button', { name: 'Wyloguj' }).click();

    // Back to auth screen
    await expect(page.locator('.auth-shell')).toBeVisible();

    // Now log in
    await page.getByRole('button', { name: 'Logowanie' }).click();
    await page.getByPlaceholder('name@company.com').fill('login@example.com');
    await page.getByPlaceholder('minimum 6 znakow').fill('haslo123');
    await page.getByRole('button', { name: 'Zaloguj' }).click();

    await expect(page.locator('.tab-pill').filter({ hasText: 'Studio' })).toBeVisible();
  });

  // ── Login — error: wrong password ────────────────────────────────────────
  test('logowanie blednym haslem pokazuje blad', async ({ page }) => {
    // Register
    await page.getByRole('button', { name: 'Rejestracja' }).click();

    await page.getByPlaceholder('np. Anna Nowak').fill('Wrong Pass Tester');
    await page.getByPlaceholder('name@company.com').fill('wrongpass@example.com');
    await page.getByPlaceholder('minimum 6 znakow').fill('dobrehasto');
    await page.getByPlaceholder('np. Zespol sprzedazy').fill('WP Workspace');
    await page.getByRole('button', { name: 'Wejdz do workspace' }).click();

    // Log out
    await expect(page.locator('.tab-pill').filter({ hasText: 'Studio' })).toBeVisible();
    await page.locator('.settings-button').click();
    await page.getByRole('button', { name: 'Wyloguj' }).click();

    // Try wrong password
    await page.getByRole('button', { name: 'Logowanie' }).click();
    await page.getByPlaceholder('name@company.com').fill('wrongpass@example.com');
    await page.getByPlaceholder('minimum 6 znakow').fill('zle_haslo');
    await page.getByRole('button', { name: 'Zaloguj' }).click();

    await expect(page.locator('.inline-alert.error')).toBeVisible();
    await expect(page.locator('.auth-shell')).toBeVisible();
  });
  // ── Login — error: user does not exist ────────────────────────────────
  test('logowanie nieistniejacym uzytkownikiem pokazuje blad', async ({ page }) => {
    // Directly try to login with a user that doesn't exist
    await page.getByRole('button', { name: 'Logowanie' }).click();

    await page.getByPlaceholder('name@company.com').fill('nie_istnieje@example.com');
    await page.getByPlaceholder('minimum 6 znakow').fill('cokolwiek');
    await page.getByRole('button', { name: 'Zaloguj' }).click();

    await expect(page.locator('.inline-alert.error')).toBeVisible();
    await expect(page.locator('.inline-alert.error')).toContainText('Niepoprawny email lub haslo.');
  });
});
