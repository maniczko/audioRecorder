```javascript
import { test, expect } from '@playwright/test';

test('adds a task from tasks tab', async ({ page }) => {
  const taskTitle = `Smoke task ${Date.now()}`;

  await page.goto('/tasks');
  await page.getByRole('button', { name: 'Dodaj zadanie' }).click();
  await page.fill('input[name="taskTitle"]', taskTitle);
  await page.getByRole('button', { name: 'Save' }).click();

  // Wait for the task to be visible
  await expect(page.getByRole('heading', { name: taskTitle })).toBeVisible({ timeout: 10000 });
});
```