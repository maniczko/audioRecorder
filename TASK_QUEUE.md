# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

Zadania zakonczone trafiaja do [`TASK_DONE.md`](TASK_DONE.md).

## Podsumowanie (2026-04-02)

### CI/CD Status:

- **GH-01 do GH-35**: 34 ✅ zrealizowane, 1 ⚠️ blocked (zewnętrzne secrety)
- **GH-AUTO-2,3,6,8,10,11,12**: ✅ naprawione (Prettier, Docker require(), Railway filter, coverage thresholds)
- **ESLint**: 0 ostrzeżeń
- **Vitest Frontend**: 1050 testów passing, 0 failures (91 plików)
- **Vitest Server**: 680 testów passing, 0 failures (49 plików)
- **CI/CD Pipeline**: ✅ Quality Checks, Unit Tests, Build Application przechodzą (run `23901618675`)
- **Error Monitor workflow**: ✅ Działa (run `23898465998` — 52s, bez błędów)

### 🟢 Railway Health Check (2026-03-31 - LIVE)

| Metric       | Value       | Status     |
| ------------ | ----------- | ---------- |
| Status       | `ok`        | ✅ Healthy |
| Database     | `connected` | ✅ OK      |
| Memory (RSS) | 112.99 MB   | ✅ Normal  |
| Git SHA      | `1d70ce9`   | ✅ Latest  |

---

## Otwarta kolejka

### ⚠️ BLOCKED (wymaga konfiguracji zewnętrznej)

- **GH-33 / GH-AUTO-4 / GH-AUTO-5** — "Remote boom" bootstrap failure (Code Review + Auto-Fix workflow)
  - **Status:** blocked
  - **Error:** ``Remote workspace bootstrap failed. Error: Remote boom``
  - **Blokada:** Brak Claude API key w GitHub Actions Secrets
  - **Akcja:** Dodaj secret ``ANTHROPIC_API_KEY`` lub ``CLAUDE_API_KEY`` w GitHub → Settings → Secrets → Actions

- **GH-AUTO-1 / GH-AUTO-7 / GH-AUTO-9** — Missing VITE_* env vars w CI (validate-env.js)
  - **Status:** blocked (by design)
  - **Error:** ``❌ VITE_DATA_PROVIDER: BRAK``, ``❌ VITE_MEDIA_PROVIDER: BRAK``
  - **Uwaga:** Krok ma ``continue-on-error: true`` — nie blokuje CI. Brakuje produkcyjnych sekretów w GitHub Actions.
  - **Akcja:** Opcjonalnie dodaj sekrety ``VITE_DATA_PROVIDER``, ``VITE_MEDIA_PROVIDER`` itp.

---

## 🔄 Następne Kroki

1. **GH-33** — Dodaj ``ANTHROPIC_API_KEY`` secret w GitHub → Settings → Secrets → Actions (odblokuje automatyczny code review i auto-fix)
2. Opcjonalnie: dodaj sekrety ``VITE_*`` jeśli chcesz wyciszyć warnings w validate-env job

<!-- Auto-generated on 2026-04-02T12:00:11.969Z -->

### GitHub Actions Errors (10 found)

- **GH-AUTO-2026-04-02-1** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T11:52:30.6595324Z [31m❌ VITE_DATA_PROVIDER: BRAK (Provider danych)[0m
    2026-04-02T11:52:30.6598799Z [31m❌ VITE_MEDIA_PROVIDER: BRAK (Provider mediów)[0m
    2026-04-02T11:52:30.6599615Z [31...
  - **Created:** 2026-04-02T12:00:11.969Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-2** — Fix Optimized CI failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** Job "format" step "Check formatting" failed
  - **Created:** 2026-04-02T12:00:11.969Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-3** — Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T11:53:15.4198349Z #22 [build 4/4] RUN node -e " const fs=require('fs'); const path=require('path'); try { const ffmpegPath = require('ffmpeg-static'); const ffprobePath = requ...
  - **Created:** 2026-04-02T12:00:11.969Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-4** — Fix Auto-Fix Test Failures failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T11:52:53.6540735Z [22m[39mRemote workspace bootstrap failed. Error: Remote boom
    2026-04-02T11:52:53.6713478Z [22m[39mRemote workspace bootstrap failed. Error: Backend jest chwilowo nied...
  - **Created:** 2026-04-02T12:00:11.969Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-5** — Fix Auto-Fix Test Failures failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T11:49:37.4589688Z [22m[39mRemote workspace bootstrap failed. Error: Remote boom
    2026-04-02T11:49:37.4731431Z [22m[39mRemote workspace bootstrap failed. Error: Backend jest chwilowo nied...
  - **Created:** 2026-04-02T12:00:11.969Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-6** — Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T11:49:47.7586037Z #22 [build 4/4] RUN node -e " const fs=require('fs'); const path=require('path'); try { const ffmpegPath = require('ffmpeg-static'); const ffprobePath = requ...
  - **Created:** 2026-04-02T12:00:11.969Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-7** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T11:49:17.2240016Z [31m❌ VITE_DATA_PROVIDER: BRAK (Provider danych)[0m
    2026-04-02T11:49:17.2240847Z [31m❌ VITE_MEDIA_PROVIDER: BRAK (Provider mediów)[0m
    2026-04-02T11:49:17.2241619Z [31...
  - **Created:** 2026-04-02T12:00:11.969Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-8** — Fix Optimized CI failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** Job "format" step "Check formatting" failed
  - **Created:** 2026-04-02T12:00:11.969Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-9** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T11:41:29.8494014Z [31m❌ VITE_DATA_PROVIDER: BRAK (Provider danych)[0m
    2026-04-02T11:41:29.8495050Z [31m❌ VITE_MEDIA_PROVIDER: BRAK (Provider mediów)[0m
    2026-04-02T11:41:29.8496239Z [31...
  - **Created:** 2026-04-02T12:00:11.969Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-10** — Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T11:42:00.4340852Z #22 [build 4/4] RUN node -e " const fs=require('fs'); const path=require('path'); try { const ffmpegPath = require('ffmpeg-static'); const ffprobePath = requ...
  - **Created:** 2026-04-02T12:00:11.969Z
  - **Priority:** High

### Railway Errors (2 found)

- **RW-AUTO-2026-04-02-11** — Fix Railway error
  - **Status:** todo
  - **Source:** Railway
  - **Error:** Error fetching logs: Railway command failed: Command failed: railway logs --lines 50 --filter "@level:error"
  - **Created:** 2026-04-02T12:00:11.969Z
  - **Priority:** High

- **RW-AUTO-2026-04-02-12** — Fix Railway error
  - **Status:** todo
  - **Source:** Railway
  - **Error:** Invalid RAILWAY_TOKEN. Please check that it is valid and has access to the resource you're trying to use.
  - **Created:** 2026-04-02T12:00:11.969Z
  - **Priority:** High


<!-- Auto-generated on 2026-04-02T13:08:42.341Z -->

### GitHub Actions Errors (10 found)

- **GH-AUTO-2026-04-02-1** — Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T13:01:10.0318758Z #22 [build 4/4] RUN node --input-type=commonjs -e "   const fs=require('fs');   const path=require('path');   try {     const ffmpegPath = require('ffmpeg-static');     co...
  - **Created:** 2026-04-02T13:08:42.341Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-2** — Fix Railway Error Reporter failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** Job "fetch-railway-errors" step "Login to Railway" failed
  - **Created:** 2026-04-02T13:08:42.341Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-3** — Fix Auto-merge Dependabot failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** Job "dependabot" step "Enable auto-merge for Dependabot PRs" failed
  - **Created:** 2026-04-02T13:08:42.341Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-4** — Fix Auto-Fix Test Failures failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T12:51:00.1427269Z [22m[39mRemote workspace bootstrap failed. Error: Remote boom
2026-04-02T12:51:00.1564825Z [22m[39mRemote workspace bootstrap failed. Error: Backend jest chwilowo nied...
  - **Created:** 2026-04-02T13:08:42.341Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-5** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T12:52:21.0036537Z   code: 'PARSE_ERROR',
2026-04-02T12:52:21.5480927Z ERROR: Coverage for lines (58.28%) does not meet global threshold (80%)
2026-04-02T12:52:21.5482156Z ERROR: Coverage fo...
  - **Created:** 2026-04-02T13:08:42.341Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-6** — Fix Optimized CI failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T12:51:01.3870450Z [22m[39mRemote workspace bootstrap failed. Error: Remote boom
2026-04-02T12:51:01.4180260Z [22m[39mRemote workspace bootstrap failed. Error: Backend jest chwilowo nied...
  - **Created:** 2026-04-02T13:08:42.341Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-7** — Fix Optimized CI failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T12:54:27.9807230Z [36;1mCRITICAL_FAILED="false"[0m
2026-04-02T12:54:27.9810367Z [36;1mif [ "success" == "failure" ]; then CRITICAL_FAILED="true"; fi[0m
2026-04-02T12:54:27.9811882Z [36...
  - **Created:** 2026-04-02T13:08:42.341Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-8** — Fix AI Auto-Fix failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** Job "ai-auto-fix" step "Checkout code" failed
  - **Created:** 2026-04-02T13:08:42.341Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-9** — Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T12:50:40.4427326Z #22 [build 4/4] RUN node --input-type=commonjs -e "   const fs=require('fs');   const path=require('path');   try {     const ffmpegPath = require('ffmpeg-static');     co...
  - **Created:** 2026-04-02T13:08:42.341Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-10** — Fix Code Review failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T12:50:16.6079124Z [22m[39mRemote workspace bootstrap failed. Error: Remote boom
2026-04-02T12:50:16.6221186Z [22m[39mRemote workspace bootstrap failed. Error: Backend jest chwilowo nied...
  - **Created:** 2026-04-02T13:08:42.341Z
  - **Priority:** High


### Railway Errors (1 found)

- **RW-AUTO-2026-04-02-11** — Fix Railway error
  - **Status:** todo
  - **Source:** Railway
  - **Error:** Error fetching logs: Railway command failed: Command failed: railway logs --lines 50
  - **Created:** 2026-04-02T13:08:42.341Z
  - **Priority:** High

