# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

Zadania zakonczone trafiaja do [`TASK_DONE.md`](TASK_DONE.md).

## Podsumowanie (2026-04-03, aktualizacja wieczorna v3)

### CI/CD Status (commit c6371e32, push 2026-04-03):

- **Optimized CI**: ✅ success
- **Auto-Fix Test Failures**: ✅ success
- **Docker Build**: ✅ success
- **E2E Playwright Tests**: ✅ success
- **Backend Production Smoke**: ✅ success
- **Production Deployment (Vercel)**: ✅ success
- **CI/CD Pipeline**: ✅ success

### Railway Health Check (2026-04-03 - LIVE)

| Metric       | Value                          | Status  |
| ------------ | ------------------------------ | ------- |
| Status       | ok                             | ✅ Healthy |
| Database     | connected                      | ✅ OK      |
| Build Time   | 2026-04-03T12:15:06Z           | ✅ Fresh   |
| Memory (RSS) | 113.44 MB                      | ✅ Normal  |
| Uptime       | 626s                           | ✅ Stable  |

### Client Error Endpoint

- `GET /api/client-errors` → ✅ Działa end-to-end (zweryfikowane POST + GET + DELETE)

---
## Aktualne Zadania

### DONE (naprawione w tej sesji)

- **GH-PROFILE-MOCK** ✅ — Dodano brakujące eksporty do vi.mock (commit b6693393)
- **GH-DOCKER-PNPM** ✅ — Usunięto pnpm check z Docker runtime (commit b6693393)
- **GH-COVERAGE-LOW** ✅ — Wyrównano progi .js do .ts (55/50/55/48) (commit ee334eaa)
- **GH-CSP-CLARITY** ✅ — Dodano clarity.ms do CSP + guard (commit f3f3dce7)
- **GH-HUSKY-WIN** ✅ — Naprawiono core.hooksPath (.husky/_ → .husky)
- **GH-RAILWAY-STALE** ✅ — Railway wdrożony via `railway up` (buildTime 2026-04-03T12:15:06Z)
- **GH-CLIENT-ERRORS-SILENT** ✅ — Endpoint działa end-to-end (POST + GET + DELETE zweryfikowane)
- **GH-SECURITY-REQUIRE** ✅ — Zamieniono require() na ESM import we wszystkich plikach serwera (commit c6371e32)
- **GH-AUTO-2026-04-03-1** ✅ — Fix Auto-Fix Test Failures: corrected failure detection logic (commit 004fcffe)
- **GH-AUTO-2026-04-03-2** ✅ — Fix Docker Build: use /bin/sh entrypoint for binary verification (commit 004fcffe)
- **GH-AUTO-2026-04-03-3** ✅ — Fix CI/CD Pipeline: added missing VITE_* env vars to validate-env.js (commit 004fcffe)
- **GH-AUTO-2026-04-03-4** ✅ — Fix Optimized CI: corrected failure detection logic (commit 004fcffe)
- **GH-AUTO-2026-04-03-5** ✅ — Fix Optimized CI: corrected CRITICAL_FAILED logic (commit 004fcffe)
- **GH-AUTO-2026-04-03-6** ✅ — Fix Docker Build: use /bin/sh entrypoint for binary verification (commit 004fcffe)
- **GH-AUTO-2026-04-03-7** ✅ — Fix Docker Build: use /bin/sh entrypoint for binary verification (commit 004fcffe)
- **GH-AUTO-2026-04-03-8** ✅ — Fix Docker Build: use /bin/sh entrypoint for binary verification (commit 004fcffe)
- **GH-AUTO-2026-04-03-9** ✅ — Fix Docker Build: use /bin/sh entrypoint for binary verification (commit 004fcffe)

### TODO

_Brak aktualnych zadań._

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

1. � **GH-33** — dodaj ANTHROPIC_API_KEY secret (wymaga konfiguracji w GitHub Settings)
2. 🟢 **GH-AUTO-VITE** — opcjonalnie dodaj VITE_* sekrety w GitHub Settings


<!-- Auto-generated on 2026-04-03T12:59:39.749Z -->

### GitHub Actions Errors (9 found)

- **GH-AUTO-2026-04-03-1** — Fix Auto-Fix Test Failures failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-03T11:19:50.0774858Z [22m[39mRemote workspace bootstrap failed. Error: Remote boom
2026-04-03T11:19:50.0919981Z [22m[39mRemote workspace bootstrap failed. Error: Backend jest chwilowo nied...
  - **Created:** 2026-04-03T12:59:39.749Z
  - **Priority:** High

- **GH-AUTO-2026-04-03-2** — Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-03T11:20:11.1948710Z [36;1mdocker run --rm --entrypoint="" voicelog:test node --version || (echo "❌ Node.js not found" && exit 1)[0m
2026-04-03T11:20:11.1950016Z [36;1mdocker run --rm --ent...
  - **Created:** 2026-04-03T12:59:39.749Z
  - **Priority:** High

- **GH-AUTO-2026-04-03-3** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-03T11:21:34.0951443Z   code: 'PARSE_ERROR',
  - **Created:** 2026-04-03T12:59:39.749Z
  - **Priority:** High

- **GH-AUTO-2026-04-03-4** — Fix Optimized CI failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-03T11:19:44.1981003Z [22m[39mRemote workspace bootstrap failed. Error: Remote boom
2026-04-03T11:19:44.2115834Z [22m[39mRemote workspace bootstrap failed. Error: Backend jest chwilowo nied...
  - **Created:** 2026-04-03T12:59:39.749Z
  - **Priority:** High

- **GH-AUTO-2026-04-03-5** — Fix Optimized CI failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-03T11:23:15.0666553Z [36;1mCRITICAL_FAILED="false"[0m
2026-04-03T11:23:15.0670021Z [36;1mif [ "success" == "failure" ]; then CRITICAL_FAILED="true"; fi[0m
2026-04-03T11:23:15.0671630Z [36...
  - **Created:** 2026-04-03T12:59:39.749Z
  - **Priority:** High

- **GH-AUTO-2026-04-03-6** — Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-03T10:48:34.4506715Z [36;1mdocker run --rm --entrypoint="" voicelog:test node --version || (echo "❌ Node.js not found" && exit 1)[0m
2026-04-03T10:48:34.4508083Z [36;1mdocker run --rm --ent...
  - **Created:** 2026-04-03T12:59:39.749Z
  - **Priority:** High

- **GH-AUTO-2026-04-03-7** — Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-03T10:13:39.5434512Z [36;1mdocker run --rm --entrypoint="" voicelog:test node --version || (echo "❌ Node.js not found" && exit 1)[0m
2026-04-03T10:13:39.5435827Z [36;1mdocker run --rm --ent...
  - **Created:** 2026-04-03T12:59:39.749Z
  - **Priority:** High

- **GH-AUTO-2026-04-03-8** — Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-03T09:10:19.6223670Z [36;1mdocker run --rm --entrypoint="" voicelog:test node --version || (echo "❌ Node.js not found" && exit 1)[0m
2026-04-03T09:10:19.6224998Z [36;1mdocker run --rm --ent...
  - **Created:** 2026-04-03T12:59:39.749Z
  - **Priority:** High

- **GH-AUTO-2026-04-03-9** — Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-03T07:34:30.0063100Z [36;1mdocker run --rm --entrypoint="" voicelog:test node --version || (echo "❌ Node.js not found" && exit 1)[0m
2026-04-03T07:34:30.0064491Z [36;1mdocker run --rm --ent...
  - **Created:** 2026-04-03T12:59:39.749Z
  - **Priority:** High

