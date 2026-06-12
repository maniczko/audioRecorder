# Audyt layoutu VoiceBóbr premium-light — 2026-06-09

## Executive summary

Automatyczny audyt layoutu premium-light został wdrożony jako osobny Playwright spec z seedowanym workspace. Test przechodzi przez Studio, Nagrania, Kalendarz, Zadania, Osoby, Notatki i Profil na breakpointach 320, 390, 768, 1024, 1366, 1440 i 1920 px.

Najważniejsze naprawy wykonane w tej iteracji:

- usunięto blokujące ciemne powierzchnie w premium-light dla command palette, notification center i notatek,
- ujednolicono minimalny target 44 px dla globalnych inputów i kluczowych kontrolek,
- naprawiono kolizje toolbaru zadań przez bezpieczniejszy dwurzędowy commandbar,
- dopasowano Studio legacy controls do rytmu 44 px,
- dodano automatyczny layout gate: overflow, overlap, tap-target i dark-panel detection.

Ocena po tej iteracji: 8.6/10.

Nie deklaruję 9/10, bo visual snapshot baseline wymaga osobnej akceptacji nowych obrazów, a `test:visual:check` nadal zgłasza brak baseline’ów dla dodanych breakpointów oraz 401 z endpointów integracji w seedowanym runie.

## Wyniki walidacji

| Test                                                                                      | Wynik           | Uwagi                                                                                                 |
| ----------------------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------- |
| `pnpm exec playwright test tests/e2e/layout-audit.spec.ts --project=chromium --workers=1` | PASS            | 7/7 breakpointów przeszło.                                                                            |
| `pnpm run audit:mojibake`                                                                 | PASS            | Brak mojibake w release-critical UI/config.                                                           |
| `pnpm run audit:build-warnings`                                                           | PASS            | Build Vite bez release-blocking warnings.                                                             |
| `pnpm run test:visual:check`                                                              | FAIL oczekiwany | Brak zaakceptowanych snapshotów dla nowych breakpointów i 401 z endpointów integracji w runie visual. |

## Tabela audytu

| Widok               |          Breakpoint | Problem                                                                    | Wpływ                                                  | Priorytet | Rekomendowana poprawka                                                                 | Plik/klasa                                                                                               |
| ------------------- | ------------------: | -------------------------------------------------------------------------- | ------------------------------------------------------ | --------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Studio              | 1024/1366/1440/1920 | Legacy taby i przyciski miały 29–42 px wysokości.                          | Trudniejsze klikanie, niespójna ergonomia.             | High      | Ustawiono min-height 44 px dla legacy controls.                                        | `src/studio/StudioMeetingViewStyles.css`, `.ff-int-tab`, `.ff-tb-btn`, `.ff-tb-record`, `.header-action` |
| Zadania             |           1366/1920 | Toolbar widoków i filtr właściciela mogły kolidować.                       | Nierówna hierarchia i ryzyko nachodzenia kontrolek.    | High      | Commandbar premium-light przeszedł na bezpieczny grid 1 kolumna + zawijanie grup.      | `src/tasks/TaskDetailsPanelStyles.css`, `.todo-commandbar`                                               |
| Kalendarz           |               1024+ | View switch miał 42 px.                                                    | Lekko za mały target dla kontroli przełączania widoku. | Medium    | Dodano min-height 44 px dla view/nav/today buttons.                                    | `src/styles/calendar.css`, `.calendar-view-button`                                                       |
| Osoby               |            320–1920 | Wyszukiwarka osób miała 42 px, status chipy 34 px.                         | Niespójna wysokość i słabsza dostępność.               | Medium    | Dodano globalny floor 44 px dla pól premium-light oraz status chipów.                  | `src/styles/foundation.css`, `src/PeopleTabStyles.css`                                                   |
| Notatki             |      mobile/desktop | Sidebar i pola notatek dziedziczyły cięższe ciemne/półciemne powierzchnie. | Jasny layout tracił spójność premium.                  | High      | Dodano jasne powierzchnie panelu i search input 44 px.                                 | `src/NotesTabStyles.css`, `.notes-sidebar`, `.notes-search-input`                                        |
| Command palette     |             overlay | Ciemna powierzchnia w jasnym motywie.                                      | Wrażenie niespójnej aplikacji.                         | Medium    | Dodano premium-light override dla backdrop, panelu i wyników.                          | `src/CommandPaletteStyles.css`                                                                           |
| Notification center |             overlay | Panel i karty były za ciemne w premium-light.                              | Niespójne stany systemowe.                             | Medium    | Dodano jasne tokenowe powierzchnie i stany warning/danger.                             | `src/NotificationCenterStyles.css`                                                                       |
| Kalendarz mini      |            320–1024 | Dni kalendarza są gęste 27–35 px.                                          | Potencjalnie mniejszy touch target, ale bez overflow.  | Low       | Pozostawiono jako świadomy dense calendar exception; pilnowane przez overflow/overlap. | `tests/e2e/layout-audit.spec.ts`, `.mini-day`                                                            |

## Critical/High

| Priorytet | Obszar                                | Status                                                                  |
| --------- | ------------------------------------- | ----------------------------------------------------------------------- |
| High      | Studio legacy controls <44 px         | Naprawione i objęte layout audit.                                       |
| High      | Zadania toolbar overlap               | Naprawione i objęte layout audit.                                       |
| High      | Ciemne powierzchnie w jasnym układzie | Naprawione dla wykrytych paneli: Notes, command palette, notifications. |

## Mapa niespójności spacingu

| Obszar             | Poprzedni wzorzec                    | Docelowy wzorzec                                    |
| ------------------ | ------------------------------------ | --------------------------------------------------- |
| Kontrolki główne   | 29/34/36/39/42 px                    | Minimum 44 px dla input/button/select/textarea.     |
| Toolbar zadań      | Jedna oś, ryzyko kolizji             | Grid + wrap, gap 16 px, row-gap 8 px.               |
| Jasne powierzchnie | Część paneli dziedziczyła ciemne tła | Tokeny `--surface-*`, `--text`, `--surface-stroke`. |
| Mini calendar      | Gęsty grid dni                       | Wyjątek dense control, ale bez overflow/overlap.    |

## Komponenty do ujednolicenia

- `StudioMeetingView` legacy controls: docelowo przepiąć na wspólny Button/Tab primitive.
- `TasksWorkspaceView` commandbar: scalić duplikaty CSS w `tasks.css` i `TaskDetailsPanelStyles.css`.
- `PeopleTab` search/status chips: przepiąć na globalne form/control primitives.
- `CalendarTab` mini calendar: rozważyć osobny wariant mobile z większym targetem albo month picker.
- `NotesTab` sidebar: przenieść premium-light overrides do tokenowego layera zamiast dopisywać końcowe override’y.

## Backlog poprawek

| Priorytet | Zadanie                                                                    | Walidacja                                                             |
| --------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| High      | Zaakceptować lub odświeżyć visual baselines dla nowych breakpointów.       | `pnpm run test:visual:check -- --update-snapshots` po review obrazów. |
| High      | Rozwiązać 401 w visual regression seedzie dla integracji Google/status.    | Visual check bez console 401.                                         |
| Medium    | Scalić powielone style task commandbar w jeden blok.                       | Layout audit nadal PASS.                                              |
| Medium    | Wprowadzić shared `ControlHeight` token dla legacy Studio i People.        | Brak klas z ręcznym 29–42 px w audycie.                               |
| Low       | Zaprojektować alternatywny mini calendar mobile z większym touch targetem. | Mobile calendar bez overflow i bez dense exception.                   |

## Rekomendowany system layoutu

- Shell: sidebar 256 px desktop, overlay/collapsed na tablet/mobile, content z minmax i bez h-scroll.
- Spacing: 8 px grid, wartości 4/8/12/16/24/32/48/64.
- Controls: minimum 44 px dla klikanych CTA, inputów, selectów i icon buttons.
- Dense exceptions: tylko transcript rows, checkboxy, mini-calendar days i event pills, zawsze z osobnym overflow/overlap gate.
- Surfaces: `--surface-panel`, `--surface-panel-muted`, `--surface-stroke`, `--text`, `--muted`, `--accent` zamiast raw dark rgba w premium-light.
- Toolbars: grid/flex with wrap, nigdy wymuszona jedna linia dla 5+ kontrolek.

## Miejsca niesprawdzone

- Ręczne porównanie screenshotów i akceptacja visual baseline: nie wykonane, bo wymaga decyzji czy nowe obrazy mają stać się źródłem prawdy.
- Pełna interakcja z realnym Google Calendar/OAuth: poza zakresem layout audit; w visual check pojawia się 401 w seedowanym runie.
- Wszystkie loading skeletony produkcyjne z realnym wolnym backendiem: audit bazował na seedowanym Playwright workspace.
