# ==========================================
# VoiceLog OS - Quality Assurance Guide
# ==========================================

## 📋 Checklista przed commitowaniem

### Przed każdym commitem:
- [ ] Uruchom testy: `npm test`
- [ ] Uruchom lint: `npm run lint`
- [ ] Uruchom build: `npm run build`
- [ ] Sprawdź zmiany: `git diff`
- [ ] Upewnij się, że .env nie jest commitowane

### Przed merge do main:
- [ ] Wszystkie testy przechodzą
- [ ] Code review zatwierdzone
- [ ] Dokumentacja zaktualizowana
- [ ] Migration scripts przygotowane (jeśli dotyczy DB)

---

## 🧪 System testów

### Struktura testów:
```
src/
  ├── *.test.tsx          # Testy komponentów
  ├── *.test.ts           # Testy funkcji
  ├── *.integration.tsx   # Testy integracyjne
  └── __tests__/          # Testy e2e
```

### Rodzaje testów:

#### 1. Unit Testy (Vitest)
```bash
npm test                    # Uruchom wszystkie testy
npm test -- --watch        # Tryb watch (dev)
npm test -- --coverage     # Z raportem coverage
```

#### 2. Integration Testy (Playwright)
```bash
npm run test:e2e           # Testy end-to-end
npm run test:e2e:ui        # Z interfejsem graficznym
```

#### 3. Linting & Type Checking
```bash
npm run lint               # ESLint
npm run type-check         # TypeScript
npm run format-check       # Prettier
```

---

## 🚀 CI/CD Pipeline

### GitHub Actions Workflow (.github/workflows/ci.yml)

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Type check
        run: pnpm run type-check
      
      - name: Lint
        run: pnpm run lint
      
      - name: Test
        run: pnpm test -- --coverage
      
      - name: Build
        run: pnpm run build
      
      - name: E2E Tests
        run: pnpm run test:e2e
```

---

## 📝 Pre-commit Hooks (Husky)

### Skrypty w .husky/:

#### pre-commit
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

pnpm run type-check
pnpm run lint
pnpm test -- --bail
```

#### commit-msg
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Wymuszanie konwencji commit messages
if ! grep -qE "^(feat|fix|docs|style|refactor|test|chore): " "$1"; then
  echo "❌ Commit message musi zaczynać się od: feat|fix|docs|style|refactor|test|chore"
  exit 1
fi
```

---

## 🛡️ Best Practices

### 1. **Code Review Checklist**
- [ ] Kod jest czytelny i zrozumiały
- [ ] Brak console.log w produkcyjnym kodzie
- [ ] Obsłużone przypadki brzegowe
- [ ] Testy dodane dla nowych funkcji
- [ ] Dokumentacja zaktualizowana

### 2. **Git Branch Strategy**
```
main          - produkcja
develop       - rozwój
feature/*     - nowe funkcje
fix/*         - bugfixy
hotfix/*      - pilne naprawy
```

### 3. **Commit Message Convention**
```
feat: dodanie nowego komponentu X
fix: naprawa błędu Y
docs: aktualizacja dokumentacji
style: poprawa formatowania
refactor: refaktoryzacja kodu
test: dodanie testów
chore: aktualizacja zależności
```

---

## 📊 Coverage Requirements

### Minimalne wymagania:
- **Lines:** 80%
- **Functions:** 80%
- **Branches:** 70%

### Check coverage:
```bash
npm test -- --coverage
open coverage/index.html
```

---

## 🔍 Code Quality Tools

### Zainstalowane:
- ✅ ESLint - linting kodu
- ✅ Prettier - formatowanie
- ✅ TypeScript - type checking
- ✅ Stylelint - linting CSS
- ✅ Vitest - test runner
- ✅ Playwright - e2e tests

### Konfiguracja:

#### .eslintrc.json
```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "no-console": "warn",
    "@typescript-eslint/no-unused-vars": "error"
  }
}
```

#### .prettierrc
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

---

## 📚 Dokumentacja

### Wymagana dokumentacja:
1. **README.md** - główny opis projektu
2. **CHANGELOG.md** - lista zmian
3. **CONTRIBUTING.md** - jak kontrybuować
4. **API.md** - dokumentacja API
5. **DEPLOYMENT.md** - instrukcja deploy

### Generowanie dokumentacji:
```bash
npm run docs              # Generuj dokumentację
npm run docs:serve        # Podgląd na localhost
```

---

## 🎯 Quick Commands

```bash
# Development
npm run dev              # Start dev server
npm run dev:full         # Dev + watch tests

# Quality Checks
npm run quality          # Wszystkie checki
npm run quality:fast     # Tylko lint + type-check

# Testing
npm test                 # Unit tests
npm run test:e2e         # E2E tests
npm run test:coverage    # Z raportem

# Build
npm run build            # Production build
npm run build:analyze    # Z analizą bundle

# Deploy
npm run deploy           # Deploy na produkcję
```

---

## 🚨 Error Prevention

### 1. **TypeScript Strict Mode**
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### 2. **Error Boundaries**
- Wszystkie komponenty owinięte w ErrorBoundary
- Logowanie błędów do Sentry

### 3. **Runtime Validation**
- Zod schema validation dla API
- PropTypes dla komponentów

### 4. **Monitoring**
- Sentry dla error tracking
- LangSmith dla AI monitoring
- Custom metrics w Prometheus

---

## 📈 Continuous Improvement

### Cotygodniowe zadania:
- [ ] Review coverage report
- [ ] Check Sentry errors
- [ ] Update dependencies
- [ ] Review and refactor tech debt

### Comiesięczne zadania:
- [ ] Security audit
- [ ] Performance audit
- [ ] Documentation review
- [ ] Test coverage goals review
