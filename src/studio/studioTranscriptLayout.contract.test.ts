import { readFileSync } from 'node:fs';

function cssBlock(css: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm'));
  return match?.[1] || '';
}

describe('Studio transcript layout CSS contract', () => {
  const studioCss = readFileSync('src/styles/studio.css', 'utf8');
  const meetingCss = readFileSync('src/studio/StudioMeetingViewStyles.css', 'utf8');

  // -----------------------------------------------------------------
  // Issue #0 - transcript speaker dropdown and checkbox regress visually
  // Date: 2026-05-21
  // Bug: global mobile input min-size inflated transcript checkboxes to 44px,
  //      and the speaker dropdown used light-theme item colors on dark surfaces.
  // Fix: transcript controls define stable dimensions and dark dropdown surfaces.
  // -----------------------------------------------------------------
  it('keeps transcript selection checkbox compact despite global mobile input rules', () => {
    const checkboxBlock = cssBlock(studioCss, ".fireflies-select input[type='checkbox']");

    expect(checkboxBlock).toContain('width: 14px');
    expect(checkboxBlock).toContain('height: 14px');
    expect(checkboxBlock).toContain('min-width: 14px');
    expect(checkboxBlock).toContain('min-height: 14px');
  });

  it('gives the speaker dropdown a solid premium dark surface and readable items', () => {
    expect(meetingCss).toContain("[data-theme='dark'] .ff-speaker-dropdown");
    expect(meetingCss).toContain("[data-theme='dark'] .ff-speaker-dropdown-item");
    expect(meetingCss).toContain("[data-theme='dark'] .ff-speaker-dropdown-item:hover");
    expect(meetingCss).toContain("[data-theme='dark'] .ff-speaker-dropdown-divider");
  });

  it('raises the active transcript segment while its speaker dropdown is open', () => {
    expect(meetingCss).toContain('.fireflies-segment:has(.ff-speaker-dropdown)');
    expect(meetingCss).toContain('.ff-speaker-picker-wrap:has(.ff-speaker-dropdown)');
    expect(cssBlock(meetingCss, '.ff-speaker-dropdown')).toContain('z-index: 1200');
  });
});
