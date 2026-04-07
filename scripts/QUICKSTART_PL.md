# 🧪 Test Dashboard Pro - Quick Start (PL)

## Instalacja

Dashboard jest już zainstalowany! Wystarczy uruchomić:

```bash
pnpm run dashboard
```

## Używanie

### Opcja 1: Automatyczna (zalecane)
```bash
pnpm run dashboard
```
✅ Uruchomi testy  
✅ Wygeneruje raport  
✅ Otworzy dashboard w przeglądarce

### Opcja 2: Manualna
```bash
# 1. Testy
npx vitest run --reporter=json --outputFile=reports/vitest-results.json

# 2. Generowanie
pnpm run test:generate

# 3. Dashboard
pnpm run dashboard:open
```

### Opcja 3: Z Coverage (wolniejsze ale dokładniejsze)
```bash
npx vitest run --coverage --reporter=json --outputFile=reports/vitest-results.json
pnpm run test:generate
pnpm run dashboard:open
```

## Co Widzisz na Dashboardzie?

### 🔝 Na Górze
- **Status Badge** - czy wszystkie testy przeszły
- **Timestamp** - kiedy ostatnia aktualizacja
- **Przyciski** - odśwież, drukuj, export, coverage report

### 📊 Karty KPI
- ✅ **Testy Przedszłe** - liczba i % success rate
- ❌ **Testy Nieudane** - wymaga uwagi
- 📊 **Całkowita Liczba** - ile всего testów
- 📈 **Coverage** - procent coverage kodu
- 📁 **Pliki Testowe** - ile plików bez błędów
- ⚡ **Pomnijte** - testy skipped

### 🎯 Poziom Zaawansowania
Wskaźnik 1-5 pokazujący dojrzałość testów:
- **5/5 Optimized** 🟢 -理想nie, wszystkie testy, coverage >80%
- **4/5 Managed** 🟢 - Bardzo dobrze, mało błędów
- **3/5 Defined** 🔵 - Średnio, podstawowe testy są
- **2/5 Developing** 🟡 - Słabo, dużo błędów
- **1/5 Initial** 🔴 - Bardzo słabo, mało testów

### 💚 Health Score
Ocena 0-100 kompleksowa:
- **90-100** 🟢 Excellent
- **75-89** 🔵 Good  
- **60-74** 🟡 Fair
- **0-59** 🔴 Poor

### 📈 Wykresy
1. **Rozkład Testów** - kołowy wykres passed/failed/skipped
2. **Coverage by Category** - słupki dla kategorii
3. **Test Duration** - czas trwania testów
4. **Pass Rate** - procent przszedłych testów

### 📁 Kategorie Testów
Kafelki z kategoriami:
- 🪝 Hooks
- 🧩 Components  
- 💾 Stores
- 🔧 Services
- 🌐 Context
- 🛠️ Utilities
- 📄 Pages/Tabs
- 📦 Other

### 📂 Drzewo Plików
Lista wszystkich plików testowych:
- ❌ czerwone = mają błędy (na górze)
- ✅ zielone = wszystkie przeszły
- Pokazuje: passed, failed, duration

### ❌ Nieudane Testy
Lista błędów (jeśli są):
- Plik + nazwa testu
- Komunikat błędu
- Szczegóły

### 📈 Metryki
Szczegółowe wskaźniki:
- Test Pass Rate %
- Test Fail Rate %
- Avg Duration
- File Pass Rate %
- High Coverage Files
- Low Coverage Files

## Przykładowe Scenariusze

### 1. Sprawdzam Post Pracą
```bash
pnpm run dashboard
```
Patrzysz na:
- Maturity Level (czy się poprawił?)
- Health Score (czy wzrósł?)
- Failed Tests (czy mniej?)

### 2. Naprawiam Błędy
```bash
# Przed naprawą
pnpm run dashboard

# Naprawiasz błędy w kodzie...

# Po naprawie
pnpm run dashboard
```
Porównujesz dashboardy!

### 3. Analiza Coverage
```bash
npx vitest run --coverage --reporter=json --outputFile=reports/vitest-results.json
pnpm run test:generate
pnpm run dashboard:open
```
Patrzysz na:
- Coverage KPI (ogólne %)
- Coverage by Category (które kategorie słabe?)
- Drzewo plików (które pliki mają niski coverage?)

### 4. Raport dla Teamu
```bash
pnpm run dashboard
# Kliknij 🖨️ Drukuj Raport
```
Print to PDF i wyślij na Slacka!

## Częste Problemy

### ❌ Brak Danych
**Problem:** Dashboard pokazuje "Brak Danych"  
**Rozwiązanie:**
```bash
pnpm run test:with-report
```

### 📊 Coverage = 0%
**Problem:** Coverage jest 0%  
**Rozwiązanie:** Uruchom testy z `--coverage`:
```bash
npx vitest run --coverage --reporter=json --outputFile=reports/vitest-results.json
pnpm run test:generate
pnpm run dashboard:open
```

### 🐌 Wolne Ładowanie
**Problem:** Dashboard wolno się ładuje  
**Rozwiązanie:** 
- Odśwież stronę (Ctrl+F5)
- Sprawdź internet (Chart.js z CDN)

## Porady 💡

✅ **Trzymaj dashboard otwarty w tle**  
✅ **Refreshuj po każdej większej zmianie**  
✅ **Exportuj JSON do archiwum**  
✅ **Porównuj dashboardy przed/po**  
✅ **Drukuj raporty na spotkania**

## Komendy - Podsumowanie

| Komenda | Co Robi |
|---------|---------|
| `pnpm run dashboard` | Testy + generowanie + otwarcie |
| `pnpm run dashboard:open` | Otwórz dashboard |
| `pnpm run test:generate` | Generuj dane z istniejącego raportu |
| `pnpm run test:with-report` | Pełny cycle z testami |
| `pnpm run dashboard:legacy` | Otwórz stary dashboard |

---

**Miłego Testowania! 🧪✨**

Dashboard Pro v2.0 - VoiceLog Project
