# UI Action Inventory

VoiceLog treats every visible user action as a release contract, not as a best-effort UI detail.

Run:

```bash
pnpm run audit:ui-actions
pnpm run test:ui-actions
pnpm run test:e2e:production-actions
```

`audit:ui-actions` scans the main React surfaces and compares the current action count and fingerprint with `docs/testing/ui-action-contracts.json`. The inventory includes:

- native buttons
- links
- inputs, selects, and textareas
- role-based actions: `button`, `tab`, `menuitem`

When a new action appears, update the contract only after adding or confirming an interaction test. The generated report is written to `reports/ui-action-inventory/latest.md` and `reports/ui-action-inventory/latest.json`.

The production action crawler writes runtime evidence to `reports/production-action-crawler/latest.json` and Playwright failure screenshots/traces under `test-results/`. It must be run with the production audit workspace secrets, never against private user data.

Release rule:

- New action without interaction evidence: block release.
- Existing action with changed fingerprint: review the diff and update the matching test.
- Critical Studio, recording, voice-profile, auth, and workspace actions require regression tests before the contract is updated.
