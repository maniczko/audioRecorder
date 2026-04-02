# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

Zadania zakonczone trafiaja do [`TASK_DONE.md`](TASK_DONE.md).

## Podsumowanie (2026-04-02)

### CI/CD Status:

- **GH-01 do GH-35**: 34 zrealizowane, 1 blocked (zewnetrzne secrety)
- **GH-AUTO (Prettier, Docker, Railway filter, coverage)**: naprawione
- **ESLint**: 0 ostrzezen
- **Vitest Frontend**: 1050 testow passing, 0 failures (91 plikow)
- **Vitest Server**: 680 testow passing, 0 failures (49 plikow)
- **CI/CD Pipeline**: Quality Checks, Unit Tests, Build Application przechodza (run 23901618675)
- **Error Monitor workflow**: Dziala

### Railway Health Check (2026-03-31 - LIVE)

| Metric       | Value       | Status     |
| ------------ | ----------- | ---------- |
| Status       | ok          | Healthy    |
| Database     | connected   | OK         |
| Memory (RSS) | 112.99 MB   | Normal     |
| Git SHA      | 1d70ce9     | Latest     |

---

## Otwarta kolejka

### BLOCKED (wymaga konfiguracji zewnetrznej)

- **GH-33** - "Remote boom" bootstrap failure (Code Review + Auto-Fix workflow)
  - **Status:** blocked
  - **Error:** Remote workspace bootstrap failed. Error: Remote boom
  - **Blokada:** Brak Claude API key w GitHub Actions Secrets
  - **Akcja:** Dodaj secret ANTHROPIC_API_KEY lub CLAUDE_API_KEY w GitHub Settings Secrets Actions

- **GH-AUTO-1/7/9** - Missing VITE_* env vars w CI (validate-env.js)
  - **Status:** blocked (by design)
  - **Error:** VITE_DATA_PROVIDER: BRAK, VITE_MEDIA_PROVIDER: BRAK
  - **Uwaga:** Krok ma continue-on-error: true - nie blokuje CI. Brakuje produkcyjnych sekretow.
  - **Akcja:** Opcjonalnie dodaj sekrety VITE_DATA_PROVIDER, VITE_MEDIA_PROVIDER itp.

---

## Nastepne Kroki

1. **GH-33** - Dodaj ANTHROPIC_API_KEY secret w GitHub Settings Secrets Actions (odblokuje automatyczny code review i auto-fix)
2. Opcjonalnie: dodaj sekrety VITE_* jesli chcesz wyciszyc warnings w validate-env job

<!-- Last updated: 2026-04-02 -->


<!-- Auto-generated on 2026-04-02T13:27:10.095Z -->

### GitHub Actions Errors (10 found)

- **GH-AUTO-2026-04-02-1** — Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T13:20:59.9410457Z #22 [build 4/4] RUN node --input-type=commonjs -e "   const fs=require('fs');   const path=require('path');   try {     const ffmpegPath = require('ffmpeg-static');     co...
  - **Created:** 2026-04-02T13:27:10.095Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-2** — Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T13:09:44.2273800Z #22 [build 4/4] RUN node --input-type=commonjs -e "   const fs=require('fs');   const path=require('path');   try {     const ffmpegPath = require('ffmpeg-static');     co...
  - **Created:** 2026-04-02T13:27:10.095Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-3** — Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T13:01:10.0318758Z #22 [build 4/4] RUN node --input-type=commonjs -e "   const fs=require('fs');   const path=require('path');   try {     const ffmpegPath = require('ffmpeg-static');     co...
  - **Created:** 2026-04-02T13:27:10.095Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-4** — Fix Railway Error Reporter failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** Job "fetch-railway-errors" step "Login to Railway" failed
  - **Created:** 2026-04-02T13:27:10.095Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-5** — Fix Auto-merge Dependabot failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** Job "dependabot" step "Enable auto-merge for Dependabot PRs" failed
  - **Created:** 2026-04-02T13:27:10.095Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-6** — Fix Auto-Fix Test Failures failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T12:51:00.1427269Z [22m[39mRemote workspace bootstrap failed. Error: Remote boom
2026-04-02T12:51:00.1564825Z [22m[39mRemote workspace bootstrap failed. Error: Backend jest chwilowo nied...
  - **Created:** 2026-04-02T13:27:10.095Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-7** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T12:52:21.0036537Z   code: 'PARSE_ERROR',
2026-04-02T12:52:21.5480927Z ERROR: Coverage for lines (58.28%) does not meet global threshold (80%)
2026-04-02T12:52:21.5482156Z ERROR: Coverage fo...
  - **Created:** 2026-04-02T13:27:10.095Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-8** — Fix Optimized CI failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T12:51:01.3870450Z [22m[39mRemote workspace bootstrap failed. Error: Remote boom
2026-04-02T12:51:01.4180260Z [22m[39mRemote workspace bootstrap failed. Error: Backend jest chwilowo nied...
  - **Created:** 2026-04-02T13:27:10.095Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-9** — Fix Optimized CI failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T12:54:27.9807230Z [36;1mCRITICAL_FAILED="false"[0m
2026-04-02T12:54:27.9810367Z [36;1mif [ "success" == "failure" ]; then CRITICAL_FAILED="true"; fi[0m
2026-04-02T12:54:27.9811882Z [36...
  - **Created:** 2026-04-02T13:27:10.095Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-10** — Fix AI Auto-Fix failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** Job "ai-auto-fix" step "Checkout code" failed
  - **Created:** 2026-04-02T13:27:10.095Z
  - **Priority:** High


### Railway Errors (1 found)

- **RW-AUTO-2026-04-02-11** — Fix Railway error
  - **Status:** todo
  - **Source:** Railway
  - **Error:** Error fetching logs: Railway command failed: Command failed: railway logs --lines 50
  - **Created:** 2026-04-02T13:27:10.095Z
  - **Priority:** High

