// @ts-check
import { test, expect } from '@playwright/test';

const uniqueEmail = (prefix) => `${prefix}.${Date.now()}@example.com`;

async function openRegister(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Rejestracja' }).click();
}

async function fillRegisterForm(page, { name, email, password = 'haslo123', workspace }) {
  await page.getByLabel('Imię i nazwisko').fill(name);
  await page.getByLabel('Adres email').fill(email);
  await page.getByLabel('Hasło').fill(password);
  await page.getByLabel(/Nazwa nowej przestrzeni/).fill(workspace);
}

async function submitRegister(page) {
  await page.getByRole('button', { name: /Wejd[zź] do aplikacji/i }).click();
}

async function expectMainApp(page) {
  await expect(page.locator('.modern-nav-item').filter({ hasText: 'Studio' })).toBeVisible({
    timeout: 15_000,
  });
}

test.describe('Auth - rejestracja i logowanie', () => {
  test('rejestracja nowego uzytkownika otwiera aplikacje', async ({ page }) => {
    await openRegister(page);
    await fillRegisterForm(page, {
      name: 'Jan Testowy',
      email: uniqueEmail('jan.testowy'),
      workspace: 'Test Workspace',
    });

    await submitRegister(page);

    await expectMainApp(page);
  });

  test('rejestracja z istniejacym emailem pokazuje blad', async ({ page }) => {
    const email = uniqueEmail('duplicate');

    await openRegister(page);
    await fillRegisterForm(page, {
      name: 'Jan Testowy',
      email,
      workspace: 'Test Workspace',
    });
    await submitRegister(page);
    await expectMainApp(page);

    await page.locator('[title="Ustawienia profilu"]').click();
    await page.getByRole('button', { name: 'Wyloguj' }).click();
    await expect(page.locator('.auth-shell')).toBeVisible();

    await page.getByRole('button', { name: 'Rejestracja' }).click();
    await fillRegisterForm(page, {
      name: 'Jan Testowy',
      email,
      workspace: 'Test Workspace',
    });
    await submitRegister(page);

    await expect(page.locator('.inline-alert.error')).toBeVisible();
    await expect(page.locator('.auth-shell')).toBeVisible();
  });

  test('logowanie poprawnym haslem otwiera aplikacje', async ({ page }) => {
    const email = uniqueEmail('login');

    await openRegister(page);
    await fillRegisterForm(page, {
      name: 'Login Tester',
      email,
      workspace: 'Login Workspace',
    });
    await submitRegister(page);
    await expectMainApp(page);

    await page.locator('[title="Ustawienia profilu"]').click();
    await page.getByRole('button', { name: 'Wyloguj' }).click();
    await expect(page.locator('.auth-shell')).toBeVisible();

    await page.getByRole('button', { name: 'Logowanie' }).click();
    await page.getByLabel('Adres email').fill(email);
    await page.getByLabel('Hasło').fill('haslo123');
    await page.getByRole('button', { name: /Zaloguj się/i }).click();

    await expectMainApp(page);
  });

  test('logowanie blednym haslem pokazuje przyjazny blad', async ({ page }) => {
    const email = uniqueEmail('wrongpass');

    await openRegister(page);
    await fillRegisterForm(page, {
      name: 'Wrong Pass Tester',
      email,
      password: 'dobrehasto',
      workspace: 'Wrong Password Workspace',
    });
    await submitRegister(page);
    await expectMainApp(page);

    await page.locator('[title="Ustawienia profilu"]').click();
    await page.getByRole('button', { name: 'Wyloguj' }).click();

    await page.getByRole('button', { name: 'Logowanie' }).click();
    await page.getByLabel('Adres email').fill(email);
    await page.getByLabel('Hasło').fill('zle_haslo');
    await page.getByRole('button', { name: /Zaloguj się/i }).click();

    await expect(page.locator('.inline-alert.error')).toBeVisible();
    await expect(page.locator('.inline-alert.error')).not.toContainText(
      /ENOTFOUND|postgres|tenant/i
    );
    await expect(page.locator('.auth-shell')).toBeVisible();
  });

  test('logowanie nieistniejacym uzytkownikiem pokazuje blad bez detali technicznych', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Logowanie' }).click();

    await page.getByLabel('Adres email').fill(uniqueEmail('missing'));
    await page.getByLabel('Hasło').fill('cokolwiek');
    await page.getByRole('button', { name: /Zaloguj się/i }).click();

    await expect(page.locator('.inline-alert.error')).toBeVisible();
    await expect(page.locator('.inline-alert.error')).toContainText('Niepoprawny email lub haslo.');
    await expect(page.locator('.inline-alert.error')).not.toContainText(
      /ENOTFOUND|postgres|tenant/i
    );
  });

  test('reset hasla pozwala zalogowac sie nowym haslem bez technicznych komunikatow', async ({
    page,
  }) => {
    const email = uniqueEmail('reset');
    const oldPassword = 'stare_haslo_123';
    const newPassword = 'nowe_haslo_456';

    await openRegister(page);
    await fillRegisterForm(page, {
      name: 'Reset Tester',
      email,
      password: oldPassword,
      workspace: 'Reset Workspace',
    });
    await submitRegister(page);
    await expectMainApp(page);

    await page.locator('[title="Ustawienia profilu"]').click();
    await page.getByRole('button', { name: 'Wyloguj' }).click();
    await expect(page.locator('.auth-shell')).toBeVisible();

    await page.getByRole('button', { name: 'Logowanie' }).click();
    await page.getByRole('button', { name: /Zapomnia/i }).click();
    await expect(page.getByRole('heading', { name: /Zresetuj/i })).toBeVisible();

    await page.locator('#reset-email').fill(email);
    await page.getByRole('button', { name: /kod resetu/i }).click();
    const resetCodeAlert = page
      .locator('.inline-alert.info')
      .filter({ hasText: /lokalny kod resetu/i });
    await expect(resetCodeAlert).toBeVisible();

    const previewCode = (await resetCodeAlert.locator('strong').innerText()).trim();
    expect(previewCode, 'local reset flow should expose a deterministic preview code').toBeTruthy();

    await page.locator('#reset-code').fill(previewCode);
    await page.locator('#new-password').fill(newPassword);
    await page.locator('#confirm-password').fill(newPassword);
    await page.getByRole('button', { name: /Zmien|Zmie/i }).click();

    await expect(page.locator('.auth-shell')).toBeVisible();
    await page.getByLabel('Adres email').fill(email);
    await page.getByLabel(/Has/i).fill(newPassword);
    await page.getByRole('button', { name: /Zaloguj/i }).click();

    await expectMainApp(page);
    await expect(page.locator('.inline-alert.error')).toHaveCount(0);
  });
});
