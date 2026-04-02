import { test, expect } from '@playwright/test';

test.describe('Visual Regression - Core Components', () => {
  test.beforeEach(async ({ page }) => {
    // Seed logged in user
    await page.addInitScript(() => {
      localStorage.setItem(
        'voicelog_session',
        JSON.stringify({
          userId: 'u1',
          workspaceId: 'ws1',
          token: 'test-token',
        })
      );
    });
  });

  test('Topbar - desktop layout', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 1920, height: 1080 });

    const topbar = page.locator('[data-testid="topbar"]');
    await expect(topbar).toBeVisible();
    await expect(topbar).toHaveScreenshot('topbar-desktop.png');
  });

  test('Topbar - mobile layout', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 375, height: 667 });

    const topbar = page.locator('[data-testid="topbar"]');
    await expect(topbar).toBeVisible();
    await expect(topbar).toHaveScreenshot('topbar-mobile.png');
  });

  test('Tasks Kanban - desktop layout', async ({ page }) => {
    await page.goto('/tasks');
    await page.setViewportSize({ width: 1920, height: 1080 });

    const kanban = page.locator('[data-testid="kanban-board"]');
    await expect(kanban).toBeVisible();
    await expect(kanban).toHaveScreenshot('tasks-kanban-desktop.png');
  });

  test('Tasks Kanban - mobile layout', async ({ page }) => {
    await page.goto('/tasks');
    await page.setViewportSize({ width: 375, height: 667 });

    const kanban = page.locator('[data-testid="kanban-board"]');
    await expect(kanban).toBeVisible();
    await expect(kanban).toHaveScreenshot('tasks-kanban-mobile.png');
  });

  test('Calendar - month view', async ({ page }) => {
    await page.goto('/calendar');
    await page.setViewportSize({ width: 1920, height: 1080 });

    const calendar = page.locator('[data-testid="calendar-grid"]');
    await expect(calendar).toBeVisible();
    await expect(calendar).toHaveScreenshot('calendar-month.png');
  });

  test('People list - desktop layout', async ({ page }) => {
    await page.goto('/people');
    await page.setViewportSize({ width: 1920, height: 1080 });

    const peopleList = page.locator('[data-testid="people-list"]');
    await expect(peopleList).toBeVisible();
    await expect(peopleList).toHaveScreenshot('people-list-desktop.png');
  });

  test('Studio - meeting view', async ({ page }) => {
    await page.goto('/studio');
    await page.setViewportSize({ width: 1920, height: 1080 });

    const studio = page.locator('[data-testid="studio-meeting-view"]');
    await expect(studio).toBeVisible();
    await expect(studio).toHaveScreenshot('studio-meeting.png');
  });

  test('Command Palette', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');

    const palette = page.locator('[data-testid="command-palette"]');
    await expect(palette).toBeVisible();
    await expect(palette).toHaveScreenshot('command-palette.png');
  });

  test('Dark mode rendering', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Dark mode is default
    const body = page.locator('body');
    await expect(body).toHaveScreenshot('dark-mode.png');
  });
});
