# 📊 Coverage Reports - Instrukcja

## 🎯 Jak generować raporty coverage

### Szybkie uruchomienie

```bash
# Generuj raport coverage dla servera i otwórz w przeglądarce
npm run coverage:report
npm run coverage:open

# Lub osobno:
npm run test:coverage:server    # Server coverage
npm run test:coverage           # Frontend coverage
```

## 📁 Struktura raportów

```
coverage/
├── server/                     # Raporty servera (Node.js/TypeScript)
│   ├── index.html             # Główny raport HTML
│   ├── coverage-summary.json  # Podsumowanie JSON
│   ├── lcov.info              # Format LCOV dla CI/CD
│   └── server/                # Szczegółowe raporty per plik
│
└── frontend/                   # Raporty frontendu (React/TypeScript)
    ├── index.html
    ├── coverage-summary.json
    └── src/                   # Szczegółowe raporty per plik
```

## 🔧 Dostępne komendy

| Komenda | Opis |
|---------|------|
| `npm run test:coverage:server` | Testy servera z coverage |
| `npm run test:coverage` | Testy frontendu z coverage |
| `npm run test:coverage:all` | Wszystkie testy z coverage |
| `npm run coverage:report` | Generuj raporty (skrypt batch) |
| `npm run coverage:open` | Otwórz raport servera w przeglądarce |
| `npm run coverage:open:frontend` | Otwórz raport frontendu |

## 📊 Jak czytać raport HTML

### Kolory wskaźników

- 🟢 **Zielony (≥80%)** - Dobry coverage
- 🟡 **Żółty (50-79%)** - Wymaga poprawy
- 🔴 **Czerwony (<50%)** - Krytycznie niski coverage

### Metryki

| Metryka | Opis | Cel |
|---------|------|-----|
| **Statements** | % wykonanych instrukcji | ≥80% |
| **Branches** | % przetestowanych gałęzi (if/else) | ≥70% |
| **Functions** | % przetestowanych funkcji | ≥80% |
| **Lines** | % pokrytych linii kodu | ≥80% |

## 🔄 Automatyczna aktualizacja

Raporty są **nadpisywane** przy każdym uruchomieniu testów z `--coverage`:

```bash
# Każde uruchomienie aktualizuje raporty HTML
npm run test:coverage:server  # → coverage/server/index.html
npm run test:coverage         # → coverage/frontend/index.html
```

## 🎯 Przykładowy workflow

### 1. Przed commitowaniem
```bash
# Sprawdź coverage przed commitowaniem
npm run coverage:report
npm run coverage:open
```

### 2. Po dodaniu nowych testów
```bash
# Wygeneruj świeży raport
npm run test:coverage:all
```

### 3. Analiza konkretnego pliku
```bash
# Otwórz raport i wyszukaj plik
npm run coverage:open
# Kliknij na plik w raporcie HTML aby zobaczyć szczegóły
```

## 📈 Coverage Thresholds

### Server (`server/vitest.config.ts`)
```javascript
thresholds: {
  lines: 20,      // Minimalny % linii
  functions: 23,  // Minimalny % funkcji
  statements: 20, // Minimalny % instrukcji
  branches: 16,   // Minimalny % gałęzi
}
```

### Frontend (`vitest.config.js`)
```javascript
thresholds: {
  lines: 28,
  functions: 30,
  statements: 28,
  branches: 22,
}
```

## ⚠️ Rozwiązywanie problemów

### Problem: Brak pamięci (OOM)
```bash
# Zwiększ pamięć dla Node.js
set NODE_OPTIONS=--max-old-space-size=8192
npm run test:coverage:server
```

### Problem: Raport nie jest generowany
```bash
# Wyczyść stare raporty
rm -rf coverage/
npm run test:coverage:server
```

### Problem: Testy padają ale coverage jest potrzebny
Raport jest generowany nawet przy padających testach dzięki `reportOnFailure: true` w konfiguracji.

## 🔗 Integracja z CI/CD

### GitHub Actions przykład
```yaml
- name: Run tests with coverage
  run: npm run test:coverage:all

- name: Upload coverage reports
  uses: actions/upload-artifact@v4
  with:
    name: coverage-reports
    path: coverage/
```

## 📊 Aktualny status (2026-03-22)

### Server Coverage
| Metryka | Coverage | Status |
|---------|----------|--------|
| Statements | 47.19% | 🟡 |
| Branches | 35.5% | 🔴 |
| Functions | 50.85% | 🟡 |
| Lines | 47.4% | 🟡 |

## 📊 Aktualny status (2026-03-22)

### Server Coverage
| Metryka | Coverage | Status |
|---------|----------|--------|
| Statements | 47.19% | 🔴 |
| Branches | 35.5% | 🔴 |
| Functions | 50.85% | 🟡 |
| Lines | 47.4% | 🔴 |

### Jakość testów wg kategorii

```
Kategoria                 │   Plików │   Testów │   Pass Rate │      Ocena
────────────────────────────────────────────────────────────────────────────────
Backend (server/)         │       18 │      ~50 │         95% │ 🟢 9/10
Frontend Components       │       15 │      ~60 │         85% │ 🟡 7/10
Hooks                     │       12 │      ~50 │         60% │ 🔴 5/10
Services                  │        6 │      ~30 │         50% │ 🔴 4/10
Stores (Zustand)          │        5 │      ~30 │         70% │ 🟡 6/10
Lib (pure functions)      │       15 │      ~50 │         98% │ 🟢 9/10
Context Providers         │        2 │      ~10 │         50% │ 🔴 5/10
Integration/E2E           │        2 │      ~15 │         70% │ 🟡 6/10
```

### Najważniejsze pliki do poprawy
- `audioPipeline.ts` - 22% coverage 🔴
- `sqliteWorker.ts` - 0% coverage 🔴
- `supabaseStorage.ts` - 26% coverage 🔴

### Priorytety napraw

| Priorytet | Kategoria | Działanie |
|-----------|-----------|-----------|
| 🔴 P0 | Hooks | Naprawić testy z brakującymi providerami |
| 🔴 P0 | Services | Naprawić mocki fetch/API |
| 🔴 P0 | Context Providers | Dodać wrappery z providerami |
| 🟡 P1 | Frontend Components | Naprawić testy integracyjne |
| 🟡 P1 | Stores | Naprawić testy z async state |
