# UI Action Test Policy

The goal is simple: a user should never click a visible control and get silence.

Required path for every UI action change:

1. Identify the screen and action.
2. Add or update the interaction-contract test.
3. Verify the action has an accessible name.
4. Verify the action creates visible feedback: navigation, modal, toast, changed state, disabled/busy state, or actionable error.
5. Run `pnpm run audit:ui-actions`.
6. Run `pnpm run test:ui-actions`.
7. For visual/layout changes, capture Playwright screenshots or update the visual baseline.
8. Before production handoff, run the production browser crawler through
   `pnpm run test:e2e:production-actions` or `pnpm run release:prod-gate:strict`
   with production audit secrets. The crawler inventories visible actions, clicks
   every safe enabled action, fails on unallowlisted `4xx/5xx`, requires visible
   feedback, and writes screenshot/JSON artifacts on failure.

Action categories:

- P0: auth, workspace, recording, upload, transcription, retry, delete, voice profile creation.
- P1: command palette, notification center, filters, exports, profile settings, calendar/task actions.
- P2: cosmetic toggles and non-critical preference controls.

Test expectation:

- P0 actions need a business-result assertion and a failure-state assertion.
- P1 actions need visible feedback and no console error.
- P2 actions need at least state-change coverage.
- Production crawler skips destructive/costly/provider-bound actions only when
  they are explicitly classified; those actions still need a separate journey or
  contract test.

Skip policy:

- No `test.skip` or `describe.skip` for P0 actions.
- Any temporary skip must include an issue, owner, expiration date, and replacement coverage.
