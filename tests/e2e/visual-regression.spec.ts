/**
 * Visual Regression Tests
 *
 * Uses Playwright to capture and compare screenshots for UI stability.
 * Run: npx playwright test tests/e2e/visual-regression.spec.ts
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    // Wait for initial render
    await page.waitForLoadState('networkidle');
  });

  test('main app renders correctly', async ({ page }) => {
    await expect(page).toHaveScreenshot('main-app.png', {
      fullPage: true,
      threshold: 0.1,
      maxDiffPixelRatio: 0.05,
    });
  });

  test('studio tab renders correctly', async ({ page }) => {
    // Navigate to studio tab
    await page.click('[data-testid="tab-studio"]');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('studio-tab.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('calendar tab renders correctly', async ({ page }) => {
    await page.click('[data-testid="tab-calendar"]');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('calendar-tab.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('tasks tab renders correctly', async ({ page }) => {
    await page.click('[data-testid="tab-tasks"]');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('tasks-tab.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('people tab renders correctly', async ({ page }) => {
    await page.click('[data-testid="tab-people"]');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('people-tab.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('recordings tab renders correctly', async ({ page }) => {
    await page.click('[data-testid="tab-recordings"]');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('recordings-tab.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('notes tab renders correctly', async ({ page }) => {
    await page.click('[data-testid="tab-notes"]');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('notes-tab.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('profile tab renders correctly', async ({ page }) => {
    await page.click('[data-testid="tab-profile"]');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('profile-tab.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('topbar renders correctly', async ({ page }) => {
    const topbar = page.locator('[data-testid="topbar"]');
    await expect(topbar).toBeVisible();

    await expect(topbar).toHaveScreenshot('topbar.png', {
      threshold: 0.1,
    });
  });

  test('component: ProgressBar renders correctly', async ({ page }) => {
    // Navigate to a page with ProgressBar or inject it
    await page.evaluate(() => {
      const root = document.getElementById('root');
      if (root) {
        root.innerHTML = `
          <div data-testid="test-progress">
            <div role="progressbar" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100">
              <div style="width: 50%; background: #667eea;">50%</div>
            </div>
          </div>
        `;
      }
    });

    await expect(page.locator('[data-testid="test-progress"]')).toHaveScreenshot(
      'progress-bar.png',
      {
        threshold: 0.1,
      }
    );
  });

  test('dark mode renders correctly', async ({ page }) => {
    // Toggle dark mode if available
    const themeToggle = page.locator('[data-testid="theme-toggle"]');
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      await page.waitForTimeout(300);
    }

    await expect(page).toHaveScreenshot('dark-mode.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('mobile responsive: 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('mobile-375px.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('mobile responsive: 768px', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('tablet-768px.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('desktop responsive: 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('desktop-1440px.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });
});
