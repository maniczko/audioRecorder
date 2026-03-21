# ROADMAP_NEXT_STEPS

Kolejne zadania dla projektu `audioRecorder`, ustawione od najwyzszego wplywu do prac rozwojowych.

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

---

## PRIORYTET P1 - stabilizacja architektury i backendu

## R04. [OBS] Dodac request id, logi strukturalne i podstawowe metryki
Status: `todo`
Priorytet: `P1`
Cel: bez telemetryki trudno diagnozowac opoznienia, bledy i kosztowne fragmenty pipeline audio.
Akceptacja:
- kazdy request ma `requestId`
- logi backendu zawieraja route, status, czas, requestId
- mierzone sa czasy: upload, transkrypcja, diarization, analiza
- w trybie debug mozna odczytac etapy pipeline dla konkretnego nagrania
Techniczne wskazowki:
- nie trzeba od razu wdrazac pelnego stacku observability; wystarczy stabilny format logu i lekkie liczniki

---

## R05. [RELIABILITY] Dodac timeouty, retry i klasyfikacje bledow dla wywolan AI
Status: `todo`
Priorytet: `P1`
Cel: integracje z modelami i audio processing musza zachowywac sie przewidywalnie przy timeoutach i bledach dostawcy.
Akceptacja:
- wszystkie wywolania do zewnetrznych API maja timeout
- rozroznione sa bledy retryable i non-retryable
- transient failures maja ograniczony retry z backoff
- UI dostaje czytelny status bledu i mozliwosc ponowienia
Techniczne wskazowki:
- objac tym przynajmniej transcribe, diarization, analysis i voice coaching

---

## PRIORYTET P2 - jakosc produktu i UX audio

## R06. [UX] Dopracowac statusy pipeline audio w UI
Status: `todo`
Priorytet: `P2`
Cel: uzytkownik powinien rozumiec, co dzieje sie z nagraniem od uploadu do gotowej analizy.
Akceptacja:
- widoczne etapy: upload, queued, processing, diarization, review, done, failed
- komunikaty bledow sa konkretne, a nie generyczne
- mozna wykonac retry po bledzie bez recznego odswiezania stanu
- dla dlugich operacji widoczny jest postep albo heartbeat
Techniczne wskazowki:
- wykorzystac istniejące SSE/progress i ujednolicic warstwe prezentacji statusu

---

## R07. [UX] Ujednolicic loading, empty i error states w glownych zakladkach
Status: `todo`
Priorytet: `P2`
Cel: aplikacja ma wiele widokow i przy slabym stanie danych UX staje sie niespojny.
Akceptacja:
- kalendarz, tasks, people, recordings, notes i studio maja spojn e stany ladowania i bledow
- brak danych nie wyglada jak awaria
- komponenty skeleton/error sa wspolne i wielokrotnego uzytku
Techniczne wskazowki:
- bazowac na istniejacym `src/components/Skeleton.tsx`
- wydzielic 2-3 wspolne komponenty statusowe

---

## R08. [STATE] Uporzadkowac warstwe stanu frontendu
Status: `todo`
Priorytet: `P2`
Cel: projekt laczy contexty, hooki i store, co moze byc trudne do utrzymania przy dalszym rozwoju.
Akceptacja:
- jasno opisany podzial odpowiedzialnosci: co siedzi w context, co w store, co w hookach
- usuniete zdublowane flow danych i dublowanie side effectow
- onboarding nowego developera do warstwy stanu jest prostszy
Techniczne wskazowki:
- zaczac od mapy zaleznosci miedzy `AppProviders`, `context/*`, `hooks/*`, `store/*`

---

## PRIORYTET P2.2 - spojnosc layoutu i system UI

## R09. [LAYOUT] Zdefiniowac foundation layoutu i design tokens
Status: `todo`
Priorytet: `P2`
Cel: odstepy, szerokosci, wysokosci, grid i breakpoints musza wynikac z jednego systemu, a nie z lokalnych decyzji w kazdym widoku.
Akceptacja:
- istnieje jeden zestaw tokenow dla spacingu, promieni, szerokosci kontenera, wysokosci topbara, gapow i breakpointow
- nowe i przebudowane widoki korzystaja z tokenow zamiast arbitralnych wartosci
- odstepy miedzy przyciskami, panelami i sekcjami sa przewidywalne i powtarzalne
Techniczne wskazowki:
- oprzec to o `src/styles/variables.css` i wydzielic warstwe `layout tokens`
- zdefiniowac jasna skale spacingu, np. `4/8/12/16/24/32`

---

## R10. [LAYOUT] Wydzielic prymitywy layoutowe wielokrotnego uzytku
Status: `todo`
Priorytet: `P2`
Cel: zamiast skladac kazdy ekran recznie z przypadkowych `div` i lokalnych klas, aplikacja powinna miec zestaw prymitywow layoutowych.
Akceptacja:
- powstaja komponenty/prymitywy typu `PageShell`, `PageHeader`, `Panel`, `Stack`, `Cluster`, `SplitPane`, `ContentGrid`
- glowne zakladki korzystaja z tych samych prymitywow
- kod layoutu w widokach jest krotszy i bardziej przewidywalny
Techniczne wskazowki:
- zaczac od lekkich wrapperow CSS, bez budowy ciezkiego frameworka komponentowego
- pilnowac, by prymitywy rozwiazywaly layout, nie logike biznesowa

---

## R11. [LAYOUT] Ujednolicic system przyciskow, toolbarow i akcji
Status: `todo`
Priorytet: `P2`
Cel: nierowne odstepy i niespojne akcje najczesciej wychodza na poziomie przyciskow, grup akcji i naglowkow sekcji.
Akceptacja:
- istnieja stale rozmiary i odstpy dla przyciskow, icon buttonow i grup akcji
- toolbar i akcje glowne sa rozmieszczane wedlug jednego wzorca
- nie ma lokalnych "magic numbers" tylko po to, zeby cos wizualnie dosunac
Techniczne wskazowki:
- zbudowac wspolne klasy lub komponenty dla `button row`, `section actions`, `top actions`
- powiazac to z tokenami spacingu i wysokosci

---

## R12. [LAYOUT] Ujednolicic strukture ekranow glownych
Status: `todo`
Priorytet: `P2`
Cel: zakladki typu studio, tasks, notes, people, profile i recordings powinny miec jedna logike kompozycji strony.
Akceptacja:
- kazdy ekran ma spojny układ: header, controls, content, secondary panel
- szerokosci kolumn, odstpy pionowe i rytm sekcji sa podobne miedzy widokami
- mobile i desktop maja przewidywalny responsive behavior
Techniczne wskazowki:
- zaczac od 2-3 najwazniejszych ekranow i dopiero potem propagowac wzorzec
- unifikowac layout bez niszczenia specyfiki widokow

---

## R13. [THEME] Dodac warianty layoutu i motywy, np. "bobr"
Status: `todo`
Priorytet: `P2`
Cel: chcesz miec rozne wersje layoutow i klimatow wizualnych, ale musi to byc systemowe, a nie przez kopiowanie CSS per widok.
Akceptacja:
- layout i theme mozna przelaczac przez zestaw tokenow lub `data-theme` / `data-layout`
- wariant "bobr" moze zmieniac kolorystyke, promienie, tlo, akcenty, a nawet gestość layoutu bez przepisywania widokow
- komponenty i layout prymitywy pozostaja te same niezaleznie od wariantu
Techniczne wskazowki:
- oddzielic `semantic tokens` od konkretnych kolorow i wartosci wizualnych
- przygotowac warstwe wariantow zamiast rozwidlac pliki CSS

---

## R14. [LAYOUT] Dodac visual regression i checklisty UI dla spojnosc layoutu
Status: `todo`
Priorytet: `P2`
Cel: bez stalej kontroli layout znow zacznie sie rozjezdzac po kolejnych zmianach.
Akceptacja:
- istnieje podstawowy zestaw screenshot/visual regression dla kluczowych ekranow
- PR zmieniajacy layout pokazuje roznice wizualne
- istnieje krotka checklista UI: spacing, align, responsive, states
Techniczne wskazowki:
- zaczac od kilku ekranow i breakpoints, nie od pelnego pokrycia wszystkiego

---

## PRIORYTET P2.5 - poprawa testow i odpornosci na regresje

## R15. [TEST] Zwiekszyc pokrycie testowe kluczowych hookow frontendu
Status: `todo`
Priorytet: `P2`
Cel: duza czesc logiki aplikacji siedzi w hookach, wiec to one powinny byc bronione przed regresja.
Akceptacja:
- lepsze pokrycie dla `useMeetings`, `useWorkspace`, `useRecorder`, `useRecordingPipeline`, `useLiveTranscript`
- testowane sa happy path, edge case i cleanup side effectow
- ograniczona liczba niestabilnych testow zaleznych od timingu
Techniczne wskazowki:
- priorytet dla hookow z logika stanu i synchronizacji z backendem lub local storage

---

## R16. [TEST] Dodac smoke E2E dla krytycznych scenariuszy produktowych
Status: `todo`
Priorytet: `P2`
Cel: e2e powinny chronic najwazniejsze sciezki uzytkownika, ale pozostac szybkie.
Akceptacja:
- smoke suite obejmuje logowanie, utworzenie spotkania, dodanie taska i wejscie do widoku nagrania
- suite odpala sie stabilnie lokalnie i w CI
- flaky testy sa ograniczone lub usuniete
Techniczne wskazowki:
- trzymac smoke E2E male i przewidywalne; bardziej szczegolowe przypadki zostawic unit/integration

---

## R17. [TEST] Dodac raportowanie pokrycia i minimalne progi quality gate
Status: `todo`
Priorytet: `P2`
Cel: sama obecnosc testow nie wystarczy; trzeba mierzyc czy suite chroni istotne obszary.
Akceptacja:
- coverage raportowane dla frontendu i backendu
- ustawione sa minimalne progi dla najwazniejszych katalogow albo globalnie
- spadek ponizej progu powoduje blad w CI
Techniczne wskazowki:
- nie ustawiac zbyt wysokich progow na start; lepiej wejsc stopniowo i podnosic je wraz z porzadkowaniem testow

---

## PRIORYTET P2.8 - przewaga produktowa nad Fireflies

## R18. [PRODUCT] Zbudowac mocniejszy "meeting intelligence" niz standardowe summary
Status: `todo`
Priorytet: `P2`
Cel: Fireflies mocno stoi na transkrypcji, summary, action items i Q&A. Zeby wygrac, aplikacja musi dawac glebsza wartosc operacyjna, nie tylko notatke ze spotkania.
Akceptacja:
- po kazdym spotkaniu powstaje nie tylko summary, ale tez decyzje, ryzyka, zaleznosci, unresolved questions i nastepne kroki
- kazdy insight ma odniesienie do konkretnych fragmentow transkryptu
- wynik nadaje sie od razu do pracy operacyjnej zespolu, nie wymaga recznego przepisywania
Techniczne wskazowki:
- rozbudowac pipeline analizy o output strukturalny zamiast jednego bloku tekstu
- utrzymac linkowanie do segmentow transkryptu i speakerow

---

## R19. [PRODUCT] Dodac "workspace memory" i RAG na poziomie calej organizacji
Status: `todo`
Priorytet: `P2`
Cel: Fireflies oferuje pytania do spotkan i AI apps; przewage da trwala pamiec organizacyjna ponad pojedynczym meetingiem.
Akceptacja:
- mozna zadawac pytania nie tylko o jedno spotkanie, ale o cala historie workspace
- odpowiedzi lacza wnioski z wielu spotkan, taskow i notatek
- system wskazuje zrodla i poziom pewnosci odpowiedzi
Techniczne wskazowki:
- rozszerzyc obecne RAG z poziomu pojedynczego flow do indeksu workspace/global search
- dodac filtrowanie po osobach, projektach, okresie i tagach

---

## R20. [PRODUCT] Dodac analityke rozmow i trendow zespolowych
Status: `todo`
Priorytet: `P2`
Cel: Fireflies publicznie podkresla analytics, talk time i trendy. Zeby byc lepszym, trzeba miec bardziej praktyczne insighty.
Akceptacja:
- dashboard pokazuje trendy: talk ratio, tempo spotkan, zalegle decyzje, powracajace tematy, SLA taskow
- widoczne sa zmiany w czasie, nie tylko snapshot jednego spotkania
- metryki pomagaja prowadzic zespol, a nie tylko ogladac dane
Techniczne wskazowki:
- oprzec na danych ze speakerow, taskow, kalendarza i analizy tresci
- zaczac od kilku metryk, ale z sensowna interpretacja biznesowa

---

## R21. [PRODUCT] Dodac zaawansowane review i edycje po spotkaniu
Status: `todo`
Priorytet: `P2`
Cel: przewage nad Fireflies da "human-in-the-loop" lepiej dopracowany niz typowy notetaker.
Akceptacja:
- uzytkownik moze zatwierdzac lub poprawiac: speakerow, decyzje, action items, wazne cytaty
- poprawki aktualizuja summary, taski i baze wiedzy
- system zapamietuje korekty i poprawia kolejne analizy
Techniczne wskazowki:
- powiazac review z voice profiles i warstwa analityczna
- logowac korekty jako material do ulepszania heurystyk lub promptow

---

## R22. [PRODUCT] Dodac workflow automation i integracje "po wyniku", nie tylko import
Status: `todo`
Priorytet: `P2`
Cel: Fireflies ma szerokie integracje. Zeby wygrac, trzeba automatycznie wykonywac dalsza prace po spotkaniu.
Akceptacja:
- po analizie mozna automatycznie wyslac wynik do Slack, Notion, Linear, Jira, HubSpot lub webhooka
- taski i follow-upy tworza sie bez recznego przeklejania
- mozna konfigurowac reguly per workspace
Techniczne wskazowki:
- zaczac od webhook + 2-3 najwazniejszych integracji
- budowac system adapterow zamiast twardych integracji per plik

---

## R23. [PRODUCT] Dodac mobilny lub PWA-first capture flow dla spotkan offline i in-person
Status: `todo`
Priorytet: `P2`
Cel: Fireflies ma mobile app i web recorder. Zeby byc lepszym, nagrywanie offline i szybkie przejscie do analizy musi byc bardzo lekkie i niezawodne.
Akceptacja:
- aplikacja dobrze dziala jako PWA na telefonie i desktopie
- nagranie offline synchronizuje sie po powrocie sieci
- capture flow ma minimalna liczbe krokow i odporny upload kolejki
Techniczne wskazowki:
- rozbudowac obecne PWA/service worker o kolejke synchronizacji i resumable upload

---

## PRIORYTET P3 - porzadek repo i proces developerski

## R24. [DOCS] Dopracowac README i dokumentacje uruchomienia
Status: `todo`
Priorytet: `P3`
Cel: wejscie do projektu powinno byc jednoznaczne, bez zgadywania, ktore uslugi i env sa wymagane.
Akceptacja:
- README zawiera aktualny quick start dla frontu i backendu
- jest sekcja architektury na poziomie wysokim
- opisane sa tryby local/remote oraz wymagane klucze i fallbacki
- jest sekcja testow i troubleshooting

---

## PRIORYTET P4 - dalszy rozwoj produktu

## R31. [PRODUCT] Dodac onboarding i sample workspace
Status: `todo`
Priorytet: `P4`
Cel: nowy uzytkownik powinien od razu zobaczyc wartosc bez recznego budowania wszystkiego od zera.
Akceptacja:
- pierwszy start pokazuje przewodnik po glownych funkcjach
- sample workspace zawiera przykladowe spotkanie, zadania i transcript
- mozna pominac onboarding i wrocic do niego pozniej

---

## R32. [PRODUCT] Dodac eksport wynikow spotkania
Status: `todo`
Priorytet: `P4`
Cel: wynik pracy aplikacji musi latwo wychodzic poza sam interfejs.
Akceptacja:
- eksport do co najmniej `Markdown` i `PDF` albo `JSON`
- eksport obejmuje summary, action items, transcript i speaker names
- eksport respektuje poprawki uzytkownika po review

---

## R33. [PRODUCT] Rozszerzyc funkcje wspolpracy zespolowej
Status: `todo`
Priorytet: `P4`
Cel: z czasem aplikacja powinna przejsc z narzedzia osobistego do zespolowego.
Akceptacja:
- komentarze lub notatki wewnatrz spotkan / taskow
- historia zmian dla waznych obiektow
- lepsza widocznosc ról i przypisan w workspace

---

## Proponowana kolejnosc wykonania

1. `R05` Uporzadkowac timeouty/retry dla AI
2. `R09-R14` zbudowac spojny system layoutu i wariantow
3. `R06` Poprawic statusy pipeline audio w UI
4. `R15-R17` podniesc jakosc testow frontend/e2e/coverage
5. `R25-R30` przyspieszyc i ustabilizowac deploye
6. `R08` Uporzadkowac warstwe stanu
7. `R18-R23` budowac przewage produktowa
8. `R24` Dopracowac README i dokumentacje
9. `R04` Dodac obserwowalnosc
10. `R07` Ujednolicic stany
11. `R31-R33` rozwijac dalej produktowo
