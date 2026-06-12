import { expect, test } from '@playwright/test';
import { seedLoggedInUser, seedMeeting, seedQueueItem, seedTask } from './helpers/seed.js';

const auditViewports = [
  { name: 'mobile-320', width: 320, height: 844 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'tablet-1024', width: 1024, height: 768 },
  { name: 'desktop-1366', width: 1366, height: 768 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1600', width: 1600, height: 900 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
];

const coreTabs = [
  { label: 'Studio', expected: '.modern-content-wrapper' },
  { label: 'Nagrania', expected: '.recordings-page, .recordings-shell, main' },
  { label: 'Kalendarz', expected: '.calendar-layout, .calendar-board, main' },
  { label: 'Zadania', expected: '.tasks-layout, .todo-shell, main' },
  { label: 'Osoby', expected: '.people-tab, .people-layout, main' },
  { label: 'Notatki', expected: '.notes-layout' },
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

async function seedAuditWorkspace(page) {
  await seedLoggedInUser(page);
  await seedMeeting(page, {
    id: 'meeting_layout_audit',
    title: 'Release baseline meeting',
    context: 'Premium layout audit',
    startsAt: '2026-05-14T10:00:00.000Z',
    durationMinutes: 90,
    attendees: ['Anna Kowalska', 'Jan Nowak', 'Barbara Zynda'],
    tags: ['layout', 'premium'],
    recordings: [
      {
        id: 'recording_layout_audit',
        createdAt: '2026-05-14T10:05:00.000Z',
        duration: 5455,
        pipelineStatus: 'done',
        audioAvailable: false,
        audioUnavailable: true,
        transcript: [
          {
            id: 'seg_layout_1',
            speakerId: 0,
            timestamp: 545,
            text: 'Weryfikujemy czy panel transkrypcji, metryki i zakladki zachowuja czytelny rytm.',
          },
          {
            id: 'seg_layout_2',
            speakerId: 1,
            timestamp: 575,
            text: 'Sprawdzamy tez dlugie tytuly zadan, overflow i zachowanie mobile.',
          },
        ],
        speakerNames: { '0': 'Anna Kowalska', '1': 'Jan Nowak' },
        analysis: {
          summary: 'Layout audit summary',
          actionItems: ['Ujednolicic spacing', 'Zamknac regresje mobile'],
          decisions: ['Premium-light pozostaje domyslny'],
        },
      },
    ],
  });
  await seedTask(page, {
    id: 'task_layout_audit',
    title:
      'Release baseline task with intentionally long title for checkbox and ellipsis layout audit',
    notes: 'Task seeded for premium responsive layout audit.',
    dueDate: '2026-05-14T12:00:00.000Z',
    priority: 'high',
    owner: 'Barbara Zynda',
  });
  await seedQueueItem(page, {
    id: 'q_layout_failed',
    recordingId: 'recording_layout_failed',
    meetingId: 'meeting_layout_audit',
    status: 'failed',
    error: 'Layout audit failure state.',
  });
}

async function openShellTab(page, label: string) {
  const hamburger = page.locator('.modern-hamburger-btn');
  const navItem = page.locator('.modern-nav').getByRole('button', { name: label });
  if (
    !(await navItem.isVisible().catch(() => false)) &&
    (await hamburger.isVisible().catch(() => false))
  ) {
    await hamburger.click({ force: true });
  }
  await expect(navItem).toBeVisible();
  const className = await navItem.getAttribute('class');
  if (!className?.includes('active')) {
    await navItem.evaluate((element) => (element as HTMLButtonElement).click());
  }
  await page.keyboard.press('Escape');
  const sidebarOverlay = page.locator('.modern-sidebar-overlay');
  if (await sidebarOverlay.isVisible().catch(() => false)) {
    await sidebarOverlay.click({ force: true }).catch(() => undefined);
  }
}

async function collectLayoutAudit(page, view: string, breakpoint: string) {
  return page.evaluate(
    ({ view, breakpoint }) => {
      const viewportWidth = document.documentElement.clientWidth;
      const documentWidth = Math.max(
        document.documentElement.scrollWidth,
        document.body?.scrollWidth || 0
      );
      const isVisible = (element: Element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          rect.width > 1 &&
          rect.height > 1 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        );
      };
      const isTopmost = (element: Element) => {
        const rect = element.getBoundingClientRect();
        const x = Math.min(Math.max(rect.left + rect.width / 2, 0), window.innerWidth - 1);
        const y = Math.min(Math.max(rect.top + rect.height / 2, 0), window.innerHeight - 1);
        const topElement = document.elementFromPoint(x, y);
        return Boolean(topElement && (element === topElement || element.contains(topElement)));
      };
      const labelFor = (element: Element) => {
        const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
        return {
          tag: element.tagName.toLowerCase(),
          className: String((element as HTMLElement).className || '').slice(0, 120),
          text: text.slice(0, 120),
        };
      };
      const allVisible = Array.from(document.querySelectorAll('body *')).filter(isVisible);
      const overflowOffenders = allVisible
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.left < -2 || rect.right > viewportWidth + 2;
        })
        .slice(0, 12)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            ...labelFor(element),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
          };
        });

      const interactiveSelector =
        'button,a,input,select,textarea,[role="button"],[tabindex]:not([tabindex="-1"])';
      const denseControlAllowList = [
        '.transcript-row input',
        '.segment-checkbox',
        '.transcript-checkbox',
        '.ff-segment-check',
        '.calendar-day-add-btn',
        '.ui-checkbox',
        '.todo-task-circle',
        '.todo-star',
        '.todo-drag-handle',
        '.notification-dismiss',
        '.tag-chip-remove',
        '.mini-day',
        '.calendar-pill',
        'input[type="checkbox"]',
      ].join(',');
      const smallTargets = allVisible
        .filter((element) => element.matches(interactiveSelector))
        .filter(isTopmost)
        .filter((element) => !element.matches(denseControlAllowList))
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return Math.round(rect.width) < 44 || Math.round(rect.height) < 44;
        })
        .slice(0, 20)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            ...labelFor(element),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        });

      const darkPanelAllowList = [
        '.transcript-panel',
        '.transcript-sidebar',
        '.recording-player',
        '.player-shell',
        '.unified-player-panel',
        '.command-palette-backdrop',
        '.modern-sidebar-overlay',
      ].join(',');
      const darkPanels = allVisible
        .filter((element) => !element.matches(darkPanelAllowList))
        .filter(isTopmost)
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          if (rect.width < 140 || rect.height < 64) return false;
          const color = getComputedStyle(element).backgroundColor.match(/rgba?\(([^)]+)\)/);
          if (!color) return false;
          const [red, green, blue, alpha = 1] = color[1]
            .split(',')
            .map((value) => Number.parseFloat(value.trim()));
          if (alpha === 0) return false;
          return red < 125 && green < 135 && blue < 145;
        })
        .slice(0, 12)
        .map((element) => ({
          ...labelFor(element),
          background: getComputedStyle(element).backgroundColor,
        }));

      const controls = allVisible
        .filter((element) => element.matches(interactiveSelector))
        .filter(isTopmost)
        .filter((element) => !element.matches('svg, path'))
        .slice(0, 160);
      const overlayLayerSelector =
        '.notification-panel,.command-palette,.modal-overlay,.modal-backdrop,[role="dialog"]';
      const overlaps = [];
      for (let outer = 0; outer < controls.length; outer += 1) {
        const a = controls[outer];
        const aRect = a.getBoundingClientRect();
        for (let inner = outer + 1; inner < controls.length; inner += 1) {
          const b = controls[inner];
          if (a.contains(b) || b.contains(a)) continue;
          const aLayer = a.closest(overlayLayerSelector);
          const bLayer = b.closest(overlayLayerSelector);
          if (aLayer !== bLayer && (aLayer || bLayer)) continue;
          const bRect = b.getBoundingClientRect();
          const overlapX = Math.max(
            0,
            Math.min(aRect.right, bRect.right) - Math.max(aRect.left, bRect.left)
          );
          const overlapY = Math.max(
            0,
            Math.min(aRect.bottom, bRect.bottom) - Math.max(aRect.top, bRect.top)
          );
          if (overlapX > 8 && overlapY > 8) {
            overlaps.push({
              first: labelFor(a),
              second: labelFor(b),
              area: Math.round(overlapX * overlapY),
            });
          }
          if (overlaps.length >= 12) break;
        }
        if (overlaps.length >= 12) break;
      }

      return {
        view,
        breakpoint,
        overflowPixels: documentWidth - viewportWidth,
        overflowOffenders,
        smallTargets,
        darkPanels,
        overlaps,
      };
    },
    { view, breakpoint }
  );
}

test.describe('Premium layout audit', () => {
  test.setTimeout(90000);

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await freezeClock(page);
    await seedAuditWorkspace(page);
  });

  for (const viewport of auditViewports) {
    test(`premium-light surfaces pass layout metrics at ${viewport.name}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await expect(page.locator('.modern-main')).toBeVisible();

      const findings = [];
      for (const tab of coreTabs) {
        await openShellTab(page, tab.label);
        await expect(page.locator(tab.expected).first()).toBeVisible();
        const audit = await collectLayoutAudit(page, tab.label, viewport.name);
        findings.push(audit);
      }

      await page.keyboard.press('Escape');
      await page
        .locator('.modern-sidebar-overlay')
        .click({ force: true })
        .catch(() => undefined);
      await page.getByRole('button', { name: /profil/i }).click({ force: true });
      await expect(page.locator('.profile-shell, .profile-layout, main').first()).toBeVisible();
      findings.push(await collectLayoutAudit(page, 'Profil', viewport.name));

      await page.locator('.modern-search-btn').click();
      await expect(page.locator('.command-palette')).toBeVisible();
      findings.push(await collectLayoutAudit(page, 'Command palette', viewport.name));
      await page.keyboard.press('Escape');

      await page.getByRole('button', { name: 'Powiadomienia' }).click();
      await expect(page.locator('.notification-panel')).toBeVisible();
      findings.push(await collectLayoutAudit(page, 'Notification center', viewport.name));
      await page.keyboard.press('Escape');

      await testInfo.attach(`layout-audit-${viewport.name}.json`, {
        body: JSON.stringify(findings, null, 2),
        contentType: 'application/json',
      });

      const blockingFindings = findings.flatMap((finding) => {
        const problems = [];
        if (finding.overflowPixels > 2) {
          problems.push({
            view: finding.view,
            breakpoint: finding.breakpoint,
            type: 'horizontal-overflow',
            details: finding.overflowOffenders,
          });
        }
        if (finding.overlaps.length) {
          problems.push({
            view: finding.view,
            breakpoint: finding.breakpoint,
            type: 'interactive-overlap',
            details: finding.overlaps,
          });
        }
        if (finding.darkPanels.length) {
          problems.push({
            view: finding.view,
            breakpoint: finding.breakpoint,
            type: 'dark-panel-in-premium-light',
            details: finding.darkPanels,
          });
        }
        if (finding.smallTargets.length) {
          problems.push({
            view: finding.view,
            breakpoint: finding.breakpoint,
            type: 'small-tap-target',
            details: finding.smallTargets,
          });
        }
        return problems;
      });

      expect(blockingFindings).toEqual([]);
    });
  }
});
