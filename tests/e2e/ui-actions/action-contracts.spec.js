// @ts-check
import { expect, test } from '@playwright/test';
import { seedLoggedInUser, seedMeeting, seedTask } from '../helpers/seed.js';

const actionSelector = [
  'button',
  'a[href]',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[role="button"]',
  '[role="tab"]',
  '[role="menuitem"]',
].join(',');

const coreSurfaces = [
  { label: 'Studio', expected: '.modern-content-wrapper' },
  { label: 'Nagrania', expected: 'text=UI action meeting' },
  { label: 'Kalendarz', expected: '.calendar-view, .calendar-shell, main' },
  { label: 'Zadania', expected: 'text=UI action task' },
  { label: 'Osoby', expected: '.people-tab, .people-layout, main' },
  { label: 'Notatki', expected: '.notes-layout' },
];

async function seedUiActionData(page) {
  await seedLoggedInUser(page);
  await seedMeeting(page, {
    id: 'meeting_ui_actions',
    title: 'UI action meeting',
    startsAt: '2026-05-22T09:00:00.000Z',
    durationMinutes: 30,
    attendees: ['Barbara', 'Iwo'],
    latestRecordingId: 'recording_ui_actions',
    recordings: [
      {
        id: 'recording_ui_actions',
        createdAt: '2026-05-22T09:05:00.000Z',
        duration: 180,
        audioUrl: '/fixtures/ui-action-audio.webm',
        pipelineStatus: 'done',
        transcriptionStatus: 'completed',
        transcript: [
          {
            id: 'segment_ui_action_1',
            speakerId: 'speaker_barbara',
            timestamp: 0,
            text: 'To jest segment do walidacji akcji w transkrypcji.',
          },
        ],
        speakerNames: { speaker_barbara: 'Barbara' },
        analysis: {
          summary: 'UI action summary',
          actionItems: ['Zweryfikowac akcje UI'],
        },
      },
    ],
  });
  await seedTask(page, {
    id: 'task_ui_actions',
    title: 'UI action task',
    priority: 'high',
    dueDate: '2026-05-22T12:00:00.000Z',
  });
}

async function openShellTab(page, label) {
  const hamburger = page.locator('.modern-hamburger-btn');
  if (await hamburger.isVisible()) {
    await hamburger.click();
  }

  const navItem = page.locator('.modern-nav-item').filter({ hasText: label }).first();
  await expect(navItem).toBeVisible();
  await navItem.click();
}

async function visibleActionNames(page) {
  return page.locator(actionSelector).evaluateAll((elements) =>
    elements
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          !element.hasAttribute('disabled') &&
          element.getAttribute('aria-hidden') !== 'true'
        );
      })
      .map((element) => {
        const text = element.textContent?.replace(/\s+/g, ' ').trim() || '';
        const label =
          element.getAttribute('aria-label') ||
          element.getAttribute('title') ||
          element.getAttribute('placeholder') ||
          element.getAttribute('name') ||
          text;
        return {
          tag: element.tagName.toLowerCase(),
          role: element.getAttribute('role') || '',
          type: element.getAttribute('type') || '',
          className: String(element.getAttribute('class') || ''),
          label: String(label || '').trim(),
        };
      })
  );
}

test.describe('UI action inventory contracts', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedUiActionData(page);
  });

  test('core shell actions open visible feedback surfaces', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.modern-main')).toBeVisible();

    await page.locator('.modern-search-btn').click();
    await expect(page.locator('.command-palette')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.command-palette')).toHaveCount(0);

    await page.getByLabel('Powiadomienia').click();
    await expect(page.locator('.notification-panel, .notification-center').first()).toBeVisible();
    await page.keyboard.press('Escape');

    for (const surface of coreSurfaces) {
      await openShellTab(page, surface.label);
      await expect(page.locator(surface.expected).first()).toBeVisible();
    }
  });

  test('visible enabled actions have an accessible name on core surfaces', async ({ page }) => {
    await page.goto('/');

    for (const surface of coreSurfaces) {
      await openShellTab(page, surface.label);
      const actions = await visibleActionNames(page);
      const unlabeled = actions.filter((action) => !action.label);
      expect(unlabeled, `${surface.label} has unlabeled visible actions`).toEqual([]);
    }
  });

  test('studio transcript controls expose labels and feedback instead of silent clicks', async ({
    page,
  }) => {
    await page.goto('/');
    await openShellTab(page, 'Nagrania');
    await page.getByText('UI action meeting').first().click();

    await expect(page.getByRole('button', { name: /Transkrypcja/i })).toBeVisible();
    await expect(page.getByLabel(/Edytuj transkrypcje segmentu/i).first()).toBeVisible();
    await expect(page.getByLabel(/Zaznacz segment/i).first()).toBeVisible();

    await page
      .getByLabel(/Edytuj transkrypcje segmentu/i)
      .first()
      .fill('Zmieniony segment testowy.');
    await expect(page.getByText('Zmieniony segment testowy.')).toBeVisible();
  });
});
