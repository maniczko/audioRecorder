# 🚀 Szybki Start - Test Dashboard

## Używanie

### Opcja 1: Jednym komendą (zalecane)
```bash
pnpm run dashboard
```
Uruchomi testy wygeneruje raport i otworzy dashboard.

### Opcja 2: Ręcznie
```bash
# 1. Uruchom testy
npx vitest run --reporter=json --outputFile=reports/vitest-results.json

# 2. Wygeneruj dane
pnpm run test:generate

# 3. Otwórz dashboard
pnpm run dashboard:open
```

### Opcja 3: PowerShell (Windows)
```powershell
.\scripts\run-dashboard.ps1
```

## Co Widzisz na Dashboardzie

### 📊 Karty Statystyk
- **Total Tests** - Całkowita liczba testów
- **Passed** - Przszedłe testy (zielone)
- **Failed** - Nieudane testy (czerwone)
- **Skipped** - Pominięte testy (pomarańczowe)

### 📈 Wykresy
- **Test Distribution** - Doughnut wykres pokazujący proporcje
- **Coverage by Category** - Słupki coverage frontend vs backend

### ❌ Lista Błędów
- Wszystkie nieudane testy z komunikatami błędów
- Kliknij aby zobaczyć szczegóły

### 📁 Drzewa Plików
- Wszystkie pliki testowe posortowane po statusie
- ❌ czerwone - mają nieudane testy
- ✅ zielone - wszystkie przeszły

## Refreshowanie Dashboardu

Po każdym uruchomieniu testów:

```bash
# Kliknij przycisk "Refresh" na dashboardzie
# LUB uruchom ponownie:
pnpm run dashboard
```

## Przykładowe Komendy

```bash
# Testuj jeden plik i odśwież dashboard
npx vitest run src/hooks/useUI.test.ts --reporter=json --outputFile=reports/vitest-results.json
pnpm run test:generate
pnpm run dashboard:open

# Testuj wszystko i pokaż dashboard
pnpm run test:with-report

# Tylko otwórz istniejący dashboard
pnpm run dashboard:open
```

## Dashboard nie działa?

```bash
# Sprawdź czy plik z danymi istnieje
dir scripts\test-results.json

# Wygeneruj ponownie
pnpm run test:generate

# Otwórz ręcznie
start scripts\test-dashboard.html
```

## Tip 💡

Trzymaj dashboard otwarty w tle i refreshuj po każdej większej zmianie aby widzieć postęp!

---

**Miłego testowania! 🧪✨**
