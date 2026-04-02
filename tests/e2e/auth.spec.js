```javascript
import { test, expect } from '@playwright/test';

test.describe('Auth — rejestracja i logowanie', () => {
  test('logowanie poprawnym haslem otwiera aplikacje', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.fill('input[name="username"]', 'validUser');
    await page.fill('input[name="password"]', 'validPassword');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('http://localhost:3000/home');
  });

  test('logowanie blednym haslem pokazuje blad', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.fill('input[name="username"]', 'validUser');
    await page.fill('input[name="password"]', 'invalidPassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('.error-message')).toHaveText('Invalid credentials');
  });
});
```
