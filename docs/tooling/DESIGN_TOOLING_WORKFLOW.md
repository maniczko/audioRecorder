# Design Tooling Workflow

VoiceLog is a premium workspace app. UI work must be validated in real
rendering, not only by reading CSS.

## Source Of Truth

- `docs/DESIGN_SYSTEM_RULES.md` defines spacing, typography, responsive rules,
  cards, color usage, and layout constraints.
- `docs/DESIGN_ACTION_STATES.md` defines action feedback, disabled states,
  loading states, and destructive-action expectations.
- `docs/ui-actions/ACTION_INVENTORY.md` and
  `docs/ui-actions/ACTION_TEST_POLICY.md` connect visible actions to automated
  interaction tests.

## Figma

Use Figma when a change needs design-system clarification, new component
structure, responsive layout decisions, or visual hierarchy review. Figma
output must be translated into repo-visible rules, screenshots, or component
contracts before it can be release evidence.

## Canva

Use Canva only for presentation/marketing assets or external visual artifacts.
Canva is not the source of truth for application UI implementation.

## Browser And Playwright

For UI changes, verify with Browser or Playwright:

- desktop and mobile layout;
- no horizontal overflow;
- visible focus states;
- modals and popovers layering above content;
- every enabled button has feedback or a state change;
- screenshot or trace evidence for release-impacting UI changes.

Automated gates:

```bash
pnpm run audit:ui-actions
pnpm run test:ui-actions
pnpm run test:visual:check
```
