# 🐛 Fix: Dashboard CORS Issue

## Problem
Dashboard pokazywał "Brak Danych Testowych" mimo że plik `test-results.json` istniał i miał dane.

## Przyczyna
Gdy otwierasz plik HTML lokalnie (`file://C:/Users/.../test-dashboard-pro.html`), przeglądarka **blokuje żądania `fetch()`** do innych plików lokalnych z powodów bezpieczeństwa (CORS policy).

```
❌ BŁĄD: Access to fetch at 'file:///.../test-results.json' 
   from origin 'null' has been blocked by CORS policy
```

## Rozwiązanie

### 1. Osadzone Dane JavaScript
Zamiast ładować dane przez `fetch()`, generator teraz tworzy **plik JavaScript** (`test-results.js`) który osadza dane bezpośrednio w zmiennej globalnej:

```javascript
// scripts/test-results.js (auto-generated)
window.TEST_DATA = {
  "timestamp": "2026-04-06T...",
  "summary": { "total": 1477, "passed": 1411, ... },
  "files": [...],
  ...
};
```

### 2. Dashboard Logic Updated
`dashboard-logic.js` teraz sprawdza najpierw osadzone dane:

```javascript
async function loadDashboard() {
  // Try embedded data first (avoids CORS)
  if (window.TEST_DATA) {
    dashboardData = window.TEST_DATA;
    renderDashboard(dashboardData);
    return;
  }
  
  // Fallback: fetch (works on HTTP server)
  try {
    const response = await fetch('test-results.json');
    ...
  }
}
```

### 3. HTML Updated
Dashboard HTML ładuje plik JS przed logiką:

```html
<script>
  window.TEST_DATA = null;
</script>
<script src="test-results.js"></script>
<script src="dashboard-logic.js"></script>
```

## Jak To Działa Teraz

```
1. pnpm run test:with-report
   ├─ Runs tests → reports/vitest-results.json
   └─ Generates:
      ├─ scripts/test-results.json (raw data)
      └─ scripts/test-results.js (embedded JS)

2. Dashboard opens:
   ├─ Loads test-results.js (no CORS issues!)
   ├─ window.TEST_DATA is populated
   └─ Dashboard renders with data ✅
```

## Dlaczego To Lepiej?

| Metoda | CORS | Speed | Compatibility |
|--------|------|-------|---------------|
| `fetch()` z `file://` | ❌ Blokuje | Fast | Poor |
| Osadzone JS | ✅ Nie ma problemu | Fastest | Excellent |
| HTTP Server | ✅ OK | Fast | Good |

## Alternatywne Rozwiązania

Jeśli chcesz używać `fetch()`, możesz:

### Opcja 1: Local HTTP Server
```bash
# Install http-server
npm install -g http-server

# Serve dashboard
http-server scripts -p 8080

# Open
http://localhost:8080/test-dashboard-pro.html
```

### Opcja 2: VS Code Live Server
1. Install "Live Server" extension
2. Right-click `test-dashboard-pro.html`
3. "Open with Live Server"

### Opcja 3: Python Server
```bash
cd scripts
python -m http.server 8000
# Open http://localhost:8000/test-dashboard-pro.html
```

## Pliki Zmienione

1. **`scripts/test-dashboard-pro.html`**
   - Dodano `<script src="test-results.js">` przed `dashboard-logic.js`
   - Dodano `window.TEST_DATA = null` placeholder

2. **`scripts/dashboard-logic.js`**
   - `loadDashboard()` sprawdza `window.TEST_DATA` przed `fetch()`
   - Fallback na fetch jeśli osadzone dane nie dostępne

3. **`scripts/generate-test-results.js`**
   - Generuje teraz DWA pliki:
     - `test-results.json` (raw data)
     - `test-results.js` (embedded JS z `window.TEST_DATA`)

## Weryfikacja

Dashboard działa poprawnie gdy:
- ✅ Widzisz KPI cards z danymi
- ✅ Wykresy są renderowane
- ✅ Drzewo plików pokazuje 111 plików
- ✅ Maturity Level i Health Score są widoczne

Dashboard NIE działa gdy:
- ❌ Widzisz "Brak Danych Testowych"
- ❌ Sprawdź konsolę (F12) po błędy CORS
- ❌ Upewnij się że `test-results.js` istnieje w `scripts/`

## Next Time

Jeśli dashboard znowu pokaże "Brak Danych":

```bash
# Regenerate data
pnpm run test:generate

# Reopen dashboard
pnpm run dashboard:open

# Check if test-results.js exists
dir scripts\test-results.js
```

---

**Status:** ✅ Fixed  
**Date:** 2026-04-06  
**Impact:** Dashboard now works perfectly when opened directly from filesystem
