# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

Zadania zakonczone trafiaja do [`TASK_DONE.md`](TASK_DONE.md).

## Podsumowanie (2026-04-02, aktualizacja wieczorna)

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


<!-- Auto-generated on 2026-04-03T07:05:51.611Z -->

### GitHub Actions Errors (9 found)

- **GH-AUTO-2026-04-03-1** â€” Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-03T07:03:42.1307735Z [36;1mdocker run --rm --entrypoint="" voicelog:test node --version || (echo "âťŚ Node.js not found" && exit 1)[0m
2026-04-03T07:03:42.1309049Z [36;1mdocker run --rm --ent...
  - **Created:** 2026-04-03T07:05:51.611Z
  - **Priority:** High

- **GH-AUTO-2026-04-03-2** â€” Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-03T06:48:20.6584473Z [36;1mdocker run --rm --entrypoint="" voicelog:test node --version || (echo "âťŚ Node.js not found" && exit 1)[0m
2026-04-03T06:48:20.6585787Z [36;1mdocker run --rm --ent...
  - **Created:** 2026-04-03T07:05:51.611Z
  - **Priority:** High

- **GH-AUTO-2026-04-03-3** â€” Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-03T06:35:57.8851234Z [36;1mdocker run --rm --entrypoint="" voicelog:test node --version || (echo "âťŚ Node.js not found" && exit 1)[0m
2026-04-03T06:35:57.8852643Z [36;1mdocker run --rm --ent...
  - **Created:** 2026-04-03T07:05:51.611Z
  - **Priority:** High

- **GH-AUTO-2026-04-03-4** â€” Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-03T06:40:19.2743821Z     TimeoutError: locator.click: Timeout 15000ms exceeded.
2026-04-03T06:40:19.2761593Z     TimeoutError: locator.click: Timeout 15000ms exceeded.
2026-04-03T06:40:19.2779...
  - **Created:** 2026-04-03T07:05:51.611Z
  - **Priority:** High

- **GH-AUTO-2026-04-03-5** â€” Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-03T06:28:49.7375089Z     TimeoutError: locator.click: Timeout 15000ms exceeded.
2026-04-03T06:28:49.7398640Z     TimeoutError: locator.click: Timeout 15000ms exceeded.
2026-04-03T06:28:49.7419...
  - **Created:** 2026-04-03T07:05:51.611Z
  - **Priority:** High

- **GH-AUTO-2026-04-03-6** â€” Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-03T06:24:03.2023907Z [36;1mdocker run --rm --entrypoint="" voicelog:test node --version || (echo "âťŚ Node.js not found" && exit 1)[0m
2026-04-03T06:24:03.2025208Z [36;1mdocker run --rm --ent...
  - **Created:** 2026-04-03T07:05:51.611Z
  - **Priority:** High

- **GH-AUTO-2026-04-03-7** â€” Fix Auto Security Patches failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-03T02:13:46.9375934Z [22m[39mRemote workspace bootstrap failed. Error: Remote boom
2026-04-03T02:13:46.9509882Z [22m[39mRemote workspace bootstrap failed. Error: Backend jest chwilowo nied...
  - **Created:** 2026-04-03T07:05:51.611Z
  - **Priority:** High

- **GH-AUTO-2026-04-03-8** â€” Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-03T02:08:14.4566843Z [36;1mdocker run --rm --entrypoint="" voicelog:test node --version || (echo "âťŚ Node.js not found" && exit 1)[0m
2026-04-03T02:08:14.4568162Z [36;1mdocker run --rm --ent...
  - **Created:** 2026-04-03T07:05:51.611Z
  - **Priority:** High

- **GH-AUTO-2026-04-03-9** â€” Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-03T02:13:25.7202068Z     TimeoutError: locator.click: Timeout 15000ms exceeded.
2026-04-03T02:13:25.7223580Z     TimeoutError: locator.click: Timeout 15000ms exceeded.
2026-04-03T02:13:25.7240...
  - **Created:** 2026-04-03T07:05:51.611Z
  - **Priority:** High



<!-- Auto-generated on 2026-04-03T07:07:29.383Z -->

### GitHub Actions Errors (4 found)

- **GH-AUTO-2026-04-03-1** â€” Fix Docker Build failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-03T07:06:47.6964035Z [36;1mdocker run --rm --entrypoint="" voicelog:test node --version || (echo "âťŚ Node.js not found" && exit 1)[0m
2026-04-03T07:06:47.6965720Z [36;1mdocker run --rm --ent...
  - **Created:** 2026-04-03T07:07:29.383Z
  - **Priority:** High

- **GH-AUTO-2026-04-03-2** â€” Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-03T06:40:19.2743821Z     TimeoutError: locator.click: Timeout 15000ms exceeded.
2026-04-03T06:40:19.2761593Z     TimeoutError: locator.click: Timeout 15000ms exceeded.
2026-04-03T06:40:19.2779...
  - **Created:** 2026-04-03T07:07:29.383Z
  - **Priority:** High

- **GH-AUTO-2026-04-03-3** â€” Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-03T06:28:49.7375089Z     TimeoutError: locator.click: Timeout 15000ms exceeded.
2026-04-03T06:28:49.7398640Z     TimeoutError: locator.click: Timeout 15000ms exceeded.
2026-04-03T06:28:49.7419...
  - **Created:** 2026-04-03T07:07:29.383Z
  - **Priority:** High

- **GH-AUTO-2026-04-03-4** â€” Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** 2026-04-03T02:13:25.7202068Z     TimeoutError: locator.click: Timeout 15000ms exceeded.
2026-04-03T02:13:25.7223580Z     TimeoutError: locator.click: Timeout 15000ms exceeded.
2026-04-03T02:13:25.7240...
  - **Created:** 2026-04-03T07:07:29.383Z
  - **Priority:** High

