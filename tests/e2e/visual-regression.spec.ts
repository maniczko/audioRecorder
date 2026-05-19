import { expect, test, type TestInfo } from '@playwright/test';
import { seedLoggedInUser, seedMeeting, seedQueueItem, seedTask } from './helpers/seed.js';

const releaseViewports = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1280', width: 1280, height: 720 },
  { name: 'tablet-1024', width: 1024, height: 768 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 },
];

const overlayViewports = [releaseViewports[0], releaseViewports[releaseViewports.length - 1]];

const consoleErrorsByTest = new WeakMap<TestInfo, string[]>();

const coreTabs = [
  { label: 'Studio', surface: 'studio', expected: '.modern-content-wrapper' },
  { label: 'Nagrania', surface: 'recordings', expected: 'text=Release baseline meeting' },
  { label: 'Kalendarz', surface: 'calendar', expected: '.calendar-view, .calendar-shell, main' },
  { label: 'Zadania', surface: 'tasks', expected: 'text=Release baseline task' },
  { label: 'Osoby', surface: 'people', expected: '.people-tab, .people-layout, main' },
  { label: 'Notatki', surface: 'notes', expected: '.notes-layout' },
];

async function freezeClock(page) {
  await page.addInitScript(`
    {
      const fixedTime = new Date('2026-05-14T10:00:00.000Z').getTime();
      const RealDate = Date;
      class MockDate extends RealDate {
        constructor(...args) {
          super(...(args.length ? args : [fixedTime]));
        }
        static now() {
          return fixedTime;
        }
      }
      MockDate.UTC = RealDate.UTC;
      MockDate.parse = RealDate.parse;
      window.Date = MockDate;
    }
  `);
}

async function seedReleaseData(page) {
  await seedLoggedInUser(page);
  await seedMeeting(page, {
    id: 'meeting_visual_baseline',
    title: 'Release baseline meeting',
    context: 'Layout validation',
    startsAt: '2026-05-14T10:00:00.000Z',
    durationMinutes: 45,
    attendees: ['Anna', 'Jan'],
    tags: ['release'],
    recordings: [
      {
        id: 'recording_visual_baseline',
        createdAt: '2026-05-14T10:05:00.000Z',
        duration: 180,
        pipelineStatus: 'done',
        transcript: [
          {
            id: 'seg_visual_1',
            speakerId: 0,
            timestamp: 0,
            text: 'Ustalamy priorytety release i zadania po spotkaniu.',
          },
        ],
        speakerNames: { '0': 'Anna' },
        analysis: {
          summary: 'Release baseline summary',
          actionItems: ['Zamknac visual baseline', 'Potwierdzic smoke produkcyjny'],
        },
      },
    ],
  });
  await seedTask(page, {
    id: 'task_visual_baseline',
    title: 'Release baseline task',
    notes: 'Task seeded for responsive visual baseline.',
    dueDate: '2026-05-14T12:00:00.000Z',
    priority: 'high',
  });
}

async function assertNoGlobalOverflow(page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth || 0
    );
    return documentWidth - window.innerWidth;
  });

  expect(overflow).toBeLessThanOrEqual(2);
}

async function assertVisibleFocus(page) {
  await page.keyboard.press('Tab');
  const focusedBox = await page.evaluate(() => {
    const active = document.activeElement;
    if (!active || active === document.body) return null;
    const rect = active.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
    };
  });

  expect(focusedBox).toBeTruthy();
  expect(focusedBox?.width || 0).toBeGreaterThan(0);
  expect(focusedBox?.height || 0).toBeGreaterThan(0);
}

async function openShellTab(page, label: string) {
  const hamburger = page.locator('.modern-hamburger-btn');
  if (await hamburger.isVisible()) {
    await hamburger.click();
  }

  const navItem = page.locator('.modern-nav').getByRole('button', { name: label });
  await expect(navItem).toBeVisible();
  await navItem.click();
}

async function screenshotPage(page, name: string) {
  await page.evaluate(() => document.fonts?.ready);
  await expect(page).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.02,
  });
}

test.describe('Release visual baselines', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    consoleErrorsByTest.set(testInfo, consoleErrors);
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await freezeClock(page);
  });

  test.afterEach(async ({}, testInfo) => {
    expect(consoleErrorsByTest.get(testInfo) || []).toEqual([]);
  });

  for (const viewport of releaseViewports) {
    test(`@baseline auth login layout ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await expect(page.locator('.auth-shell')).toBeVisible();
      await assertNoGlobalOverflow(page);
      await assertVisibleFocus(page);
      await screenshotPage(page, `auth-login-${viewport.name}.png`);
    });

    test(`@baseline authenticated shell tabs ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await seedReleaseData(page);
      await page.goto('/');
      await expect(page.locator('.modern-main')).toBeVisible();
      await assertNoGlobalOverflow(page);
      await screenshotPage(page, `shell-home-${viewport.name}.png`);

      for (const tab of coreTabs) {
        await openShellTab(page, tab.label);
        await expect(page.locator(tab.expected).first()).toBeVisible();
        await assertNoGlobalOverflow(page);
        await screenshotPage(page, `${tab.surface}-${viewport.name}.png`);
      }

      await page.getByRole('button', { name: /profil/i }).click();
      await expect(page.locator('.profile-shell, .profile-layout, main').first()).toBeVisible();
      await assertNoGlobalOverflow(page);
      await screenshotPage(page, `profile-${viewport.name}.png`);
    });
  }

  for (const viewport of overlayViewports) {
    test(`@state auth register and reset states ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await page.getByRole('button', { name: 'Rejestracja' }).click();
      await expect(page.getByPlaceholder('np. Anna Nowak')).toBeVisible();
      await assertNoGlobalOverflow(page);
      await screenshotPage(page, `auth-register-${viewport.name}.png`);

      await page.getByRole('button', { name: 'Logowanie' }).click();
      await page.getByRole('button', { name: /hasla|hasła/i }).click();
      await expect(page.getByRole('button', { name: /kod resetu/i })).toBeVisible();
      await assertNoGlobalOverflow(page);
      await screenshotPage(page, `auth-reset-${viewport.name}.png`);
    });

    test(`@state overlays and failure states ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await seedReleaseData(page);
      await seedQueueItem(page, {
        id: 'q_visual_failed',
        recordingId: 'recording_visual_failed',
        meetingId: 'meeting_visual_baseline',
        status: 'failed',
        error: 'STT provider unavailable during visual baseline.',
      });
      await page.goto('/');

      await page.locator('.modern-search-btn').click();
      await expect(page.locator('.command-palette')).toBeVisible();
      await assertNoGlobalOverflow(page);
      await screenshotPage(page, `command-palette-${viewport.name}.png`);

      await page.locator('.command-palette input').fill('xqz-no-results-release');
      await expect(page.locator('.empty-panel, .command-palette-results .empty')).toBeVisible();
      await assertNoGlobalOverflow(page);
      await screenshotPage(page, `command-palette-empty-${viewport.name}.png`);

      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Powiadomienia' }).click();
      await expect(page.locator('.notification-panel')).toBeVisible();
      await assertNoGlobalOverflow(page);
      await screenshotPage(page, `notification-center-${viewport.name}.png`);

      await page.keyboard.press('Escape');
      await openShellTab(page, 'Nagrania');
      await assertNoGlobalOverflow(page);
      await screenshotPage(page, `recordings-failure-state-${viewport.name}.png`);
    });
  }
});
