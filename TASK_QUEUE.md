# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

Zadania zakonczone trafiaja do [`TASK_DONE.md`](TASK_DONE.md).

## Sprint: refactor architektury

Cel sprintu: zmniejszyc sprzezenia miedzy backendem, stanem frontendu i widokami, zeby dalszy rozwoj nie wymagal dotykania jednego wielkiego pliku.

Kolejnosc prac:
1. kontrakty danych i typy wspolne
2. backend bootstrap i orchestration pipeline
3. frontend state, hooks i services
4. `TabRouter` i ekrany
5. testy kontraktowe i regresyjne
6. porzadki layout / UX po stabilizacji architektury

## Otwarta kolejka

### Codex

- Brak otwartych zadan.

### Qwen

- `229` [P1] `todo` - Fix failing CI after `60059681`: E2E Smoke Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: E2E Smoke Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23501292568).

- `228` [P1] `todo` - Fix failing CI after `b2165e7b`: E2E Smoke Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: E2E Smoke Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23500409927).

- `227` [P1] `todo` - Fix failing CI after `27185fa0`: E2E Smoke Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: E2E Smoke Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23498777006).

- `226` [P1] `todo` - Fix failing CI after `bc3a89e4`: E2E Smoke Tests, Frontend Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: E2E Smoke Tests, Frontend Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23498326233).

- `225` [P1] `todo` - Fix failing CI after `14be5183`: Frontend Tests, Server Tests, E2E Smoke Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Frontend Tests, Server Tests, E2E Smoke Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23498020233).

- `224` [P1] `todo` - Fix failing CI after `faa97744`: Server Tests, Frontend Tests, E2E Smoke Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Server Tests, Frontend Tests, E2E Smoke Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23496734384).

- `223` [P1] `todo` - Fix failing CI after `8c34991d`: Frontend Tests, E2E Smoke Tests, Server Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Frontend Tests, E2E Smoke Tests, Server Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23496246897).

- `222` [P1] `todo` - Fix failing CI after `97c2d4bb`: Server Tests, Frontend Tests, E2E Smoke Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Server Tests, Frontend Tests, E2E Smoke Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23495770672).

- `221` [P1] `todo` - Fix failing CI after `0f72547d`: Frontend Tests, Server Tests, E2E Smoke Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Frontend Tests, Server Tests, E2E Smoke Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23495448912).

- `220` [P1] `todo` - Fix failing CI after `56f73178`: Server Tests, E2E Smoke Tests, Frontend Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Server Tests, E2E Smoke Tests, Frontend Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23494870865).

- `219` [P1] `todo` - Fix failing CI after `14d407d6`: Server Tests, Frontend Tests, E2E Smoke Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Server Tests, Frontend Tests, E2E Smoke Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23494363750).

- `218` [P1] `todo` - Fix failing CI after `37a04295`: Frontend Tests, Server Tests, E2E Smoke Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Frontend Tests, Server Tests, E2E Smoke Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23493657834).

- `217` [P1] `todo` - Fix failing CI after `f6683244`: E2E Smoke Tests, Frontend Tests, Server Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: E2E Smoke Tests, Frontend Tests, Server Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23493083112).

- `216` [P1] `todo` - Fix failing CI after `b4ec256b`: Server Tests, Frontend Tests, E2E Smoke Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Server Tests, Frontend Tests, E2E Smoke Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23492502989).

- `215` [P1] `todo` - Fix failing CI after `f8cb7ef6`: Server Tests, E2E Smoke Tests, Frontend Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Server Tests, E2E Smoke Tests, Frontend Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23491841689).

- `214` [P1] `todo` - Fix failing CI after `71ee6653`: Server Tests, E2E Smoke Tests, Frontend Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Server Tests, E2E Smoke Tests, Frontend Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23490328252).

- `213` [P1] `todo` - Fix failing CI after `cba5d325`: Server Tests, Frontend Tests, E2E Smoke Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Server Tests, Frontend Tests, E2E Smoke Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23489958847).

- `212` [P1] `todo` - Fix failing CI after `c75d36bf`: Server Tests, E2E Smoke Tests, Frontend Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Server Tests, E2E Smoke Tests, Frontend Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23486791130).

- `211` [P1] `todo` - Fix failing CI after `f9a7f30b`: Frontend Tests, Server Tests, E2E Smoke Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Frontend Tests, Server Tests, E2E Smoke Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23486130159).

- `210` [P1] `todo` - Fix failing CI after `fb79d791`: Frontend Tests, E2E Smoke Tests, Server Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Frontend Tests, E2E Smoke Tests, Server Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23485654171).

- `209` [P1] `todo` - Fix failing CI after `25a84e23`: Server Tests, Frontend Tests, E2E Smoke Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Server Tests, Frontend Tests, E2E Smoke Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23483486998).

- `201` [P1] `todo` - testy `ai/routes.ts`
  - Cel: podniesc coverage AI routes z 26% do 80%+.
  - Zakres: `/ai/analyze`, `/ai/suggest-tasks`, `/ai/search`, fallbacki i timeouty.

- `208` [P1] `todo` - coverage `ProfileTab.tsx`
  - Cel: podniesc coverage `ProfileTab.tsx` z 2% do 60%.
  - Zakres: render, interakcje, walidacja formularza, integracja z authStore.

### GPT

- `080` [P3] `todo` - [CSS] Konsolidacja plików i usunięcie `!important`
  - Cel: Oczyszczenie `tasks.css` i `StudioMeetingViewStyles.css` oraz likwidacja tagów `!important`.
  - Migracja kilkuset twardych bindowań paddingów/wielkości na tokeny z `index.css`.

- `018` [P3] `todo` - Outlook / Microsoft To Do / Microsoft Calendar
  - Cel: rozszerzyc integracje poza ekosystem Google.
  - Akceptacja: logowanie MSAL OAuth2, synchronizacja z Microsoft To Do, integracja z Outlook Calendar.

## Uwagi

- Nie dopisuje tu zakonczonych zadan. Sa w [`TASK_DONE.md`](TASK_DONE.md).
- Jesli chcesz, moge tez przygotowac osobna sekcje `in_progress` i `blocked`, kiedy pojawi sie taka potrzeba.
