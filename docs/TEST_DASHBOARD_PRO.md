# 🎯 Test Dashboard Pro - Instrukcja Obsługi

## Co To Jest?

Profesjonalny, interaktywny dashboard do monitorowania testów z wieloma kategoriami, KPI i poziomami zaawansowania.

## ✨ Funkcje

### 📊 Karty KPI (Key Performance Indicators)
- **Testy Przedszłe** - liczba i procent przszedłych testów
- **Testy Nieudane** - wymagające uwagi
- **Całkowita Liczba Testów** - pełen przegląd
- **Coverage (Lines)** - procent coverage z podziałem na pliki
- **Pliki Testowe** - stan plików
- **Pomnijte Testy** - testy skipped/pending

### 🎯 Poziom Zaawansowania (Maturity Model 1-5)
Automatycznie obliczany na podstawie:
- **Pass Rate (25%)** - procent przszedłych testów
- **Coverage (25%)** - procent coverage kodu
- **File Health (25%)** - procent plików bez błędów
- **Zero Failures Bonus (25%)** - bonus za zero błędów

**Poziomy:**
1. **Initial (0-40%)** - Początkowe stadium, mało testów
2. **Developing (40-60%)** - Testy w rozwoju, wymaga poprawy
3. **Defined (60-75%)** - Podstawowe testy istnieją
4. **Managed (75-90%)** - Większość testów zautomatyzowana
5. **Optimized (90-100%)** - W pełni zautomatyzowane, regularne przeglądy

### 💚 Health Score (0-100)
Complex metric bazująca na:
- Pass Rate (40% wagi)
- Coverage (30% wagi)
- File Health (20% wagi)
- Failure Count (10% wagi)

**Kolory:**
- 🟢 **90-100**: Excellent
- 🔵 **75-89**: Good
- 🟡 **60-74**: Fair
- 🔴 **0-59**: Poor

### 📁 Kategorie Testów
Automatyczne grupowanie po typie:
- 🪝 **Hooks** - testy hooków (useXxx)
- 🧩 **Components** - komponenty UI
- 💾 **Stores** - Zustand stores
- 🔧 **Services** - serwisy i API
- 🌐 **Context** - React Context
- 🛠️ **Utilities** - funkcje pomocnicze
- 📄 **Pages/Tabs** - widoki i zakładki
- 📦 **Other** - inne

### 📈 Wykresy
1. **Rozkład Testów** - doughnut chart (passed/failed/skipped)
2. **Coverage by Category** - słupki coverage według kategorii
3. **Test Duration** - liniowy wykres czasu testów
4. **Pass Rate Trend** - kołowy wykres pass rate

### 📂 Drzewo Plików
- Posortowane po statusie (błdy pierwsze)
- Kolumny: status, nazwa, passed, failed, duration
- ✅ zielone = wszystkie przeszły
- ❌ czerwone = mają błędy

### ❌ Nieudane Testy
- Lista wszystkich błędów
- Każdy błąd w osobnej karcie
- Szczegóły: plik, test, komunikat błędu

### 📈 Metryki i Wskaźniki
- Test Pass Rate (dokładny %)
- Test Fail Rate (dokładny %)
- Avg Test Duration
- File Pass Rate
- High Coverage Files (≥80%)
- Low Coverage Files (<50%)

## 🚀 Jak Używać

### Szybki Start
```bash
# Uruchom testy i otwórz dashboard
pnpm run dashboard
```

### Ręczne Generowanie
```bash
# 1. Uruchom testy z JSON reporter
npx vitest run --reporter=json --outputFile=reports/vitest-results.json

# 2. Wygeneruj dane dashboardu
pnpm run test:generate

# 3. Otwórz dashboard
pnpm run dashboard:open
```

### Pełny Cycle z Coverage
```bash
pnpm run test:with-report
```

## 📋 Dostępne Komendy

| Komenda | Opis |
|---------|------|
| `pnpm run dashboard` | Testy + generowanie + otwarcie nowego dashboardu |
| `pnpm run dashboard:open` | Otwórz istniejący dashboard |
| `pnpm run test:generate` | Tylko generuj dane |
| `pnpm run test:with-report` | Pełny cycle (testy + report + dashboard) |
| `pnpm run dashboard:legacy` | Otwórz stary dashboard (v1) |

## 📊 Struktura Danych

Dashboard używa pliku `scripts/test-results.json` z taką strukturą:

```json
{
  "timestamp": "2025-04-06T...",
  "summary": {
    "total": 100,
    "passed": 90,
    "failed": 10,
    "skipped": 0,
    "totalFiles": 20,
    "passingFiles": 18,
    "failingFiles": 2
  },
  "files": [
    {
      "file": "src/components/Button.test.tsx",
      "passed": 5,
      "failed": 0,
      "skipped": 0,
      "duration": 120,
      "coverage": 85
    }
  ],
  "failures": [
    {
      "file": "src/hooks/useAuth.test.ts",
      "test": "should login successfully",
      "error": "Expected true to be false",
      "duration": 50
    }
  ],
  "coverage": {
    "lines": 55,
    "statements": 58,
    "functions": 50,
    "branches": 48
  },
  "metadata": {
    "vitestVersion": "4.x",
    "environment": "jsdom",
    "generatedBy": "generate-test-results.js",
    "generatedAt": "2025-04-06T..."
  }
}
```

## 🎨 Personalizacja

### Zmiana Kolorów
Edytuj CSS variables w `scripts/test-dashboard-pro.html`:

```css
:root {
  --primary: #667eea;
  --success: #48bb78;
  --danger: #f56565;
  --warning: #ed8936;
  --info: #4299e1;
  --purple: #9f7aea;
}
```

### Dodanie Nowego Wykresu
1. Dodaj `<canvas id="new-chart">` w HTML
2. Dodaj logikę renderowania w `scripts/dashboard-logic.js`
3. Użyj Chart.js API

### Export Danych
Kliknij przycisk **💾 Export JSON** na dashboardzie aby pobrać dane.

## 🔍 Przykładowe Użycie

### Monitorowanie Postępu Naprawy Testów

```bash
# Przed naprawą
pnpm run dashboard
# Dashboard pokazuje: 150 failed tests, Maturity Level 2/5

# Po naprawie 50 testów
npx vitest run --reporter=json --outputFile=reports/vitest-results.json
pnpm run test:generate
pnpm run dashboard:open
# Dashboard pokazuje: 100 failed tests, Maturity Level 3/5
```

### Analiza Coverage

Dashboard automatycznie pokazuje:
- **Overall coverage** w KPI cards
- **Coverage by category** w wykresach
- **Per-file coverage** w drzewie plików
- **High/Low coverage files** w metrykach

### Identyfikacja Problemów

1. **Sprawdź Failed Tests** - sekcja ❌ na dole
2. **Zidentyfikuj kategorie z niskim coverage** - wykres Coverage by Category
3. **Znajdź najwolniejsze testy** - wykres Test Duration
4. **Określ priority naprawy** - pliki posortowane po statusie

## 🛠️ Troubleshooting

### Dashboard nie pokazuje danych
```bash
# Sprawdź czy plik istnieje
dir scripts\test-results.json

# Wygeneruj ponownie
pnpm run test:generate

# Upewnij się że testy zostały uruchomione z JSON reporter
npx vitest run --reporter=json --outputFile=reports/vitest-results.json
```

### Wykresy się nie ładują
- Sprawdź połączenie internetowe (Chart.js z CDN)
- Otwórz konsolę przeglądarki (F12) i sprawdź błędy
- Odśwież stronę (Ctrl+F5)

### Coverage jest 0%
- Upewnij się że testy zostały uruchomione z coverage:
  ```bash
  npx vitest run --coverage --reporter=json --outputFile=reports/vitest-results.json
  ```
- Sprawdź czy `reports/vitest-results.json` zawiera pole `coverageMap`

### Dashboard wolno się ładuje
- Zmniejsz liczbę plików do analizy
- Wyłącz coverage (wolne przy dużych projektach)
- Użyj trybu offline (wykresy bez CDN)

## 💡 Tips & Tricks

1. **Trzymaj dashboard otwarty w tle** i refreshuj po każdej zmianie
2. **Exportuj JSON** przed i po dużych zmianach aby porównać
3. **Drukuj raport** (🖨️) przed spotkaniami z teamem
4. **Sortuj pliki** po coverage aby znaleźć najsłabsze obszary
5. **Monitoruj Maturity Level** jako wskaźnik postępu projektu

## 📚 Zasoby

- [Chart.js Documentation](https://www.chartjs.org/docs/)
- [Vitest JSON Reporter](https://vitest.dev/config/#reporters)
- [Test Maturity Model](https://www.functionize.com/blog/test-maturity-model/)

---

**Dashboard Pro v2.0** - Stworzony dla VoiceLog Project 🎵
