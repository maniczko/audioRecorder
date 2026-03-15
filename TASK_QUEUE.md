# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

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

Nastepny do realizacji: `010. Pelny live sync z Google Calendar i Google Tasks`

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
- taski pokazują teraz widoczny stan `online / offline`, tryb `przegladarka / aplikacja` i gotowosc cache offline, wiec korzysci z PWA sa czytelne z poziomu UI.

## 010. Pelny live sync z Google Calendar i Google Tasks
Status: `in_progress`
Priorytet: `P3`
Cel: domknac integracje z Google bez recznego przepinania zmian.
Akceptacja:
- zmiany lokalne synchronizuja sie do Google automatycznie.
- zmiany z Google sa odswiezane bez recznego klikania.
- widac status ostatniej synchronizacji i konflikty danych.
Postep:
- dodane automatyczne odswiezanie Google Calendar i Google Tasks po polaczeniu oraz status ostatniej synchronizacji w UI.
- taski maja teraz widoczny hub syncu z `connect / refresh / import / export`, etykieta live sync i ostatni sync dla Google Tasks.
- profil pokazuje live sync Google Calendar, ostatni sync i reczne `Odswiez teraz`, ale nadal brakuje pelnej obslugi konfliktow oraz automatycznego wypychania wszystkich zmian lokalnych do Google.

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

## 012. Konflikty synchronizacji Google i centrum rozwiazywania zmian
Status: `in_progress`
Priorytet: `P2`
Cel: bezpiecznie obslugiwac przypadki, w ktorych dane lokalne i Google roznia sie od siebie.
Akceptacja:
- aplikacja wykrywa konflikt dla spotkan i zadan, gdy lokalna i zdalna wersja zostaly zmienione niezaleznie.
- widac panel porownania `lokalne / Google / finalna wersja`.
- uzytkownik moze wybrac: zachowaj lokalne, zachowaj Google lub polacz pola recznie.
- po rozwiazaniu konfliktu widac status ostatniego syncu i wynik akcji.
Postep:
- UI konfliktu w TaskDetailsPanel jest gotowe: panel lokalny/Google/finalna wersja z tryb `local / google / merge`.
- brakuje automatycznego wykrywania konfliktu po stronie googleSync.js i propagacji pola `googleSyncConflict` do stanu zadania.

## 013. Prawdziwy waveform audio i markery na nagraniu
Status: `todo`
Priorytet: `P2`
Cel: poprawic review nagran i uczynic prace na audio bardziej precyzyjna.
Akceptacja:
- waveform bazuje na realnym audio, a nie tylko uproszczonej osi czasu.
- mozna dodawac markery / bookmarki do kluczowych momentow spotkania.
- klik w marker przewija audio i ustawia odpowiedni segment transkrypcji.
- markery sa zapisywane do nagrania i wracaja po odswiezeniu.

## 014. Tryb review transkrypcji ze skrotami klawiaturowymi
Status: `todo`
Priorytet: `P2`
Cel: przyspieszyc review transkrypcji przy dluzszych nagraniach.
Akceptacja:
- sa skroty do `next / previous review item`, `approve`, `leave in review`, `play / pause`.
- widok pokazuje licznik postepu review i aktywny fragment.
- mozna hurtowo zatwierdzac albo odrzucac fragmenty po filtrze.
- nawigacja dziala bez myszy w najwazniejszych scenariuszach.

## 015. Komentarze, mentiony i presence w workspace
Status: `todo`
Priorytet: `P2`
Cel: lepiej wspierac wspolprace zespolu przy spotkaniach i zadaniach.
Akceptacja:
- mozna dodawac komentarze do spotkan, taskow i nagran.
- mention `@osoba` tworzy powiadomienie i link do konkretnej encji.
- widac kto aktualnie edytuje brief, task albo transkrypt.
- feed workspace pokazuje komentarze i mentiony jako osobne typy aktywnosci.

## 016. Audit log i historia zmian z filtrowaniem
Status: `todo`
Priorytet: `P2`
Cel: dac pelna widocznosc zmian i odpowiedzialnosci w workspace.
Akceptacja:
- istnieje widok historii zmian dla workspace.
- mozna filtrowac po uzytkowniku, typie encji, zakresie dat i rodzaju akcji.
- wpis pokazuje `kto`, `co`, `kiedy`, `na czym` i roznice w kluczowych polach.
- dla wybranych zmian mozna otworzyc powiazane spotkanie, task lub nagranie.

## 017. Dashboard KPI per osoba i obciazenie zespolu
Status: `todo`
Priorytet: `P2`
Cel: rozszerzyc analityke o widok per osoba i pomoc w zarzadzaniu obciazeniem.
Akceptacja:
- widac liczbe taskow per osoba z podzialem na `open / overdue / completed`.
- widac ile decyzji i follow-upow powstaje po spotkaniach dla kazdego czlonka.
- dashboard pokazuje sygnaly przeciazenia: za duzo overdue, za duzo otwartych taskow, za malo zamkniec.
- dane mozna filtrowac po workspace i zakresie dat.

## 018. Outlook / Microsoft To Do / Microsoft Calendar
Status: `todo`
Priorytet: `P3`
Cel: rozszerzyc integracje poza ekosystem Google.
Akceptacja:
- mozna polaczyc konto Microsoft.
- zadania synchronizuja sie z Microsoft To Do podobnie jak z Google Tasks.
- spotkania moga byc synchronizowane z Outlook Calendar.
- UI pokazuje status polaczenia i ostatni sync per provider.

## 019. Integracja ze Slack / Teams po spotkaniu
Status: `todo`
Priorytet: `P3`
Cel: szybciej przenosic wynik spotkania do narzedzi komunikacyjnych zespolu.
Akceptacja:
- mozna wyslac podsumowanie spotkania, decyzje i taski do wybranego kanalu.
- mozna wybrac szablon wiadomosci i zakres informacji do publikacji.
- taski i follow-upy maja klikalne linki do aplikacji.
- po wysylce widac status publikacji i ewentualny blad.

## 020. Dostepnosc i keyboard-only flows
Status: `todo`
Priorytet: `P2`
Cel: poprawic dostepnosc aplikacji i wygode pracy bez myszy.
Akceptacja:
- glowne widoki maja sensowne role ARIA, focus order i widoczne focus state.
- da sie obsluzyc kluczowe flow klawiatura: nagranie, review, taski, command palette.
- formularze i panele nie maja krytycznych problemow z czytnikami ekranu.
- istnieje przynajmniej podstawowy zestaw testow pod accessibility smoke check.

---

## 021. Kanban w stylu Microsoft Planner — swimlanes, widok wykresow i zaawansowane karty
Status: `todo`
Priorytet: `P1`
Cel: podniesc widok tablicy Kanban do poziomu wizualnego i funkcjonalnego Microsoft Planner — swimlanes, wykresy, kompaktowe karty z avatarami, filtr na tablicy, quick-add per kolumna i eksport.

### Szczegolowe wytyczne implementacji

#### A. Swimlanes — grupowanie wierszami na tablicy
- Tablica moze byc grupowana wierszami po: `Brak`, `Osoba (assignee)`, `Priorytet`, `Etykieta (label)`, `Grupa / projekt`, `Po terminie (this week / next week / later / no date)`.
- Przelacznik grupowania to select lub row of chips nad tablica, zapisywany w stanie workspace (persystowany).
- Kazdy wiersz (swimlane) ma naglowek z nazwa grupy, liczba kart i przyciskiem zwijania.
- W ramach jednego wiersza zadania sa rozlozone w takich samych kolumnach co normalnie — tablica jest macierza kolumny x wiersze.
- Kolumny bez kart w danym swimlane sa pokazane jako puste sloty (pozwala to na drag-drop z kolumny do kolumny wewnatrz wiersza).
- Drag-and-drop przesuwa karte w kolumnie I moze zmienic grupe (np. przeniesienie do swimlane innej osoby updatuje pole `assignedTo`).
- Techniczny ksztalt: `TaskKanbanView` przyjmuje `groupBy` prop i buduje dwuwymiarowa strukture `swimlanes[groupKey][columnId][]`.

#### B. Ulepszona karta Kanban (card redesign)
Karta musi wizualnie dorownac Microsoft Planner. Kolejnosc elementow z gory na dol:
1. **Cover bar** — opcjonalny pasek koloru u gory karty; kolor wybierany z predefiniowanej palety 8 kolorow (Planner: red, pink, orange, yellow, green, teal, blue, purple) lub wylaczony; zapisywany jako `task.coverColor`.
2. **Label chips** — kolorowe chipsety dla `task.tags`; kazdy tag ma przypisany kolor (hash tagu → kolor z palety); nie sa to szare boxy lecz barwne kapsulki jak w Planner.
3. **Tytul** — pogrubiony, klikowalny, max 2 linie z elipsa.
4. **Subtask progress** — jezeli zadanie ma subtaski, pokazuje pasek postepu `N/M` z miniaturowym progress barem (jak kursor 0–100 %).
5. **Meta row** — linia z avatarami przypisanych osob (inicjaly w kolowym chipsie), data terminu (czerwona jezeli po terminie), SLA pill.
6. **Hover actions** — przy najechaniu na karte pojawiaja sie ikony: `complete`, `important (star)`, `due date quick-pick`, `move to...` (mini dropdown kolumn), `open detail`. Akcje sa inline bez otwierania panelu szczegolowo.
Techniczny ksztalt: Wydzielic `KanbanCard` jako osobny komponent przyjmujacy `task`, `boardColumns`, `onUpdateTask`, `onMoveTask`. Hover state w CSS (`:hover .kanban-card-actions { opacity: 1 }`).

#### C. Quick-add inline w kolumnie
- Na dole kazdej kolumny jest przycisk `+ Dodaj zadanie`.
- Po kliknieciu pojawia sie inline input w tej samej kolumnie (nie otwiera bocznego panelu).
- Wpisanie tytulu i Enter tworzy zadanie z `status = column.id` i ewentualnie z biezacego swimlane (np. przypisuje automatycznie osobe jezeli swimlane to `By Person`).
- ESC anuluje bez tworzenia.
Techniczny ksztalt: Stan `quickAddColumnId` w `TasksTab` lub `TaskKanbanView`, renderowanie `<QuickAddInput>` zamiast przycisku gdy aktywny.

#### D. Pasek filtrowania i sortowania nad tablica
Nad tablica Kanban (takze nad widokiem listy) pojawia sie pasek z:
- `Filtruj: Osoba` (multi-select chips z listy assignees w workspace)
- `Filtruj: Priorytet` (P1 / P2 / P3 / Brak)
- `Filtruj: Etykieta` (lista tagów)
- `Filtruj: Termin` (Dzisiaj / Ten tydzien / Bez terminu / Po terminie)
- `Sortuj` (select: Termin, Priorytet, Tytul, Ostatnia aktywnosc, Data utworzenia)
- `Resetuj filtry` (pojawia sie jezeli jakis filtr jest aktywny)
Filtry sa aplikowane do kart we wszystkich kolumnach jednoczesnie. Stany filtrow zapisywane w `sessionStorage` lub w stanie komponentu (nie musza przetrwac refresh).
Techniczny ksztalt: Hook `useTaskBoardFilters` zwracajacy `filteredTasks`, `filters`, `setFilter`, `resetFilters`. Hook jest wspoldzielony miedzy widokiem listy i kanbanem.

#### E. WIP limit per kolumna
- Kazda kolumna moze miec opcjonalny limit `WIP (work-in-progress)`.
- Limit ustawiany w panelu zarzadzania kolumnami (istniejacy `ColumnManager` w sidebarze) jako `number | null`.
- Jezeli liczba kart w kolumnie >= WIP limit, naglowek kolumny zmienia kolor na ostrzegawczy (orange/red) i wyswietla `N / limit`.
- Drag-drop DO kolumny z pełnym WIP pozwala ale pokazuje ostrzezenie (nie blokuje — Microsoft Planner tez nie blokuje).
Techniczny ksztalt: Dodac pole `wipLimit` do schematu kolumny w `lib/workspace.js`.

#### F. Widok Wykresy (Charts tab)
Nowa zakladka `Wykresy` obok przyciskow `Lista / Kanban` w toolbarze widoku zadan.
Widok zawiera 4 wykresy (SVG lub canvas, bez zewnetrznych bibliotek):
1. **Donut — Status**: udzial kart per kolumna (np. Backlog 40 %, In Progress 35 %, Done 25 %).
2. **Donut — Priorytet**: P1 / P2 / P3 / Brak.
3. **Bar chart — Osoba**: liczba otwartych zadan per assignee (poziomy bar chart).
4. **Bar chart — Termin**: zadania bez terminu / na czas / ryzyko SLA / po terminie.
Kazdy wykres ma legende i tooltipem przy hover na segment.
Techniczny ksztalt: Nowy plik `src/tasks/TaskChartsView.js`, wykresy jako czyste SVG z proporcjami obliczanymi z tablicy tasks. Komponent jest lazy-rendered (only when charts tab active).

#### G. Widok Harmonogram (Schedule)
Nowa zakladka `Harmonogram` w toolbarze — prosta os czasu tygodniowa/miesieczna.
- Kolumny to dni lub tygodnie (przelacznik w toolbarze).
- Zadania z `dueDate` sa renderowane jako bloczki w odpowiednim dniu.
- Klik na bloczek otwiera panel szczegolowy (standardowy prawy panel).
- Brak terminu — zadania w osobnej sekcji `Bez terminu` na dole.
- Drag-drop bloczka na inny dzien zmienia `dueDate` zadania.
Techniczny ksztalt: Nowy plik `src/tasks/TaskScheduleView.js`. Daty obliczane z `Date` API. Widok tygodniowy jako domyslny.

#### H. Akcje masowe (bulk actions)
Istniejace zaznaczanie kart (`selectedTaskIds`) rozbudowac o pasek akcji masowych:
- Pasek pojawia sie nad tablica gdy `selectedTaskIds.length > 0`.
- Dostepne akcje: `Zmien status` (select kolumny), `Zmien priorytet`, `Przypisz do osoby`, `Dodaj etykiete`, `Ustaw termin`, `Przenies do grupy`, `Usun zaznaczone`.
- Akcje wykonuja `onUpdateTask(id, patch)` dla kazdego zaznaczonego ID.
Techniczny ksztalt: Komponent `BulkActionBar` renderowany warunkowo w `TasksWorkspaceView`.

#### I. Eksport tablicy
Przycisk `Eksportuj` w toolbarze widoku zadan (obok przelacznikow widoku).
- Eksport do CSV: kolumny `id, title, status, priority, assignedTo, dueDate, group, tags, completed, createdAt`.
- Eksport do JSON: pelny obiekt zadania.
- Eksport do PDF: uproszczony widok listy (jak obecny eksport spotkan).
Techniczny ksztalt: Rozbudowac `lib/export.js` o funkcje `exportTasksCsv(tasks)` i `exportTasksJson(tasks)`.

#### J. Reorder kolumn via drag-and-drop
- Naglowek kolumny jest przeciagalny (`draggable` na elemencie `<header>`).
- Upuszczenie naglowka na inny naglowek zamienia kolejnosc kolumn w tablicy.
- Nowa kolejnosc jest zapisywana do stanu workspace.
Techniczny ksztalt: Dodac `onReorderColumns(fromId, toId)` do `TasksWorkspaceView` i propagowac do `TaskKanbanView`.

### Akceptacja zadania 021
- Tablica Kanban wyglada jak Microsoft Planner: kolorowe cover bary, chipsety etykiet, avatary, progress subtaskow.
- Swimlanes dzialaja dla `By Person`, `By Priority`, `By Label`, `By Due Date` z drag-dropem wewnatrz swimlane.
- Quick-add per kolumna dziala inline bez otwierania panelu bocznego.
- Filtr nad tablica dziala dla osoby, priorytetu, etykiety i terminu.
- WIP limit zmienia kolor naglowka kolumny po przekroczeniu.
- Widok Wykresy pokazuje 4 wykresy SVG ze statusem, priorytetem, osobami i terminem.
- Widok Harmonogram pokazuje zadania na osi czasu z drag-dropem zmieniajacym termin.
- Akcje masowe dzialaja dla co najmniej: zmiana statusu, priorytetu, przypisania, usuniecia.
- Eksport do CSV dziala dla aktualnie widocznych zadan.
- Kolumny mozna reorderowac przeciaganiem naglowkow.

### Kolejnosc realizacji (sugerowana)
1. Ulepszone karty (B) — widoczny efekt, niska zlozonosc.
2. Pasek filtrowania (D) — duza wartosc uzytkownikowi, wspolny dla listy i kanbana.
3. Quick-add per kolumna (C) — czesta akcja, male ryzyko.
4. Swimlanes (A) — wiekszy refaktor, wysoka wartosc.
5. Widok Wykresy (F) — srednia zlozonosc, bez zaleznosci.
6. Akcje masowe (H) — rozbudowa istniejacego mechanizmu selekcji.
7. WIP limit (E) — mala zmiana, duzy efekt UX.
8. Eksport (I) — niski priorytet, latwa realizacja.
9. Harmonogram (G) — najbardziej zlozony, realizowac jako osobny sprint.
10. Reorder kolumn (J) — ostatni, najmniej krytyczny.

### Akceptacja zadania 021
Status: `done`
Wynik:
- TaskKanbanView przebudowany: cover bar (8 kolorow), kolorowe chipsety tagow z hashowaniem, pasek postepu subtaskow, avatary inicjalow z kolorami, hover actions (move-to-column select), quick-add inline per kolumna, WIP limit z ostrzezeniem w naglowku, swimlanes (by Person / Priority / Label / Due), drag-reorder naglowkow kolumn.
- TaskChartsView (nowy): 4 wykresy SVG bez bibliotek — donut (status, priorytet), bar (osoby, terminy).
- TaskScheduleView (nowy): oś czasu 2 tyg / 5 tyg, drag zadania na dzien zmienia dueDate, sekcja "Bez terminu".
- TasksWorkspaceView: 4 zakladki widoku (Kanban / Lista / Wykresy / Harmonogram), swimlane select w toolbarze, przycisk Eksport CSV.
- TasksTab: stan swimlaneGroupBy, handler handleQuickAddToColumn, handleColumnReorder (via onUpdateColumn z order), handleExportCsv (Blob download).
- TaskDetailsPanel: picker 8 kolorow cover bar (kolor zapisywany w task.coverColor).
- TasksSidebar: pole WIP limit per kolumna w ColumnManager.
- lib/tasks.js: normalizeColumns zachowuje wipLimit.
- App.css: ~450 nowych linii CSS dla wszystkich powyzszych komponentow.

---

## 022. AI — inteligentne sugerowanie i kategoryzacja zadan po spotkaniu
Status: `todo`
Priorytet: `P1`
Cel: zautomatyzowac i ulepszyc proces zamieniania ustalen ze spotkan na dobrze opisane, przypisane i skategoryzowane zadania.
Zakres:
- po zakonczeniu transkrypcji LLM (Claude) analizuje pelny tekst spotkania i proponuje liste zadan z polami: `tytul`, `opis`, `owner (osoba z transkryptu)`, `termin (jezeli wymieniony)`, `priorytet (na podstawie jezykowych sygnałow: pilne / wazne)`, `sugerowane tagi`.
- interfejs pokazuje proponowane zadania w panelu `Sugestie AI` zanim uzytkownik je zatwierdzi — mozna edytowac kazde pole, odrzucic lub zatwierdzic jednym klikaniem.
- po zatwierdzeniu zadania trafiaja do tablicy Kanban z oznaczeniem `sourceType: ai-suggestion`.
- jezeli zadanie dotyczy osoby wymienionej w People, automatycznie prefiluje pole `assignedTo`.
Akceptacja:
- po analizie spotkania widac panel z N sugerowanymi zadaniami do zatwierdzenia.
- kazde sugerowane zadanie ma tytul, opis, ewentualnego ownera i priorytet.
- zatwierdzenie jednym kliknieciem lub edycja przed zatwierdzeniem.
- odrzucone sugestie nie trafiaja do tablicy.
- zadania AI maja widoczne oznaczenie zrodla w panelu detalu.
Techniczne wskazowki:
- wywolanie Claude API z promptem: "Na podstawie ponizszej transkrypcji wygeneruj JSON z lista zadan..."
- schemat odpowiedzi: `{ tasks: [{ title, description, owner, dueDate, priority, tags }] }`.
- uzyc `response_format` lub structured output jezeli dostepne w SDK.
- nowy plik `src/lib/aiTaskSuggestions.js` z funkcja `suggestTasksFromTranscript(transcript, people)`.
- wywolywa istniejacy `REACT_APP_ANTHROPIC_API_KEY`.

## 023. AI — inteligentny asystent priorytetu i terminu
Status: `todo`
Priorytet: `P2`
Cel: pomoc uzytkownikowi lepiej planowac dzien przez AI ktory sugeruje kolejnosc i termin dla otwartych zadan.
Zakres:
- przycisk `Zaplanuj z AI` w widoku `Moj dzien` lub toolbarze zadan.
- po kliknieciu Claude analizuje liste otwartych zadan (tytul, priorytet, termin, owner) i zwraca: rekomendowana kolejnosc na dzisiaj (max 5 zadan), uzasadnienie dla kazdego, flagi ryzyka (overdue, blokujace inne).
- wynik pokazywany jako karty `Plan na dzis` w sidebarze lub osobnym panelu.
- uzytkownik moze zaakceptowac sugestie (zadania trafiaja do `My Day`) lub zignorerowac.
Akceptacja:
- wywolanie AI trwa < 5 s dla listy 50 zadan.
- wynik zawiera max 5 zadan na dzien z krotkim uzasadnieniem.
- zaakceptowanie planu oznacza zadania jako `myDay = true`.
- jezeli nie ma API key, przycisk jest ukryty lub wyszarzony.
Techniczne wskazowki:
- nowy plik `src/lib/aiDayPlanner.js` z funkcja `planMyDay(tasks, currentDate)`.
- prompt zawiera aktualna date i prosci sortowanie wejsciowe po SLA przed wywolaniem LLM.
- cachowac wynik w `sessionStorage` przez 15 minut zeby nie wywolywac AI przy kazdym kliknieciu.

## 024. AI — automatyczny coaching po spotkaniu (meeting debrief)
Status: `todo`
Priorytet: `P2`
Cel: po zakonczeniu spotkania AI generuje krotki debrief: co poszlo dobrze, co mozna poprawic, jakie sa ryzyka dla otwartych zadan.
Zakres:
- zakadka lub sekcja `Debrief AI` w panelu spotkania, dostepna po analizie transkrypcji.
- Claude generuje: streszczenie 3-5 zdan, lista kluczowych decyzji (max 5), lista ryzyk i blokad (max 3), sugestie dzialan follow-up.
- format odpowiedzi to krotki dokument z sekcjami, renderowany jako listy w UI.
- uzytkownik moze skopiowac debrief do schowka lub wyeksportowac do PDF.
- debrief jest zapisywany do danych spotkania i wraca po odswiezeniu.
Akceptacja:
- debrief jest dostepny jednym kliknieciem po zakonczeniu analizy spotkania.
- zawiera sekcje: streszczenie, decyzje, ryzyka, follow-upy.
- jest mozliwy eksport do PDF lub kopiowanie do schowka.
- debrief persystuje w obiekcie spotkania (pole `aiDebrief`).
Techniczne wskazowki:
- rozbudowac `src/lib/analysis.js` o funkcje `generateMeetingDebrief(meeting, transcript)`.
- prompt: "Jestes asystentem spotkaniowym. Przeanalizuj ponizsze spotkanie i wygeneruj debrief w jezyku polskim...".
- wynik zapisywac do `meeting.aiDebrief` przez istniejacy mechanizm updateMeeting.

## 025. AI — semantyczne wyszukiwanie zadan i spotkan (embeddings)
Status: `todo`
Priorytet: `P3`
Cel: umozliwic wyszukiwanie "co ustalilismy w Q1 o deploymencie" zamiast szukania po slowach kluczowych.
Zakres:
- rozbudowac istniejaca command palette (Ctrl+K) o semantyczne wyszukiwanie przez LLM.
- zapytanie uzytkownika jest przesylane do Claude z kontekstem: lista spotkan (tytul + streszczenie) + lista zadan (tytul + opis).
- Claude zwraca ranking: ktore spotkania i zadania sa najblizej semantycznie zapytaniu.
- wyniki sa wyswietlane w palecie z oznaczeniem `AI Match` odrozniajacym je od wynikow pelnotekstowych.
- jezeli brak API key, AI match jest wylaczony a standardowe wyszukiwanie dziala jak dotad.
Akceptacja:
- zapytanie semantyczne zwraca wyniki w < 3 s dla workspace z max 100 elementami.
- wyniki AI Match sa wizualnie rozroznialne od standardowych wynikow.
- jezeli API key nie jest ustawiony, funkcja jest ukryta bez bledow w konsoli.
- standardowe wyszukiwanie pelnotekstowe nie jest zepsute.
Techniczne wskazowki:
- nowy plik `src/lib/aiSearch.js` z funkcja `semanticSearch(query, meetings, tasks)`.
- przekazywac do Claude tylko tytuly i streszczenia (nie pelne transkrypty) zeby zmniejszyc zuzycie tokenow.
- limit: max 50 spotkan i 100 zadan w jednym wywolaniu; dla wiekszych workspace wziac ostatnie 50/100.
- cache wynikow wyszukiwania w Map z kluczem `query` przez czas sesji (unikac podwojnych wywolan).
