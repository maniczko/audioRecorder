# 🛡️ Anti-Regression & TDD Workflow Skill

## 🎯 Cel

Każdy agent MUSI użyć tego workflow przed rozpoczęciem implementacji jakiejkolwiek funkcjonalności lub naprawy buga.

---

## 📋 Workflow Checklist (WYMAGANE)

### Przed implementacją:

```markdown
## 1. Zrozumienie zadania
- [ ] Jaka funkcjonalność ma być dodana/naprawiona?
- [ ] Jakie jest obecne zachowanie?
- [ ] Jakie jest oczekiwane zachowanie?
- [ ] Czy to jest bug fix czy nowa funkcjonalność?

## 2. Test-First Approach (TDD)
- [ ] Napisałem testy ZANIM kodem?
- [ ] Czy testy FAILUJĄ przed implementacją? (RED)
- [ ] Czy testy przechodzą po implementacji? (GREEN)
- [ ] Czy refaktoryzowałem z zielonymi testami? (REFACTOR)

## 3. Regression Prevention
- [ ] Dodałem test regresji jeśli to bug fix?
- [ ] Dodałem testy edge cases?
- [ ] Dodałem testy error handling?
- [ ] Czy coverage nie spadł?

## 4. Documentation
- [ ] Zaktualizowałem CHANGELOG.md?
- [ ] Dodałem ADR jeśli to architectural change?
- [ ] Skomentowałem dlaczego (nie co) w kodzie?

## 5. Verification
- [ ] Wszystkie testy przechodzą? `pnpm run test`
- [ ] Coverage jest OK? `pnpm run test:coverage`
- [ ] Lint przechodzi? `pnpm run lint`
- [ ] Build przechodzi? `pnpm run build`
```

---

## 🔧 Narzędzia

### 1. TDD Test Template

```typescript
// 📁 server/tests/lib/[featureName].test.ts
/**
 * TDD Workflow: Red → Green → Refactor
 * Feature: [FEATURE_NAME]
 * Issue: #[ISSUE_NUMBER]
 * Date: [DATE]
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

describe('[FeatureName]', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────
  // RED: Write test first (should FAIL)
  // ───────────────────────────────────────────────────────
  test('should [EXPECTED_BEHAVIOR] when [CONDITION]', async () => {
    // Arrange
    // Act
    // Assert
    // ❌ FAIL → Write minimum implementation → ✅ GREEN
  });

  // ───────────────────────────────────────────────────────
  // Edge Cases
  // ───────────────────────────────────────────────────────
  test('should handle [EDGE_CASE]', async () => {
    // ❌ FAIL → Extend implementation → ✅ GREEN
  });

  // ───────────────────────────────────────────────────────
  // Error Handling
  // ───────────────────────────────────────────────────────
  test('should throw [ERROR] when [INVALID_CONDITION]', async () => {
    // ❌ FAIL → Add error handling → ✅ GREEN
  });

  // ───────────────────────────────────────────────────────
  // Integration
  // ───────────────────────────────────────────────────────
  test('should work with [DEPENDENCY]', async () => {
    // ❌ FAIL → Add integration logic → ✅ GREEN
  });
});
```

---

### 2. Regression Test Template

```typescript
// 📁 server/tests/regression/[issueNumber].test.ts
/**
 * Regression Test
 * Issue: #[ISSUE_NUMBER]
 * Bug: [BUG_DESCRIPTION]
 * Fixed: [DATE]
 * 
 * This test prevents the bug from coming back.
 * DO NOT DELETE OR MODIFY without understanding the bug.
 */

import { describe, test, expect } from 'vitest';

describe(`Regression: Issue #[ISSUE_NUMBER] - [BUG_DESCRIPTION]`, () => {
  test('should not [BUG_BEHAVIOR] anymore', async () => {
    // Arrange: Setup the exact scenario that caused the bug
    
    // Act: Trigger the buggy code path
    
    // Assert: Verify the bug is fixed
    // This MUST pass, if it fails = bug is back!
  });
});
```

---

### 3. Pre-Implementation Checklist Script

```bash
#!/bin/bash
# 📁 scripts/tdd-check.sh

echo "🛡️  Anti-Regression & TDD Check"
echo "================================"
echo ""

# Check if test file exists
if [ -z "$1" ]; then
  echo "❌ Usage: ./tdd-check.sh [feature-name]"
  exit 1
fi

TEST_FILE="server/tests/lib/${1}.test.ts"
IMPL_FILE="server/lib/${1}.ts"

echo "📝 Checking: $1"
echo ""

# Check test exists
if [ ! -f "$TEST_FILE" ]; then
  echo "❌ Test file not found: $TEST_FILE"
  echo "   → Write tests FIRST (TDD)"
  exit 1
fi

echo "✅ Test file exists: $TEST_FILE"

# Check implementation exists
if [ ! -f "$IMPL_FILE" ]; then
  echo "⏳ Implementation not found: $IMPL_FILE"
  echo "   → Implement to make tests pass"
fi

# Run tests
echo ""
echo "🧪 Running tests..."
pnpm exec vitest run "$TEST_FILE" --reporter=verbose

if [ $? -eq 0 ]; then
  echo "✅ All tests pass"
else
  echo "❌ Tests failed"
  echo "   → Fix implementation or tests"
  exit 1
fi

# Check coverage
echo ""
echo "📊 Checking coverage..."
pnpm exec vitest run "$TEST_FILE" --coverage

echo ""
echo "✅ TDD Check complete!"
```

---

### 4. Agent Prompt Template

```markdown
## 🤖 Agent Task Template

### Task: [TASK_NAME]

**Before you start coding:**

1. **Understand the task**
   - What problem are we solving?
   - What is the current behavior?
   - What is the expected behavior?

2. **Write tests FIRST (TDD)**
   - Create test file: `server/tests/lib/[feature].test.ts`
   - Write failing tests (RED)
   - Run tests to confirm they fail

3. **Implement minimum code**
   - Write only enough code to pass tests
   - Run tests (GREEN)
   - Refactor if needed (REFACTOR)

4. **Add regression tests**
   - If this is a bug fix, add regression test
   - Document the bug in the test

5. **Verify**
   - All tests pass: `pnpm run test`
   - Coverage OK: `pnpm run test:coverage`
   - Lint passes: `pnpm run lint`
   - Build passes: `pnpm run build`

6. **Document**
   - Update CHANGELOG.md
   - Add ADR if architectural change
   - Comment WHY not WHAT in code

**DO NOT:**
- ❌ Write implementation before tests
- ❌ Skip regression tests for bug fixes
- ❌ Merge without all tests passing
- ❌ Accept coverage drop without justification

**DO:**
- ✅ Test-first development (TDD)
- ✅ Document bugs with regression tests
- ✅ Keep coverage at 90%+
- ✅ Run full test suite before merge
```

---

## 📁 File Structure

```
project/
├── .qwen/
│   └── skills/
│       └── anti-regression-tdd.md  ← THIS FILE
├── scripts/
│   └── tdd-check.sh                ← Pre-implementation check
├── server/
│   ├── lib/
│   │   └── [feature].ts            ← Implementation
│   └── tests/
│       ├── lib/
│       │   └── [feature].test.ts   ← Tests (written FIRST)
│       └── regression/
│           └── [issue].test.ts     ← Regression tests
└── docs/
    └── adr/
        └── [number]-[title].md     ← Architectural decisions
```

---

## 🚀 Usage

### For Agents:

```markdown
@anti-regression-tdd

Task: Implement new feature X

Following the TDD workflow:
1. ✅ Understand task
2. ✅ Write tests first (RED)
3. ✅ Implement minimum code (GREEN)
4. ✅ Refactor (REFACTOR)
5. ✅ Add regression tests
6. ✅ Verify all tests pass
```

### For Humans:

```bash
# Before starting work
./scripts/tdd-check.sh my-new-feature

# Or manually follow the checklist
cat .qwen/skills/anti-regression-tdd.md
```

---

## 📊 Metrics to Track

| Metric | Target | How to measure |
|--------|--------|----------------|
| Test coverage | 90%+ | `pnpm run test:coverage` |
| Tests before code | 100% | Code review checklist |
| Regression tests | 1 per bug | Count in `tests/regression/` |
| CI pass rate | 95%+ | GitHub Actions analytics |
| Bug recurrence | 0% | Regression test failures |

---

## 🎯 Success Criteria

A task is **NOT DONE** until:

- [ ] Tests written BEFORE implementation
- [ ] All tests pass (100% green)
- [ ] Coverage didn't drop
- [ ] Regression test added (if bug fix)
- [ ] Documentation updated
- [ ] Code reviewed
- [ ] CI passes

---

## 📚 Related Skills

- `code-review.md` - Code review checklist
- `git-workflow.md` - Git branching strategy
- `ci-cd.md` - CI/CD pipeline configuration
- `documentation.md` - Documentation standards

---

## 🔄 Continuous Improvement

After each sprint:

1. Review regression test count
2. Check if any bugs escaped to production
3. Update this skill with lessons learned
4. Add new test patterns if needed

---

**Remember:** Tests are not a burden. They are your safety net. 🛡️

**Golden Rule:** No code without tests. Period.
