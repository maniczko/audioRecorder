```javascript
import { test, expect } from '@playwright/test';

test.describe('Smoke product flows', () => {
  test('login via registration opens the app', async ({ page }) => {
    // Your login logic here
  });

  test('adds a task from tasks tab', async ({ page }) => {
    const taskTitle = `Smoke task ${Date.now()}`; // Ensure unique task title
    await page.getByRole("button", { name: "Dodaj zadanie" }).click();
    await page.fill('input[name="taskTitle"]', taskTitle); // Assuming there's an input for task title
    await page.getByRole("button", { name: "Save" }).click(); // Assuming there's a save button

    // Wait for the task to be visible
    await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible({ timeout: 10000 });
  });
});
```