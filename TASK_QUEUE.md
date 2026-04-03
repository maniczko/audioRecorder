# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

Zadania zakonczone trafiaja do [`TASK_DONE.md`](TASK_DONE.md).

## Podsumowanie (2026-04-03, aktualizacja wieczorna v2)

### CI/CD Status (commit ee334eaa, push 2026-04-03):

- **Optimized CI**: ✅ success
- **Auto-Fix Test Failures**: ✅ success
- **Docker Build**: ✅ success
- **E2E Playwright Tests**: ✅ success
- **Backend Production Smoke**: ✅ success
- **Production Deployment (Vercel)**: ✅ success
- **CI/CD Pipeline**: ⏳ in_progress (coverage thresholds fixed in this push)

### Railway Health Check (2026-04-03 - LIVE)

| Metric       | Value                          | Status  |
| ------------ | ------------------------------ | ------- |
| Status       | ok                             | Healthy |
| Database     | connected                      | OK      |
| Git SHA      | bdfcf557 (STALE! latest=ee334eaa) | ⚠️ Old deploy |
| Memory (RSS) | 114.38 MB                      | Normal  |
| Uptime       | 51s (fresh restart)            | OK      |

### Client Error Endpoint

- `GET /api/client-errors` → `{"count":0,"errors":[]}` — auto-send aktywny, brak błędów klienta

---
## Aktualne Zadania

### DONE (naprawione w tej sesji)

- **GH-PROFILE-MOCK** ✅ — Dodano brakujące eksporty do vi.mock (commit b6693393)
- **GH-DOCKER-PNPM** ✅ — Usunięto pnpm check z Docker runtime (commit b6693393)
- **GH-COVERAGE-LOW** ✅ — Wyrównano progi .js do .ts (55/50/55/48) (commit ee334eaa)
- **GH-CSP-CLARITY** ✅ — Dodano clarity.ms do CSP + guard (commit f3f3dce7)
- **GH-HUSKY-WIN** ✅ — Naprawiono core.hooksPath (.husky/_ → .husky)

### TODO

- **GH-RAILWAY-STALE** - Railway nie wdrożył najnowszego commitu
  - **Status:** todo
  - **Uwaga:** Health endpoint pokazuje gitSha `bdfcf557`, a najnowszy commit to `ee334eaa`
  - **Akcja:** Sprawdź Railway dashboard — czy auto-deploy jest włączony? Czy build się nie powiódł?

- **GH-CLIENT-ERRORS-SILENT** - Auto-send błędów klienta — weryfikacja po Railway deploy
  - **Status:** todo (czeka na Railway redeploy)
  - **Problem:** Railway jest na starym commicie, brak endpointu z nowym kodem
  - **Akcja:** Po Railway redeploy, zweryfikuj na nowym Vercel URL

- **GH-SECURITY-REQUIRE** - Auto Security Patches — `require is not defined in ES module`
  - **Status:** todo (niski priorytet, stary commit)
  - **Error:** `ReferenceError: require is not defined in ES module scope`
  - **Akcja:** Zweryfikuj czy problem nadal występuje po nowych commitach

### BLOCKED (wymaga konfiguracji zewnetrznej)

- **GH-33** - Auto code review/auto-fix workflow ("Remote boom")
  - **Status:** blocked
  - **Error:** Remote workspace bootstrap failed. Error: Remote boom
  - **Blokada:** Brak ANTHROPIC_API_KEY w GitHub Actions Secrets
  - **Akcja:** Dodaj secret ANTHROPIC_API_KEY w GitHub Settings > Secrets > Actions

- **GH-AUTO-VITE** - Missing VITE_* env vars w CI (validate-env.js)
  - **Status:** blocked (by design, non-blocking)
  - **Error:** VITE_DATA_PROVIDER: BRAK, VITE_MEDIA_PROVIDER: BRAK
  - **Uwaga:** Krok ma continue-on-error: true. Nie blokuje CI.
  - **Akcja:** Opcjonalnie dodaj sekrety VITE_* w GitHub Settings > Secrets > Actions

---

## Następne Kroki (priorytet 🔴 → 🟡 → 🟢)

1. 🔴 **GH-RAILWAY-STALE** — sprawdź Railway dashboard, uruchom ręczny redeploy
2. 🟡 **GH-CLIENT-ERRORS-SILENT** — zweryfikuj po Railway redeploy
3. 🟢 **GH-SECURITY-REQUIRE** — zweryfikuj po nowych commitach
4. 🟢 **GH-33** — dodaj ANTHROPIC_API_KEY secret
