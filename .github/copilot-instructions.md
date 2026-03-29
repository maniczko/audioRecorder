# Copilot Instructions — audioRecorder (VoiceLog)

> **All project standards live in [`AGENTS.md`](../AGENTS.md).**
> Read it before every task. This file contains Copilot-specific overrides only.

## Copilot-Specific Rules

1. **Always read `AGENTS.md`** at the start of each task for testing, code quality, and git standards.
2. **Tests are mandatory** — never submit code without corresponding tests (see AGENTS.md §2).
3. **TDD for bug fixes** — write a failing regression test before fixing the bug (see AGENTS.md §9 for full procedure, format, and checklist).
4. **React 19 + fakeTimers deadlock** — use `vi.useFakeTimers()` in `beforeEach` + `vi.useRealTimers()` in `afterEach`. Avoid hooks that trigger `setState` during mount with faked timers. Pass non-empty initial data to prevent mount-time re-renders.
5. **Communicate in Polish** with the user, but write code and commits in English.
6. **Implement directly** — don't just suggest changes, make them.
7. **Verify changes** — run relevant tests after every code change.
