// @ts-check
import { expect, test } from '@playwright/test';

import {
  attachRuntimeGuard,
  hasProductionAuditConfig,
  installProductionSession,
} from './helpers/productionAudit.js';

const coreTabs = [
  { label: 'Studio', expected: '.modern-content-wrapper, main' },
  { label: 'Nagrania', expected: 'text=Baza nagra' },
  { label: 'Kalendarz', expected: '.calendar-view, .calendar-shell, main' },
  { label: 'Zadania', expected: '.tasks-tab, main' },
  { label: 'Osoby', expected: '.people-tab, .people-layout, main' },
  { label: 'Notatki', expected: '.notes-layout, main' },
];

const destructiveOrCostly =
  /usun|usuń|delete|wyloguj|rozpocznij|zatrzymaj|nagraj|wgraj|upload|eksport|pobierz|google|microsoft|wykryj|generuj|zapisz/i;

async function openShellTab(page, label) {
  const hamburger = page.locator('.modern-hamburger-btn');
  if (await hamburger.isVisible().catch(() => false)) {
    await hamburger.click();
  }

  const navItem = page.locator('.modern-nav-item').filter({ hasText: label }).first();
  await expect(navItem).toBeVisible();
  await navItem.click({ force: true });
}

async function visibleActions(page) {
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

async function clickByLabel(page, label) {
  const candidates = [
    page.getByRole('button', { name: label }).first(),
    page.getByRole('link', { name: label }).first(),
    page.getByRole('tab', { name: label }).first(),
    page.getByRole('menuitem', { name: label }).first(),
  ];

  for (const candidate of candidates) {
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click({ force: true });
      await page.keyboard.press('Escape').catch(() => undefined);
      return true;
    }
  }

  return false;
}

test.describe('production action crawler', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!hasProductionAuditConfig(), 'Production action audit secrets are not configured.');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installProductionSession(page, request);
  });

  test('core tabs load and safe actions are clickable without unhandled runtime failures', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const guard = attachRuntimeGuard(page, {
      allow: [
        /network 401: .*\/auth\/login/,
        /network 404: .*\/favicon/,
        /network 404: .*\/logo192\.png/,
      ],
    });

    await page.goto('/');
    await expect(page.locator('.modern-main, main').first()).toBeVisible();

    for (const tab of coreTabs) {
      await openShellTab(page, tab.label);
      await expect(page.locator(tab.expected).first()).toBeVisible();

      const safeLabels = [...new Set(await visibleActions(page))]
        .filter((label) => !destructiveOrCostly.test(label))
        .slice(0, 3);

      for (const label of safeLabels) {
        await openShellTab(page, tab.label);
        const clicked = await clickByLabel(page, label);
        expect(clicked, `${tab.label}: ${label} should be clickable`).toBe(true);
        await guard.assertClean();
      }
    }
  });

  test('command palette and notification center expose visible feedback surfaces', async ({
    page,
  }) => {
    const guard = attachRuntimeGuard(page);
    await page.goto('/');

    await page.locator('.modern-search-btn').click();
    await expect(page.locator('.command-palette')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByLabel('Powiadomienia').click();
    await expect(page.locator('.notification-panel, .notification-center').first()).toBeVisible();
    await page.keyboard.press('Escape');

    await guard.assertClean();
  });
});
