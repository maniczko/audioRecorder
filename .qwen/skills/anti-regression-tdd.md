# Anti-Regression & TDD Workflow Skill

> **Full standards: see [AGENTS.md](../../AGENTS.md) §2 (Testing).**
> This file is a Qwen-specific skill wrapper. All rules come from AGENTS.md.

## Trigger

Every agent MUST follow this workflow before implementing any feature or bug fix.

## TDD Workflow (AGENTS.md §2.2)

1. **UNDERSTAND** — What problem? Current vs expected behavior?
2. **RED** — Write test that fails (proves the gap)
3. **GREEN** — Write minimum code to pass
4. **REFACTOR** — Clean up with green tests
5. **VERIFY** — Full suite passes, coverage OK

## Test Template

` ypescript
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

describe('[FeatureName]', () => {
beforeEach(() => {
vi.useFakeTimers();
});

afterEach(() => {
vi.useRealTimers();
vi.restoreAllMocks();
});

// RED: should FAIL before implementation
test('should [EXPECTED] when [CONDITION]', async () => {
// Arrange → Act → Assert
});

// Edge cases
test('should handle [EDGE_CASE]', async () => {});

// Error handling
test('should throw when [INVALID]', async () => {});
});
`

## Regression Test Template

` ypescript
/\*\*

- Regression: Issue #[NUMBER]
- Bug: [DESCRIPTION]
- Fixed: [DATE]
- DO NOT DELETE without understanding the original bug.
  \*/
  describe('Regression: #[NUMBER] — [BUG]', () => {
  test('should not [BUG_BEHAVIOR] anymore', async () => {
  // exact scenario that caused the bug
  });
  });
  `

## Verification Checklist

- [ ] Tests written BEFORE implementation
- [ ] All tests pass: `npx vitest run`
- [ ] Coverage OK: `npx vitest run --coverage`
- [ ] Lint passes: `pnpm run lint`
- [ ] Regression test if bug fix
