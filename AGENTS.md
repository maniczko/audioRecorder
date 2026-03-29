# Project Coding Standards — audioRecorder (VoiceLog)

> **Canonical source of truth.** All AI agents (Copilot, Qwen, Cursor, etc.)
> MUST follow these rules. Agent-specific config files should reference this file
> rather than duplicate its content.

---

## 1. Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript 5.9, Vite, Zustand 5, TailwindCSS, shadcn/ui |
| Backend | Hono (Node.js 22), LangChain/LangGraph, Supabase, PostgreSQL |
| Testing | Vitest 4 + @testing-library/react 16, Playwright (e2e) |
| Package manager | pnpm 9 (monorepo: root = frontend, `server/` = backend) |
| Formatting | Prettier + ESLint (react-app), Stylelint for CSS |
| Commits | Conventional Commits, max 72 chars subject, English, imperative mood |

---

## 2. Testing — MANDATORY

**Every code change MUST include corresponding tests. No exceptions.**

### 2.1 When to write tests

| Change type | Required action | Minimum tests |
|-------------|----------------|---------------|
| New hook | `useXxx.test.ts` next to `useXxx.ts` | ≥ 5 (happy, edge, error, cleanup, re-render) |
| New service/util | `xxx.test.ts` next to source | ≥ 5 (happy, edge, error, boundary mocks) |
| New component | `Xxx.test.tsx` next to source | ≥ 3 (render, interaction, conditional, a11y) |
| New API route | `server/tests/routes/xxx.test.ts` | ≥ 4 (success, validation, auth, edge) |
| Bug fix | Failing test FIRST, then fix | ≥ 1 regression test |
| Refactor | Run tests before AND after | No coverage drop allowed |

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
npx vitest run --coverage                         # with coverage

# Server
npx vitest run -c server/vitest.config.ts         # all server tests
npx vitest run -c server/vitest.config.ts --retry=3  # with retries (pre-push hook)

# E2E
npx playwright test
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
- Zustand stores in `src/stores/`
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

| Type | Pattern | Example |
|------|---------|---------|
| Component | `PascalCase.tsx` + `.module.css` | `MeetingCard.tsx` |
| Hook | `useXxx.ts` + `useXxx.test.ts` | `useRecorder.ts` |
| Service | `xxxService.ts` + `xxxService.test.ts` | `mediaService.ts` |
| Store | `xxxStore.ts` | `meetingStore.ts` |
| Server route | `server/routes/xxx.ts` | `server/routes/ai.ts` |
| Server test | `server/tests/routes/xxx.test.ts` | `server/tests/routes/ai.test.ts` |

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

| Agent | Config location | What to put there |
|-------|----------------|-------------------|
| GitHub Copilot | `.github/copilot-instructions.md` | `→ See AGENTS.md` + agent-specific overrides only |
| Qwen | `.qwen/skills/*.md` | `→ See AGENTS.md` + Qwen-specific skill syntax only |
| Cursor | `.cursor/rules/*.md` | `→ See AGENTS.md` + Cursor-specific rules only |
