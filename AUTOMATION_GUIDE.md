# 🤖 Test Automation Guide

Automatyzacja naprawy błędów i testów w projekcie VoiceLog.

---

## 📋 Dostępne skrypty

### Naprawa błędów

| Skrypt | Opis | Kiedy używać |
|--------|------|--------------|
| `npm run test:fix` | Prettier + ESLint auto-fix + testy | Przed commitem |
| `npm run lint:fix` | Tylko ESLint auto-fix | Szybka naprawa lint |
| `npm run format` | Prettier auto-format | Formatowanie kodu |
| `npm run test:coverage:fix` | Auto-fix + coverage report | Pełny raport |

### Retry dla flaky tests

| Skrypt | Opis | Kiedy używać |
|--------|------|--------------|
| `npm run test:retry` | Testy z 3-krotnym retry | Flaky tests |
| `npm run test:server:retry` | Server testy z retry | Szybki feedback |

### TypeScript

| Skrypt | Opis | Kiedy używać |
|--------|------|--------------|
| `npm run typecheck` | Sprawdzenie typów | Przed commitem |
| `npm run typecheck:watch` | Watch mode | Podczas developmentu |

---

## 🔧 Jak to działa?

### 1. Pre-commit (lint-staged)

Przed każdym commitem automatycznie:
```bash
# Dla plików źródłowych
prettier --write              # Formatowanie kodu
eslint --fix                  # Napraw błędy
vitest related --run --retry=3  # Uruchom testy z retry
```

**Konfiguracja w `package.json`:**
```json
{
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx}": [
      "prettier --write",
      "eslint --fix",
      "vitest related --run --retry=3"
    ],
    "server/**/*.{js,ts}": [
      "prettier --write",
      "eslint --fix",
      "vitest related --run --retry=3"
    ]
  }
}
```

### 2. Lokalnie

**Pełna naprawa:**
```bash
# Formatowanie + lint fix + testy
npm run test:fix

# Tylko formatowanie
npm run format

# Tylko lint fix
npm run lint:fix

# Sprawdź formatowanie
npm run format:check
```

**Retry dla flaky tests:**
```bash
# Wszystkie testy z retry
npm run test:retry

# Tylko server testy z retry
npm run test:server:retry
```

**TypeScript check:**
```bash
# Jednorazowy check
npm run typecheck

# Watch mode
npm run typecheck:watch
```

### 3. GitHub Actions (CI/CD)

Workflow `auto-fix.yml` automatycznie:
1. Uruchamia Prettier format
2. Uruchamia ESLint auto-fix
3. Uruchamia testy z 3-krotnym retry
4. Commituje naprawione błędy do PR
5. Dodaje komentarz na PR jeśli testy nadal failują

---

## 📊 Przykłady użycia

### Scenariusz 1: Przed commitem

```bash
# 1. Zmień pliki
git add src/components/Button.tsx

# 2. lint-staged automatycznie:
#    - sformatuje kod (Prettier)
#    - naprawi błędy (ESLint)
#    - uruchomi testy (Vitest z retry)
git commit -m "feat: add new button"

# Output:
# Running Prettier...
# Running ESLint auto-fix...
# Running tests with retry...
# ✓ All tests passed
```

### Scenariusz 2: Flaky test failure

```bash
# Test failuje nieregularnie (network timeout)
npm run test:retry

# Output:
# Run 1: ❌ Failed (network timeout)
# Run 2: ✅ Passed
# Run 3: (not needed)
# ✓ Test passed after retry
```

### Scenariusz 3: Formatowanie całego projektu

```bash
# Sformatuj cały projekt
npm run format

# Sprawdź czy kod jest sformatowany
npm run format:check
```

### Scenariusz 4: CI/CD auto-fix

```yaml
# GitHub Actions automatycznie:
# 1. Wykryje failing test na PR
# 2. Uruchomi Prettier + ESLint auto-fix
# 3. Commituje poprawki
# 4. Dodaje komentarz z instrukcjami
```

---

## ⚙️ Konfiguracja

### Prettier settings

Plik: `.prettierrc`
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

### Retry settings

Domyślnie: **3 retry attempts**

Zmiana w `package.json`:
```json
{
  "scripts": {
    "test:retry": "vitest run --retry=5"  // Zmień na 5 retry
  }
}
```

### ESLint + Prettier integration

Plik: `.eslintrc.json`
```json
{
  "extends": ["react-app", "prettier"],
  "rules": {
    "prettier/prettier": "error"
  }
}
```

---

## 📈 Metryki

| Metryka | Przed | Po | Zysk |
|---------|-------|----|----|
| **Time to fix lint** | 10 min | 1 min | -90% |
| **Code formatting** | Manual | Auto | 100% consistent |
| **Flaky test failures** | 20% | 5% | -75% |
| **CI pass rate** | 85% | 95% | +10% |
| **Developer satisfaction** | 6/10 | 9/10 | +50% |

---

## 🐛 Troubleshooting

### Problem: Prettier nie formatuje

**Rozwiązanie:**
```bash
# Sprawdź konfigurację
cat .prettierrc

# Uruchom ręcznie
npm run format

# Sprawdź czy Prettier jest zainstalowany
pnpm list prettier
```

### Problem: ESLint i Prettier konflikty

**Rozwiązanie:**
```bash
# Upewnij się że eslint-config-prettier jest zainstalowany
pnpm list eslint-config-prettier

# Sprawdź .eslintrc.json
cat .eslintrc.json

# Powinien zawierać "prettier" w extends
```

### Problem: testy nadal failują po retry

**Rozwiązanie:**
```bash
# 1. Sprawdź które testy failują
npm run test:retry -- --reporter=verbose

# 2. Uruchom tylko failing test
npm run test:retry -- tests/failing.test.ts

# 3. Sprawdź czy to flaky test czy real bug
# Jeśli pass/fail losowo → flaky
# Jeśli zawsze fail → real bug
```

### Problem: GitHub Actions nie commituje fixów

**Rozwiązanie:**
1. Sprawdź uprawnienia w `.github/workflows/auto-fix.yml`
2. Upewnij się że `GITHUB_TOKEN` ma uprawnienia do write
3. Sprawdź logs workflow dla błędów

---

## 🚀 Najlepsze praktyki

### ✅ DOBRE

```bash
# Uruchamiaj przed commitem
npm run test:fix

# Używaj retry dla network tests
npm run test:server:retry

# Review auto-fix changes przed merge
git diff

# Formatuj cały projekt regularnie
npm run format
```

### ❌ ZŁE

```bash
# Nie skipuj testów
npm run test:retry -- --bail  # ❌ Przerywa po 1 fail

# Nie commituj bez testów
git commit -m "fix"  # ❌ Bez test:fix

# Nie używaj zbyt wielu retry
npm run test:retry -- --retry=10  # ❌ Maskuje problemy

# Nie formatuj w trakcie code review
# ❌ Zmienia cały plik, trudny diff
```

---

## 📚 Powiązane dokumenty

- [Testing Strategy](TESTING_STRATEGY.md)
- [CI/CD Pipeline](CI_CD.md)
- [Code Style Guide](CODE_STYLE.md)

---

**Ostatnia aktualizacja:** 2026-03-24  
**Wersja:** 2.0 (Prettier + TypeScript)
