# QA browser scenarios

This directory is the source of truth for repeatable browser scenarios executed manually by Codex and later automated in Playwright.

## Workflow

1. Read the scenario from `docs/qa/scenarios/`.
2. Prepare the declared test data and environment.
3. Execute every step in order.
4. Record `PASS`, `FAIL`, or `BLOCKED` for each step.
5. Capture screenshots, console errors, and relevant network failures.
6. Create a GitHub issue only when the scenario finds a defect, is blocked, or should be automated.
7. Add or update a Playwright regression test for critical or recurring failures.

## Source-of-truth rules

- Scenario definition: `docs/qa/scenarios/*.md`
- Scenario inventory and status: `docs/qa/TEST_SCENARIO_INDEX.md`
- Scenario writing contract: `docs/qa/TEST_SCENARIO_STANDARD.md`
- Automated implementation: `tests/e2e/*.spec.ts`
- Deterministic data: `tests/e2e/fixtures/` and `tests/e2e/helpers/`

## Execution result template

```markdown
## Execution result

- Scenario:
- Environment:
- Build SHA:
- Browser:
- Viewport:
- Result: PASS / FAIL / BLOCKED
- Failed step:
- Console errors:
- Network errors:
- Screenshot or artifact:
- Suspected component or file:
- Follow-up issue:
- Automation recommendation:
```

## Safety

- Never place passwords, API keys, session tokens, private recordings, or raw production transcripts in scenario files or evidence.
- Use deterministic QA users, workspaces, meetings, and audio fixtures.
- Do not mutate production data unless the scenario explicitly declares a safe production-smoke procedure.
