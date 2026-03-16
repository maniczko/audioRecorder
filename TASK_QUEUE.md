# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`
Zadania zakonczone → TASK_DONE.md

---

## PRIORYTET P1 — krytyczne dla bezpieczenstwa i uzytecznosci

---

## 043. [AUDIO] Sanityzacja timestampów ffmpeg — command injection
Status: `todo`
Priorytet: `P1`
Cel: timestampy segmentów wklejane bezpośrednio do filtra ffmpeg bez walidacji — potencjalne RCE.
Akceptacja:
- przed wstawieniem do polecenia każdy timestamp jest parsowany jako `Number()` i sprawdzany `isFinite()`.
- jeśli timestamp nieprawidłowy — segment pomijany, logowane ostrzeżenie.
- test jednostkowy: złośliwy timestamp `"0;rm -rf /"` nie wykonuje dodatkowego polecenia.
Techniczne wskazówki:
- w `server/audioPipeline.js` funkcja `buildSpeakerClip`: `const t = Number(s.timestamp); if (!isFinite(t)) continue;`.
- to samo dla `s.endTimestamp`.

---

## 044. [AUDIO] Odblokowywanie queueProcessingRef po synchronicznym błędzie
Status: `todo`
Priorytet: `P1`
Cel: jeśli `processQueueItem()` rzuca synchronicznie — flaga `queueProcessingRef.current` zostaje `true` na zawsze, kolejka zamrożona.
Akceptacja:
- flaga zawsze wraca do `false` niezależnie od rodzaju błędu.
- po błędzie kolejka wznawia processing przy następnym renderze.
- test: symulacja sync throw → po 1s kolejka znów przetwarza.
Techniczne wskazówki:
- `useRecorder.js` linia ~218: owinąć cały blok w `try { ... } finally { queueProcessingRef.current = false; }` zamiast polegać wyłącznie na `Promise.finally`.

---

## 045. [AUDIO] Walidacja rozmiaru blob przed zapisem do IndexedDB
Status: `todo`
Priorytet: `P1`
Cel: brak sprawdzenia rozmiaru → cicha awaria gdy IndexedDB quota przekroczona, nagranie utracone.
Akceptacja:
- przed `saveAudioBlob()` sprawdzana jest `navigator.storage.estimate()`.
- jeśli dostępne < 10MB: użytkownik widzi ostrzeżenie i może anulować zapis.
- jeśli blob > 100MB: odrzucany z czytelnym komunikatem.
Techniczne wskazówki:
- `src/lib/audioStore.js`: dodać `checkStorageQuota(blobSize)` wywołaną przed `saveAudioBlob`.
- fallback jeśli `navigator.storage` niedostępny: pomiń sprawdzenie, zapisz normalnie.

---

## PRIORYTET P2 — wazne dla jakosci i completeness

---

## 046. [AUDIO] Exponential backoff i auto-retry w kolejce nagrań
Status: `todo`
Priorytet: `P2`
Cel: aktualnie błąd sieciowy = item utknięty w `failed` bez auto-ponowienia; user musi kliknąć ręcznie.
Akceptacja:
- po błędzie item czeka 1s, 4s, 16s (3 próby) przed oznaczeniem jako trwały błąd.
- przy braku internetu (`navigator.onLine === false`) item czeka do powrotu sieci.
- po 3 nieudanych próbach: status `failed_permanent`, wyraźny komunikat + przycisk "Ponów ręcznie".
- licznik prób widoczny przy każdym itemie w kolejce.
Techniczne wskazówki:
- dodać `retryCount`, `backoffUntil`, `lastErrorMessage` do `RecordingQueueItem` w `recordingQueue.js`.
- w `useRecorder.js`: przed `processQueueItem` sprawdzić `item.backoffUntil > Date.now()`.
- listener `window.addEventListener("online", ...)` wznawia processing.

---

## 047. [AUDIO] Obsługa błędów odtwarzania audio w UnifiedPlayer
Status: `todo`
Priorytet: `P2`
Cel: `play().catch(() => {})` połyka błędy — user klika ▶ i nic się nie dzieje bez żadnego feedbacku.
Akceptacja:
- błąd odtwarzania pokazuje inline komunikat (np. "Nie można odtworzyć — plik może być uszkodzony").
- po błędzie ▶ zmienia się na ikonę ⚠ z tooltipem.
- błąd `NotAllowedError` (brak interakcji user) obsługiwany osobno: "Kliknij aby odblokować audio".
Techniczne wskazówki:
- `src/studio/UnifiedPlayer.js`: `a.play().catch(err => setPlayError(err.message))`.
- lokalny stan `playError` w UnifiedPlayer, czyszczony przy zmianie src.

---

## 048. [AUDIO] Noise cancellation i gain control przy nagrywaniu
Status: `todo`
Priorytet: `P2`
Cel: nagrania w głośnych środowiskach mają zaszumioną transkrypcję — WebRTC oferuje darmowe filtrowanie.
Akceptacja:
- mikrofon otwierany z `{ echoCancellation: true, noiseSuppression: true, autoGainControl: true }`.
- w ustawieniach profilu toggle "Filtrowanie szumów" (domyślnie włączone).
- w UnifiedPlayer/RecorderPanel widoczny wskaźnik poziomu wejścia (gain meter) przed i w trakcie nagrania.
Techniczne wskazówki:
- `useRecorder.js` linia ~501: zmienić `getUserMedia({ audio: true })` na obiekt z constraintami.
- gain meter: `AnalyserNode.getByteFrequencyData()` → mean amplitude → CSS width bar, update co 100ms.
- preferencja zapisana w `profile.noiseSuppression` (bool, default true).

---

## 049. [AUDIO] VAD — automatyczne zatrzymanie przy długiej ciszy
Status: `todo`
Priorytet: `P2`
Cel: użytkownik zapomina zatrzymać nagranie → kilkugodzinne pliki, przepełnienie storage, zły UX.
Akceptacja:
- jeśli cisza > 3 minuty (konfigurowalnie w profilu: 1/3/5/off) — nagranie zatrzymuje się automatycznie.
- 30s przed zatrzymaniem: widoczne odliczanie w UnifiedPlayer "Zatrzymanie za 30s — kliknij aby kontynuować".
- użytkownik może kliknąć "Kontynuuj" aby resetować licznik.
Techniczne wskazówki:
- w `useRecorder.js`: monitorować `signatureTimelineRef` — jeśli ostatnie 180 wpisów mają amplitude < 5 → trigger.
- alternatywnie: śledzić `AnalyserNode` max amplitude w oknie 3min.
- countdown state eksponowany do UnifiedPlayer jako prop.

---

## 050. [AUDIO] Chunked upload dla dużych plików (>10MB)
Status: `todo`
Priorytet: `P2`
Cel: przy słabym WiFi upload jednego dużego pliku audio często się przerywa i wymaga ponowienia od zera.
Akceptacja:
- pliki > 10MB dzielone na chunki 2MB i wysyłane sekwencyjnie.
- postęp uploadu widoczny w UnifiedPlayer (pasek procentowy).
- przerwany upload może być wznowiony — serwer przechowuje już wysłane chunki przez 24h.
- pliki < 10MB działają jak dotąd (jeden request).
Techniczne wskazówki:
- `src/services/mediaService.js`: `persistRecordingAudio()` → jeśli `blob.size > 10MB`, podzielić na `Blob.slice()` chunks.
- serwer: `PUT /media/recordings/:id/audio/chunk?index=N&total=M` → składa chunks w jeden plik.
- po zakończeniu chunków: `POST /media/recordings/:id/audio/finalize`.

---

## 051. [AUDIO] Speaker ID — multi-sample enrollment i per-profile threshold
Status: `todo`
Priorytet: `P2`
Cel: jeden sample głosu (~15s) to za mało — wielokrotne próbki dramatycznie zwiększają dokładność.
Akceptacja:
- użytkownik może nagrać do 5 próbek głosu per osoba (każda 15–30s).
- embedding przechowywany jako average z wszystkich próbek.
- per-profil slider threshold (0.70–0.95, default 0.82) w UI listy profili.
- w transkrypcji: przy auto-labelu widoczne "Marek (94%)" z confidence score.
Techniczne wskazówki:
- `voice_profiles` table: dodać kolumnę `sample_count INT DEFAULT 1`.
- `POST /voice-profiles` z tym samym `X-Speaker-Name` → uśrednia embedding z istniejącym.
- `server/speakerEmbedder.js`: eksportować `averageEmbeddings(embeddings[])`.

---

## 052. [AUDIO] Eksport wybranych segmentów jako osobny plik audio
Status: `todo`
Priorytet: `P2`
Cel: użytkownik chce wyciąć konkretny fragment rozmowy i udostępnić go bez całego nagrania.
Akceptacja:
- w TranscriptPanel zaznaczenie zakresu segmentów + przycisk "Eksportuj audio".
- serwer wycina fragmenty ffmpeg i zwraca plik WAV/MP3.
- eksport działa tylko w trybie remote (pliki na serwerze).
- czas exportu < 5s dla 5-minutowego fragmentu.
Techniczne wskazówki:
- `POST /media/recordings/:id/export` z body `{ segments: [{start, end}] }`.
- `ffmpeg -i input -af "aselect=..." -acodec pcm_s16le output.wav`.
- response: `Content-Disposition: attachment; filename="fragment.wav"`.

---

## 053. [AUDIO] Normalizacja głośności nagrań (loudness normalization)
Status: `todo`
Priorytet: `P2`
Cel: niektóre nagrania są zbyt ciche lub za głośne — trudne do odsłuchania bez ręcznej regulacji.
Akceptacja:
- opcja "Normalizuj głośność" przy każdym nagraniu w TranscriptPanel.
- serwer przetwarza plik przez `ffmpeg -af loudnorm` i zwraca znormalizowany URL.
- oryginał zachowany, znormalizowana wersja jako osobny asset.
- operacja < 10s dla nagrania 30-minutowego.
Techniczne wskazówki:
- `POST /media/recordings/:id/normalize`.
- ffmpeg: `-af loudnorm=I=-16:TP=-1.5:LRA=11`.
- nowe pole `normalizedAudioPath` w `media_assets`.

---

## 054. [AUDIO] Wykrywanie języka i multi-język per segment
Status: `todo`
Priorytet: `P3`
Cel: spotkania prowadzone częściowo po polsku, częściowo po angielsku transkrybowane są niepoprawnie.
Akceptacja:
- Whisper wywołany z `language: auto` zamiast hardcoded `pl`.
- w ustawieniach profilu: "Język nagrań" = Auto / PL / EN / DE / inne.
- per-segment language tag widoczny w TranscriptPanel (małe flagi lub kod języka).
- wpływ na dokładność: transkrypcja angielskich fragmentów o >15% lepsza.
Techniczne wskazówki:
- `server/audioPipeline.js`: `language: options.language || AUDIO_LANGUAGE` — już istnieje, wystarczy env `VOICELOG_AUDIO_LANGUAGE=auto`.
- verbose_json odpowiedź zawiera `language` per segment — zachować jako `segment.language`.

---

## 055. [AUDIO] Custom vocabulary — nazwy firm i branżowy żargon
Status: `todo`
Priorytet: `P3`
Cel: Whisper niepoprawnie transkrybuje nazwy własne, skróty branżowe, produkty firmy.
Akceptacja:
- w ustawieniach workspace pole tekstowe "Słownik" (max 500 słów, jedno per linia).
- słownik przekazywany do Whisper jako `prompt` (initial prompt injection).
- aktualizacja słownika działa natychmiast dla nowych nagrań (nie wymaga restartu).
Techniczne wskazówki:
- pole `vocabulary_json` w tabeli `workspaces` lub w `workspace_state`.
- `server/audioPipeline.js`: `prompt: options.vocabulary?.slice(0, 500).join(", ")` w polach formularza.
- UI: textarea w ProfileTab → workspace settings section.

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
