// @ts-check
import fs from 'node:fs';
import path from 'node:path';

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
  /usun|usun|delete|wyloguj|rozpocznij|zatrzymaj|nagraj|wgraj|upload|eksport|pobierz|google|microsoft|wykryj|generuj|zapisz/i;

const shellOrUtilityAction = /strona glowna|voicebobr|workspace|ctrl|command|escape/i;
const feedbackSelector = [
  '[role="alert"]',
  '[role="status"]',
  '[role="dialog"]',
  '[aria-busy="true"]',
  '.toast-container',
  '.toast',
  '.command-palette',
  '.notification-panel',
  '.notification-center',
  '.modal',
  '.dialog',
  '.popover',
  '[data-state="open"]',
  '[data-loading="true"]',
].join(',');

const actionSelector = 'button, a[href], [role="button"], [role="tab"], [role="menuitem"]';

function normalizeActionLabel(label) {
  return String(label || '')
    .normalize('NFD')
    .replace(/\u0142/g, 'l')
    .replace(/\u0141/g, 'l')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

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
  return page.locator(actionSelector).evaluateAll((elements) =>
    elements
      .map((element, index) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const disabled =
          element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true';
        const visible =
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.pointerEvents !== 'none' &&
          !disabled &&
          element.getAttribute('aria-hidden') !== 'true';
        const text = element.textContent?.replace(/\s+/g, ' ').trim() || '';
        const label =
          element.getAttribute('aria-label') ||
          element.getAttribute('title') ||
          element.getAttribute('name') ||
          text;
        return {
          index,
          tag: element.tagName.toLowerCase(),
          role: element.getAttribute('role') || '',
          type: element.getAttribute('type') || '',
          label: String(label || '').trim(),
          actionId: element.getAttribute('data-action-id') || '',
          visible,
        };
      })
      .filter((action) => action.visible && action.label)
  );
}

function classifyAction(action) {
  const normalized = normalizeActionLabel(action.label);
  if (destructiveOrCostly.test(normalized)) return 'skipped-destructive-or-costly';
  if (shellOrUtilityAction.test(normalized)) return 'skipped-shell-or-utility';
  if (coreTabs.some((item) => normalizeActionLabel(item.label) === normalized)) {
    return 'skipped-core-navigation';
  }
  return 'click';
}

function slug(value) {
  return (
    normalizeActionLabel(value)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'action'
  );
}

async function collectUiState(page) {
  return page.evaluate((selector) => {
    const text = document.body.innerText.replace(/\s+/g, ' ').trim();
    const feedbackCount = [...document.querySelectorAll(selector)].filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        element.getAttribute('aria-hidden') !== 'true'
      );
    }).length;
    return {
      url: window.location.href,
      text,
      feedbackCount,
      activeElementLabel:
        document.activeElement?.getAttribute('aria-label') ||
        document.activeElement?.textContent?.replace(/\s+/g, ' ').trim() ||
        '',
    };
  }, feedbackSelector);
}

function hasActionFeedback(before, after) {
  if (before.url !== after.url) return true;
  if (after.feedbackCount > before.feedbackCount) return true;
  if (before.text !== after.text) return true;
  if (before.activeElementLabel !== after.activeElementLabel) return true;
  return false;
}

async function captureFailureScreenshot(page, testInfo, tabLabel, actionLabel, reason) {
  const filePath = testInfo.outputPath(
    `production-action-${slug(tabLabel)}-${slug(actionLabel)}-${slug(reason)}.png`
  );
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await page.screenshot({ path: filePath, fullPage: true });
  await testInfo.attach(`failure-${tabLabel}-${actionLabel}`, {
    path: filePath,
    contentType: 'image/png',
  });
  return filePath;
}

async function writeCrawlerReport(testInfo, report) {
  const reportJson = JSON.stringify(report, null, 2);
  const outputPath = testInfo.outputPath('production-action-crawler-report.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, reportJson);
  await testInfo.attach('production-action-crawler-report', {
    body: Buffer.from(reportJson),
    contentType: 'application/json',
  });

  const reportDir = path.resolve(process.cwd(), 'reports', 'production-action-crawler');
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, 'latest.json'), reportJson);
}

async function closeTransientUi(page) {
  await page.keyboard.press('Escape').catch(() => undefined);
  const closeButtons = [/zamknij|anuluj|pomin/i, /close|cancel|dismiss/i];
  for (const pattern of closeButtons) {
    const button = page.getByRole('button', { name: pattern }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click({ force: true }).catch(() => undefined);
    }
  }
  await page.keyboard.press('Escape').catch(() => undefined);
}

function actionIdSelector(actionId) {
  return `[data-action-id="${String(actionId).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
}

function isVolatileCalendarAction(action) {
  return /^calendar-(entry|resize|upcoming|detail-resize)-/.test(String(action.actionId || ''));
}

async function clickAction(page, action) {
  if (action.actionId) {
    const byActionId = page.locator(actionIdSelector(action.actionId)).first();
    if (await byActionId.isVisible().catch(() => false)) {
      await byActionId.click({ force: true });
      return { clicked: true, stale: false };
    }

    if (isVolatileCalendarAction(action)) {
      return { clicked: false, stale: true };
    }
  }

  const candidates = [
    page.getByRole('button', { name: action.label }).first(),
    page.getByRole('link', { name: action.label }).first(),
    page.getByRole('tab', { name: action.label }).first(),
    page.getByRole('menuitem', { name: action.label }).first(),
  ];

  for (const candidate of candidates) {
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click({ force: true });
      return { clicked: true, stale: false };
    }
  }

  return { clicked: false, stale: false };
}

test.describe('production action crawler', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!hasProductionAuditConfig(), 'Production action audit secrets are not configured.');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installProductionSession(page, request);
  });

  test('core tabs load and all safe actions provide feedback without runtime failures', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    const guard = attachRuntimeGuard(page, {
      allow: [
        /network 401: .*\/auth\/login/,
        /network 404: .*\/favicon/,
        /network 404: .*\/logo192\.png/,
      ],
    });
    const report = {
      generatedAt: new Date().toISOString(),
      frontendUrl: page.url(),
      tabs: [],
      failures: [],
    };

    try {
      await page.goto('/');
      await expect(page.locator('.modern-main, main').first()).toBeVisible();

      for (const tab of coreTabs) {
        await openShellTab(page, tab.label);
        await expect(page.locator(tab.expected).first()).toBeVisible();

        const tabReport = {
          label: tab.label,
          actionCount: 0,
          clicked: [],
          skipped: [],
          failures: [],
        };
        report.tabs.push(tabReport);

        const actions = await visibleActions(page);
        const seen = new Set();
        const uniqueActions = actions.filter((action) => {
          const key = `${normalizeActionLabel(action.label)}:${action.tag}:${action.role}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        tabReport.actionCount = uniqueActions.length;

        for (const action of uniqueActions) {
          const policy = classifyAction(action);
          if (policy !== 'click') {
            tabReport.skipped.push({ ...action, policy });
            continue;
          }

          await openShellTab(page, tab.label);
          await expect(page.locator(tab.expected).first()).toBeVisible();

          const before = await collectUiState(page);
          const failuresBeforeClick = guard.failures.length;
          const clickResult = await clickAction(page, action);
          if (!clickResult.clicked) {
            if (clickResult.stale) {
              tabReport.skipped.push({ ...action, policy: 'skipped-stale-dynamic-action' });
              continue;
            }

            const screenshot = await captureFailureScreenshot(
              page,
              testInfo,
              tab.label,
              action.label,
              'not-clickable'
            );
            const failure = {
              tab: tab.label,
              action,
              reason: 'not-clickable',
              screenshot,
            };
            tabReport.failures.push(failure);
            report.failures.push(failure);
            continue;
          }

          await page.waitForTimeout(500);
          const after = await collectUiState(page);
          const hasFeedback = hasActionFeedback(before, after);
          const newRuntimeFailures = guard.failures.slice(failuresBeforeClick);

          const actionResult = {
            ...action,
            feedback: hasFeedback,
            runtimeFailures: newRuntimeFailures,
            before: {
              url: before.url,
              feedbackCount: before.feedbackCount,
            },
            after: {
              url: after.url,
              feedbackCount: after.feedbackCount,
            },
          };
          tabReport.clicked.push(actionResult);

          if (!hasFeedback || newRuntimeFailures.length > 0) {
            const screenshot = await captureFailureScreenshot(
              page,
              testInfo,
              tab.label,
              action.label,
              !hasFeedback ? 'missing-feedback' : 'runtime-failure'
            );
            const failure = {
              tab: tab.label,
              action,
              reason: !hasFeedback ? 'missing-feedback' : 'runtime-failure',
              runtimeFailures: newRuntimeFailures,
              screenshot,
            };
            tabReport.failures.push(failure);
            report.failures.push(failure);
          }

          await closeTransientUi(page);
        }
      }

      await guard.assertClean();
      expect(report.failures, JSON.stringify(report.failures, null, 2)).toEqual([]);
    } finally {
      await writeCrawlerReport(testInfo, report);
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
