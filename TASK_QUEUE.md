# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

Zadania zakonczone trafiaja do [`TASK_DONE.md`](TASK_DONE.md).

## Podsumowanie (2026-04-03, aktualizacja po naprawie CI/CD)

### CI/CD Status (commit 40e52a7c, push 2026-04-03):

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

1. 🔴 **GH-33** — dodaj ANTHROPIC_API_KEY secret (wymaga konfiguracji w GitHub Settings)
2. 🟢 **GH-AUTO-VITE** — opcjonalnie dodaj VITE_* sekrety w GitHub Settings


<!-- Auto-generated on 2026-04-04T06:58:35.854Z -->

### GitHub Actions Errors (10 found)

- **GH-AUTO-2026-04-04-1** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-04T06:55:18.3264082Z [31m❌ VITE_GOOGLE_CLIENT_ID: BRAK (Google OAuth Client ID)[0m
2026-04-04T06:55:18.3268350Z [31m❌ VOICELOG_API_PORT: BRAK (Port API)[0m
2026-04-04T06:55:18.3269134Z [3...
  - **Created:** 2026-04-04T06:58:35.854Z
  - **Priority:** High

- **GH-AUTO-2026-04-04-2** — Fix Auto-Fix Test Failures failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-04T06:55:48.1555460Z [22m[39mRemote workspace bootstrap failed. Error: Remote boom
2026-04-04T06:55:48.1683138Z [22m[39mRemote workspace bootstrap failed. Error: Backend jest chwilowo nied...
  - **Created:** 2026-04-04T06:58:35.854Z
  - **Priority:** High

- **GH-AUTO-2026-04-04-3** — Fix Optimized CI failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** Job "format" step "Check formatting" failed
  - **Created:** 2026-04-04T06:58:35.854Z
  - **Priority:** High

- **GH-AUTO-2026-04-04-4** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-04T06:50:18.4179089Z [31m❌ VITE_GOOGLE_CLIENT_ID: BRAK (Google OAuth Client ID)[0m
2026-04-04T06:50:18.4183678Z [31m❌ VOICELOG_API_PORT: BRAK (Port API)[0m
2026-04-04T06:50:18.4184448Z [3...
  - **Created:** 2026-04-04T06:58:35.854Z
  - **Priority:** High

- **GH-AUTO-2026-04-04-5** — Fix Auto-Fix Test Failures failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-04T06:50:52.0687762Z [22m[39mRemote workspace bootstrap failed. Error: Remote boom
2026-04-04T06:50:52.0795270Z [22m[39mRemote workspace bootstrap failed. Error: Backend jest chwilowo nied...
  - **Created:** 2026-04-04T06:58:35.854Z
  - **Priority:** High

- **GH-AUTO-2026-04-04-6** — Fix Optimized CI failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** Job "format" step "Check formatting" failed
  - **Created:** 2026-04-04T06:58:35.854Z
  - **Priority:** High

- **GH-AUTO-2026-04-04-7** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-04T06:45:31.4492881Z [31m❌ VITE_GOOGLE_CLIENT_ID: BRAK (Google OAuth Client ID)[0m
2026-04-04T06:45:31.4496789Z [31m❌ VOICELOG_API_PORT: BRAK (Port API)[0m
2026-04-04T06:45:31.4497524Z [3...
  - **Created:** 2026-04-04T06:58:35.854Z
  - **Priority:** High

- **GH-AUTO-2026-04-04-8** — Fix Auto-Fix Test Failures failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-04T06:46:01.1625770Z [22m[39mRemote workspace bootstrap failed. Error: Remote boom
2026-04-04T06:46:01.1783104Z [22m[39mRemote workspace bootstrap failed. Error: Backend jest chwilowo nied...
  - **Created:** 2026-04-04T06:58:35.854Z
  - **Priority:** High

- **GH-AUTO-2026-04-04-9** — Fix Optimized CI failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** Job "format" step "Check formatting" failed
  - **Created:** 2026-04-04T06:58:35.854Z
  - **Priority:** High

- **GH-AUTO-2026-04-04-10** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-04T06:15:09.7468828Z [31m❌ VITE_GOOGLE_CLIENT_ID: BRAK (Google OAuth Client ID)[0m
2026-04-04T06:15:09.7473019Z [31m❌ VOICELOG_API_PORT: BRAK (Port API)[0m
2026-04-04T06:15:09.7473885Z [3...
  - **Created:** 2026-04-04T06:58:35.854Z
  - **Priority:** High


### Vercel Errors (10 found)

- **VL-AUTO-2026-04-04-11** — Fix Vercel deployment error
  - **Status:** todo
  - **Source:** Vercel
  - **Error:** [31merror during build:
  - **Created:** 2026-04-04T06:58:35.854Z
  - **Priority:** High

- **VL-AUTO-2026-04-04-12** — Fix Vercel deployment error
  - **Status:** todo
  - **Source:** Vercel
  - **Error:** [31mBuild failed with 1 error:
  - **Created:** 2026-04-04T06:58:35.854Z
  - **Priority:** High

- **VL-AUTO-2026-04-04-13** — Fix Vercel deployment error
  - **Status:** todo
  - **Source:** Vercel
  - **Error:**     at aggregateBindingErrorsIntoJsError (file:///vercel/path0/node_modules/.pnpm/rolldown@1.0.0-rc.12_@emnapi+core@1.9.1_@emnapi+runtime@1.9.1/node_modules/rolldown/dist/shared/error-BLhcSyeg.mjs:48:...
  - **Created:** 2026-04-04T06:58:35.854Z
  - **Priority:** High

- **VL-AUTO-2026-04-04-14** — Fix Vercel deployment error
  - **Status:** todo
  - **Source:** Vercel
  - **Error:**     at unwrapBindingResult (file:///vercel/path0/node_modules/.pnpm/rolldown@1.0.0-rc.12_@emnapi+core@1.9.1_@emnapi+runtime@1.9.1/node_modules/rolldown/dist/shared/error-BLhcSyeg.mjs:18:128)
  - **Created:** 2026-04-04T06:58:35.854Z
  - **Priority:** High

- **VL-AUTO-2026-04-04-15** — Fix Vercel deployment error
  - **Status:** todo
  - **Source:** Vercel
  - **Error:**   errors: [Getter/Setter]
  - **Created:** 2026-04-04T06:58:35.854Z
  - **Priority:** High

- **VL-AUTO-2026-04-04-16** — Fix Vercel deployment error
  - **Status:** todo
  - **Source:** Vercel
  - **Error:** [31merror during build:
  - **Created:** 2026-04-04T06:58:35.854Z
  - **Priority:** High

- **VL-AUTO-2026-04-04-17** — Fix Vercel deployment error
  - **Status:** todo
  - **Source:** Vercel
  - **Error:** [31mBuild failed with 1 error:
  - **Created:** 2026-04-04T06:58:35.854Z
  - **Priority:** High

- **VL-AUTO-2026-04-04-18** — Fix Vercel deployment error
  - **Status:** todo
  - **Source:** Vercel
  - **Error:**     at aggregateBindingErrorsIntoJsError (file:///vercel/path0/node_modules/.pnpm/rolldown@1.0.0-rc.12_@emnapi+core@1.9.1_@emnapi+runtime@1.9.1/node_modules/rolldown/dist/shared/error-BLhcSyeg.mjs:48:...
  - **Created:** 2026-04-04T06:58:35.854Z
  - **Priority:** High

- **VL-AUTO-2026-04-04-19** — Fix Vercel deployment error
  - **Status:** todo
  - **Source:** Vercel
  - **Error:**     at unwrapBindingResult (file:///vercel/path0/node_modules/.pnpm/rolldown@1.0.0-rc.12_@emnapi+core@1.9.1_@emnapi+runtime@1.9.1/node_modules/rolldown/dist/shared/error-BLhcSyeg.mjs:18:128)
  - **Created:** 2026-04-04T06:58:35.854Z
  - **Priority:** High

- **VL-AUTO-2026-04-04-20** — Fix Vercel deployment error
  - **Status:** todo
  - **Source:** Vercel
  - **Error:**   errors: [Getter/Setter]
  - **Created:** 2026-04-04T06:58:35.854Z
  - **Priority:** High

