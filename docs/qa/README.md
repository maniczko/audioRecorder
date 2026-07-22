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

- Premium coverage audit and target catalogue: `docs/qa/PREMIUM_TEST_COVERAGE_PLAN.md`
- Scenario definition: `docs/qa/scenarios/*.md`
- Scenario inventory and status: `docs/qa/TEST_SCENARIO_INDEX.md`
- Scenario writing contract: `docs/qa/TEST_SCENARIO_STANDARD.md`
- Automated implementation: `tests/e2e/*.spec.ts`
- Deterministic data: `tests/e2e/fixtures/` and `tests/e2e/helpers/`

The premium coverage plan is the complete target model. The scenario index lists scenarios that have been fully written and are ready to execute. A catalogue entry is not considered executable until it has a detailed scenario file following `TEST_SCENARIO_STANDARD.md`.

## Implementation queue

Scenario documentation and automated implementation are delivered separately:

1. Merge the reviewed scenario definition and coverage contract.
2. Create one implementation issue for one coherent scenario package.
3. Use one branch and one pull request for that package.
4. Keep the scenario status as `ready` or `partial` until green CI evidence exists.
5. Change the status to `automated` only when the linked test is maintained and release-relevant checks pass.
6. Do not weaken product behavior or assertions to make a scenario pass; open a defect issue when the application violates the documented contract.

The first implementation package is tracked by `#1538` for `AUTH-001` through `AUTH-004`.

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