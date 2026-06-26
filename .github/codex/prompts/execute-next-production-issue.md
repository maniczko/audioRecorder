# Execute the next production-readiness backlog issue

You are Codex working in the VoiceLog `audioRecorder` repository.

## Goal

Implement the GitHub issue that invoked this run from the production-readiness backlog. Treat the issue body as the source of truth for scope, acceptance criteria, and validation.

## Required context

Before changing files:

1. Read `AGENTS.md`.
2. Read `docs/CODEX_ORCHESTRATION.md` if it exists.
3. Read the triggering issue and any linked PR comments.
4. Identify whether the issue is P0, P1, P2, or P3 and preserve that priority in the final report.

## Execution rules

- Keep the change focused on the selected issue only.
- Follow the repository TDD workflow: run `pnpm run tdd <short-feature-name>`, add tests first when implementation changes code, then implement the minimum passing change.
- For bug fixes, add a regression test before the fix.
- Do not introduce secrets, tokens, service-role keys, or production credentials.
- Do not broaden refactors across audio pipeline files without a focused test plan.
- If the issue cannot be safely completed, leave a clear blocking comment and do not make speculative changes.

## Validation

Run the narrowest relevant tests first, then the issue-required checks. For production-readiness changes, prefer these checks when applicable:

```bash
pnpm run test:server:retry
pnpm run test:frontend:ci
pnpm run audit:mojibake
pnpm run typecheck:all
```

Document any skipped command with the concrete environment limitation.

## Final report

Include:

1. Linear or GitHub issue IDs covered.
2. Files changed.
3. Tests/checks run and result.
4. Known weaknesses or deferred risks.
5. Whether local frontend/backend runtime was verified when code changed.
