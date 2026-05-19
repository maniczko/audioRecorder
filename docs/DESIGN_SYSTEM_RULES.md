# VoiceLog OS Design System Rules

These rules are release-blocking for UI work. They encode the Figma/Codex governance expected for a premium, utilitarian SaaS workspace.

## Layout And Spacing

- Use the existing CSS variables before adding new values: `--space-*`, `--radius-*`, `--color-*`, `--text-*`, `--surface-*`.
- Keep spacing on a 4 px scale. Prefer `8`, `12`, `16`, `24`, `32`, and `48` px equivalents.
- Do not put UI cards inside other cards. Use cards only for repeated items, modals, and genuinely framed tools.
- Keep page sections unframed and full-width inside the application shell.
- Use stable dimensions for fixed-format controls such as sidebars, icon buttons, tab bars, toolbars, counters, and table/list rows.

## Responsive Breakpoints

- Required visual matrix: `1440x900`, `1280x720`, `1024x768`, `768x1024`, `390x844`.
- All core views must avoid horizontal overflow at every release viewport.
- Mobile navigation must keep the hamburger, command search, notification trigger, record CTA, and profile control reachable without overlap.
- Text must wrap or truncate deliberately; accidental clipping is a release defect.

## Interaction Quality

- Icon buttons need accessible names and visible focus states.
- Modals, command palette, notification center, drawers, and popovers must layer above page content without scroll traps.
- Empty, loading, error, disabled, retry, and completed states must be visually covered before release.
- Use `prefers-reduced-motion` friendly transitions in visual tests.

## Visual QA

- Every UI change that affects layout must run a real browser check.
- Release visual baselines are owned by `tests/e2e/visual-regression.spec.ts`.
- Update baselines only after reviewing screenshots in the Playwright report.
- Store transient screenshots and traces as CI artifacts, not as ad hoc root files.

## Text And Encoding

- UI text and repo config must be UTF-8 without mojibake.
- Polish copy may use native diacritics when the surrounding file already uses UTF-8.
- Release-critical UI/config surfaces must pass `pnpm run audit:mojibake`.

## Agent Governance

- Agent-specific files should point to `AGENTS.md` and this file instead of duplicating broad rules.
- Codex/Figma/Canva work should produce repo-visible evidence: tests, screenshots, baselines, or PR checklist entries.
- Figma/Canva source files are optional for this release; Playwright artifacts and GitHub checks are canonical.
