import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readCss = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('global app shell layout contract', () => {
  it('defines one desktop sidebar and page spacing token set', () => {
    const css = readCss('../index.css');

    expect(css).toContain('--sidebar-width: 260px;');
    expect(css).toContain('--topbar-height: 64px;');
    expect(css).toContain('--page-padding-x: 24px;');
    expect(css).toContain('--page-padding-y: 24px;');
    expect(css).toContain('--layout-global-sidebar-width: var(--sidebar-width);');
    expect(css).toContain('--layout-topbar-height: var(--topbar-height);');
  });

  it('keeps desktop navigation labels readable instead of truncating them', () => {
    const css = readCss('./modern-layout.css');
    const navLabelRule = css.match(/\[data-layout='modern'\] \.modern-nav-label\s*\{[^}]*\}/)?.[0];

    expect(css).toContain(
      '--modern-sidebar-width: var(--layout-global-sidebar-width, var(--sidebar-width, 260px));'
    );
    expect(css).toContain('flex: 0 0 var(--modern-sidebar-width);');
    expect(navLabelRule).toContain('text-overflow: clip;');
    expect(navLabelRule).not.toContain('text-overflow: ellipsis;');
  });

  it('prevents screen-specific premium-light overrides from restoring the old narrow sidebar', () => {
    const css = readCss('./modern-layout.css');

    expect(css).not.toContain('var(--layout-global-sidebar-width, 160px)');
    expect(css).not.toContain('width: var(--layout-global-sidebar-width, 160px)');
    expect(css).toContain('flex-basis: var(--modern-sidebar-width);');
    expect(css).toContain('width: min(84vw, 280px) !important;');
  });

  it('keeps primary page shells full width instead of centered in the viewport', () => {
    const peopleCss = readCss('../PeopleTabStyles.css');
    const studioCss = readCss('../studio/StudioMeetingViewStyles.css');
    const tasksCss = readCss('../tasks/TasksWorkspaceViewStyles.css');
    const recordingsCss = readCss('../RecordingsTabStyles.css');

    expect(peopleCss).toContain(
      '.people-directory-page,\n.people-detail-page {\n  width: 100%;\n  max-width: none;\n  margin: 0;'
    );
    expect(studioCss).toContain(
      ":root[data-theme='premium-light'] .studio-home-dashboard {\n  width: 100%;\n  margin: 0;"
    );
    expect(studioCss).not.toContain('width: min(1180px');
    expect(studioCss).not.toContain('width: calc(100vw - 32px)');
    expect(tasksCss).toContain(
      ":root[data-theme='premium-light'] .tasks-layout.ms-todo.ui-split-pane {\n  width: 100%;\n  max-width: none;\n  margin: 0;"
    );
    expect(tasksCss).not.toContain('margin: -49px');
    expect(recordingsCss).toContain(
      ":root[data-theme='premium-light'] .recordings-tab-shell {\n  width: 100%;\n  max-width: none;\n  margin: 0;"
    );
    expect(recordingsCss).toContain(
      ":root[data-theme='premium-light'] .recordings-tab-content {\n  width: 100%;\n  max-width: none;\n  margin: 0;"
    );
    expect(recordingsCss).not.toContain('width: min(1600px');
  });

  it('provides shared UI primitive classes for future layout refactors', () => {
    const css = readCss('./reference-ui.css');

    expect(css).toContain('.ui-button');
    expect(css).toContain('.ui-input');
    expect(css).toContain('.ui-card');
    expect(css).toContain('.ui-table');
    expect(css).toContain('.ui-modal');
    expect(css).toContain('.ui-badge');
    expect(css).toContain('cursor: pointer;');
    expect(css).toContain('--ui-space-6: 24px;');
  });
});
