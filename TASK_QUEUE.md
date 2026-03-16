# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`
Zadania zakonczone → TASK_DONE.md

---

## PRIORYTET P1 — krytyczne dla bezpieczenstwa i uzytecznosci

---

## 043. XSS — sanityzacja HTML w NotesTab (dangerouslySetInnerHTML)
Status: `todo`
Priorytet: `P1`
Cel: zapobiec XSS przy renderowaniu notatek z edytora WYSIWYG.
Problem: `note.context` renderowany przez `dangerouslySetInnerHTML` bez sanityzacji — jezeli AI lub sync dostarczy zloslwiwy HTML, wykona sie w przegladarce uzytkownika.
Akceptacja:
- przed przekazaniem do `dangerouslySetInnerHTML` kazda wartosc przechodzi przez DOMPurify.sanitize().
- dozwolone tagi: b, i, u, em, strong, ul, ol, li, p, br — wszystkie inne sa stripowane.
- dodany test jednostkowy sprawdzajacy ze script-tag jest usuwany.
Techniczne wskazowki:
- npm install dompurify (+ @types/dompurify opcjonalnie).
- w NotesTab.js: `import DOMPurify from "dompurify"` → `__html: DOMPurify.sanitize(note.context, { ALLOWED_TAGS: [...] })`.
- to samo zabezpieczenie nalezy zastosowac we wszystkich przyszlych miejscach z dangerouslySetInnerHTML.
Zrodlo: audyt bezpieczenstwa 2026-03-16, pozycja C1.

---

## 044. CORS i rate limiting na backendzie
Status: `todo`
Priorytet: `P1`
Cel: zamknac dwie luki krytyczne: nieograniczony dostep cross-origin oraz brak ochrony przed brute-force.
Problem (C2): `Access-Control-Allow-Origin: *` pozwala kazdej domenie na requesty do API.
Problem (H2): `/auth/login`, `/auth/register`, `/auth/password/reset/confirm` nie maja zadnego rate limitingu — mozliwy brute-force 6-cyfrowego kodu odzyskiwania (1M kombinacji).
Akceptacja:
- CORS dozwolony tylko dla origin z env `VOICELOG_ALLOWED_ORIGINS` (domyslnie `http://localhost:3000`).
- endpointy `/auth/*` blokuja IP po 10 nieudanych probach w ciagu 60 s (odpowiedz 429 z `Retry-After`).
- recovery code nie jest zwracany w response body — tylko `{ success: true }` + w trybie dev logowany do konsoli serwera.
Techniczne wskazowki:
- prosty Map-based rate limiter w server/index.js (klucz: `${ip}:${endpoint}`, reset co 60s).
- CORS_ORIGINS split po przecinku z env.
- usunac `recoveryCode` z response w `server/database.js` linia ~570.
Zrodlo: audyt bezpieczenstwa 2026-03-16, pozycje C2, H1, H2.

---

## 045. Memoizacja buildTasksFromMeetings i pochodnych
Status: `todo`
Priorytet: `P1`
Cel: wyeliminowac najdrozsze obliczenia przy kazdym renderze hooka useMeetings.
Problem: `buildTasksFromMeetings`, `buildTaskPeople`, `buildTaskNotifications`, `buildPeopleProfiles` (linie 143–154 useMeetings.js) wywolywane bez `useMemo` — przy kazdej zmianie jakiegokolwiek state w hooku iteruja cale kolekcje spotkan i zadan.
Akceptacja:
- wszystkie cztery obliczenia sa opakowan w `useMemo` z prawidlowymi tablicami zaleznosci.
- brak regresji w testech i UI.
- `normalizeColumns` wywolywana max raz na operacje (refactor helper do lazy singleton lub cache per board).
Techniczne wskazowki:
- `useMemo(() => buildTasksFromMeetings(...), [userMeetings, manualTasks, ...deps])` w useMeetings.js.
- rozwazyc extract do osobnego hooka `useTaskDerived(userMeetings, manualTasks)` dla czystosci.
Zrodlo: audyt kodu 2026-03-16, pozycje H3, M5, M6.

---

## 046. Naprawa stale closure w processQueueItem (useRecorder)
Status: `todo`
Priorytet: `P1`
Cel: zapobiec przetwarzaniu nagran ze starymi danymi spotkan po ich aktualizacji w trakcie przetwarzania.
Problem: `processQueueItem` zamkniety nad `userMeetings` z momentu uruchomienia efektu; spotkania zaktualizowane w trakcie przetwarzania sa ignorowane przez procesor kolejki (stale closure, linia ~270 useRecorder.js).
Akceptacja:
- `userMeetings` przekazywane przez ref (np. `userMeetingsRef.current`) zamiast przez domkniecie.
- `queueProcessingRef` resetowany do `false` w `.finally()` rowniez przy synchronicznym rzuceniu wyjatku.
- dodany test jednostkowy dla scenariusza "spotkanie zmienione w trakcie przetwarzania".
Techniczne wskazowki:
- `const userMeetingsRef = useRef(userMeetings); useEffect(() => { userMeetingsRef.current = userMeetings; }, [userMeetings]);`
- w `processQueueItem` czytac `userMeetingsRef.current` zamiast zamknietego `userMeetings`.
Zrodlo: audyt kodu 2026-03-16, pozycje H5, H10.

---

## 047. Naprawa stale closure conflictCount w useGoogleIntegrations
Status: `todo`
Priorytet: `P2`
Cel: poprawic wyswietlanie liczby konfliktow po imporcie zadan z Google Tasks.
Problem: `conflictCount` jest inkrementowany wewnatrz asynchronicznego callbacku `setManualTasks`, a nastepnie czytany synchronicznie — zawsze wynosi 0 (linia ~279 useGoogleIntegrations.js).
Akceptacja:
- wiadomosc o konfliktach wyswietla sie poprawnie gdy sa konflikty po imporcie.
- test jednostkowy pokrywa scenariusz z i bez konfliktow.
Techniczne wskazowki:
- obliczyc `conflictCount` z wartosci zwracanej przez `upsertGoogleImportedTasks` przed wywolaniem `setManualTasks`.
- `const { merged, conflictCount } = upsertGoogleImportedTasks(...)` → `setManualTasks(...)` → uzywac `conflictCount`.
Zrodlo: audyt kodu 2026-03-16, pozycja H9.

---

## 048. Node.js >= 22.5 — dokumentacja wymagan srodowiska
Status: `todo`
Priorytet: `P2`
Cel: zapobiec bledom instalacji na starszych wersjach Node (server/database.js uzywa `node:sqlite` wymagajacego Node 22.5+).
Akceptacja:
- `package.json` zawiera `"engines": { "node": ">=22.5" }`.
- plik `.env.example` dokumentuje wszystkie 9 zmiennych srodowiskowych: `REACT_APP_GOOGLE_CLIENT_ID`, `REACT_APP_DATA_PROVIDER`, `REACT_APP_MEDIA_PROVIDER`, `REACT_APP_API_BASE_URL`, `VOICELOG_API_PORT`, `VOICELOG_API_HOST`, `VOICELOG_DB_PATH`, `VOICELOG_UPLOAD_DIR`, `VOICELOG_SESSION_TTL_HOURS`.
- README (lub komentarz w package.json) informuje o wymogu Node 22.5+.
Zrodlo: audyt zalezonosci 2026-03-16, pozycje H8, M13.

---

## 049. URL.revokeObjectURL po eksporcie pliku
Status: `todo`
Priorytet: `P3`
Cel: wyeliminowac wyciek pamieci przy eksporcie (TXT/PDF).
Problem: `URL.createObjectURL` w `storage.js` linia ~79 nigdy nie jest revokowany — kazdy eksport zostawia w pamieci blob URL.
Akceptacja:
- po `link.click()` wywolywane jest `URL.revokeObjectURL(url)` (w setTimeout 100ms aby dac czas przegladarce na pobranie).
Techniczne wskazowki:
- `setTimeout(() => URL.revokeObjectURL(url), 100)` po `link.click()`.
Zrodlo: audyt kodu 2026-03-16, pozycja L1.

---

## 050. Naprawa endsAt dla task-eventow w googleSync.js
Status: `todo`
Priorytet: `P2`
Cel: eventy zadan w Google Calendar maja zerowy czas trwania (startsAt === endsAt).
Problem: `buildCalendarSyncSnapshot` dla `type === "task"` ustawia oba pola na ta sama wartosc (linia ~93 googleSync.js).
Akceptacja:
- task-eventy maja `endsAt` ustawione na `startsAt + 1h` (lub koniec dnia gdy brak godziny).
- istniejace testy googleSync przechodzi.
Techniczne wskazowki:
- `endsAt: new Date(new Date(source.dueDate).getTime() + 3600000).toISOString()`.
Zrodlo: audyt logiki 2026-03-16, pozycja M15.

---

## 051. Polling Google Calendar — visibility API i backoff
Status: `todo`
Priorytet: `P2`
Cel: nie odpytywac Google API gdy uzytkownik nie patrzy na aplikacje (karta w tle).
Problem: `setInterval` co 45s w useGoogleIntegrations.js odpytuje Google Calendar niezaleznie od stanu karty przegladarki.
Akceptacja:
- polling nie wykonuje sie gdy `document.visibilityState !== "visible"`.
- po powrocie do karty (visibilitychange event) odswiezenie wykonuje sie natychmiast.
- brak bledow w konsoli gdy token wygaznie podczas nieaktywnosci.
Techniczne wskazowki:
- `document.addEventListener("visibilitychange", ...)` zamiast lub dodatkowo do `setInterval`.
- wewnatrz intervalu: `if (document.hidden) return;`.
Zrodlo: audyt wydajnosci 2026-03-16, pozycja M1.

---

## 027. React Error Boundaries i graceful degradation
Status: `todo`
Priorytet: `P1`
Cel: zapobiec crashowi calej aplikacji przy nieobsluzonym wyjatku w jednym komponencie.
Akceptacja:
- kazdy glowny widok (Studio, Calendar, Tasks, Notes, People, Profile) ma osobny ErrorBoundary.
- po errore widac czytelny komunikat z przyciskiem "Odswierz widok" zamiast bialego ekranu.
- blad jest logowany (console.error lub sentry jesli dostepny).
- strona glowna nie crashuje jesli jeden tab rzuci wyjatek.
Techniczne wskazowki:
- nowy plik `src/lib/ErrorBoundary.js` — klasowy komponent z componentDidCatch.
- owinac kazdy tab w MainApp.js w dedykowany ErrorBoundary.
- pokazywac fallback z nazwa widoku i stacktrace w trybie dev.

---

## 028. Hardening bezpieczenstwa backendu
Status: `todo`
Priorytet: `P1`
Cel: usunac krytyczne luki: plaintext-equivalent hashing, brak rate-limitingu, zbyt szerokie CORS.
Zakres:
- hasla hashowane po stronie serwera z bcrypt (min 10 rounds) zamiast SHA-256 bez soli.
- rate limiting dla /auth/* — max 10 prob na IP w ciagu 60s, odpowiedz 429 po przekroczeniu.
- CORS zawezony do konkretnych origin (env: VOICELOG_ALLOWED_ORIGINS).
- naglowek Content-Security-Policy dla zasobow serwera.
- recovery code nie powinien byc zwracany w API response po stronie klienta — tylko boolean "wysylam email".
Techniczne wskazowki:
- npm install bcrypt (lub bcryptjs dla pure-JS) po stronie server/.
- prosty middleware counter dla rate limit w server/index.js (Map z resetem co 60s).
- CORS_ORIGINS z env z fallbackiem do localhost w development.

---

## 030. Nawigacja i lista spotkan w Studio
Status: `todo`
Priorytet: `P1`
Cel: uzytkownicy nie maja aktualnie mozliwosci przegladania spotkan bezposrednio w Studio — brak listy po usunieciu sidebara.
Akceptacja:
- w widoku Studio istnieje panel lub dropdown do szybkiego przelaczania miedzy spotkaniami.
- widac tytul, date i status aktywnego spotkania w naglowku.
- mozna wyszukac spotkanie po tytule (min. 10 ostatnich w menu).
- przycisk "+ Nowe" pozostaje zawsze dostepny.
- nawigacja do spotkania z zewnetrznego zrodla (Calendar, Notes, Cmd+K) nadal dziala.
Techniczne wskazowki:
- maly dropdown / popover z lista `userMeetings.slice(0, 10)` + pole wyszukiwania w naglowku StudioMeetingView.
- istniejaca prop `selectedMeeting` + `selectMeeting` wystarczy do obslugi.

---

## PRIORYTET P2 — wazne dla jakosci i completeness

---

## 010. Pelny live sync z Google Calendar i Google Tasks
Status: `in_progress`
Priorytet: `P2`
Cel: domknac integracje z Google — brakuje automatycznego wypychania lokalnych zmian.
Akceptacja:
- edycja lub usuniecie taska lokalnie automatycznie aktualizuje odpowiadajacy Google Task.
- utworzenie spotkania z briefem automatycznie tworzy event w Google Calendar (jesli polaczony).
- zmiany z Google odswiezane sa bez recznego klikania (dziala juz via timer 45s).
- widac status "zsynchronizowano X sekund temu" przy kazdej integracji.
Postep:
- automatyczne odswiezanie z Google dziala (45s timer).
- import/export manualny dziala.
- brakuje: auto-push lokalnych zmian zadania do Google Tasks, auto-create eventu przy saveMeeting.
Techniczne wskazowki:
- w useGoogleIntegrations: po resolveGoogleTaskConflict i po updateTask gdy googleTaskId istnieje — wywolac updateGoogleTask.
- w useMeetings: po saveMeeting — jezeli googleCalendarTokenRef.current i spotkanie ma googleEventId → syncCalendarEntryToGoogle.

---

## 016. Audit log i historia zmian z filtrowaniem
Status: `todo`
Priorytet: `P2`
Cel: dac pelna widocznosc zmian i odpowiedzialnosci w workspace.
Akceptacja:
- istnieje dedykowany widok historii zmian (osobna zakladka lub sekcja w Profile/Settings).
- mozna filtrowac po uzytkowniku, typie encji (meeting/task/recording), zakresie dat i rodzaju akcji.
- wpis pokazuje: kto, co, kiedy, na czym oraz roznice w kluczowych polach (przed/po).
- klikniecie wpisu otwiera powiazane spotkanie lub task.
Techniczne wskazowki:
- dane juz sa: meeting.activity[], task.history[] — potrzebny dedykowany widok agregujacy.
- filtrowanie po stronie klienta (useMemo) dla max 500 wpisow.

---

## 017. Dashboard KPI per osoba i obciazenie zespolu
Status: `todo`
Priorytet: `P2`
Cel: rozszerzyc analityke o widok per czlonek zespolu.
Akceptacja:
- widac liczbe taskow per osoba z podzialem na open / overdue / completed.
- widac ile decyzji i follow-upow powstaje po spotkaniach dla kazdego czlonka.
- dashboard pokazuje sygnaly przeciazenia: za duzo overdue, za duzo otwartych, za malo zamkniec.
- dane mozna filtrowac po workspace i zakresie dat.
Techniczne wskazowki:
- rozszerzyc kpi.js o buildPersonKpiView(tasks, meetings, peopleList, rangeDays).
- widok w KpiDashboard.js — dodac zakladke "Per osoba" obok istniejacego dashboardu workspace.

---

## 020. Dostepnosc i keyboard-only flows
Status: `todo`
Priorytet: `P2`
Cel: poprawic dostepnosc aplikacji i wygode pracy bez myszy.
Akceptacja:
- glowne widoki maja sensowne role ARIA, focus order i widoczne focus state (outline).
- da sie obsluzyc kluczowe flow klawiatura: nagranie, review transkrypcji, taski, command palette.
- formularze i panele nie maja krytycznych problemow z czytnikami ekranu (VoiceOver/NVDA smoke test).
- przyciski maja aria-label gdy nie maja tekstu (ikony, kolorowe swatche).
- co najmniej podstawowy axe-core accessibility smoke test w CI.
Techniczne wskazowki:
- npm install --save-dev @axe-core/react lub axe-playwright dla smoke testu.
- uzupelnic aria-label na: waveform SVG, cover-swatche, topbar record button, timeline segments.

---

## 029. Testy E2E — krytyczne flows
Status: `todo`
Priorytet: `P2`
Cel: zabezpieczyc przed regresja najwazniejsze scenariusze uzytkownika.
Zakres:
- flow rejestracji i logowania (email + Google mock).
- tworzenie spotkania + nagrywanie ad hoc + zapis.
- tworzenie zadania, zmiana statusu, usuwanie.
- import zadan z Google Tasks (mock API).
- command palette — nawigacja do zakladki, wynik spotkania.
Akceptacja:
- testy uruchamiaja sie w CI (GitHub Actions lub lokalnie npx playwright test).
- kazdy flow ma happy path + jeden blad (np. bledne haslo przy logowaniu).
- testy nie uzalezniaja sie od prawdziwego Google API — mock przez MSW lub fixtures.
Techniczne wskazowki:
- Playwright jest preferowany (npx playwright install).
- konfiguracja w playwright.config.js, testy w tests/e2e/.
- startuje dev server przed testami (webServer w playwright.config).

---

## 031. Tworzenie spotkania bezposrednio z widoku kalendarza
Status: `todo`
Priorytet: `P2`
Cel: skrocic sciezke do tworzenia spotkania — aktualnie wymaga przejscia do Studio.
Akceptacja:
- klikniecie na slotach godzinowych kalendarza tygodniowego otwiera szybki formularz nowego spotkania (tytul, termin wstepnie wypelniony kliknieta godzina).
- zapisanie formularza tworzy spotkanie i przekierowuje do Studio z otwartym briefem.
- jesli Google Calendar polaczony — opcja "Tworzy rowniez event w Google".
Techniczne wskazowki:
- onClick na pustym slocie w CalendarTab.js → setMeetingDraftFromSlot(date, hour) → setActiveTab("studio").
- wystarczy przekazac startNewMeetingDraft(prefill) z datą/godziną.

---

## 032. Lepsza obsluga bledow pipeline nagrywania
Status: `todo`
Priorytet: `P2`
Cel: uzytkownicy nie wiedza co robic gdy nagranie utknie w stanie failed lub processing.
Akceptacja:
- dla kazdego failed item w kolejce widac czytelny komunikat bledu (nie "Error processing").
- przycisk "Ponow" wyswietla sie przy kazdym failed item z informacja ile razy probowano.
- jesli brak internetu widac "Oczekuje na polaczenie — ponowi automatycznie".
- max 3 retry automatyczne z exponential backoff (1s, 4s, 16s).
- po 3 niepowodzeniach item nie znika — zostaje z "Blad trwaly, sprawdz polaczenie lub serwer".
Techniczne wskazowki:
- dodac retryCount, lastError, backoffUntil do RecordingQueueItem.
- w useRecorder: sprawdzac backoffUntil przed processowaniem kolejnego itemu.
- rozszerzyc komunikaty w recording.js.

---

## 033. Optymalizacja wydajnosci — code splitting i memoizacja
Status: `todo`
Priorytet: `P2`
Cel: skrocic czas pierwszego ladowania i poprawic responsywnosc przy duzych datasetach.
Zakres:
- code splitting dla ciezkich komponentow (TaskKanbanView, TranscriptPanel, KpiDashboard, NotesTab) via React.lazy + Suspense.
- React.memo dla TaskListView, NoteCard, TranscriptSegment — komponenty rerenderujace sie zbyt czesto.
- useMemo dla sortVisibleTasks, buildWorkspaceActivityFeed, groupTasks przy duzych listach.
- bundle analyse: npm run build -- --stats + webpack-bundle-analyzer.
Akceptacja:
- czas FCP na dev server < 1.5s po code splitting.
- brak widocznych "lag spikes" przy scrollowaniu listy 100+ taskow.
- build chunk dla lazy views < 50kB gzip kazdego.
Techniczne wskazowki:
- React.lazy(() => import("./tasks/TaskKanbanView")) w TasksTab.js.
- Suspense fallback: prosty spinner lub szkielet.
- sprawdzic czy aktualny useMemo w taskViewUtils.js ma stabilne referencje deps.

---

## 034. Onboarding dla nowych uzytkownikow
Status: `todo`
Priorytet: `P2`
Cel: pierwsze 5 minut w aplikacji jest dezorientujace — nowy user nie wie od czego zaczac.
Akceptacja:
- po pierwszej rejestracji widac ekran powitalny z 3 krokami: "Nagraj pierwsze spotkanie", "Dodaj zadanie", "Polacz Google".
- kazdy krok ma przycisk akcji prowadzacy bezposrednio do odpowiedniego flow.
- mozna pominac onboarding jednym klikniciem.
- po ukonczeniu 3 krokow widac krotkie potwierdzenie.
- onboarding nie pojawia sie po ponownym logowaniu.
Techniczne wskazowki:
- stan onboardingCompleted w profilu uzytkownika (updateUserProfile).
- nowy komponent OnboardingBanner.js pokazywany nad tabow gdy !user.onboardingCompleted.
- krok uznany za ukonczony gdy: pierwsze nagranie zapisane, pierwsze zadanie stworzone, Google polaczony.

---

## 035. Delta sync zamiast pelnego PUT stanu workspace
Status: `todo`
Priorytet: `P2`
Cel: aktualny stateService.syncWorkspaceState wysyla caly state za kazdym razem — roznie przy 50+ spotkaniach.
Akceptacja:
- server przyjmuje PATCH /state/workspaces/{id} z deltatem (lista zmienionych encji).
- klient slucha tylko tych pol ktore faktycznie sie zmienily (dirty tracking).
- full sync pozostaje jako fallback (GET /state/bootstrap).
- payload synca przy edycji jednego taska < 5kB zamiast potencjalnie 500kB.
Techniczne wskazowki:
- dirty flag w useMeetings: gdy zmieni sie konkretne meeting/task → dodaj do dirtySet.
- PATCH endpoint przyjmuje { meetings?: [...], tasks?: [...], taskState?: {...} }.
- server: merge patch z istniejacym state (JSON merge, nie replace).

---

## 036. Backup i restore danych workspace (JSON export/import)
Status: `todo`
Priorytet: `P2`
Cel: uzytkownik moze stracic dane przy czyszczeniu localStorage lub zmianie urzadzenia.
Akceptacja:
- w Profile / Settings przycisk "Eksportuj dane workspace" pobiera plik JSON ze wszystkimi spotkaniami, zadaniami i nagraniami (metadane, bez audio blob).
- przycisk "Importuj dane" laduje plik JSON i merduje z biezacym stanem (nie nadpisuje).
- import waliduje schemat przed zastosowaniem i pokazuje preview: ile spotkan, taskow zostanie dodanych.
- audio blobs sa pomijane przy eksporcie (za duze) — eksportuje sie URL-e lub opis.
Techniczne wskazowki:
- exportWorkspaceJson(meetings, tasks, taskBoards) → downloadTextFile("backup.json", ...).
- importWorkspaceJson(jsonString, currentMeetings, currentTasks) → merge z deduplikacja po id.
- walidacja: sprawdzic ze meetings[] i tasks[] sa tablicami z polem id.

---

## 039. Zarzadzanie pamiecia audio — limity IndexedDB
Status: `todo`
Priorytet: `P2`
Cel: aplikacja moze wypelnic quota storage przegladarki bez zadnego ostrzezenia.
Akceptacja:
- przy starcie aplikacji sprawdzana jest dostepna i uzyta przestrzen IndexedDB (navigator.storage.estimate).
- jezeli uzyte > 80% quota: widac ostrzezenie z informacja ile miejsca pozostalo.
- w Profile / Settings widac liste nagran z rozmiarami i przyciskiem "Usun audio z pamieci lokalnej" per nagranie.
- usuniecie audio lokalnie nie usuwa transkrypcji ani metadanych spotkania.
Techniczne wskazowki:
- navigator.storage?.estimate() przy starcie w useRecorder lub useWorkspace.
- nowa funkcja audioStore.deleteRecordingBlob(recordingId) i audioStore.listStoredSizes().
- widok listy nagran z rozmiarami w ProfileTab.js.

---

## PRIORYTET P3 — usprawnienia i nice-to-have

---

## 018. Outlook / Microsoft To Do / Microsoft Calendar
Status: `todo`
Priorytet: `P3`
Cel: rozszerzyc integracje poza ekosystem Google.
Akceptacja:
- mozna polaczyc konto Microsoft (MSAL OAuth2).
- zadania synchronizuja sie z Microsoft To Do podobnie jak z Google Tasks.
- spotkania moga byc synchronizowane z Outlook Calendar.
- UI pokazuje status polaczenia i ostatni sync per provider.
Techniczne wskazowki:
- @azure/msal-browser jako alternatywa dla GSI.
- MS Graph API dla To Do: https://graph.microsoft.com/v1.0/me/todo/lists.
- analogiczna architektura jak googleSync.js → msSync.js.

---

## 019. Integracja ze Slack / Teams po spotkaniu
Status: `todo`
Priorytet: `P3`
Cel: szybciej przenosic wynik spotkania do narzedzi komunikacyjnych zespolu.
Akceptacja:
- mozna wyslac podsumowanie spotkania, decyzje i taski do wybranego kanalu Slack lub Teams.
- mozna wybrac szablon wiadomosci i zakres informacji do publikacji.
- taski i follow-upy maja klikalne linki do aplikacji.
- po wysylce widac status publikacji i ewentualny blad.
Techniczne wskazowki:
- Slack Incoming Webhooks (nie OAuth) dla MVP — tylko URL webhooka w ustawieniach.
- Teams: Incoming Webhook connector URL.
- POST JSON payload z summary, decisions[], tasks[] → buildSlackPayload(meeting, analysis).

---

## 023. AI — inteligentny asystent priorytetu i terminu
Status: `todo`
Priorytet: `P2`
Cel: pomoc uzytkownikowi lepiej planowac dzien przez AI ktory sugeruje kolejnosc i termin dla otwartych zadan.
Zakres:
- przycisk `Zaplanuj z AI` w widoku `Moj dzien` lub toolbarze zadan.
- Claude analizuje liste otwartych zadan i zwraca: rekomendowana kolejnosc na dzisiaj (max 5), uzasadnienie dla kazdego, flagi ryzyka (overdue, blokujace inne).
- wynik pokazywany jako karty `Plan na dzis` w sidebarze lub osobnym panelu.
- uzytkownik moze zaakceptowac sugestie (zadania trafiaja do `My Day`) lub zignorowac.
Akceptacja:
- wywolanie AI trwa < 5 s dla listy 50 zadan.
- wynik zawiera max 5 zadan na dzien z krotkim uzasadnieniem.
- zaakceptowanie planu oznacza zadania jako `myDay = true`.
- jezeli nie ma API key, przycisk jest ukryty lub wyszarzony.
Techniczne wskazowki:
- nowy plik `src/lib/aiDayPlanner.js` z funkcja `planMyDay(tasks, currentDate)`.
- prompt zawiera aktualna date i wstepne sortowanie po SLA przed wywolaniem LLM.
- cachowac wynik w `sessionStorage` przez 15 minut.

---

## 024. AI — automatyczny coaching po spotkaniu (meeting debrief)
Status: `todo`
Priorytet: `P2`
Cel: po zakonczeniu spotkania AI generuje krotki debrief: streszczenie, decyzje, ryzyka, follow-upy.
Zakres:
- sekcja `Debrief AI` w panelu spotkania, dostepna po analizie transkrypcji.
- Claude generuje: streszczenie 3-5 zdan, lista decyzji (max 5), ryzyk (max 3), sugestii follow-up.
- format renderowany jako listy w UI.
- uzytkownik moze skopiowac debrief do schowka lub wyeksportowac do PDF.
- debrief persystuje w danych spotkania (pole `aiDebrief`).
Akceptacja:
- debrief dostepny jednym kliknieciem po analizie.
- zawiera sekcje: streszczenie, decyzje, ryzyka, follow-upy.
- eksport PDF lub kopia do schowka dziala.
- debrief persystuje w meeting.aiDebrief.
Techniczne wskazowki:
- rozbudowac `src/lib/analysis.js` o funkcje `generateMeetingDebrief(meeting, transcript)`.
- prompt po polsku, wynik zapisywac przez istniejacy mechanizm updateMeeting.

---

## 025. AI — semantyczne wyszukiwanie zadan i spotkan
Status: `todo`
Priorytet: `P3`
Cel: umozliwic wyszukiwanie naturalnym jezykiem zamiast slow kluczowych.
Zakres:
- rozbudowac command palette (Ctrl+K) o semantyczne wyszukiwanie przez LLM.
- zapytanie przesylane do Claude z kontekstem: lista spotkan (tytul + streszczenie) + lista zadan (tytul + opis).
- Claude zwraca ranking najbardziej pasujacych elementow.
- wyniki oznaczone `AI Match` odrozniaja sie od pelnotekstowych.
- jezeli brak API key, AI match wylaczony, standardowe wyszukiwanie dziala.
Akceptacja:
- wyniki semantyczne w < 3 s dla max 100 elementow.
- AI Match wizualnie odroznialne od standardowych wynikow.
- brak API key — brak bledow w konsoli, funkcja ukryta.
Techniczne wskazowki:
- nowy plik `src/lib/aiSearch.js` z funkcja `semanticSearch(query, meetings, tasks)`.
- przekazywac tylko tytuly i streszczenia (nie pelne transkrypty).
- cache wynikow w Map z kluczem `query` przez sesje.

---

## 037. Ekran zarzadzania tagami
Status: `todo`
Priorytet: `P3`
Cel: tagi rosna niekontrolowanie — brak widoku all-tags i mozliwosci zmiany nazwy lub usuwania.
Akceptacja:
- w zakladce Tasks lub Profile istnieje widok "Tagi" z lista wszystkich tagow w workspace.
- mozna zmienic nazwe tagu (zmienia we wszystkich taskach i spotkaniach).
- mozna usunac tag (usuwa z wszystkich encji).
- widac ile taskow i spotkan uzywa kazdego tagu.
Techniczne wskazowki:
- renameTag(tasks, meetings, oldTag, newTag) — map/replace po calej kolekcji.
- brak osobnego storage — tagi sa czesc meeting.tags i task.tags.

---

## 038. Tryb jasny i przelacznik motywu
Status: `todo`
Priorytet: `P3`
Cel: ciemny motyw jest jedynym dostepnym — niektore srodowiska (prezentacje, jasne biura) wymagaja jasnego.
Akceptacja:
- w Profile / Settings toggle "Motyw: Ciemny / Jasny".
- wybor persystuje w localStorage i profilu uzytkownika.
- jasny motyw spelnia minimalny kontrast WCAG AA dla glownych klas tekstu.
Techniczne wskazowki:
- CSS: :root[data-theme="light"] { --bg: #f6f9fb; --text: #111; ... }.
- data-theme atrybut na <html> element.
- w App.js lub MainApp.js: document.documentElement.setAttribute("data-theme", ...).

---

## 040. Email digest i powiadomienia poza przegladarka
Status: `todo`
Priorytet: `P3`
Cel: Browser Notifications wymagaja otwartej karty — usefulness poza sesja jest zerowa.
Akceptacja:
- uzytkownik moze wlaczyc "Dzienny digest" w Profile — email przychodzi raz dziennie (7:00 lokalnego czasu).
- digest zawiera: zadania zalegajace (overdue), zadania na dzisiaj, nadchodzace spotkania.
- email jest plain-text lub prosty HTML (bez obrazkow).
- nie wymaga wlaczonego klienta — dziala przez endpoint serwera + cron.
Techniczne wskazowki:
- serwer: endpoint GET /digest/daily wywolywalny przez cron (lub manualnie do testow).
- nodemailer + SMTP (env: VOICELOG_SMTP_HOST/USER/PASS).
- user.notifyDailyDigest juz istnieje w profilu — podlaczenie pod mailer.

---

## 041. Podzial App.css na moduly CSS
Status: `todo`
Priorytet: `P3`
Cel: App.css przekroczyl 3500 linii i jest trudny w utrzymaniu — brak izolacji stylów, konflikty nazw.
Zakres:
- podzielic App.css na moduly per funkcjonalnosc: layout.css, studio.css, tasks.css, calendar.css, notes.css, people.css, profile.css, animations.css, variables.css.
- zmienne CSS pozostaja w :root w variables.css importowanym przez index.css.
- zadne istniejace style nie moga sie psuć — zmiana czysto strukturalna.
Akceptacja:
- kazdy plik < 500 linii.
- build przechodzi bez ostrzezen.
- brak regresji wizualnych (smoke test na glownych widokach).

---

## 042. PropTypes lub TypeScript — bezpieczenstwo typow
Status: `todo`
Priorytet: `P3`
Cel: 14k+ linii pure JS bez typow to rosnace ryzyko regresji i trudnosci refaktoru.
Zakres:
- opcja A (szybsza): dodac PropTypes dla najwazniejszych komponentow (MainApp, TaskDetailsPanel, TranscriptPanel, StudioMeetingView).
- opcja B (dlugoterminowa): migracja do TypeScript — zaczac od lib/ (auth.js, tasks.js, googleSync.js) i rozszerzac iteracyjnie.
- nie konwertowac wszystkiego naraz — stopniowa migracja plik po pliku.
Akceptacja:
- opcja A: brak warn "missing required prop" dla kluczowych komponentow w konsoli dev.
- opcja B: tsconfig.json z "allowJs: true" + strict: false na start, po 20 plikach podniesc do strict: true.
Techniczne wskazowki:
- opcja B: npm install --save-dev typescript @types/react @types/react-dom.
- rename: auth.js → auth.ts, stopniowe dodawanie interface.
