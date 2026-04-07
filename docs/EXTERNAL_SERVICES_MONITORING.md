# 🌐 External Services Monitoring - Instrukcja

## Co To Jest?

Dashboard teraz zawiera sekcję **"External Services Status"** która monitoruje stan 4 kluczowych usług:

1. **🐙 GitHub Actions** - CI/CD workflow status
2. **🔴 Sentry** - Error tracking configuration
3. **🚂 Railway** - Backend deployment status
4. **▲ Vercel** - Frontend deployment status

## Jak To Działa?

### 1. GitHub Actions
- **Z GITHUB_TOKEN**: Łączy się z GitHub API i pobiera ostatnie workflow runs
- **Bez tokenu**: Pokazuje listę lokalnych workflow plików (.github/workflows/*.yml)
- **Metryki:**
  - Liczba workflow
  - Success rate (%)
  - Ostatni run

### 2. Sentry
- Sprawdza czy `SENTRY_DSN` jest skonfigurowany w .env
- Pokazuje status konfiguracji
- **Metryki:**
  - DSN Configured (Yes/No)
  - API Access status

### 3. Railway
- Sprawdza czy railway.json/railway.toml istnieje
- Sprawdza czy `RAILWAY_TOKEN` jest ustawiony
- **Metryki:**
  - Token Configured
  - Deployment status

### 4. Vercel
- Odczytuje vercel.json
- Sprawdza czy `VERCEL_TOKEN` jest ustawiony
- **Metryki:**
  - Project name
  - Framework

## Konfiguracja dla Live Data

### GitHub Actions (Recommended)
```bash
# Create GitHub Personal Access Token
# https://github.com/settings/tokens
# Permissions: Actions (read)

# Add to .env
GITHUB_TOKEN=ghp_your_token_here
GITHUB_OWNER=your_username
GITHUB_REPO=audioRecorder
```

### Sentry (Optional)
```bash
# Already configured if SENTRY_DSN exists in .env
# For error stats, add auth token:
SENTRY_AUTH_TOKEN=your_sentry_token
```

### Railway (Optional)
```bash
# Get token from Railway dashboard
# https://railway.app/account/tokens
RAILWAY_TOKEN=your_railway_token
```

### Vercel (Optional)
```bash
# Get token from Vercel dashboard
# https://vercel.com/account/tokens
VERCEL_TOKEN=your_vercel_token
VERCEL_PROJECT_ID=your_project_id
```

## Używanie

### Automatycznie z Testami
```bash
# Pełny cycle: testy + monitoring + dashboard
pnpm run test:with-report
```

### Tylko Monitoring
```bash
# Generuj dane z usług zewnętrznych
pnpm run services:monitor

# Otwórz dashboard
pnpm run dashboard:open
```

### Ręcznie
```bash
# 1. Uruchom monitoring
node scripts/monitor-external-services.js

# 2. Dashboard automatycznie załaduje dane
start scripts/test-dashboard-pro.html
```

## Co Widzisz na Dashboardzie?

### Karty Usług

Każda usługa ma:
- **Status Badge** - kolorowy indicator stanu
  - 🟢 Connected - pełne połączenie API
  - 🔵 Configured - skonfigurowane ale bez API
  - 🟡 Local Only - tylko lokalne pliki
  - 🔴 Not Configured - brak konfiguracji

- **Metryki** - 2-4 key metrics w kafelkach
- **Note** - wskazówki jak poprawić konfigurację (jeśli potrzebne)

### Przykładowy Widok

```
┌─────────────────────────────────────────┐
│ 🐙 GitHub Actions          ◐ Local Only │
├─────────────────────────────────────────┤
│ Workflows:    22                        │
│ Success Rate: N/A                       │
│                                         │
│ 💡 Set GITHUB_TOKEN to get live status  │
└─────────────────────────────────────────┘
```

## Pliki Generowane

1. **`scripts/external-services.json`** - Raw JSON data
2. **`scripts/external-services.js`** - Embedded JS (`window.EXTERNAL_SERVICES_DATA`)
3. **`scripts/test-results.json`** - Merged with test data
4. **`scripts/test-results.js`** - Embedded JS for dashboard

## Troubleshooting

### GitHub Actions Shows "Local Only"
**Problem:** Dashboard nie pokazuje live status GitHub Actions  
**Rozwiązanie:**
```bash
# 1. Create token
# Go to: https://github.com/settings/tokens
# Create token with "Actions" read permission

# 2. Add to .env
echo "GITHUB_TOKEN=ghp_your_token" >> .env
echo "GITHUB_OWNER=your_username" >> .env
echo "GITHUB_REPO=audioRecorder" >> .env

# 3. Re-run monitoring
pnpm run services:monitor
```

### Sentry Shows "Not Configured"
**Problem:** Sentry nie jest wykrywany  
**Rozwiązanie:**
```bash
# Add to .env
echo "SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx" >> .env

# Re-run
pnpm run services:monitor
```

### Dashboard Nie Pokazuje Danych
**Problem:** Sekcja "External Services" jest pusta  
**Rozwiązanie:**
```bash
# Check if file exists
dir scripts\external-services.js

# Regenerate
pnpm run services:monitor

# Refresh dashboard
pnpm run dashboard:open
```

## Integration with CI

Możesz dodać monitoring do GitHub Actions:

```yaml
name: Test Dashboard
on:
  push:
    branches: [main]

jobs:
  test-and-monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Tests
        run: pnpm run test:with-report
      
      - name: Monitor Services
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: pnpm run services:monitor
      
      - name: Upload Dashboard
        uses: actions/upload-artifact@v3
        with:
          name: test-dashboard
          path: |
            scripts/test-dashboard-pro.html
            scripts/test-results.js
            scripts/external-services.js
```

## API Limits

| Service | Rate Limit | Notes |
|---------|-----------|-------|
| GitHub | 5000 req/hr | With token |
| Sentry | 1000 req/hr | With auth token |
| Railway | Varies | With token |
| Vercel | Varies | With token |

Bez tokenów, dashboard używa fallback data z lokalnych plików (no API calls).

## Future Enhancements

- [ ] Live deployment status from Railway API
- [ ] Recent error count from Sentry API
- [ ] Vercel deployment history
- [ ] GitHub Actions workflow trend graph
- [ ] Slack notifications on service status change
- [ ] Historical status tracking

---

**Dashboard Pro v2.0** - External Services Monitoring 🌐
