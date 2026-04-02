# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

Zadania zakonczone trafiaja do [`TASK_DONE.md`](TASK_DONE.md).

## Podsumowanie (2026-04-02)

### CI/CD Status:

- **GH-01 do GH-35**: 34 zrealizowane, 1 blocked (zewnetrzne secrety)
- **GH-AUTO (naprawione)**: Prettier, Docker require(), Railway login, Dependabot auto-merge, Railway filter, coverage thresholds
- **Vitest Frontend**: 1050 testow passing, 0 failures (91 plikow)
- **Vitest Server**: 680 testow passing, 0 failures (49 plikow)
- **CI/CD Pipeline**: Quality Checks, Unit Tests, Build Application przechodza

### Railway Health Check (2026-03-31 - LIVE)

| Metric       | Value       | Status  |
| ------------ | ----------- | ------- |
| Status       | ok          | Healthy |
| Database     | connected   | OK      |
| Memory (RSS) | 112.99 MB   | Normal  |

---

## Otwarta kolejka

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

## Nastepne Kroki

1. Dodaj ANTHROPIC_API_KEY w GitHub Settings > Secrets > Actions (odblokuje GH-33)
2. Opcjonalnie: dodaj sekrety VITE_* aby wyciszyc warnings

<!-- Last updated: 2026-04-02 -->


<!-- Auto-generated on 2026-04-02T18:09:15.711Z -->

### GitHub Actions Errors (10 found)

- **GH-AUTO-2026-04-02-1** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T15:03:12.5220236Z     Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed
2026-04-02T15:03:12.5223310Z     Error: element(s) not found
2026-04-02T15:03...
  - **Created:** 2026-04-02T18:09:15.711Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-2** — Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T14:55:57.6584424Z [36;1mdocker run --rm --entrypoint="" voicelog:test node --version || (echo "❌ Node.js not found" && exit 1)[0m
2026-04-02T14:55:57.6585744Z [36;1mdocker run --rm --ent...
  - **Created:** 2026-04-02T18:09:15.711Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-3** — Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T14:23:18.1463146Z [36;1mdocker run --rm --entrypoint="" voicelog:test node --version || (echo "❌ Node.js not found" && exit 1)[0m
2026-04-02T14:23:18.1465235Z [36;1mdocker run --rm --ent...
  - **Created:** 2026-04-02T18:09:15.711Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-4** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T14:33:53.7127890Z     TimeoutError: page.click: Timeout 15000ms exceeded.
2026-04-02T14:33:53.7155264Z     TimeoutError: page.click: Timeout 15000ms exceeded.
2026-04-02T14:33:53.7184623Z  ...
  - **Created:** 2026-04-02T18:09:15.711Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-5** — Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T13:46:31.1774188Z [36;1mdocker run --rm --entrypoint="" voicelog:test node --version || (echo "❌ Node.js not found" && exit 1)[0m
2026-04-02T13:46:31.1775523Z [36;1mdocker run --rm --ent...
  - **Created:** 2026-04-02T18:09:15.711Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-6** — Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T13:28:17.3852688Z #22 [build 4/4] RUN node --input-type=commonjs -e "   const fs=require('fs');   const path=require('path');   try {     const ffmpegPath = require('ffmpeg-static');     co...
  - **Created:** 2026-04-02T18:09:15.711Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-7** — Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T13:20:59.9410457Z #22 [build 4/4] RUN node --input-type=commonjs -e "   const fs=require('fs');   const path=require('path');   try {     const ffmpegPath = require('ffmpeg-static');     co...
  - **Created:** 2026-04-02T18:09:15.711Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-8** — Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T13:09:44.2273800Z #22 [build 4/4] RUN node --input-type=commonjs -e "   const fs=require('fs');   const path=require('path');   try {     const ffmpegPath = require('ffmpeg-static');     co...
  - **Created:** 2026-04-02T18:09:15.711Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-9** — Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-02T13:01:10.0318758Z #22 [build 4/4] RUN node --input-type=commonjs -e "   const fs=require('fs');   const path=require('path');   try {     const ffmpegPath = require('ffmpeg-static');     co...
  - **Created:** 2026-04-02T18:09:15.711Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-10** — Fix Railway Error Reporter failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** Job "fetch-railway-errors" step "Login to Railway" failed
  - **Created:** 2026-04-02T18:09:15.711Z
  - **Priority:** High


### Railway Errors (1 found)

- **RW-AUTO-2026-04-02-11** — Fix Railway error
  - **Status:** todo
  - **Source:** Railway
  - **Error:** Error fetching logs: Railway command failed: Command failed: railway logs --lines 50
  - **Created:** 2026-04-02T18:09:15.711Z
  - **Priority:** High

