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
  { label: 'Profil', expected: 'text=Profil i Styl pracy', open: openProfileTab },
];

const unsafeActionPattern =
  /strona glowna|strona główna|^studio$|^nagrania$|^kalendarz$|^zadania$|^osoby$|^notatki$|^profil$|otw.*profil|powiadomienia|szukaj|zapytaj ai|inteligentne listy|widoki workspace|ważne|wazne|moje zadania|do zrobienia|w toku|oczekuje|zakonczone|zakończone|spotkań|spotkan|zadań|zadan|generuj|^\d+$|^\d{1,2}:\d{2}$|copy|kopiuj|transkrypcja|voice analytics|zmień mówcę|zmien mowce|podsumowanie spotkania|potrzeby i obawy|profil psychologiczny|twój feedback|brief|edytuj|rozpocznij nagrywanie|zatrzymaj nagrywanie|nagraj|mikrofon|microphone|record|wgraj|upload|usun|usuń|delete|wyloguj|eksport|download|pobierz|google|microsoft/i;

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
  await closeTransientUi(page);
  const hamburger = page.locator('.modern-hamburger-btn');
  if (await hamburger.isVisible()) {
    await hamburger.click();
  }

  const navItem = page.locator('.modern-nav-item').filter({ hasText: label }).first();
  await expect(navItem).toBeVisible();
  const className = String((await navItem.getAttribute('class')) || '');
  if (!className.includes('active')) {
    await navItem.click({ force: true });
  }
}

async function openProfileTab(page) {
  const profileButton = page
    .getByLabel(/profil|ustawienia profilu|otworz profil|otwórz profil/i)
    .first();
  await expect(profileButton).toBeVisible();
  await profileButton.click();
}

async function openSurface(page, surface) {
  if (surface.open) {
    await surface.open(page);
    return;
  }
  await openShellTab(page, surface.label);
}

function attachRuntimeGuard(page) {
  const failures = [];

  page.on('pageerror', (error) => {
    failures.push(`pageerror: ${error.message}`);
  });

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/ResizeObserver loop/i.test(text)) return;
    failures.push(`console error: ${text}`);
  });

  page.on('response', (response) => {
    const status = response.status();
    if (status < 400) return;
    const url = response.url();
    if (url.includes('/api/client-errors') && status < 500) return;
    failures.push(`network ${status}: ${url}`);
  });

  return {
    async assertClean() {
      await page.waitForTimeout(250);
      expect(failures).toEqual([]);
    },
  };
}

async function visibleClickableActions(page) {
  return page
    .locator('button, a[href], [role="button"], [role="tab"], [role="menuitem"]')
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          const disabled =
            element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true';
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.pointerEvents !== 'none' &&
            !disabled &&
            element.getAttribute('aria-hidden') !== 'true'
          );
        })
        .map((element) => {
          const text = element.textContent?.replace(/\s+/g, ' ').trim() || '';
          const label =
            element.getAttribute('aria-label') ||
            element.getAttribute('title') ||
            element.getAttribute('name') ||
            text;
          return String(label || '').trim();
        })
        .filter(Boolean)
    );
}

async function closeTransientUi(page) {
  await page.keyboard.press('Escape');
  const cancel = page.getByRole('button', { name: /anuluj|zamknij|pomin/i }).first();
  if (await cancel.isVisible().catch(() => false)) {
    await cancel.click().catch(() => undefined);
  }
  await page.keyboard.press('Escape');
}

async function clickActionByLabel(page, label) {
  const roleCandidates = [
    page.getByRole('button', { name: label }).first(),
    page.getByRole('link', { name: label }).first(),
    page.getByRole('tab', { name: label }).first(),
    page.getByRole('menuitem', { name: label }).first(),
  ];

  for (const candidate of roleCandidates) {
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click({ force: true });
      await closeTransientUi(page);
      return true;
    }
  }

  const clicked = await page.evaluate((targetLabel) => {
    const comparableLabel = (value) =>
      String(value || '')
        .normalize('NFKD')
        .replace(/[^\p{Letter}\p{Number}]+/gu, '')
        .toLowerCase();
    const elements = [
      ...document.querySelectorAll(
        'button, a[href], [role="button"], [role="tab"], [role="menuitem"]'
      ),
    ];
    const target = elements.find((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const disabled =
        element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true';
      if (
        rect.width <= 0 ||
        rect.height <= 0 ||
        style.visibility === 'hidden' ||
        style.display === 'none' ||
        style.pointerEvents === 'none' ||
        disabled ||
        element.getAttribute('aria-hidden') === 'true'
      ) {
        return false;
      }
      const text = element.textContent?.replace(/\s+/g, ' ').trim() || '';
      const label =
        element.getAttribute('aria-label') ||
        element.getAttribute('title') ||
        element.getAttribute('name') ||
        text;
      const normalizedLabel = String(label || '').trim();
      const compactLabel = normalizedLabel.replace(/\s+/g, '');
      const compactTarget = String(targetLabel || '').replace(/\s+/g, '');
      const lowerLabel = normalizedLabel.toLowerCase();
      const lowerTarget = String(targetLabel || '')
        .trim()
        .toLowerCase();
      const comparableElementLabel = comparableLabel(normalizedLabel);
      const comparableTargetLabel = comparableLabel(targetLabel);
      return (
        normalizedLabel === targetLabel ||
        normalizedLabel.includes(targetLabel) ||
        compactLabel === compactTarget ||
        compactLabel.includes(compactTarget) ||
        lowerLabel === lowerTarget ||
        lowerLabel.includes(lowerTarget) ||
        comparableElementLabel === comparableTargetLabel ||
        comparableElementLabel.includes(comparableTargetLabel)
      );
    });
    if (!target) return false;
    target.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, view: window })
    );
    return true;
  }, label);

  if (!clicked) {
    const textFallback = page.getByText(label, { exact: false }).first();
    if (!(await textFallback.isVisible().catch(() => false))) return false;
    await textFallback.click({ force: true });
  }
  await closeTransientUi(page);
  return true;
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
          style.pointerEvents !== 'none' &&
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
          element.closest('label')?.textContent?.replace(/\s+/g, ' ').trim() ||
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
      if (surface.label === 'Studio') {
        continue;
      }
      await openSurface(page, surface);
      await expect(page.locator(surface.expected).first()).toBeVisible();
    }
  });

  test('visible enabled actions have an accessible name on core surfaces', async ({ page }) => {
    await page.goto('/');

    for (const surface of coreSurfaces) {
      if (surface.label === 'Studio') {
        continue;
      }
      await openSurface(page, surface);
      const actions = await visibleActionNames(page);
      const unlabeled = actions.filter((action) => !action.label);
      expect(unlabeled, `${surface.label} has unlabeled visible actions`).toEqual([]);
    }
  });

  test('safe visible actions across core surfaces can be clicked without console or network failures', async ({
    page,
  }) => {
    test.setTimeout(90000);
    const guard = attachRuntimeGuard(page);
    await page.goto('/');
    let probedSurfaceCount = 0;

    for (const surface of coreSurfaces) {
      if (surface.label === 'Studio') {
        continue;
      }
      await openSurface(page, surface);
      await expect(page.locator(surface.expected).first()).toBeVisible();

      const safeLabels = [
        ...new Set(
          (await visibleClickableActions(page)).filter(
            (label) => label && !unsafeActionPattern.test(label)
          )
        ),
      ].slice(0, 2);

      if (!safeLabels.length) {
        continue;
      }
      probedSurfaceCount += 1;

      for (const label of safeLabels) {
        await page.goto('/');
        await openSurface(page, surface);
        await expect(page.locator(surface.expected).first()).toBeVisible();
        const clicked = await clickActionByLabel(page, label);
        expect(clicked, `${surface.label}: ${label} should remain clickable`).toBe(true);
        await guard.assertClean();
      }
    }

    expect(probedSurfaceCount, 'should click-probe multiple core surfaces').toBeGreaterThanOrEqual(
      3
    );
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

  test('studio new speaker action asks for a name before any voice-profile request', async ({
    page,
  }) => {
    const fromSpeakerRequests = [];
    await page.route('**/media/recordings/*/voice-profiles/from-speaker', async (route) => {
      fromSpeakerRequests.push(route.request().url());
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'unexpected_pre_name_save' }),
      });
    });

    await page.goto('/');
    await openShellTab(page, 'Nagrania');
    await page.getByText('UI action meeting').first().click();

    const speakerButton = page
      .locator('.ff-speaker-trigger')
      .filter({ hasText: 'Barbara' })
      .first();
    await expect(speakerButton).toBeVisible();
    await speakerButton.click();

    const newSpeakerOption = page
      .locator('.ff-speaker-dropdown-item')
      .filter({ hasText: 'Nowy m' })
      .first();
    await expect(newSpeakerOption).toBeVisible();
    await newSpeakerOption.click();

    await expect(page.getByText('Nazwij nowego mowce')).toBeVisible();
    await expect(page.getByLabel('Nazwa nowego mowcy')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Utworz mowce' })).toBeDisabled();
    expect(fromSpeakerRequests, 'clicking + Nowy mowca must not save before naming').toEqual([]);

    await page.getByLabel('Nazwa nowego mowcy').fill('Nowy Audytor');
    await expect(page.getByRole('button', { name: 'Utworz mowce' })).toBeEnabled();
    expect(
      fromSpeakerRequests,
      'typing a speaker name still must wait for explicit submit'
    ).toEqual([]);
  });
});
