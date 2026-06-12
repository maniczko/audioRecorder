import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const referenceCss = readFileSync(join(root, 'src/styles/reference-ui.css'), 'utf8');
const briefModal = readFileSync(join(root, 'src/studio/StudioBriefModal.tsx'), 'utf8');
const visualSpec = readFileSync(join(root, 'tests/e2e/visual-regression.spec.ts'), 'utf8');
const layoutAuditSpec = readFileSync(join(root, 'tests/e2e/layout-audit.spec.ts'), 'utf8');

describe('screenshot-first premium-light contract', () => {
  it('keeps approved screenshots as named baseline fixtures', () => {
    for (const fileName of [
      'profile-integrations-desktop-1660x947.png',
      'brief-modal-desktop-678x783.png',
      'tasks-detail-desktop-1161x786.png',
      'notes-detail-desktop-1183x788.png',
      'recordings-table-desktop-1275x777.png',
      'people-profile-desktop-1394x774.png',
    ]) {
      expect(
        existsSync(join(root, 'tests/e2e/reference-screenshots/premium-light/named', fileName))
      ).toBe(true);
    }
  });

  it('defines shared premium-light tokens for approved reference screens', () => {
    expect(referenceCss).toContain('--vb-control-h: 44px');
    expect(referenceCss).toContain('--vb-radius-lg: 24px');
    expect(referenceCss).toContain('--vb-shadow-card');
    expect(referenceCss).toContain(":root[data-theme='premium-light'] .recordings-library-panel");
  });

  it('keeps required reference screens covered by the override layer', () => {
    for (const selector of [
      '.modern-sidebar',
      '.profile-layout-container',
      '.tasks-layout.ms-todo',
      '.studio-brief-modal',
      '.people-layout',
      '.notes-layout',
      '.recordings-tab-shell',
    ]) {
      expect(referenceCss).toContain(selector);
    }
  });

  it('uses dedicated date and time controls in the brief modal instead of datetime-local', () => {
    expect(briefModal).not.toContain('type="datetime-local"');
    expect(briefModal).toContain('type="date"');
    expect(briefModal).toContain('type="time"');
  });

  it('documents why the brief submit action is disabled', () => {
    expect(briefModal).toContain('data-disabled-reason={disabledReason}');
    expect(briefModal).toContain('studio-brief-title-error');
  });

  it('keeps visual and layout audits on the required desktop reference viewports', () => {
    for (const width of ['1366', '1440', '1600', '1920']) {
      expect(visualSpec).toContain(`width: ${width}`);
      expect(layoutAuditSpec).toContain(`width: ${width}`);
    }
  });

  it('covers every approved reference screen in the visual regression matrix', () => {
    for (const screenshotName of [
      'reference-shell',
      'reference-profile-integrations',
      'reference-tasks-detail',
      'reference-brief-modal',
      'reference-people-profile',
      'reference-notes-detail',
      'reference-recordings-table',
    ]) {
      expect(visualSpec).toContain(screenshotName);
    }
  });

  it('keeps premium-light quality assertions in the screenshot-first flow', () => {
    for (const assertionName of [
      'assertNoInternalDebugText',
      'assertNoSerifFallback',
      'assertNoPremiumLightDarkPanels',
      'assertReferenceScreenQuality',
    ]) {
      expect(visualSpec).toContain(assertionName);
    }
  });
});
