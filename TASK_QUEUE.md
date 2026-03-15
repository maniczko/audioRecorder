# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`
Zadania zakonczone → TASK_DONE.md

---

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
- UI konfliktu w TaskDetailsPanel jest gotowe: panel lokalny/Google/finalna wersja z trybem `local / google / merge`.
- brakuje automatycznego wykrywania konfliktu po stronie googleSync.js i propagacji pola `googleSyncConflict` do stanu zadania.

---

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
- zakladka lub sekcja `Debrief AI` w panelu spotkania, dostepna po analizie transkrypcji.
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

## 025. AI — semantyczne wyszukiwanie zadan i spotkan
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
