# 🌐 Monitoring Zewnętrznych Usług - Szybki Start (PL)

## Co Dostałeś?

Dashboard teraz ma **nową sekcję** na dole która pokazuje status 4 usług:

### 1. 🐙 GitHub Actions
- Ile masz workflow (22 pliki .yml)
- Success rate (potrzebny token dla live danych)
- Status: ◐ Local Only (bo brak tokenu)

### 2. 🔴 Sentry
- Czy masz skonfigurowany DSN
- Status API access
- Status: ○ Not Configured (brak SENTRY_DSN w .env)

### 3. 🚂 Railway
- Czy masz token
- Status deployment
- Status: ◐ Config-only (masz railway.json ale brak tokenu)

### 4. ▲ Vercel
- Nazwa projektu
- Framework (Vite)
- Status: ● Configured (masz vercel.json!)

## Jak Używać?

### Najszybciej:
```bash
pnpm run test:with-report
```
To uruchomi:
1. ✅ Testy (1477 testów)
2. ✅ Coverage report
3. ✅ Monitoring usług zewnętrznych
4. ✅ Otworzy dashboard

### Tylko Dashboard z Usługami:
```bash
# Generuj dane
pnpm run services:monitor

# Otwórz dashboard
pnpm run dashboard:open
```

## Co Widzisz na Dashboardzie?

### Na Samej Górze:
- KPI z testami (passed, failed, coverage)
- Maturity Level (4/5)
- Health Score (~85-90)

### W Środku:
- 4 wykresy
- Kategorie testów
- Drzewo plików (111 plików)

### Na Dole - **NOWE**:
- **External Services Status** - 4 karty:
  - GitHub Actions
  - Sentry
  - Railway
  - Vercel

## Statusy Kolorowe:

| Kolor | Znaczenie | Przykład |
|-------|-----------|----------|
| 🟢 Zielony | Connected - pełne API | GitHub z tokenem |
| 🔵 Niebieski | Configured - skonfigurowane | Vercel z vercel.json |
| 🟡 Pomarańczowy | Local Only - tylko pliki | GitHub bez tokenu |
| 🔴 Czerwony | Not Configured | Sentry bez DSN |

## Jak Dostać Live Dane?

### GitHub Actions (Najważniejsze!)
```bash
# 1. Stwórz token:
# https://github.com/settings/tokens
# Wybierz: Actions (read)

# 2. Dodaj do .env:
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
GITHUB_OWNER=twoj_username
GITHUB_REPO=audioRecorder

# 3. Uruchom:
pnpm run services:monitor
```

Teraz GitHub Actions pokaże:
- ✅ Ostatnie workflow runs
- ✅ Success rate (np. 95%)
- ✅ Czas trwania
- ✅ Linki do runs

### Sentry (Opcjonalnie)
```bash
# Jeśli masz Sentry, dodaj do .env:
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

### Railway (Opcjonalnie)
```bash
# Token z Railway:
# https://railway.app/account/tokens
RAILWAY_TOKEN=xxxxxxxxx
```

### Vercel (Opcjonalnie)
```bash
# Token z Vercel:
# https://vercel.com/account/tokens
VERCEL_TOKEN=xxxxxxxxx
```

## Bez Tokenów - Co Dostajesz?

Nawet bez tokenów dashboard pokazuje **użyteczne informacje**:

✅ **GitHub Actions:**
- Lista 22 workflow plików
- Nazwy: ci.yml, preview.yml, etc.

✅ **Vercel:**
- Project name: "audioRecorder"
- Framework: "vite"

✅ **Railway:**
- Info że railway.json istnieje

✅ **Sentry:**
- Info czy DSN jest w .env

## Przykład Użycia na Co Dzień

### Rano po przyjściu do pracy:
```bash
pnpm run dashboard
```
Patrzysz na:
1. Czy wszystkie testy przeszły? ✅
2. Jaki jest Maturity Level? 🎯
3. Czy GitHub Actions działa? 🐙
4. Czy Vercel/Railway są OK? ▲🚂

### Po Push do GitHub:
```bash
# Poczekaj 5 min na CI
# Potem:
pnpm run services:monitor
pnpm run dashboard:open
```
Sprawdzasz:
- Czy workflow przeszedł?
- Jaki success rate?
- Czy deployment się udał?

### Przed Meetingiem z Teamem:
```bash
pnpm run test:with-report
```
Dashboard gotowy do pokazania:
- ✅ 1477 testów
- ✅ 59% coverage
- ✅ 0 failed
- ✅ Status wszystkich usług

## Troubleshooting

### Dashboard pokazuje "No external services data"
```bash
# Uruchom monitoring
pnpm run services:monitor

# Sprawdź czy plik powstał
dir scripts\external-services.js
```

### GitHub nie pokazuje success rate
```bash
# Potrzebujesz tokenu
# Dodaj GITHUB_TOKEN do .env
pnpm run services:monitor
```

### Sentry nie jest wykrywany
```bash
# Sprawdź .env
findstr "SENTRY_DSN" .env

# Jeśli brak, dodaj (opcjonalnie)
```

## Pliki

| Plik | Co Robi |
|------|---------|
| `scripts/monitor-external-services.js` | Skrypt do zbierania danych |
| `scripts/external-services.json` | Raw data |
| `scripts/external-services.js` | Dane dla dashboardu |
| `scripts/test-dashboard-pro.html` | Dashboard z sekcją usług |

## Komendy - Podsumowanie

```bash
# Wszystko naraz
pnpm run test:with-report

# Tylko monitoring
pnpm run services:monitor

# Dashboard
pnpm run dashboard
pnpm run dashboard:open

# Same testy
pnpm run test:generate
```

---

**Miłego Monitorowania! 🌐✨**

Dashboard Pro v2.0 - VoiceLog Project
