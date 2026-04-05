
# Project Coding Standards — audioRecorder (VoiceLog)

> **Canonical source of truth.** All AI agents (Copilot, Qwen, Cursor, etc.)
> MUST follow these rules. Agent-specific config files should reference this file
> rather than duplicate its content.

---

## 1. Stack

| Layer           | Tech                                                                 |
| --------------- | -------------------------------------------------------------------- |
| Frontend        | React 19, TypeScript 5.9, Vite, Zustand 5, TailwindCSS, shadcn/ui    |
| Backend         | Hono (Node.js 22), LangChain/LangGraph, Supabase, PostgreSQL         |
| Testing         | Vitest 4 + @testing-library/react 16, Playwright (e2e)               |
| Package manager | pnpm 9 (monorepo: root = frontend, `server/` = backend)              |
| Formatting      | Prettier + ESLint (react-app), Stylelint for CSS                     |
| Commits         | Conventional Commits, max 72 chars subject, English, imperative mood |

---

## 2. Testing — MANDATORY

**Every code change MUST include corresponding tests. No exceptions.**

### 2.1 When to write tests

| Change type      | Required action                      | Minimum tests                                |
| ---------------- | ------------------------------------ | -------------------------------------------- |
| New hook         | `useXxx.test.ts` next to `useXxx.ts` | ≥ 5 (happy, edge, error, cleanup, re-render) |
| New service/util | `xxx.test.ts` next to source         | ≥ 5 (happy, edge, error, boundary mocks)     |
| New component    | `Xxx.test.tsx` next to source        | ≥ 3 (render, interaction, conditional, a11y) |
| New API route    | `server/tests/routes/xxx.test.ts`    | ≥ 4 (success, validation, auth, edge)        |
| Bug fix          | Failing test FIRST, then fix         | ≥ 1 regression test                          |
| Refactor         | Run tests before AND after           | No coverage drop allowed                     |

### 2.2 TDD workflow (Red → Green → Refactor)

```
1. UNDERSTAND — What problem? Current vs expected behavior?
2. RED        — Write test that fails (proves the gap exists)
3. GREEN      — Write minimum code to pass the test
4. REFACTOR   — Clean up with green tests
5. VERIFY     — Full suite passes, coverage OK
```

For bug fixes: always write a failing regression test BEFORE fixing the bug.

### 2.3 Test patterns

```typescript
// Hooks — renderHook + act
import { renderHook, act } from '@testing-library/react';

// Components — render + userEvent + screen
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Services — direct calls with mocked boundaries
// Use vi.hoisted() for mocks referenced in vi.mock() factory

// CRITICAL: React 19 + fakeTimers deadlock
// vi.useFakeTimers() in beforeEach + vi.useRealTimers() in afterEach
// Hooks with useEffect + setState on mount may hang — provide non-empty
// initial data to avoid mount-time state updates creating new references.
```

### 2.4 Mock strategy

- Mock ONLY external boundaries: HTTP, IndexedDB, filesystem, Supabase
- Use `vi.hoisted()` for mocks needed inside `vi.mock()` factory
- Prefer `vi.spyOn()` over full module mocks
- Never mock internal functions of the module under test

### 2.5 Test quality checklist

- [ ] Tests are independent — no shared mutable state between `it()` blocks
- [ ] `afterEach` restores mocks, timers, DOM
- [ ] No `any` casts — use proper types
- [ ] Specific assertions (`toEqual` > `toBeTruthy`, `toHaveBeenCalledWith` > `toHaveBeenCalled`)
- [ ] Async ops in `act()` or `waitFor()`
- [ ] No `setTimeout` for waiting — use `vi.advanceTimersByTime()`
- [ ] No skipped tests without a `// TODO:` comment explaining why

### 2.6 Test commands

```bash
# Frontend
npx vitest run                                    # all frontend tests
npx vitest run src/path/to/file.test.ts           # single file
npx vitest run --coverage                         # with coverage (requires >55% lines)

# Server
npx vitest run -c server/vitest.config.ts         # all server tests
npx vitest run -c server/vitest.config.ts --retry=3  # with retries (pre-push hook)

# Coverage Check (All)
pnpm run test:coverage:all                        # runs backend + frontend coverage
```

---

## 3. Code Quality

### 3.1 TypeScript

- Strict mode — no `any` unless unavoidable (add comment explaining why)
- `interface` for object shapes, `type` for unions/intersections/aliases
- Export types separately: `export type { MyType }`
- Use `satisfies` for config objects

### 3.2 React

- Functional components only
- Zustand stores in `src/store/`
- Hooks in `src/hooks/`, services in `src/services/`, shared components in `src/shared/`
- No premature `useCallback`/`useMemo` — only when profiled
- Prefer composition over prop drilling

### 3.3 CSS

- TailwindCSS utility classes first
- CSS modules (`.module.css`) for complex component-specific styles
- No inline `style={{}}` — use Tailwind or CSS modules
- Theme via CSS variables: `var(--color-xxx)`

### 3.4 Error handling

- Validate at system boundaries (API inputs, user inputs, external data)
- Structured errors: `{ error: string, details?: unknown }`
- Log with context: `[module] description: { data }`
- Never swallow errors silently

### 3.5 Security

- DOMPurify for any user-generated HTML
- Zod schemas for all API input validation
- Parameterized queries — never string-concatenated SQL
- No secrets in client-side code

---

## 4. File Naming

| Type              | Pattern                                | Example                              |
| ----------------- | -------------------------------------- | ------------------------------------ |
| Component         | `PascalCase.tsx` + `.module.css`       | `MeetingCard.tsx`                    |
| Hook              | `useXxx.ts` + `useXxx.test.ts`         | `useRecorder.ts`                     |
| Service           | `xxxService.ts` + `xxxService.test.ts` | `mediaService.ts`                    |
| Store             | `xxxStore.ts`                          | `meetingStore.ts`                    |
| Server route test | `server/tests/routes/xxx.test.ts`      | `server/tests/routes/ai.test.ts`     |
| Server lib test   | `server/tests/lib/xxx.test.ts`         | `server/tests/lib/ragAnswer.test.ts` |

Tests are **always colocated** next to source (frontend) or in `server/tests/` mirroring structure (backend).

---

## 5. Git Workflow

- Single branch: `main` (production)
- **Pre-commit hook**: ESLint (staged files) + Prettier
- **Pre-push hook**: full server test suite (`test:server:retry`)
- Commit format: `type(scope): description` — English, imperative mood
- Valid types: `feat|fix|test|refactor|perf|chore|docs|style|build|ci|revert`
- One logical change per commit — don't mix features with fixes

---

## 6. Performance

- Lazy-load heavy components (recording, studio features)
- `react-virtuoso` / `react-window` for long lists
- Tree-shakeable imports only
- IndexedDB (`idb-keyval`) for large client-side data (audio blobs)

---

## 7. Agent-Specific Config

Each AI agent should have a **thin pointer file** in its own config directory
that references this document. Do NOT duplicate these rules.

| Agent          | Config location                   | What to put there                                   |
| -------------- | --------------------------------- | --------------------------------------------------- |
| GitHub Copilot | `.github/copilot-instructions.md` | `→ See AGENTS.md` + agent-specific overrides only   |
| Qwen           | `.qwen/skills/*.md`               | `→ See AGENTS.md` + Qwen-specific skill syntax only |
| Cursor         | `.cursor/rules/*.md`              | `→ See AGENTS.md` + Cursor-specific rules only      |

---

## 8. Anti-Regression & TDD Skill

**MANDATORY for all AI agents and developers.** Use before ANY implementation.

### 8.1 Usage

```bash
# Before starting any implementation
pnpm run tdd [feature-name]

# Example
pnpm run tdd supabaseStorage
```

### 8.2 Workflow

1. **Understand** — What problem? Current vs expected?
2. **Write test FIRST** — Create `*.test.ts` file
3. **RED** — Confirm test fails
4. **GREEN** — Implement minimum code to pass
5. **REFACTOR** — Clean up with green tests
6. **Regression** — Add test in `server/tests/regression/` if bug fix
7. **Verify** — `pnpm run test` + `pnpm run test:coverage:all`

### 8.3 Files

- Skill definition: `.qwen/skills/anti-regression-tdd.md`
- Usage guide: `.qwen/skills/USAGE.md`
- Check script: `scripts/tdd-check.ps1` (Windows) / `scripts/tdd-check.sh` (Linux/Mac)
- Regression tests: `server/tests/regression/*.test.ts`

### 8.4 Agent Integration

When using AI agents (Qwen, Copilot, Cursor), invoke the skill:

```markdown
@anti-regression-tdd

Task: [Description]

Following TDD workflow:

1. ✅ Understand task
2. ✅ Write tests first (RED)
3. ✅ Implement minimum code (GREEN)
4. ✅ Refactor (REFACTOR)
5. ✅ Add regression tests
6. ✅ Verify all tests pass
```

### 8.5 Enforcement

- Pre-commit hook: ESLint + Prettier on staged files (see `.husky/pre-commit`)
- Pre-push hook: server test suite via `test:server:retry` (see `.husky/pre-push`)
- CI check: Coverage thresholds are defined in `vitest.config.ts` (currently **55% lines** for frontend, **65%** for backend).
- Code review: Reject PRs without tests.
- **Known Issues**: There are currently ~286 failing frontend tests due to missing mocks in `setupTests.ts` (fetch, mediaDevices, etc.). Backend tests (`pnpm run test:server:retry`) are green.

---

## 9. Automatic Regression Tests for Bug Fixes

**MANDATORY for all AI agents.** Every bug fix MUST produce a regression test.
No exceptions — a fix without a test is incomplete.

### 9.1 When this applies

A change is a "bug fix" if ANY of these is true:

- Commit type is `fix(…)`
- User reports something broken / not working as expected
- Test suite was failing and agent is correcting it
- Runtime error, crash, or incorrect behavior is being addressed

### 9.2 Procedure (strict order)

```
1. REPRODUCE  — Understand the exact failing scenario (input → wrong output)
2. TEST FIRST — Write a test that fails WITH the bug present
3. VERIFY RED — Run the test, confirm it fails (proves bug exists)
4. FIX        — Write minimum code to make the test pass
5. VERIFY GREEN — Run the test, confirm it passes
6. REGISTER   — Add regression entry (see §9.3)
7. FULL SUITE — Run full test suite to check for side effects
```

**If step 3 (VERIFY RED) does not fail → the test does not prove the bug. Rewrite it.**

### 9.3 Where regression tests go

| Bug location              | Regression test location                                               | Naming                                 |
| ------------------------- | ---------------------------------------------------------------------- | -------------------------------------- |
| Frontend hook/service/lib | Next to source: `xxx.test.ts` (add `describe('Regression: …')` block)  | `Regression: #issue — description`     |
| Frontend component        | Next to source: `Xxx.test.tsx` (add `describe('Regression: …')` block) | `Regression: #issue — description`     |
| Server route/lib          | `server/tests/regression/regression.test.ts` (append new `describe`)   | `Regression: Issue #NNN — description` |
| Cross-cutting / unclear   | `server/tests/regression/regression.test.ts`                           | `Regression: Issue #NNN — description` |

### 9.4 Regression test format

Every regression test block MUST include a header comment:

```typescript
// ─────────────────────────────────────────────────────────────────
// Issue #NNN — short description of the bug
// Date: YYYY-MM-DD
// Bug: what was happening (wrong behavior)
// Fix: what was changed (correct behavior)
// ─────────────────────────────────────────────────────────────────
describe('Regression: Issue #NNN — short description', () => {
  test('exact scenario that was failing', () => {
    // Arrange — set up the exact conditions that triggered the bug
    // Act    — perform the operation
    // Assert — verify correct behavior (not the old broken one)
  });
});
```

### 9.5 Agent checklist (copy into commit message)

When committing a bug fix, the agent MUST verify:

- [ ] Regression test exists and is included in the commit
- [ ] Test was confirmed RED before the fix
- [ ] Test is confirmed GREEN after the fix
- [ ] Full suite passes (no side effects)
- [ ] Commit message uses `fix(scope):` format

### 9.6 What if there's no issue number?

Use `#0` and a descriptive title. Example:

```
// Issue #0 — MentionTextarea crashes with object suggestions
```

---

## 10. Post-Deployment Verification

**MANDATORY for all AI agents.** After making code changes to either the frontend or backend, the agent MUST verify that the local development server (or the resulting deployed process) still runs.

### 10.1 Verification Steps

1. If the server (`pnpm start` / `vite` / `node`) crashes or stops during the implementation, the agent must detect this via terminal checks.
2. The agent MUST explicitly restart the server with the correct port (e.g., `pnpm start` or forcing `--port 3000`).
3. The agent MUST NOT notify the user that "changes are ready" if `localhost:3000` is throwing `ERR_CONNECTION_REFUSED`. Wait for the `VITE ready` signal.
