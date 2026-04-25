# Skrypty

Poniżej jest lista tylko tych skryptów, które uruchamiają się automatycznie bez ręcznego wpisywania komendy.

| Skrypt | Skąd odpala się automatycznie | Co robi | Jak często / kiedy |
|---|---|---|---|
| `scripts/validate-env.js` | `.github/workflows/ci.yml` | Sprawdza konfigurację `.env` i podstawowe zmienne środowiskowe w CI. | Przy każdym `push` i `pull_request` uruchamiającym workflow `CI/CD Pipeline`. |
| `scripts/fetch-github-errors.js` | `.github/workflows/error-monitor-and-task-creator.yml`, `.github/workflows/github-error-reporter.yml` | Pobiera świeże błędy z GitHub Actions i zapisuje raporty. | Co `2` godziny w `Error Monitor & Task Creator` oraz codziennie o `09:00` czasu `Europe/Warsaw` w `GitHub Error Reporter`. |
| `scripts/fetch-railway-errors.js` | `.github/workflows/error-monitor-and-task-creator.yml`, `.github/workflows/railway-error-reporter.yml` | Pobiera logi błędów z Railway i buduje raporty `.md` / `.json`. | Co `2` godziny w `Error Monitor & Task Creator` oraz co `6` godzin w `Railway Error Reporter`. |
| `scripts/fetch-vercel-errors.js` | `.github/workflows/error-monitor-and-task-creator.yml` | Pobiera błędy deployów/logów z Vercela do lokalnych raportów monitoringu. | Co `2` godziny. |
| `scripts/fetch-sentry-errors.js` | `.github/workflows/error-monitor-and-task-creator.yml` | Pobiera błędy z Sentry i zapisuje snapshot raportu. | Co `2` godziny. |
| `scripts/assign-task-agents.mjs` | `.github/workflows/task-queue-auto-assign.yml` | Skanuje `TASK_QUEUE.md` i dopisuje właściciela do nowych zadań `todo`, które jeszcze nie mają przypisanego agenta. | Co `2` godziny oraz ręcznie przez `workflow_dispatch`. |
| `server/scripts/cleanup-disk.ts` | import runtime w `server/index.ts` i auto-run w samym pliku | Czyści stare pliki tymczasowe i próbuje odzyskać miejsce na dysku w środowiskach produkcyjnych / Railway. | Warunkowo przy starcie backendu, gdy środowisko wygląda na `production` albo `RAILWAY=true`; dodatkowo w bootstrapie tylko przy krytycznie niskim miejscu na dysku. |
| `.husky/pre-commit` | Git hook Husky | Uruchamia automatyczny lint i formatowanie tylko dla staged plików JS/TS przed commitem. | Przy każdym `git commit` bez `--no-verify`. |
| `.husky/pre-push` | Git hook Husky | Odpala `npm run test:server:retry`, żeby zablokować push z czerwonym backendem. | Przy każdym `git push` bez `--no-verify`. |

## Uwaga

Nie wpisywałem tu skryptów uruchamianych tylko ręcznie, np. przez `pnpm run ...`, ani kodu z timerów w komponentach/hookach, bo to nie są samodzielne skrypty repo.
