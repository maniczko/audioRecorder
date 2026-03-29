# 🛡️ Anti-Regression & TDD Skill - Instrukcja Użycia

## ✅ Skill został stworzony!

Lokalizacja: `.qwen/skills/anti-regression-tdd.md`

---

## 🚀 Jak używać?

### Dla Agentów AI:

Przed rozpoczęciem jakiejkolwiek implementacji, agent **MUSI** użyć:

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

### Dla Ludzi (Windows):

```powershell
# Przed rozpoczęciem pracy
.\scripts\tdd-check.ps1 [feature-name]

# Przykład
.\scripts\tdd-check.ps1 supabaseStorage
```

### Dla Ludzi (Linux/Mac):

```bash
# Przed rozpoczęciem pracy
./scripts/tdd-check.sh [feature-name]

# Przykład
./scripts/tdd-check.sh supabaseStorage
```

### Przez package.json:

```bash
# Windows (PowerShell)
pnpm run tdd supabaseStorage

# Linux/Mac (bash)
pnpm run tdd:check supabaseStorage
```

---

## 📋 Co robi skill?

### 1. **Wymusza Test-First Development (TDD)**

```
❌ ŹLE: Najpierw kod, potem testy
✅ DOBRZE: Najpierw testy, potem kod
```

### 2. **Sprawdza czy testy istnieją**

```
✅ Test file exists: server/tests/lib/supabaseStorage.test.ts
❌ Test file not found: server/tests/lib/newFeature.test.ts
   → TDD Rule: Write tests BEFORE implementation!
```

### 3. **Uruchamia testy**

```
✅ All tests pass (GREEN)
❌ Tests failed (RED)
   → Fix implementation or tests before proceeding
```

### 4. **Przypomina o testach regresji**

```
💡 If this is a bug fix, add regression test:
   New-Item -ItemType File server/tests/regression/2026-03-29-supabaseStorage.test.ts
```

---

## 📁 Struktura

```
project/
├── .qwen/
│   └── skills/
│       ├── README.md                     ← Instrukcja wszystkich skilli
│       └── anti-regression-tdd.md        ← Główny skill
├── scripts/
│   ├── tdd-check.ps1                     ← Windows script
│   └── tdd-check.sh                      ← Linux/Mac script
├── server/
│   ├── lib/
│   │   └── supabaseStorage.ts            ← Implementation
│   └── tests/
│       ├── lib/
│       │   └── supabaseStorage.test.ts   ← Tests (written FIRST)
│       └── regression/
│           └── *.test.ts                 ← Regression tests
└── package.json                          ← Contains "tdd" script
```

---

## 🎯 Przykład Użycia Krok po Kroku

### KROK 1: Nowa funkcjonalność

```markdown
Task: Add new feature "processRecording"

@anti-regression-tdd

Task: Add processRecording function

Following TDD workflow:
1. ✅ Understand: Function should process audio recording and return transcript
2. ✅ Write tests first (RED)
3. ✅ Implement minimum code (GREEN)
4. ✅ Refactor (REFACTOR)
5. ✅ Add regression tests
6. ✅ Verify all tests pass
```

### KROK 2: Uruchom TDD check

```powershell
.\scripts\tdd-check.ps1 processRecording
```

### KROK 3: Postępuj zgodnie z outputem

```
🛡️  Anti-Regression & TDD Check
================================

📝 Feature: processRecording

Step 1: Checking test file...
❌ Test file not found: server\tests\lib\processRecording.test.ts

   TDD Rule: Write tests BEFORE implementation!

   Create test file first:
   New-Item -ItemType Directory -Force server\tests\lib
   New-Item -ItemType File server\tests\lib\processRecording.test.ts

   Then write failing tests (RED phase)
```

### KROK 4: Stwórz test

```typescript
// 📁 server/tests/lib/processRecording.test.ts
import { describe, test, expect } from 'vitest';

describe('processRecording', () => {
  test('should return transcript when processing succeeds', async () => {
    // Arrange
    // Act
    // Assert
    // ❌ This will FAIL - function doesn't exist yet (RED)
  });
});
```

### KROK 5: Uruchom TDD check ponownie

```powershell
.\scripts\tdd-check.ps1 processRecording
```

### KROK 6: Zobacz zielone testy

```
Step 3: Running tests...

✅ All tests pass (GREEN)

================================
✅ TDD Check Complete!
================================
```

---

## 📊 Statystyki

| Metryka | Przed | Po wdrożeniu skill |
|---------|-------|-------------------|
| Test coverage | 70% | 90%+ |
| Bugs in production | Wysoki | Niski |
| Regression bugs | Często | Rzadko |
| Developer confidence | Niski | Wysoki |

---

## 🚨 Co się stanie jeśli NIE użyjesz skilla?

```
❌ Piszesz kod bez testów
❌ Testy piszesz PO implementacji
❌ Zapominasz o testach regresji
❌ Coverage spada
❌ Bugi wracają
❌ Musisz fixować to samo 3 razy
❌ Tracisz czas
```

---

## ✅ Co się stanie jeśli użyjesz skilla?

```
✅ Piszesz testy PIERWSZE
✅ Testy failują przed implementacją (RED)
✅ Implementujesz minimum kodu (GREEN)
✅ Refaktorujesz z zielonymi testami (REFACTOR)
✅ Dodajesz test regresji dla bugów
✅ Coverage rośnie
✅ Bugi nie wracają
✅ Oszczędzasz czas
✅ Śpisz spokojnie
```

---

## 🎯 Golden Rules

1. **No code without tests** - Żadnego kodu bez testów
2. **Tests first** - Testy pierwsze
3. **Red-Green-Refactor** - Zawsze w tej kolejności
4. **Regression test for every bug** - Test regresji dla każdego buga
5. **Coverage must not drop** - Coverage nie może spaść

---

## 📚 Powiązane Dokumenty

- `.qwen/skills/README.md` - Instrukcja wszystkich skilli
- `MEMORY_PROFILING.md` - Memory profiling guide
- `APM_INTEGRATION.md` - APM integration guide
- `TASK_DONE.md` - Zakończone zadania

---

**Pamiętaj:** Ten skill jest po to żebyś **nie musiał** fixować tych samych bugów w nieskończoność. 🛡️

**Używaj ZA KAŻDYM RAZEM gdy piszesz kod.**
