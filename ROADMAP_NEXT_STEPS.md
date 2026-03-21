# ROADMAP_NEXT_STEPS

Kolejne zadania dla projektu `audioRecorder`, ustawione od najwyzszego wplywu do prac rozwojowych.

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

---

## PRIORYTET P1 - stabilizacja architektury i backendu

## R01. [ARCH] Rozbic `server/app.ts` na moduly tras
Status: `todo`
Priorytet: `P1`
Cel: obecny plik HTTP jest zbyt duzy i skupia auth, workspace, media, voice profiles i RAG w jednym miejscu. To spowalnia zmiany i utrudnia testowanie.
Akceptacja:
- powstaja osobne moduly tras, np. `server/routes/auth.ts`, `server/routes/workspaces.ts`, `server/routes/media.ts`, `server/routes/voiceProfiles.ts`
- `server/app.ts` sklada aplikacje i middleware, ale nie zawiera logiki endpointow
- zachowanie API pozostaje bez zmian
- testy backendu przechodza bez regresji
Techniczne wskazowki:
- wydzielic wspolne helpery typu `authMiddleware`, `ensureWorkspaceAccess`, `applyRateLimit`
- utrzymac jeden punkt tworzenia aplikacji `createApp(...)`

---

## R02. [ARCH] Uporzadkowac kontrakty typow miedzy frontendem i backendem
Status: `todo`
Priorytet: `P1`
Cel: te same encje sa modelowane w wielu miejscach osobno, co sprzyja rozjazdom typow i payloadow.
Akceptacja:
- powstaje wspolny katalog kontraktow, np. `shared/` albo `src/shared/`
- typy dla auth, meetings, tasks, recordings i transcription status sa wspoldzielone
- frontend i backend importuja te same typy dla najwazniejszych payloadow
- redukcja lokalnych `any` i duplikatow typow
Techniczne wskazowki:
- zaczac od najczesciej przekazywanych obiektow: session bootstrap, recording asset, transcript segment, task

---

## R03. [TEST] Dodac integracyjne testy backendu dla kluczowych flow
Status: `todo`
Priorytet: `P1`
Cel: backend ma krytyczne trasy audio i auth, ale potrzebuje mocniejszego zabezpieczenia przed regresjami.
Akceptacja:
- testy pokrywaja co najmniej: auth session, upload audio, transcribe start, transcribe status, voice profile create, RAG ask
- testy uruchamiaja sie lokalnie jednym poleceniem
- mockowane sa zaleznosci zewnetrzne OpenAI i embedding/diarization
- pojawiaja sie testy dla blednych payloadow i autoryzacji
Techniczne wskazowki:
- wykorzystac istniejace `vitest` i testowac `createApp(...)` przez request listener
- osobno mockowac `authService`, `workspaceService`, `transcriptionService`

---

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

## R09. [AUDIO] Usprawnic review transkryptu i speaker correction
Status: `todo`
Priorytet: `P2`
Cel: najwieksza wartosc produktu powstaje po nagraniu, wiec poprawki speakerow i transkryptu musza byc szybkie.
Akceptacja:
- uzytkownik moze latwo poprawic nazwe mowcy i przypisanie segmentu
- fragmenty o niskiej pewnosci sa wyraznie oznaczone
- poprawki sa trwale i widoczne w analizie oraz eksporcie
Techniczne wskazowki:
- wykorzystac obecne pola confidence/reviewSummary i rozbudowac flow edycji

---

## PRIORYTET P3 - porzadek repo i proces developerski

## R10. [REPO] Posprzatac artefakty debugowe i wyniki testow z katalogu glownego
Status: `todo`
Priorytet: `P3`
Cel: repo powinno wygladac jak projekt produktowy, a nie katalog roboczy po wielu uruchomieniach.
Akceptacja:
- logi i artefakty typu `test_error*.txt`, `final_run*.txt`, `integration_*.txt` sa przeniesione do jednego katalogu roboczego albo ignorowane przez git
- katalog glowny zawiera tylko istotne pliki projektu
- `.gitignore` uwzglednia pliki generowane lokalnie
Techniczne wskazowki:
- nie usuwac potrzebnych raportow bez decyzji, ale zmienic ich miejsce i policy

---

## R11. [CI] Ustawic twardy pipeline CI dla lint, typecheck, unit, server i e2e smoke
Status: `todo`
Priorytet: `P3`
Cel: dalszy rozwoj bez automatycznej kontroli szybko spowoduje regresje.
Akceptacja:
- GitHub Actions uruchamia `lint`, `typecheck`, `vitest`, `test:server`
- e2e smoke odpala przynajmniej jeden krytyczny scenariusz
- merge bez zielonego CI jest blokowany
Techniczne wskazowki:
- rozdzielic joby dla frontendu i backendu
- e2e ograniczyc do smoke path, zeby czas pipeline nie byl zbyt duzy

---

## R12. [DOCS] Dopracowac README i dokumentacje uruchomienia
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

## R13. [PRODUCT] Dodac onboarding i sample workspace
Status: `todo`
Priorytet: `P4`
Cel: nowy uzytkownik powinien od razu zobaczyc wartosc bez recznego budowania wszystkiego od zera.
Akceptacja:
- pierwszy start pokazuje przewodnik po glownych funkcjach
- sample workspace zawiera przykladowe spotkanie, zadania i transcript
- mozna pominac onboarding i wrocic do niego pozniej

---

## R14. [PRODUCT] Dodac eksport wynikow spotkania
Status: `todo`
Priorytet: `P4`
Cel: wynik pracy aplikacji musi latwo wychodzic poza sam interfejs.
Akceptacja:
- eksport do co najmniej `Markdown` i `PDF` albo `JSON`
- eksport obejmuje summary, action items, transcript i speaker names
- eksport respektuje poprawki uzytkownika po review

---

## R15. [PRODUCT] Rozszerzyc funkcje wspolpracy zespolowej
Status: `todo`
Priorytet: `P4`
Cel: z czasem aplikacja powinna przejsc z narzedzia osobistego do zespolowego.
Akceptacja:
- komentarze lub notatki wewnatrz spotkan / taskow
- historia zmian dla waznych obiektow
- lepsza widocznosc ról i przypisan w workspace

---

## Proponowana kolejnosc wykonania

1. `R01` Rozbic backendowe trasy
2. `R03` Dodac testy integracyjne backendu
3. `R05` Uporzadkowac timeouty/retry dla AI
4. `R06` Poprawic statusy pipeline audio w UI
5. `R10` Posprzatac repo
6. `R11` Spiac wszystko pod CI
7. `R02` Ujednolicic typy kontraktow
8. `R08` Uporzadkowac warstwe stanu
9. `R09` Poprawic review transkryptu
10. `R12-R15` rozwijac produktowo
