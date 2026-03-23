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
