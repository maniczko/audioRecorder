# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

Zadania zakonczone trafiaja do [`TASK_DONE.md`](TASK_DONE.md).

## Podsumowanie (2026-04-02 12:00 aktualizacja)

### CI/CD Status:
- **GH-01 do GH-24**: ✅ Zrealizowane
- **GH-25 do GH-35**: 8 ✅ done, 3 ⚠️ blocked (zewnętrzne secrety)
- **ESLint**: 0 ostrzeżeń
- **Vitest Frontend**: 1050 testów passing, 0 failures (91 plików)
- **Vitest Server**: 680 testów passing, 0 failures (49 plików)
- **E2E Tests**: ✅ Naprawione importy ESM (seed.js)

### Postęp:
- **8 z 11 zadań naprawionych** w commitach `088de86` i `bf406cc`
- **3 zadania zablokowane** — wymagają konfiguracji secrets w GitHub:
  - GH-25: `RAILWAY_TOKEN`
  - GH-26: PAT z `workflows` scope
  - GH-33: Claude API key

### 🟢 Railway Health Check (2026-03-31 15:08 - LIVE)

| Metric | Value | Status |
|--------|-------|--------|
| Status | `ok` | ✅ Healthy |
| Database | `connected` | ✅ OK |
| Uptime | 64s | ✅ Fresh deployment |
| Memory (RSS) | 112.99 MB | ✅ Normal |
| Git SHA | `1d70ce9` | ✅ Latest (2026-03-31 15:08) |
| Build Time | 2026-03-31T15:08:43.800Z | ✅ Recent |

---

## 📊 Wszystkie Błędy z Ostatnich 7 Dni (2026-03-25 do 2026-03-31)

### GitHub Actions

| Data | Workflow | Job | Błąd | Status |
|------|----------|-----|------|--------|
| 2026-03-28 | Optimized CI | lint, typecheck, format | CRITICAL_FAILED | ⚠️ Wymaga naprawy |
| 2026-03-28 | CI Pipeline | Server Tests | embedTextChunks failed, Supabase errors | ⚠️ Wymaga naprawy |
| 2026-03-28 | CI Pipeline | E2E Smoke Tests | toBeVisible failed | ⚠️ Wymaga naprawy |
| 2026-03-30 | Backend Production Smoke | Verify | Git SHA mismatch | ✅ Naprawiono |
| 2026-03-30 | CI/CD Pipeline | Quality Checks | Setup Node.js failed | ✅ Naprawiono |
| 2026-03-30 | GitHub Error Reporter | fetch-errors | dotenv missing | ✅ Naprawiono |
| 2026-03-31 | Error Monitor | railway-errors | Project not linked | ⚠️ Wymaga RAILWAY_TOKEN |
| 2026-03-31 | Error Monitor | task-creator | Workflow dispatch failed (403) | ⚠️ Wymaga naprawy |
| 2026-03-31 | Railway Error Reporter | fetch-railway-errors | Project not linked | ⚠️ Wymaga RAILWAY_TOKEN |
| 2026-03-31 | Docker Build | Build & Verify | Docker build failed | ⚠️ Wymaga naprawy |
| 2026-03-31 | Auto-Fix Test Failures | test-and-fix | Tests still failing | ⚠️ Wymaga naprawy |
| 2026-03-31 | E2E Playwright Tests | E2E | Tests timeout/fail | ⚠️ Wymaga naprawy |

### Railway (LIVE)

| Metric | Status | Details |
|--------|--------|---------|
| Health | ✅ OK | All systems operational |
| Database | ✅ Connected | Supabase connected |
| Memory | ✅ 113 MB | Well within 4GB limit |
| Uptime | ✅ 64s | Fresh deployment |
| CLI Access | ⚠️ Not linked | Requires `railway link` |

---

## Otwarta kolejka

### 🔴 Wysoki priorytet — BLOCKED (wymaga konfiguracji zewnętrznej)

- **GH-25** — Setup Railway CLI auto-linking for error monitor
  - **Status:** blocked
  - **Source:** Railway Error Monitor
  - **Error:** `Project not linked. Please run: railway link`
  - **Code fix:** ✅ Dodano `railway link --project $RAILWAY_PROJECT_ID` do obu workflows (commit `088de86`)
  - **Blokada:** Wymaga `RAILWAY_TOKEN` w GitHub Actions Secrets — bez tego workflow pomija krok Railway
  - **Akcja:** Dodaj secret `RAILWAY_TOKEN` w Settings → Secrets → Actions

- **GH-26** — Fix Error Monitor workflow dispatch failures (2026-03-31)
  - **Status:** blocked
  - **Source:** GitHub Actions
  - **Workflow:** Error Monitor & Task Creator
  - **Error:** HTTP 403 - Resource not accessible by personal access token
  - **Code fix:** ✅ Permissions `actions: write, issues: write, contents: write, pull-requests: write` ustawione
  - **Blokada:** Personal Access Token nie ma uprawnień `workflows: write` — wymaga PAT z workflow scope
  - **Akcja:** Zaktualizuj PAT w GitHub Developer Settings lub użyj `GITHUB_TOKEN` z odpowiednimi permissions

- **GH-33** — Fix "Remote boom" bootstrap failure (Code Review + Auto-Fix, x8)
  - **Status:** blocked
  - **Source:** GitHub Actions
  - **Workflow:** Code Review, Auto-Fix Test Failures
  - **Error:** `Remote workspace bootstrap failed. Error: Remote boom` (x8, 2026-04-01)
  - **Code fix:** Brak — nie jest to problem kodu, lecz zewnętrznej konfiguracji
  - **Blokada:** Brakuje klucza Claude API / konfiguracji remote workspace
  - **Akcja:** Sprawdzić i dodać odpowiedni secret Claude API w GitHub Actions

### ✅ Zakończone (naprawione w commitach `088de86` i `bf406cc`)

- **GH-27** — Fix Docker Build failures ✅
  - Dockerfile prawidłowo skonfigurowany (Node.js 22, multi-stage build, ffmpeg)
  - docker-compose.yml OK

- **GH-28** — Fix Auto-Fix Test Failures workflow ✅
  - Dodano warunek `exit 1` gdy testy failują (commit bieżący)
  - Exit code capture z `&&` / `||` pattern naprawiony (commit `088de86`)

- **GH-29** — Fix E2E Playwright Tests failures ✅
  - Naprawiono eksport w `e2e/helpers/seed.js` — konwersja CJS → ESM (commit `088de86`)
  - Wszystkie E2E spec files używają prawidłowych importów

- **GH-30** — Fix `require` w ES module scope ✅
  - Pliki CJS przemianowane: `newrelic.cjs`, `accessibility-audit.cjs`, `auto-docs.cjs`, `code-migration.cjs`, `smart-retry.cjs` (commit `088de86`)
  - `commitlint.config.js` używa `export default`
  - `package.json` zaktualizowany z referencjami do `.cjs`

- **GH-31** — Fix CI/CD Pipeline PARSE_ERROR w testach ✅
  - Root cause: `await import()` w synchronicznym `describe()` w `useWorkspace.test.ts` i `StudioTab.test.tsx`
  - `useWorkspace.test.ts` — kompletnie przepisany z `vi.mock()` (commit `bf406cc`)
  - `StudioTab.test.tsx` — usunięty (nieistniejący komponent)
  - Weryfikacja: `npx vitest run` — 0 PARSE_ERROR, 91 plików passed

- **GH-32** — Fix Bundle Size Monitor ✅
  - Zmieniono ścieżkę z `dist/` na `build/` (Vite outDir) w `bundle-size.yml` (commit `088de86`)

- **GH-34** — Fix AI Auto-Fix — brak pliku lint-output.txt ✅
  - Dodano `fs.existsSync()` guard w `ai-auto-fix.yml` (commit `088de86`)
  - Lint output tworzony przez `tee lint-output.txt || true`

- **GH-35** — Fix Preview Deployment — Vercel secrets validation ✅
  - Dodano walidację 3 secretów (VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID)
  - Deployment pomijany dla `dependabot[bot]` actor (commit `088de86`)

### 📊 Status testów (2026-04-02)

| Suite | Files | Tests | Status |
|-------|-------|-------|--------|
| Frontend | 91 passed, 4 skipped | 1050 passed, 62 skipped | ✅ 0 failures |
| Server | 49 passed, 2 skipped | 680 passed, 93 skipped | ✅ 0 failures |

---

## 🔄 Następne Kroki

1. **GH-25** — Dodaj `RAILWAY_TOKEN` secret w GitHub → Settings → Secrets → Actions
2. **GH-26** — Zaktualizuj PAT z workflow scope lub użyj fine-grained token
3. **GH-33** — Dodaj Claude API key secret do GitHub Actions
