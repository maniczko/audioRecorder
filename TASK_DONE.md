# TASK_DONE

Zrealizowane zadania przeniesione z TASK_QUEUE.md.

---

## 066. [SPEAKER] Aktywny mówca w UnifiedPlayer podczas odtwarzania
Status: `done`
Priorytet: `P2`
Wynik:
- `src/studio/UnifiedPlayer.js` — nowe props `transcript` + `displaySpeakerNames`; `activeSeg` = segment gdzie `timestamp <= currentTime < endTimestamp`.
- Chip `.uplayer-speaker-chip` z `--chip-color: getSpeakerColor(speakerId)` renderowany między czasem a scrubberem w trybie playback; ukryty gdy żaden segment nie pokrywa pozycji.
- CSS: transition background 0.25s + kółko-indicator przed nazwą mówcy.
- `src/studio/StudioMeetingView.js` przekazuje `transcript={displayRecording?.transcript}` i `displaySpeakerNames`.
- `src/lib/speakerColors.js` + `src/lib/recording.js` (labelSpeaker) importowane w UnifiedPlayer.

---

## 029. Testy E2E — krytyczne flows
Status: `done`
Priorytet: `P2`
Wynik:
- `playwright.config.js` — konfiguracja Playwright z webServer (port 3000), chromium, CI retries.
- `tests/e2e/helpers/seed.js` — helper `seedLoggedInUser / seedMeeting / seedTask` do seedowania localStorage przed testem.
- `tests/e2e/auth.spec.js` — rejestracja nowego konta (happy), duplikat emaila (error), logowanie (happy), złe hasło (error).
- `tests/e2e/meeting.spec.js` — tworzenie spotkania (happy), pusty tytuł → przycisk disabled (error), reset formularza.
- `tests/e2e/tasks.spec.js` — szybkie dodanie zadania (happy), pusty tytuł (error), edycja, usuwanie, mock Google Tasks.
- `tests/e2e/command-palette.spec.js` — Ctrl+K (happy), filtrowanie, nawigacja, Escape (error), backdrop, brak wyników.
- `package.json` — `@playwright/test ^1.48` w devDependencies, skrypty `test:e2e` i `test:e2e:ui`.
Uruchamianie: `npx playwright install` raz, potem `npm run test:e2e` (wymaga działającego dev-server lub go uruchamia automatycznie).

---

## 037. Ekran zarządzania tagami
Status: `done`
Priorytet: `P3`
Wynik:
- Zaimplementowane w `ProfileTab.js` jako `TagManagerSection` — lista wszystkich tagów workspace z licznikami (zadania + spotkania).
- Kliknięcie nazwy tagu wchodzi w tryb inline-edit, Enter/blur zatwierdza zmianę.
- Przycisk × usuwa tag ze wszystkich spotkań i zadań.
- `renameTag` / `deleteTag` w `useMeetings.js` — propagacja do `meetings[]` i `manualTasks[]`.
- `allTags` obliczane w `MainApp.js` z `userMeetings` + `meetingTasks`, przekazywane do `ProfileTab`.
- Style `.tag-manager-*` w `App.css`.

---

## 001. Globalne wyszukiwanie i command palette
Status: `done`
Priorytet: `P1`
Cel: przyspieszyc poruszanie sie po aplikacji i dostep do najczesciej uzywanych obiektow.
Akceptacja:
- `Ctrl+K` lub `Cmd+K` otwiera palette z wyszukiwaniem.
- mozna wyszukac zakladki, spotkania, zadania i osoby.
- wybor wyniku otwiera odpowiedni widok i zaznacza obiekt.
- palette zamyka sie `Esc` i po wyborze wyniku.
Wynik:
- wdrozone w UI wraz z testem integracyjnym.

---

## 002. Autosave draftow spotkan i przywracanie po odswiezeniu
Status: `done`
Priorytet: `P1`
Cel: ograniczyc utrate danych przy odswiezeniu strony lub przypadkowym wyjsciu.
Akceptacja:
- formularz briefu spotkania zapisuje draft automatycznie.
- po odswiezeniu draft wraca dla biezacego workspace.
- uzytkownik moze wyczyscic draft recznie.
Wynik:
- wdrozone autosave per workspace, restore po odswiezeniu i reczne czyszczenie draftu w Studio.

---

## 003. Centrum powiadomien i browser notifications
Status: `done`
Priorytet: `P1`
Cel: poprawic obsluge terminow, przypomnien i taskow po SLA.
Akceptacja:
- jest panel powiadomien w aplikacji.
- przypomnienia o zadaniach i spotkaniach trafiaja do panelu.
- po zgodzie przegladarki pojawiaja sie browser notifications.
Wynik:
- dodane centrum powiadomien w topbarze, alerty o przypomnieniach i SLA oraz browser notifications po zgodzie.

---

## 004. Aktywnosc workspace i realtime feed
Status: `done`
Priorytet: `P1`
Cel: lepiej pokazac prace zespolowa i zmiany bez recznego odswiezania.
Akceptacja:
- widac feed: kto dodal komentarz, task, spotkanie lub zmienil status.
- feed odswieza sie automatycznie w trybie `remote`.
- przy taskach i spotkaniach widac ostatnia aktywnosc.
Wynik:
- dodany feed aktywnosci workspace, ostatnia aktywnosc przy spotkaniach i zadaniach oraz test helpera aktywnosci.

---

## 005. Upload queue i retry dla audio
Status: `done`
Priorytet: `P1`
Cel: zwiekszyc niezawodnosc nagran i transkrypcji.
Akceptacja:
- nagrania maja status `queued / uploading / processing / failed / done`.
- nieudany upload mozna ponowic jednym kliknieciem.
- kolejka nie gubi nagran po chwilowej utracie sieci.
Wynik:
- dodana trwala kolejka audio z retry, statusami pipeline oraz zabezpieczeniem przed blokowaniem kolejki przez osierocone wpisy.

---

## 006. Waveform i timeline review dla transkrypcji
Status: `done`
Priorytet: `P2`
Cel: ulatwic review segmentow i prace na nagraniu.
Akceptacja:
- widac waveform lub os czasu nagrania.
- klik w segment przewija i odtwarza odpowiedni moment.
- mozna zaznaczac zakres audio i przypisac speakera.
Wynik:
- dodany timeline review z klikalnymi segmentami, seek + play audio oraz przypisywanie speakera dla wybranego zakresu czasu.

---

## 007. Rozbudowane role i uprawnienia workspace
Status: `done`
Priorytet: `P2`
Cel: lepiej przygotowac produkt do pracy kilku osob na jednym workspace.
Akceptacja:
- role `owner / admin / member / viewer` maja rozne uprawnienia.
- UI pokazuje, kto moze edytowac, usuwac i eksportowac.
- owner moze zarzadzac rolami z poziomu aplikacji.
Wynik:
- dodane role workspace z macierza uprawnien, blokady edycji i eksportu dla widoku `viewer` oraz panel ownera do zarzadzania rolami zespolu.

---

## 008. Dashboard KPI dla spotkan i zadan
Status: `done`
Priorytet: `P2`
Cel: dac szybszy wglad w skutecznosc spotkan i follow-upow.
Akceptacja:
- widac liczbe decyzji, otwartych taskow, overdue i taskow po spotkaniach.
- dashboard filtruje po workspace i zakresie dat.
- widok pokazuje trendy tygodniowe lub miesieczne.
Wynik:
- dodany dashboard KPI w Studio z filtrem zakresu dat, trendami tygodniowymi lub miesiecznymi i podsumowaniem decyzji oraz taskow.

---

## 009. Lepsza wersja mobilna i PWA
Status: `done`
Priorytet: `P2`
Cel: poprawic wygode pracy na telefonie i tabletach.
Akceptacja:
- glowne widoki sa responsywne na mobile.
- aplikacja ma sensowny `manifest` i da sie zainstalowac.
- najwazniejsze akcje sa dostepne bez poziomego scrolla.
Wynik:
- dopracowane zachowanie topbara i akcji na mobile, odswiezony manifest PWA oraz dodana rejestracja service workera do instalacji aplikacji.
- taski pokazuja teraz widoczny stan `online / offline`, tryb `przegladarka / aplikacja` i gotowosc cache offline, wiec korzysci z PWA sa czytelne z poziomu UI.

---

## 011. Rozwiniete zarzadzanie zadaniami jak Microsoft To Do / Google Tasks
Status: `done`
Priorytet: `P2`
Cel: rozbudowac modul zadan tak, aby byl realnym centrum codziennej pracy, a nie tylko lista follow-upow po spotkaniach.
Zakres:
- dodac widoki i filtry w stylu `Moj dzien`, `Wazne`, `Zaplanowane`, `Powtarzalne`, `Po terminie`, `Ukonczone`.
- rozbudowac szczegoly zadania o `notatki`, `kroki / subtaski`, `termin`, `przypomnienie`, `powtarzalnosc`, `zalaczniki / linki`.
- poprawic szybkie dodawanie i edycje inline, tak aby wiekszosc zmian dalo sie wykonac bez wchodzenia w pelny formularz.
- dodac wygodniejsze grupowanie i sortowanie po `terminie`, `priorytecie`, `osobie`, `projekcie / grupie`, `statusie`.
- dodac obsluge drag and drop, masowych akcji i szybkiego oznaczania `important / completed / my day`.
- zapewnic parity dla integracji z Google Tasks: import, eksport, mapowanie terminow, statusow i podstawowych metadanych.
Akceptacja:
- uzytkownik ma widoki odpowiadajace codziennym scenariuszom pracy podobne do Microsoft To Do i Google Tasks.
- zadanie moze miec subtaski, notatki, termin, przypomnienie i powtarzalnosc.
- najczestsze akcje sa dostepne inline: utworzenie, zmiana terminu, oznaczenie waznosci, ukonczenie, przeniesienie.
- lista zadan dobrze dziala na desktopie i mobile bez poziomego scrolla dla kluczowych akcji.
- integracja z Google Tasks nie gubi podstawowych pol zadania i pokazuje status synchronizacji.
Wynik:
- rozbudowano taski o smart listy `My Day / Important / Planned / Overdue / Recurring / Completed`, przypomnienia, linki i szybsze akcje inline.
- panel zadan i detal zadania zostaly dopracowane tak, aby byly blizsze pracy znanej z Microsoft To Do i Google Tasks.
- ustandaryzowano 3-panelowy layout, polozenie akcji, quick add, sekcje filtrow oraz prawy panel detalu tak, aby widok byl spojny z reszta aplikacji.

---

## 021. Kanban w stylu Microsoft Planner — swimlanes, widok wykresow i zaawansowane karty
Status: `done`
Priorytet: `P1`
Cel: podniesc widok tablicy Kanban do poziomu wizualnego i funkcjonalnego Microsoft Planner.
Wynik:
- TaskKanbanView przebudowany: cover bar (8 kolorow), kolorowe chipsety tagow z hashowaniem, pasek postepu subtaskow, avatary inicjalow z kolorami, hover actions (move-to-column select), quick-add inline per kolumna, WIP limit z ostrzezeniem w naglowku, swimlanes (by Person / Priority / Label / Due), drag-reorder naglowkow kolumn.
- TaskChartsView (nowy): 4 wykresy SVG bez bibliotek — donut (status, priorytet), bar (osoby, terminy).
- TaskScheduleView (nowy): os czasu 2 tyg / 5 tyg, drag zadania na dzien zmienia dueDate, sekcja "Bez terminu".
- TasksWorkspaceView: 4 zakladki widoku (Kanban / Lista / Wykresy / Harmonogram), swimlane select w toolbarze, przycisk Eksport CSV.
- TasksTab: stan swimlaneGroupBy, handler handleQuickAddToColumn, handleColumnReorder, handleExportCsv (Blob download).
- TaskDetailsPanel: picker 8 kolorow cover bar (kolor zapisywany w task.coverColor).
- TasksSidebar: pole WIP limit per kolumna w ColumnManager.
- lib/tasks.js: normalizeColumns zachowuje wipLimit.
- App.css: ~450 nowych linii CSS dla wszystkich powyzszych komponentow.

---

## 013. Prawdziwy waveform audio i markery na nagraniu
Status: `done`
Priorytet: `P2`
Cel: poprawic review nagran i uczynic prace na audio bardziej precyzyjna.
Wynik:
- WaveformPanel w TranscriptPanel: Web Audio API dekoduje audio URL i renderuje 200 SVG bars z realnych danych kanalowych.
- Klik na waveformie przewija audio do kliknieto pozycji.
- Tryb "+ Dodaj marker": klik na waveformie dodaje marker z timestampem, marker persystuje przez addRecordingMarker (useMeetings).
- Markery renderowane jako zlote piny (SVG line + circle) na waveformie.
- Lista markerow pod waveformem z przyciskami seek i usun.
- Playhead renderowany jako linia na waveformie, odswieza sie przez timeupdate event.

---

## 022. AI — inteligentne sugerowanie i kategoryzacja zadan po spotkaniu
Status: `done`
Priorytet: `P1`
Cel: zautomatyzowac zamiane ustalen ze spotkan na dobrze opisane, przypisane i skategoryzowane zadania.
Wynik:
- src/lib/aiTaskSuggestions.js: funkcja suggestTasksFromTranscript(transcript, people) wywoluje Claude API (claude-sonnet-4-6), zwraca max 10 zadan z polami title/description/owner/dueDate/priority/tags.
- src/studio/AiTaskSuggestionsPanel.js: panel w StudioMeetingView z przyciskiem "Generuj sugestie AI".
- Kazda sugestia ma przyciski: Zatwierdz (tworzy task z sourceType: "ai-suggestion"), Edytuj (inline form), Odrzuc.
- Panel jest ukryty jezeli REACT_APP_ANTHROPIC_API_KEY nie jest ustawiony.
- Sugestie oznaczone wizualnie badgem "AI" i kolorem priorytetu.

---

## 026. UI/UX ergonomia — spojnosc, alignment i interaktywnosc
Status: `done`
Priorytet: `P1`
Cel: zapewnic perfekcyjna ergonomie interfejsu bez nachodzenia, z rowno wyrowanymi przyciskami i spójnymi stanami.
Wynik (App.css — 25 poprawek w bloku 026):
- button-row: dodano align-items center + flex-wrap wrap + row-gap 8px — przyciski nigdy nie nachodza na siebie.
- topbar-actions + status-cluster: align-items center — wszystkie chipsety i przyciski wyrownane w pionie.
- .small modifier: ujednolicono primary/secondary/ghost/danger w jednej regule (8px 12px, 0.84rem).
- :disabled state: opacity 0.42, cursor not-allowed, transform none, pointer-events none dla wszystkich buttonow.
- :focus-visible: jednolity outline 2px rgba(158,242,219,0.7) + box-shadow dla wszystkich buttonow i todo buttons.
- transcript-bulk-actions + transcript-advanced-filters: align-items center zamiast flex-end — select + button na jednej osi.
- transcript-bulk-toolbar: row-gap 12px przy zawijaniu.
- panel-header: min-height 44px dla spojnosci.
- ai-suggestion-meta-row: owner input flex:1, date flex:0 0 150px, select flex:0 0 120px — brak overflow w flex row.
- .todo-detail-card sticky: z-index 10 — nie przykrywany przez inne panele.
- review-queue-list: min-height 80px.
- segment-card textarea: min-height 52px.
- kanban-board + kanban-column-body: gap 12px (ujednolicono z reszta layoutu).
- task-flag: white-space nowrap + flex-shrink 0 — nie lamie sie w srodku etykiety.
- topbar: flex-wrap wrap + topbar-actions flex-wrap + row-gap przy max-width 1100px.

---

## 012. Konflikty synchronizacji Google i centrum rozwiazywania zmian
Status: `done`
Priorytet: `P2`
Cel: bezpiecznie obslugiwac przypadki, w ktorych dane lokalne i Google roznia sie od siebie.
Wynik:
- googleSync.js: detectGoogleTaskConflict, createGoogleTaskConflictState, detectGoogleCalendarConflict, createGoogleCalendarConflictState.
- tasks.js: upsertGoogleImportedTasks wykrywa konflikt przez createGoogleTaskConflictState i ustawia googleSyncConflict na zadaniu.
- TaskDetailsPanel: pelny panel lokalny/Google/finalna wersja z trybami local/google/merge.
- useGoogleIntegrations: resolveGoogleTaskConflict zapisuje finale wersje do Google i czysc pole konfliktu.
- TasksTab: conflictTasks memo + onFocusConflictTask + TasksSidebar pokazuje center konfliktow.

---

## 015. Komentarze, mentiony i presence w workspace
Status: `done`
Priorytet: `P2`
Cel: lepiej wspierac wspolprace zespolu przy spotkaniach i zadaniach.
Wynik:
- useMeetings: addMeetingComment(meetingId, text, authorName) dodaje komentarz + wpis activity z @mention detection.
- StudioMeetingView: panel komentarzy do spotkania z textarea i listą komentarzy (reversed), wyswietla @mention chips.
- TaskDetailsPanel: sekcja komentarzy z createTaskComment (author, text, createdAt).
- App.css: style dla meeting-comment-card, meeting-comment-meta, mention-chip.

---

## 014. Tryb review transkrypcji ze skrotami klawiaturowymi
Status: `done`
Priorytet: `P2`
Cel: przyspieszyc review transkrypcji przy dluzszych nagraniach.
Wynik:
- TranscriptPanel: useEffect na keydown — ] / → nastepny, [ / ← poprzedni, A zatwierdz, S zostaw w review, Space play/pause, P odtworz od aktywnego.
- Licznik postep "X/Y zatwierdzonych" w naglowku review queue.
- Przycisk "Zatwierdz wszystkie (N)" — bulk approve wszystkich widocznych review segmentow.
- Panel pomocy klawiszowej z <kbd> renderingiem (toggle ⌨ Skróty).
- Auto-scroll aktywnego elementu w liscie review przez activeReviewItemRef.

---

## 028. Hardening bezpieczenstwa backendu
Status: `done`
Priorytet: `P1`
Cel: usunac krytyczne luki bezpieczenstwa backendu.
Wynik:
- Hasla: crypto.scryptSync z 16-bajtowym losowym salt (bezpieczniejsze niz bcrypt).
- Rate limiting /auth/*: Map-based, max 10 prob/60s, 429 + Retry-After (zadanie 044).
- CORS: VOICELOG_ALLOWED_ORIGINS (zadanie 044).
- Recovery code: nie zwracany w response — tylko { expiresAt }, kod logowany do konsoli w trybie dev.
- Content-Security-Policy: default-src 'none' + X-Content-Type-Options: nosniff + X-Frame-Options: DENY dodane do wszystkich odpowiedzi przez securityHeaders() w server/index.js.

---

## 027. React Error Boundaries i graceful degradation
Status: `done`
Priorytet: `P1`
Cel: zapobiec crashowi calej aplikacji przy nieobsluzonym wyjatku w jednym komponencie.
Wynik:
- src/lib/ErrorBoundary.js — klasowy komponent z getDerivedStateFromError + componentDidCatch.
- console.error z labelem taba przy kazdym bledzie.
- fallback: czytelny komunikat + przycisk "Odswierz widok"; stacktrace widoczny tylko w dev.
- MainApp.js: <ErrorBoundary key={activeTab} label="..."> wrapuje caly blok tabow — key resetuje boundary przy przelaczaniu zakladek, label identyfikuje widok w logu.
- style .error-boundary-fallback / .error-boundary-stack dodane do App.css.

---

## 030. Nawigacja i lista spotkan w Studio
Status: `done`
Priorytet: `P1`
Cel: uzytkownicy moga przegladac i przelaczac spotkania bezposrednio w Studio bez sidebara.
Wynik:
- MeetingPicker jako pelny naglowek Studio: tytul, data, czas trwania, liczba nagran.
- Dropdown "Zmien ▾" z wyszukiwarka i lista 10 ostatnich spotkan.
- Przycisk "+ Nowe" zawsze widoczny.
- RecordingsLibrary na dole strony rowniez w pustym stanie bez wybranego spotkania.
- Zrealizowane w ramach zadania 052 (redesign MeetingPicker + globalna biblioteka nagran).

---

## 043. XSS — sanityzacja HTML w NotesTab (dangerouslySetInnerHTML)
Status: `done`
Priorytet: `P1`
Cel: zapobiec XSS przy renderowaniu notatek z edytora WYSIWYG.
Wynik:
- DOMPurify.sanitize() przed kazda wartoscia dangerouslySetInnerHTML.
- dozwolone tagi: b, i, u, em, strong, ul, ol, li, p, br.
- test jednostkowy sprawdza usuniecie script-taga.

---

## 044. CORS i rate limiting na backendzie
Status: `done`
Priorytet: `P1`
Cel: zamknac dwie luki krytyczne: nieograniczony dostep cross-origin oraz brak ochrony przed brute-force.
Wynik:
- CORS zawezony do VOICELOG_ALLOWED_ORIGINS (domyslnie http://localhost:3000).
- Map-based rate limiter: max 10 prob na IP/60s dla /auth/*, odpowiedz 429 z Retry-After.
- recoveryCode usuniete z response body API.

---

## 045. Memoizacja buildTasksFromMeetings i pochodnych
Status: `done`
Priorytet: `P1`
Cel: wyeliminowac najdrozsze obliczenia przy kazdym renderze hooka useMeetings.
Wynik:
- buildTasksFromMeetings, buildTaskPeople, buildTaskNotifications, buildPeopleProfiles opakowan w useMemo z prawidlowymi tablicami zaleznosci w useMeetings.js.

---

## 046. Naprawa stale closure w processQueueItem (useRecorder)
Status: `done`
Priorytet: `P1`
Cel: zapobiec przetwarzaniu nagran ze starymi danymi spotkan po ich aktualizacji w trakcie przetwarzania.
Wynik:
- userMeetingsRef (useRef) synced via useEffect; resolveMeetingForQueueItem czyta userMeetingsRef.current.
- test jednostkowy pokrywa scenariusz "spotkanie zmienione w trakcie przetwarzania".

---

## 047. Naprawa stale closure conflictCount w useGoogleIntegrations
Status: `done`
Priorytet: `P2`
Cel: poprawic wyswietlanie liczby konfliktow po imporcie zadan z Google Tasks.
Wynik:
- upsertGoogleImportedTasks zwraca { merged, conflictCount }.
- manualTasksRef w useGoogleIntegrations; conflictCount obliczany synchronicznie przed setManualTasks.
- testy jednostkowe: scenariusz z i bez konfliktow.

---

## 048. Node.js >= 22.5 — dokumentacja wymagan srodowiska
Status: `done`
Priorytet: `P2`
Cel: zapobiec bledom instalacji na starszych wersjach Node.
Wynik:
- package.json: "engines": { "node": ">=22.5" }.
- .env.example dokumentuje wszystkie wymagane zmienne srodowiskowe.

---

## 049. URL.revokeObjectURL po eksporcie pliku
Status: `done`
Priorytet: `P3`
Cel: wyeliminowac wyciek pamieci przy eksporcie (TXT/PDF).
Wynik:
- setTimeout(() => URL.revokeObjectURL(url), 100) po link.click() w downloadTextFile (storage.js).

---

## 050. Naprawa endsAt dla task-eventow w googleSync.js
Status: `done`
Priorytet: `P2`
Cel: eventy zadan w Google Calendar maja zerowy czas trwania (startsAt === endsAt).
Wynik:
- buildCalendarSyncSnapshot dla type=task ustawia endsAt = startsAt + 1h gdy brak jawnego endsAt.
- durationMinutes domyslnie 60 dla eventow typu task.
- testy pokrywaja oba scenariusze (z i bez jawnego endsAt).

---

## 051. Polling Google Calendar — visibility API i backoff
Status: `done`
Priorytet: `P2`
Cel: nie odpytywac Google API gdy uzytkownik nie patrzy na aplikacje (karta w tle).
Wynik:
- interval kalendarzowy sprawdza document.hidden przed fetchem.
- visibilitychange handler wykonuje odswiezenie natychmiast po powrocie do karty.
- interval Google Tasks rowniez ma guard document.hidden.

---

## 052. Studio — globalna biblioteka nagran
Status: `done`
Priorytet: `P2`
Cel: uzytkownik moze przeglądac wszystkie nagrania ze wszystkich spotkan w jednym miejscu.
Wynik:
- komponent RecordingsLibrary na dole strony Studio (takze w pustym stanie).
- tabela: Spotkanie, Data, Czas, Speakerzy, Segmenty, Status.
- klikniecie wiersza = wybranie spotkania i nagrania.

---

## 053. Zakładka Osoba — tworzenie spotkania z profilu
Status: `done`
Priorytet: `P2`
Cel: uzytkownik moze zaplanowac nowe spotkanie bezposrednio z widoku osoby.
Wynik:
- przycisk "+ spotkanie" w naglowku profilu osoby.
- startNewMeetingDraft rozszerzony o prefill.attendees; otwiera Studio z nowym draftem.

---

## 054. AI — rozszerzony ekstrakt po spotkaniu (rich post-meeting intelligence)
Status: `done`
Priorytet: `P2`
Cel: wyciagnac z transkrypcji maksimum uzytecznych informacji biznesowych.
Wynik:
- analyzeMeeting rozszerzony o 13 nowych pol: suggestedTags, meetingType, energyLevel, openQuestions, risks, blockers, participantInsights, tensions, keyQuotes, terminology, contextLinks, suggestedAgenda, coachingTip.
- buildFallbackRichFields: heurystyczne wypelnienie bez API.
- suggestedTags doklejane do meeting.tags po analizie (dedup, lowercase).
- StudioMeetingView: panele Ryzyka, Dynamika rozmowy, Kluczowe cytaty, Nastepne spotkanie.

---

## 055. AI — psychologiczny profil osoby na podstawie nagran
Status: `done`
Priorytet: `P2`
Cel: na podstawie transkrypcji wszystkich spotkan z dana osoba zbudowac zrozumialy profil psychologiczny.
Wynik:
- analyzePersonProfile w analysis.js: DISC (0-100), wartosci z cytatami, style komunikacji/decyzji/konfliktu, workingWithTips, dos/donts, redFlags, coachingNote.
- buildFallbackPsychProfile: heurystyki jezygowe dla DISC.
- analyzePersonPsychProfile w useMeetings.js: fuzzy matching speakerow, zapis przez updatePersonNotes.
- PeopleTab: DiscRadarChart (czysty SVG), PsychProfilePanel z pelnym profilem.
- personNotes jako warstwa overrides dla needs/outputs/psychProfile.

---

## 043. [AUDIO] Sanityzacja timestampów ffmpeg — command injection
Status: `done`
Priorytet: `P1`
Wynik:
- każdy timestamp parsowany przez `Number()` + `isFinite()` przed wstawieniem do filtra ffmpeg w `buildSpeakerClip`; nieprawidłowe segmenty pomijane z ostrzeżeniem.

---

## 044. [AUDIO] Odblokowywanie queueProcessingRef po synchronicznym błędzie
Status: `done`
Priorytet: `P1`
Wynik:
- cały blok `processQueueItem` opakowany w `try/finally`; `queueProcessingRef.current = false` gwarantowane niezależnie od rodzaju błędu.

---

## 045. [AUDIO] Walidacja rozmiaru blob przed zapisem do IndexedDB
Status: `done`
Priorytet: `P1`
Wynik:
- `checkStorageQuota(blobSize)` w `audioStore.js` używa `navigator.storage.estimate()`; blob > 100 MB odrzucany, dostępne < 10 MB pokazuje ostrzeżenie z opcją anulowania.

---

## 048. [AUDIO] Noise cancellation i gain control przy nagrywaniu
Status: `done`
Priorytet: `P2`
Wynik:
- `getUserMedia` otwierany z `{ echoCancellation, noiseSuppression, autoGainControl }`; toggle "Filtrowanie szumów" w profilu (domyślnie włączone); gain meter z `AnalyserNode` w RecorderPanel odświeżany co 100 ms.

---

## 053. [AUDIO] Normalizacja głośności nagrań (loudness normalization)
Status: `done`
Priorytet: `P2`
Wynik:
- `POST /media/recordings/:id/normalize` przetwarza plik przez `ffmpeg -af loudnorm=I=-16:TP=-1.5:LRA=11`; znormalizowana wersja zapisana jako osobny asset (`normalizedAudioPath`); przycisk "Normalizuj głośność" w TranscriptPanel.

---

## 056. [AUDIO] RNNoise AudioWorklet — spektralne tłumienie szumów
Status: `done`
Priorytet: `P2`
Wynik:
- `public/rnnoise-worklet.js` — Cooley-Tukey FFT 512 pt, estymator minimum-statistics, filtr Wienera, WOLA hop=128; `src/audio/noiseReducerNode.js` z graceful fallback; pipeline: source → noiseReducer → analyser + MediaStreamDestination; bypass toggle via `port.postMessage`.

---

## 063. [SPEAKER] Spójna paleta kolorów mówców w całej aplikacji
Status: `done`
Priorytet: `P2`
Wynik:
- `src/lib/speakerColors.js` eksportuje `getSpeakerColor(speakerId)` (paleta 8 kolorów, deterministyczna) i `getSpeakerColorDim`; używane przez WaveformPanel, TimelineRuler, TranscriptPanel, SpeakerStatsPanel.

---

## 064. [SPEAKER] Pasek mówców pod waveformem (speaker timeline bar)
Status: `done`
Priorytet: `P2`
Wynik:
- SVG pasek 12 px pod waveformem z kolorowymi prostokątami per segment; hover tooltip "Imię — 0:42–1:18"; klik seekuje audio; aktywny segment wyróżniony białym obrysem; dynamiczna legenda mówców pod paskiem.

---

## 065. [SPEAKER] Kolor mówcy na słupkach waveformu
Status: `done`
Priorytet: `P2`
Wynik:
- `barColors[]` w WaveformPanel mapuje każdy słupek SVG do koloru mówcy aktywnego w danym czasie via `segmentAtTime(transcript, t)`; brak pokrycia → kolor domyślny `var(--accent)`; słupki za playheadem dimowane (opacity 0.4).

---

## 060. [AUDIO] ffmpeg pre-processing — denoise + filtrowanie przed Whisperem
Status: `done`
Priorytet: `P2`
Wynik:
- `preprocessAudio()` w `server/audioPipeline.js`: ffmpeg `afftdn=nf=-25,highpass=f=80,lowpass=f=8000` + konwersja 16kHz mono WAV przed transkrypcją.
- Oba pasy (diarization + verification) używają przetworzonego pliku; cleanup w `finally`.
- Wyłączalne przez `VOICELOG_AUDIO_PREPROCESS=false`; fallback do oryginału przy błędzie ffmpeg.

---
