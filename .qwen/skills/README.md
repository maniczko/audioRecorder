# Qwen Skills — audioRecorder (VoiceLog)

> **All project standards live in [`AGENTS.md`](../../AGENTS.md).**
> Read it before every task. This directory contains Qwen-specific skill wrappers only.

## Available Skills

### `anti-regression-tdd`

TDD workflow enforcement. Wraps AGENTS.md §2 (Testing) with Qwen-compatible
`@anti-regression-tdd` invocation.

## Rules for Qwen

1. **Always read `AGENTS.md`** at the start of each task.
2. **Tests are mandatory** — see AGENTS.md §2 for minimum counts and patterns.
3. **TDD for bug fixes** — failing test first, then fix.
4. **Communicate in Polish**, code and commits in English.
5. **Implement directly** — don't just suggest changes.

---

## 🧩 Dostępne Komendy

| Komenda                        | Opis                             |
| ------------------------------ | -------------------------------- |
| `pnpm run tdd [feature]`       | Uruchom TDD check dla funkcji    |
| `pnpm run tdd:check [feature]` | To samo co `tdd`                 |
| `pnpm run test:regression`     | Uruchom wszystkie testy regresji |
| `pnpm exec vitest --watch`     | Watch mode dla TDD               |

---

## ✅ Checklist (WYMAGANE)

```markdown
## Przed implementacją:

- [ ] Napisałem testy ZANIM kodem?
- [ ] Czy testy FAILUJĄ przed implementacją? (RED)
- [ ] Czy testy przechodzą po implementacji? (GREEN)
- [ ] Czy refaktoryzowałem z zielonymi testami? (REFACTOR)

## Po implementacji:

- [ ] Dodałem test regresji jeśli to bug fix?
- [ ] Dodałem testy edge cases?
- [ ] Dodałem testy error handling?
- [ ] Czy coverage nie spadł?

## Przed mergem:

- [ ] Wszystkie testy przechodzą? `pnpm run test`
- [ ] Coverage jest OK? `pnpm run test:coverage`
- [ ] Lint przechodzi? `pnpm run lint`
- [ ] Build przechodzi? `pnpm run build`
- [ ] CHANGELOG.md zaktualizowany?
```

---

## 📊 Metrics

| Metric            | Target    | How to measure               |
| ----------------- | --------- | ---------------------------- |
| Test coverage     | 55%+ FE, 65%+ BE | `pnpm run test:coverage:all` |
| Tests before code | 100%      | Code review checklist        |
| Regression tests  | 1 per bug | Count in `server/tests/regression/` |
| CI pass rate      | 95%+      | GitHub Actions analytics     |
| Bug recurrence    | 0%        | Regression test failures     |

---

## 🎯 Przykład Użycia

### Task: Napraw bug #123 - supabaseStorage returns undefined instead of null

````markdown
@anti-regression-tdd

Task: Fix bug #123 - supabaseStorage returns undefined instead of null

## 1. Understand

- Bug: Function returns undefined when supabase not configured
- Expected: Should return null for fallback to local storage

## 2. Write Test (RED)

Created: server/tests/lib/supabaseStorage.test.ts

```typescript
test('returns null when supabase is not configured', async () => {
  vi.doMock('../config', () => ({
    config: { SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' },
  }));
  const module = await import('../../lib/supabaseStorage');
  const result = await module.uploadAudioToStorage(
    'rec1',
    Buffer.from('test'),
    'audio/webm',
    '.webm'
  );
  expect(result).toBeNull(); // ❌ FAIL: Returns undefined
});
```
````

## 3. Implement (GREEN)

Fixed: server/lib/supabaseStorage.ts

```typescript
if (!supabase) {
  return null; // ✅ Now returns null
}
```

## 4. Refactor (REFACTOR)

- Extracted sanitizeRecordingId helper function
- All tests still pass ✅

## 5. Regression Test

Created: server/tests/regression/123-supabaseStorage-null.test.ts

```typescript
describe('Regression: Issue #123', () => {
  test('should return null (not undefined) when supabase not configured', async () => {
    // This test prevents the bug from coming back
  });
});
```

## 6. Verify

- ✅ All tests pass: `pnpm run test`
- ✅ Coverage OK: 95%
- ✅ Lint passes: `pnpm run lint`
- ✅ Build passes: `pnpm run build`

```

---

## 🚨 Common Mistakes

| Mistake | Correct Approach |
|---------|-----------------|
| ❌ Writing code before tests | ✅ Write tests FIRST (TDD) |
| ❌ Skipping regression tests | ✅ Add regression test for every bug |
| ❌ Accepting coverage drop | ✅ Keep coverage at target thresholds (55% FE, 65% BE) |
| ❌ Merging without all tests green | ✅ All tests must pass |
| ❌ Testing implementation details | ✅ Test behavior, not implementation |

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
```
