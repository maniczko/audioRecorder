import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';

const readCss = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('mobile responsive CSS contracts', () => {
  it('reserves shell space for fixed mobile surfaces', () => {
    const css = readCss('./modern-layout.css');

    expect(css).toContain('--mobile-player-height');
    expect(css).toContain('--mobile-bottom-safe');
    expect(css).toContain('--z-mobile-player');
    expect(css).toContain('overflow-x: hidden');
  });

  it('turns task rows into phone cards instead of a forced wide table', () => {
    const css = readCss('./tasks.css');

    expect(css).toContain('.tasks-layout.ms-todo .todo-table-row');
    expect(css).toContain('min-width: 0 !important');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr)');
  });

  it('keeps premium-light task form and completed checkbox aligned with the light layout', () => {
    const css = readCss('./tasks.css');

    expect(css).toContain(
      ":root[data-theme='premium-light'] .tasks-layout.ms-todo .todo-detail-modal-scroll"
    );
    expect(css).toContain(
      ":root[data-theme='premium-light'] .tasks-layout.ms-todo .todo-detail-unified-field"
    );
    expect(css).toContain(
      ":root[data-theme='premium-light'] .tasks-layout.ms-todo .todo-task-circle.completed::after"
    );
    expect(css).toContain('transform: translateY(-1px) rotate(42deg)');
  });

  it('turns recordings tables into labeled mobile cards', () => {
    const css = readCss('./recordings.css');

    expect(css).toContain('.studio-recordings-table thead');
    expect(css).toContain('.studio-recordings-table td::before');
    expect(css).toContain("content: 'Spotkanie'");
    expect(css).toContain("content: 'Akcje'");
  });

  it('stacks the current Studio panes and reserves player-safe space', () => {
    const css = readCss('../studio/StudioMeetingViewStyles.mobile.css');

    expect(css).toContain('.ff-studio-split-view');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(css).toContain('var(--mobile-bottom-safe');
  });

  it('keeps premium-light Studio tabs, metrics and speaker labels readable', () => {
    const studioCss = readCss('../studio/StudioMeetingViewStyles.css');
    const modernCss = readCss('./modern-layout.css');

    expect(studioCss).toContain(":root[data-theme='premium-light'] .ff-int-tab");
    expect(studioCss).toContain(":root[data-theme='premium-light'] .analysis-shell-metric");
    expect(studioCss).toContain(":root[data-theme='premium-light'] .ff-sov-name");
    expect(studioCss).toContain(":root[data-theme='premium-light'] .ff-player-status-wrap");
    expect(modernCss).toContain("[data-theme='premium-light'][data-layout='modern'] .ff-int-tab");
  });

  it('keeps premium-light empty and generic state panels off dark gray fallbacks', () => {
    const modernCss = readCss('./modern-layout.css');
    const foundationCss = readCss('./foundation.css');
    const skeletonCss = readCss('../components/skeleton.css');

    expect(modernCss).toContain(
      ":root[data-theme='premium-light'][data-layout='modern'] .hero-panel"
    );
    expect(modernCss).toContain(
      ":root[data-theme='premium-light'][data-layout='modern'] .hero-panel.empty-workspace"
    );
    expect(foundationCss).toContain(":root[data-theme='premium-light'] .empty-panel");
    expect(foundationCss).toContain(":root[data-theme='premium-light'] .skeleton");
    expect(skeletonCss).toContain(":root[data-theme='premium-light'] .ff-state-box");
  });

  it('keeps premium-light players visually rich with waveform tracks', () => {
    const unifiedPlayerCss = readCss('../studio/UnifiedPlayerStyles.css');
    const studioCss = readCss('../studio/StudioMeetingViewStyles.css');

    expect(unifiedPlayerCss).toContain('.uplayer-waveform-shell');
    expect(unifiedPlayerCss).toContain('.uplayer-waveform-visual');
    expect(unifiedPlayerCss).toContain('--uplayer-progress');
    expect(unifiedPlayerCss).toContain(":root[data-theme='premium-light'] .unified-player-panel");
    expect(studioCss).toContain(
      ":root[data-theme='premium-light'] .ff-player-progress-row::before"
    );
    expect(studioCss).toContain(":root[data-theme='premium-light'] .ff-player-play");
  });
});
