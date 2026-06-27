# Execute next production-readiness issue

You are Codex working in repository `maniczko/audioRecorder`.

## Goal

Implement the next production-readiness GitHub issue in strict queue order.

## Queue source

Use GitHub issue `#1263` as the source of truth.

## Selection rules

1. Find the first unchecked issue in `#1263`.
2. Only consider issues that are open.
3. Skip an issue if it has `codex:blocked`.
4. Stop without coding when any open production-readiness issue has `codex:in-progress` or `codex:pr-open`, unless that issue is the one you were explicitly assigned.
5. Prefer priority order already encoded in `#1263`: P0, then P1, then P2, then P3.
6. Do not start an issue if it depends on another open issue.

## Status rules

Before coding:

1. Comment on the selected issue:
   `Codex started work on this issue.`
2. Remove `codex:ready` when present.
3. Add `codex:in-progress` when available.
4. Create a dedicated branch:
   `production-readiness/<issue-number>-<short-slug>`.
   If repository policy allows `codex/*`, use `codex/<issue-number>-<short-slug>`.

When implementation succeeds:

1. Open a PR titled:
   `[#<issue-number>] <issue title>`
2. Include `Closes #<issue-number>` in the PR body.
3. Include:
   - Summary
   - Changed files
   - Tests run
   - Risks
   - Rollback notes
4. Remove `codex:in-progress` when present.
5. Add `codex:pr-open` when available.
6. Comment on the issue with the PR link and test results.

When blocked:

1. Stop.
2. Remove `codex:in-progress` when present.
3. Add `codex:blocked` when available.
4. Comment with:
   - blocker
   - attempted approach
   - decision needed
   - next recommended action

## Hard rules

- Work on exactly one issue.
- Do not implement more than one issue.
- Do not merge PRs.
- Do not skip tests unless impossible; if impossible, explain why.
- Do not change unrelated files.
- Do not silently change production behavior outside issue scope.
- Do not remove privacy, security, auth, workspace, or audit checks to make tests pass.
- Do not print secrets, tokens, service-role keys, database passwords, raw transcripts, or audio content.

## Verification

Run the smallest relevant verification set.

For backend changes:

```bash
pnpm run typecheck:server
pnpm run test:server:retry
```

For frontend changes:

```bash
pnpm run typecheck
pnpm run lint:all
```

For workflow/config/agent changes:

```bash
pnpm run test:workflows
pnpm run audit:mojibake
```

For cross-cutting production changes:

```bash
pnpm run typecheck:all
pnpm run lint:all
pnpm run test:server:retry
```

For recorder/queue changes, run at minimum:

```bash
pnpm exec vitest run src/hooks/useAudioHardware.test.ts src/hooks/useRecorder.test.tsx src/lib/recordingQueue.test.ts src/store/recorderStore.test.ts src/store/recorderQueueProcessor.test.ts --coverage.enabled=false
```

## PR body template

```markdown
Closes #<issue-number>

## Summary

-

## Changed files

-

## Tests run

- [ ] `pnpm run typecheck:server`
- [ ] `pnpm run test:server:retry`
- [ ] other:

## Risks

-

## Rollback notes

-
```

## Final response

Report:

- selected issue number
- branch name
- PR link
- tests run
- known risks
- whether the issue was completed or blocked
