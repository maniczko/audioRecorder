# Audyt jakości testów — 28.03.2026

## TL;DR

Projekt ma **66 plików testowych**, ale ich faktyczna ochrona przed bugami produkcyjnymi jest **znacznie niższa niż sugerują liczby**:

- **38 testów jest `skip`owanych** — to martwy kod dający fałszywe poczucie pokrycia
- **4 pliki testowe to puste szkielety** (useWorkspace, useStoredState, authStore, workspaceStore)
- **1 plik (Topbar.a11y)** ma 24 "testy" które wszystkie robią `expect(Topbar).toBeDefined()` — zero prawdziwych asercji
- Kluczowe ścieżki produkcyjne (nagrywanie → kolejka → przetwarzanie → transkrypcja) są **słabo lub wcale** przetestowane

---

## 🔴 KRYTYCZNE — naprawić natychmiast

### 1. `recorderStore.test.ts` — 12 z 15 testów skipowanych
**Ryzyko:** Kolejka nagrań jest sercem aplikacji. Brak testów oznacza:
- Nie wiadomo czy retry działa po błędzie uploadu
- Nie wiadomo czy komunikaty błędów (502, brak tokena, pusty STT) wyświetlają się poprawnie
- Nie wiadomo czy fallback analysis generuje się prawidłowo
- **Efekt prod:** użytkownik nagrywa 30 min spotkanie, upload pada, brak retry → dane stracone

### 2. `workspaceStore.test.ts` — 100% skipowane (2/2)
**Ryzyko:** Przełączanie workspace, aktualizacja ról członków, bootstrap sesji — **zero weryfikacji**.
- **Efekt prod:** użytkownik zmienia workspace → stare dane, crash, brak autoryzacji

### 3. `authStore.test.ts` — 100% skipowane (2/2)  
**Ryzyko:** Persystencja tokena sesji, nadpisywanie legacy tokenów.
- **Efekt prod:** drugi login nadpisuje token → pierwszy tab traci sesję, 401 na każdym requeście

### 4. `useWorkspace.test.tsx` — 100% skipowane (3/3)
**Ryzyko:** Hydratacja sesji, logout przy 401, aktualizacja ról.
- **Efekt prod:** po odświeżeniu strony workspace nie ładuje się, użytkownik widzi pusty ekran

### 5. `useAudioHardware.test.ts` — 1 test na krytyczny hook
**Ryzyko:** Brak testów dla:
- Auto-stop po ciszy (3 min timeout) — główna feature
- VAD (Voice Activity Detection)
- Odmowa dostępu do mikrofonu (`getUserMedia` reject)
- Pause/resume
- Cleanup przy przerwaniu nagrywania
- **Efekt prod:** nagrywanie nie zatrzymuje się po ciszy → 8h nagranie, pełny dysk; lub crash po odmowie mikrofonu

### 6. `useRecordingPipeline.test.tsx` — testy nie testują nic
**Ryzyko:** Efekt `processQueue` po zakończeniu hydratacji nigdy nie zweryfikowany.
- `resolveMeetingForQueueItem` nie przetestowane
- **Efekt prod:** nagrania zostają w statusie "processing" na zawsze

### 7. `Topbar.a11y.test.tsx` — 24 fake'owe testy
Każdy test robi tylko `expect(Topbar).toBeDefined()`. **Zero testów dostępności** mimo nazwy pliku. Daje fałszywe 24 "passed" w raportach CI.

---

## 🟠 WYSOKIE RYZYKO — naprawić w tym sprincie

### 8. `useRecorder.test.tsx` — over-mocking
- Wszystkie zależności zamockowane → test przechodzi nawet jeśli integracja jest zepsuta
- Brak testów: `queueRecording` gdy `saveAudioBlob` rzuca błąd, storage quota exceeded
- **Efekt prod:** nagranie "zapisane" ale blob utrwalony niepoprawnie → crash przy odtwarzaniu

### 9. `useRecordingActions.test.ts` — słabe asercje
- `updateTranscriptSegment` nie sprawdza czy auto-verify działa poprawnie
- `mergeTranscriptSegments` nie testuje niesortowanych segmentów
- `splitTranscriptSegment` nie testuje out-of-bounds splitIndex
- **Efekt prod:** użytkownik edytuje transkrypcję → segmenty się mieszają

### 10. `useMeetings.test.tsx` — integracja nigdy nie testowana
- `deleteRecordingAndMeeting` — **zero asercji**, komentarz: "just verify function exists"
- Google Calendar conflict detection zawsze zwraca `null` w mocku
- **Efekt prod:** usunięcie nagrania nie czyści powiązanych danych → zombie rekordy

### 11. `useGoogleIntegrations.test.ts` + `autosync.test.ts` — szkielety
- Testy łapią errory w try-catch i nigdy nie assertują
- Autosync: mocki setup ale nigdy nie wywołane
- **Efekt prod:** sync z Google Tasks rozstrzyga konflikty losowo, dane nadpisywane

### 12. `permissions.test.ts` — rola 'admin' w ogóle nie testowana
- Tylko 'viewer' i 'owner' sprawdzone, 'admin' pominięty
- `toMatchObject()` nie weryfikuje kompletności obiektu permissions
- **Efekt prod:** admin ma uprawnienia ownera lub viewera zamiast swoich

### 13. `storage.browser.test.ts` — testy mockujące to co testują
- `downloadTextFile` mockuje cały DOM → test zawsze przechodzi
- `idbJSONStorage` sprawdza tylko `typeof result === 'string'`
- Brak testów: quota exceeded, uszkodzony JSON, współbieżne zapisy
- **Efekt prod:** cicha korupcja danych w IndexedDB

### 14. `tasks.coverage.test.ts` — hardcoded magic numbers
- `buildTaskReorderUpdate` — obliczenie `(1024 - 0) / 2 = 512` "prawidłowe przypadkiem"
- `extractMeetingTasks` nie testuje `analysis: null`
- **Efekt prod:** reordering tasków łamie się przy skrajnych wartościach order

### 15. `App.integration.test.tsx` — skipowany kluczowy test
- `restores an autosaved meeting draft after refresh` — skipowany
- Brak testów: failed registration, session expiry, offline mode
- **Efekt prod:** użytkownik traci draft spotkania po odświeżeniu

---

## 🟡 ŚREDNIE RYZYKO

### 16. `TasksTab.test.tsx` — skipowane error handling
- Test "komunikat bledu gdy onCreateTask zwraca falsy" — flaky → skipowany
- Brak walidacji formularza (pusty tytuł)
- **Efekt prod:** tworzenie taska bez tytułu → crash lub puste zadanie

### 17. `CalendarTab.test.tsx` — 3 testy na złożony komponent
- Brak testów: timezone, puste kalendarze, Google Calendar sync errors
- Drag-drop testowane z brittle selectorami

### 18. `RecordingsTab.test.tsx` — brak testów retry
- Empty transcript vs brak transkrypcji traktowane tak samo
- Brak testów network timeout podczas retry

### 19. `ProfileTab.comprehensive.test.tsx` — 60% skipowane
- Voice Profiles, Vocabulary, Tag Manager, Audio Storage, Changelog, Empty States — **6 describe.skip**
- **Efekt prod:** konfiguracja profilu głosowego nie działa

### 20. `useTaskOperations.test.ts` — testy checkują wywołania setterów, nie dane
- `bulkUpdateTasks` sprawdza `toHaveBeenCalled()`, nie CO zostało ustawione
- Brak testów: task ID nie istnieje, nieprawidłowy column ID

### 21. `MeetingsContext.test.tsx` — mockuje to co testuje
- Cały `useMeetings` zamockowany → test sprawdza czy mock zwraca mocka

### 22. `googleSync.test.ts` — brak testów timezone/DST
- Conflict detection sprawdza tylko boolean, nie które pola konfliktują
- Brak testów: snapshot z `null` wartościami

---

## 🟢 DOBRE TESTY (wzór do naśladowania)

| Plik | Dlaczego dobry |
|------|-------------|
| `TaskDetailsPanel.test.tsx` | Testuje Google Sync konflikty, tworzenie, usuwanie, graceful degradation |
| `taskViewUtils.test.ts` | Kompleksowe edge cases, drag-drop helpery |
| `NotesTab.test.tsx` | Testuje prawdziwe workflow użytkownika (search → filter → tag) |
| `TabRouter.test.tsx` | Error boundary, retry logic, loading states |
| `lib/workspace.test.ts` | Migracje, tworzenie, walidacje |
| `lib/auth.test.ts` | Rejestracja, reset hasła, Google OAuth (ale wymaga uzupełnienia) |

---

## Statystyki

| Metryka | Wartość |
|---------|--------|
| Pliki testowe (src/) | 54 |
| Pliki testowe (tests/) | 12 |
| **Testy skipowane** | **38** |
| Pliki z 100% skip | 4 (useWorkspace, useStoredState, authStore, workspaceStore) |
| Pliki-wydmuszki | 1 (Topbar.a11y — 24 fake testy) |
| Pliki źródłowe BEZ testów | ~50 (w tym krytyczne: services/, AI modules, wiele hooks) |

---

## Systemowe problemy w test suite

### 1. Over-mocking — testy nie łapią prawdziwych bugów
Większość hooków mockuje wszystkie zależności. Test przechodzi nawet gdy integracja jest zepsuta. Przykład: `useRecorder` mockuje `useRecordingPipeline`, `useAudioHardware`, `useAudioHydration` — to testuje tylko czy mocki się wywołują.

**Rozwiązanie:** Pisać testy integracyjne z prawdziwymi hookami, mockować tylko I/O (fetch, localStorage, MediaRecorder).

### 2. Brak testów error path
Prawie każdy test pokrywa happy path. Brakuje:
- Network errors (timeout, 5xx, quota)
- Odmowa dostępu (mikrofon, storage)
- Uszkodzone dane (corrupted JSON, null fields)
- Race conditions (concurrent operations)

**Rozwiązanie:** Dla każdej testowanej funkcji dodać minimum 1 test z reject/throw/null input.

### 3. Skip zamiast fix
38 skipowanych testów to testy których ktoś nie umiał zamockować. Komentarze typu "requires complex mocking" sugerują problem z architekturą testów, nie z samymi modułami.

**Rozwiązanie:** Skipowane testy albo naprawić (zmienić strategię mockowania), albo usunąć — martwy skip daje fałszywe poczucie bezpieczeństwa.

### 4. Słabe asercje
`toHaveBeenCalled()`, `toBeDefined()`, `toMatchObject()` z niepełnym obiektem — te asercje przechodzą nawet gdy wynik jest niepoprawny.

**Rozwiązanie:** Zawsze assertować konkretną wartość: `toEqual(expectedObject)`, `toHaveBeenCalledWith(exactArgs)`.

---

## Plan naprawy — priorytetyzacja

### Tydzień 1: Odblokować krytyczne skipy
1. ~~`recorderStore.test.ts`~~ — naprawić 12 skipowanych testów (kolejka nagrań)
2. ~~`workspaceStore.test.ts`~~ — napisać 5+ testów (switch workspace, bootstrap, unauthorized)
3. ~~`authStore.test.ts`~~ — napisać 3+ testów (token persistence, stale token, session expiry)

### Tydzień 2: Nagrywanie end-to-end
4. `useAudioHardware.test.ts` — dodać 8+ testów (silence auto-stop, VAD, permissions, pause/resume)
5. `useRecordingPipeline.test.tsx` — przepisać z prawdziwą logiką efektów
6. `useRecorder.test.tsx` — dodać error paths (saveAudioBlob fail, storage full)

### Tydzień 3: Integracje
7. `useGoogleIntegrations.test.ts` — napisać prawdziwe testy API errors, conflicts
8. `permissions.test.ts` — dodać role 'admin', weryfikacja kompletności
9. `App.integration.test.tsx` — odskipować draft autosave, dodać session expiry

### Tydzień 4: Cleanup
10. Usunąć lub naprawić `Topbar.a11y.test.tsx`
11. Odskipować `ProfileTab.comprehensive.test.tsx` sekcje
12. Dodać testy dla najważniejszych nieobjętych plików: `services/authService.ts`, `lib/meeting.ts`, `lib/transcription.ts`
