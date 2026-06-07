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
});
