```javascript
import { test, expect } from '@playwright/test';

test.describe('Smoke product flows', () => {
  test('login via registration opens the app', async ({ page }) => {
    // Your login test implementation
  });

  test('adds a task from tasks tab', async ({ page }) => {
    await page.goto('your-app-url'); // Ensure the app is loaded
    const taskTitle = `Smoke task ${Date.now()}`;

    // Wait for the button to be visible before clicking
    await page.waitForSelector('button[role="Tab Zadania"]');
    await page.getByRole("button", { name: "Tab Zadania" }).click();
    await page.getByPlaceholder("Dodaj zadanie (N)").fill(taskTitle);
    await page.getByRole("button", { name: "Dodaj" }).click();
  });

  test('opens recording view for a meeting with recordings', async ({ page }) => {
    // Your recording view test implementation
  });
});
```