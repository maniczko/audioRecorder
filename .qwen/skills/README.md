# 🛡️ Anti-Regression & TDD Skill

## 🎯 Cel

Ten skill **MUSI** być użyty przez KAŻDEGO agenta przed rozpoczęciem implementacji jakiejkolwiek funkcjonalności lub naprawy buga.

---

## 🚀 Quick Start

### Dla Agentów:

```markdown
@anti-regression-tdd

Task: [Opis zadania]

Following TDD workflow:
1. ✅ Understand task
2. ✅ Write tests first (RED)
3. ✅ Implement minimum code (GREEN)
4. ✅ Refactor (REFACTOR)
5. ✅ Add regression tests
6. ✅ Verify all tests pass
```

### Dla Ludzi:

```bash
# Przed rozpoczęciem pracy
pnpm run tdd [feature-name]

# Przykład
pnpm run tdd supabaseStorage
```

---

## 📋 Workflow

### 1. Zrozumienie zadania

```markdown
## Questions to answer:
- Jaka funkcjonalność ma być dodana/naprawiona?
- Jakie jest obecne zachowanie?
- Jakie jest oczekiwane zachowanie?
- Czy to jest bug fix czy nowa funkcjonalność?
```

### 2. Test-First Approach (TDD)

```bash
# KROK 1: Stwórz plik testu
mkdir -p server/tests/lib
touch server/tests/lib/[feature].test.ts

# KROK 2: Napisz test (który FAILUJE)
# Edit the test file with failing tests

# KROK 3: Uruchom test
pnpm exec vitest run server/tests/lib/[feature].test.ts

# ❌ Powinien FAILować (RED phase)
```

### 3. Implementacja

```bash
# KROK 4: Napisz minimum kodu żeby test przeszedł
# Edit the implementation file

# KROK 5: Uruchom test ponownie
pnpm exec vitest run server/tests/lib/[feature].test.ts

# ✅ Powinien przechodzić (GREEN phase)
```

### 4. Refaktor

```bash
# KROK 6: Refaktoruj kod (testy ciągle zielone)
pnpm exec vitest run server/tests/lib/[feature].test.ts

# ✅ Testy ciągle przechodzą (REFACTOR phase)
```

### 5. Regression Test (jeśli bug fix)

```bash
# KROK 7: Dodaj test regresji
mkdir -p server/tests/regression
touch server/tests/regression/[issue-number].test.ts

# Edit the regression test to document the bug
```

### 6. Weryfikacja

```bash
# KROK 8: Uruchom pełny TDD check
pnpm run tdd [feature-name]

# KROK 9: Uruchom wszystkie testy
pnpm run test

# KROK 10: Sprawdź coverage
pnpm run test:coverage
```

---

## 📁 Struktura Plików

```
project/
├── .qwen/
│   └── skills/
│       └── anti-regression-tdd.md  ← Skill definition
├── scripts/
│   └── tdd-check.sh                ← TDD check script
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

## 🧩 Dostępne Komendy

| Komenda | Opis |
|---------|------|
| `pnpm run tdd [feature]` | Uruchom TDD check dla funkcji |
| `pnpm run tdd:check [feature]` | To samo co `tdd` |
| `pnpm run test:regression` | Uruchom wszystkie testy regresji |
| `pnpm exec vitest --watch` | Watch mode dla TDD |

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

| Metric | Target | How to measure |
|--------|--------|----------------|
| Test coverage | 90%+ | `pnpm run test:coverage` |
| Tests before code | 100% | Code review checklist |
| Regression tests | 1 per bug | Count in `tests/regression/` |
| CI pass rate | 95%+ | GitHub Actions analytics |
| Bug recurrence | 0% | Regression test failures |

---

## 🎯 Przykład Użycia

### Task: Napraw bug #123 - supabaseStorage returns undefined instead of null

```markdown
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
  const result = await module.uploadAudioToStorage('rec1', Buffer.from('test'), 'audio/webm', '.webm');
  expect(result).toBeNull(); // ❌ FAIL: Returns undefined
});
```

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
| ❌ Accepting coverage drop | ✅ Keep coverage at 90%+ |
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
