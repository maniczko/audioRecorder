# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`
Zadania zakonczone → TASK_DONE.md

---

## PRIORYTET P0 — TEST COVERAGE (aktualny sprint)

---

### 100. [TESTS] audioPipeline.ts — pokrycie testami do 80%
Status: `in_progress`
Priorytet: `P0`
Cel: `audioPipeline.ts` ma 22% coverage (797 linii, 173 pokryte). To krytyczny plik dla transkrypcji audio.
Postęp:
- ✅ Uruchomiono coverage report (49.37% servera, audioPipeline 22%)
- ✅ Stworzono plan testów w `docs/TEST_COVERAGE_PLAN.md`
- ✅ Dodano tabelę jakości testów do raportu HTML (`npm run coverage:summary`)
- ❌ 10 padających testów w `audio-pipeline.unit.test.ts` (problemy z mockowaniem)
Następne kroki:
- wydzielić czyste funkcje do `audioPipeline.utils.ts` i wyeksportować
- naprawić mocki `fetch`, `fs`, `child_process` w istniejących testach
- dodać testy dla: `buildWhisperPrompt()`, `isHallucination()`, `textSimilarity()`, `mergeShortSegments()`
- przetestować `transcribeRecording()` — małe pliki, chunking, error handling
Pliki:
- `server/audioPipeline.ts` — główny plik do testowania
- `server/tests/audio-pipeline.unit.test.ts` — istniejące testy do naprawy
- `docs/TEST_COVERAGE_PLAN.md` — szczegółowy plan
- `scripts/coverage-summary.cjs` — skrypt podsumowujący
Komendy:
- `npm run test:server:coverage` — testy servera z coverage
- `npm run coverage:summary` — podsumowanie w terminalu
- `npm run coverage:open` — otwórz raport HTML

---

### 101. [TESTS] database.ts — pokrycie testami do 80%
Status: `in_progress`
Priorytet: `P0`
Cel: `database.ts` ma 62% coverage (337 linii). Brakuje testów dla `upsertMediaAsset()`, `getRecordingWithTranscript()`.
Postęp:
- ✅ Dodano 17 nowych testów w `database.additional.test.ts`
- ✅ `upsertMediaAsset()` - insert, update, różne formaty audio, sanitization ID
- ✅ `getMediaAsset()` - returns asset, returns null for nonexistent
- ✅ `deleteMediaAsset()` - delete with cleanup, workspace check
- ✅ `saveAudioQualityDiagnostics()` - save metrics, handle null
- ✅ Helper functions - `_generateId()`, `_generateInviteCode()`, `_safeJsonParse()`, `_pickProfileDraft()`
- 📈 Coverage wzrosło z 62% → 64.85% (+2.85%)
Następne kroki:
- kontynuować z TranscriptionService.ts
Pliki:
- `server/database.ts`
- `server/tests/database.test.ts` (istniejące)
- `server/tests/database/database.additional.test.ts` (nowe)

---

### 102. [TESTS] TranscriptionService.ts — pokrycie testami do 85%
Status: `todo`
Priorytet: `P0`
Cel: `TranscriptionService.ts` ma 68% coverage. Brakuje testów dla `analyzeAudioQuality()`, `createVoiceProfileFromSpeaker()`.
Następne kroki:
- dodać testy dla `analyzeAudioQuality()` — z pipeline, bez pipeline
- dodać testy dla `createVoiceProfileFromSpeaker()` — sukces, cleanup temp files
- przetestować deduplikację jobów transkrypcji
Pliki:
- `server/services/TranscriptionService.ts`
- `server/tests/transcription.test.ts`

---

### 103. [TESTS] sqliteWorker.ts — pokrycie testami do 70%
Status: `todo`
Priorytet: `P0`
Cel: `sqliteWorker.ts` ma 0% coverage (30 linii). To krytyczny plik dla bazy danych.
Następne kroki:
- dodać testy dla inicjalizacji worker thread
- przetestować komunikację z głównym wątkiem
- dodać testy dla obsługi błędów
Pliki:
- `server/sqliteWorker.ts`

---

### 104. [TESTS] supabaseStorage.ts — utrzymanie 90% coverage
Status: `done`
Priorytet: `P0`
Cel: `supabaseStorage.ts` ma 91% coverage — utrzymanie poziomu.
Pliki:
- `server/lib/supabaseStorage.ts`

---

## PRIORYTET P1 — krytyczne dla bezpieczenstwa i uzytecznosci

---

## 071. [SECURITY] Proxy wywołań Anthropic API przez backend
Status: `todo`
Priorytet: `P1`
Cel: REACT_APP_ANTHROPIC_API_KEY jest częścią bundla przeglądarki — każdy odwiedzający może go odczytać w DevTools i nadużyć klucza. Wszystkie wywołania Claude API muszą przechodzić przez serwer.
Akceptacja:
- brak żadnych wywołań `anthropic` / `fetch` do `api.anthropic.com` bezpośrednio z kodu React.
- nowe endpointy serwera: `POST /ai/analyze`, `POST /ai/suggest-tasks`, `POST /ai/search`, `POST /ai/person-profile`.
- klucz API tylko po stronie serwera (env `ANTHROPIC_API_KEY`); `REACT_APP_ANTHROPIC_API_KEY` usunięty z `.env` i kodu.
- istniejące UI (AiTaskSuggestionsPanel, analyzeMeeting) działa identycznie — tylko transport zmieniony.
- rate limit na endpointach AI: 20 req/min per IP.
Techniczne wskazówki:
- `server/aiProxy.js` — express router z endpointami; wywołuje Anthropic SDK.
- `src/lib/aiClient.js` — zamień bezpośrednie wywołania SDK na `fetch('/ai/...')`.
- przenieść `src/lib/analysis.js`, `aiTaskSuggestions.js`, `aiSearch.js` do wywołań przez proxy.

---

## PRIORYTET P2 — jakość rozpoznawania audio (najwyższy priorytet)

---

## 075. [AUDIO] Groq — whisper-large-v3 zamiast whisper-1/gpt-4o-transcribe
Status: `todo`
Priorytet: `P2`
Cel: Groq oferuje `whisper-large-v3` (model 3× lepszy od whisper-1 dla polskiego) z opóźnieniem ~0.3s dla pliku 60 min — 216× realtime. Koszt ~$0.111/h vs ~$0.6/h OpenAI. To najszybszy, najtańszy i najdokładniejszy model Whisper dostępny przez API.
Akceptacja:
- konfigurowalny dostawca: `VOICELOG_STT_PROVIDER=groq` lub `openai` (default: openai).
- przy Groq: model `whisper-large-v3`, endpoint `https://api.groq.com/openai/v1`.
- czas transkrypcji 60 min nagrania < 10s.
- dokładność polskich nazw własnych wyraźnie lepsza niż whisper-1.
- fallback do OpenAI gdy Groq niedostępne lub brak `GROQ_API_KEY`.
Techniczne wskazówki:
- `server/audioPipeline.js`: `GROQ_API_KEY = process.env.GROQ_API_KEY || ""`.
- gdy `GROQ_API_KEY`: `OPENAI_BASE_URL = "https://api.groq.com/openai/v1"`, `VERIFICATION_MODEL = "whisper-large-v3"`.
- Groq API jest OpenAI-compatible — `requestAudioTranscription` działa bez zmian.
- `response_format: "verbose_json"` działa w Groq; `diarized_json` niedostępne → użyj pyannote.
- limit pliku Groq: 25 MB (taki sam jak OpenAI) — chunking bez zmian.

---

## 076. [AUDIO] Word-level timestamps + precyzyjna diaryzacja per-słowo
Status: `todo`
Priorytet: `P2`
Cel: Whisper może zwracać timestamps per-słowo (`timestamp_granularities: ["word","segment"]`). Przy łączeniu z pyannote każde słowo trafia do właściwego mówcy (zamiast całego segmentu). Poprawia dokładność przy przeplotach i krótkich wypowiedziach.
Akceptacja:
- każde słowo w segmencie ma `word`, `start`, `end` fields.
- przy pyannote: `mergeWithPyannote` działa na poziomie słów (nie segmentów) → mniej błędnych przypisań.
- segmenty w wynikowej transkrypcji dzielone na granicy zmiany mówcy wewnątrz Whisper-segmentu.
- fallback do obecnego zachowania gdy brak word timestamps.
Techniczne wskazówki:
- `whisperFields.timestamp_granularities: ["word", "segment"]`.
- `mergeWithPyannote`: dla każdego słowa (`wseg.words[i]`) znajdź pyannote speakera → grupuj w segmenty po zmianie speakera.
- nowa funkcja `splitSegmentsByWordSpeaker(whisperSegments, pyannoteSegments)`.

---

## 077. [AUDIO] Server-side VAD — ffmpeg silence removal przed transkrypcją
Status: `todo`
Priorytet: `P2`
Cel: Whisper halucynuje ("Thank you.", tekst po angielsku, powtarzające się frazy) na ciszy. Usunięcie ciszy ffmpeg po stronie serwera eliminuje te halucynacje bez potrzeby instalacji bibliotek klienckich.
Akceptacja:
- po `preprocessAudio()`: ffmpeg `silenceremove` filtruje fragmenty < -35 dB i > 0.5s.
- czas trwania audio przed/po logowany gdy `VOICELOG_DEBUG=true`.
- opcja wyłączenia: `VOICELOG_SILENCE_REMOVE=false`.
- nie usuwa ciszy poniżej 0.5s (krótkie pauzy są ważne dla naturalnej mowy).
Techniczne wskazówki:
- dodać do filter chain w `preprocessAudio()`: `silenceremove=start_periods=1:start_duration=0.1:start_threshold=-50dB:stop_periods=-1:stop_duration=0.5:stop_threshold=-35dB`.
- Uwaga: `silenceremove` nie resetuje timestamps — downstream pipeline dostaje plik bez ciszy, ale timestamps w Whisper wyjściu dotyczą przetworzonego pliku.
- Dlatego ten filtr jest bezpieczny TYLKO gdy nie używamy pyannote (który potrzebuje oryginalnych timestamps). Włączyć tylko dla Whisper-only pipeline.

---


## 072. [SPEAKER] Pyannote.audio — zaawansowana diaryzacja serwera
Status: `todo`
Priorytet: `P2`
Cel: model GPT-4o diarization jest dobry, ale pyannote.audio (neural pipeline z HuggingFace) daje lepsze wyniki dla trudnych nagrań — szum tła, nakładające się głosy, krótkie wypowiedzi. Działa w trybie offline bez kosztów API.
Akceptacja:
- jeśli `HF_TOKEN` ustawiony i `pyannote` dostępne → używa pyannote.audio jako pierwszorzędnego diaryzera.
- wynik pyannote mapowany na istniejący format `diarized_json` (speakerId A/B/C..., timestamps).
- fallback → GPT-4o diarize jak dotąd gdy pyannote niedostępne.
- diaryzacja pyannote działa dla pliku 60 min w < 3 min (GPU) lub < 15 min (CPU).
- toggle `VOICELOG_DIARIZER=pyannote|openai` w `.env`.
Techniczne wskazówki:
- `server/diarizePyannote.py` — prosty skrypt: `pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", use_auth_token=HF_TOKEN)`, wyjście JSON.
- `server/audioPipeline.js`: `diarizeWithPyannote(filePath)` → `execSync("python server/diarizePyannote.py ...")` → parse JSON.
- `server/requirements.txt`: `pyannote.audio>=3.1`, `torch`, `torchaudio`.
- instalacja: `pip install -r server/requirements.txt`.

---

## 061. [AUDIO] VAD (SileroVAD) — wycinanie ciszy przed uploadem
Status: `todo`
Priorytet: `P2`
Cel: długie pauzy wydłużają czas transkrypcji, zwiększają koszt API i powodują halucynacje Whisper. SileroVAD wycina ciszę z uploadu (zachowuje lokalne audio bez zmian).
Akceptacja:
- po zatrzymaniu nagrania, przed uploadem: detekcja segmentów aktywności mowy.
- fragmenty ciszy > 2s usuwane z uploadu (lokalny plik niezmieniony).
- w UI informacja ile % audio wycięte ("Wycięto 3m 20s ciszy").
- fallback: jeśli VAD niedostępny → upload jak dotąd.
Techniczne wskazówki:
- `@ricky0123/vad-web` (SileroVAD ONNX, ~200 kB gzip) — działa w głównym wątku.
- nowy plik `src/audio/vadFilter.js`: `async function filterSilence(blob) → Blob`.
- wywoływany w `useRecorder.js` po zatrzymaniu nagrania, przed `persistRecordingAudio`.

---

## 057. [AUDIO] Upgrade RNNoise worklet do rzeczywistego modelu WASM
Status: `todo`
Priorytet: `P2`
Cel: obecna spektralna subtrakcja (task 056) nie radzi sobie z niestacjonarnym szumem (głosy w tle, ruch uliczny). RNNoise WASM (Mozilla, sieć neuronowa) daje ~15 dB lepszą redukcję.
Akceptacja:
- worklet ładuje WASM binarny RNNoise z `public/`.
- przetwarzanie ramek 480 próbek przez `rnnoise_process_frame()`.
- brak WASM → fallback do obecnej spektralnej subtrakcji.
- VAD probability z RNNoise eksponowane opcjonalnie do UI (wskaźnik aktywności głosu).
Techniczne wskazówki:
- znaleźć build WASM rnnoise bez Emscripten env imports (standalone WASI lub rnnoise-wasm.js).
- alternatywnie: ładować `rnnoise-wasm.js` w głównym wątku, przekazać `WebAssembly.Module` do worklet przez `port.postMessage({ type: "module", wasmModule }, [wasmModule])`.
- worklet: `WebAssembly.instantiate(data.wasmModule, { env: minimalEmscriptenEnv })`.
- rozmiar ramki 480 próbek; buforować w worklet, przetwarzać synchronicznie.

---


## 074. [AUDIO] Adaptacyjna normalizacja głośności per mówca
Status: `todo`
Priorytet: `P2`
Cel: gdy jeden mówca jest znacznie głośniejszy od drugiego, Whisper częściej myli głośniejszego — normalizacja per speaker wyrównuje szanse i poprawia rozpoznawanie.
Akceptacja:
- po diaryzacji (segmenty + speakerId): FFmpeg normalizuje każdy segment osobno do -16 LUFS.
- znormalizowane segmenty sklejane w jeden plik przed finalną transkrypcją.
- efekt: lepsza dokładność dla cichych mówców (mierzalne przez `verificationScore`).
- wyłączalne przez `VOICELOG_PER_SPEAKER_NORM=false`.
Techniczne wskazówki:
- `server/audioPipeline.js`: po `diarize()` → dla każdego speakerId: `ffmpeg -ss [start] -t [dur] -af loudnorm=I=-16 [out_N.wav]`.
- złożenie: `ffmpeg -i "concat:seg1.wav|seg2.wav|..." -c copy combined_norm.wav`.
- tylko jeśli `speakerCount > 1` — dla jednego mówcy globalny `loudnorm` wystarczy.

---

## PRIORYTET P2 — rozpoznawanie i wizualizacja mówców

---

## 051. [SPEAKER] Multi-sample enrollment i per-profile threshold
Status: `todo`
Priorytet: `P2`
Cel: jeden sample głosu (~15s) to za mało — wielokrotne próbki dramatycznie zwiększają dokładność rozpoznawania.
Akceptacja:
- użytkownik może nagrać do 5 próbek głosu per osoba (każda 15–30s).
- embedding przechowywany jako average ze wszystkich próbek.
- per-profil slider threshold (0.70–0.95, default 0.82) w UI listy profili.
- przy auto-labelu widoczne "Marek (94%)" z confidence score.
Techniczne wskazówki:
- `voice_profiles` table: dodać kolumnę `sample_count INT DEFAULT 1`.
- `POST /voice-profiles` z tym samym `X-Speaker-Name` → uśrednia embedding z istniejącym.
- `server/speakerEmbedder.js`: eksportować `averageEmbeddings(embeddings[])`.

---



---


---

#

---

## 069. [SPEAKER] Korekta mówcy jako aktualizacja profilu (feedback loop)
Status: `todo`
Priorytet: `P3`
Cel: gdy user ręcznie zmienia "Speaker 1" na "Marek", ta wiedza ginie — feedback loop tworzy samodoskonalący się system.
Akceptacja:
- po zmianie nazwy mówcy: opcjonalny dialog "Czy dodać audio tego mówcy do profilu głosu?".
- jeśli tak: wyciągnięcie clipów + aktualizacja profilu (jak w 068).
- toggle w ustawieniach: "Automatycznie ucz się mówców" (domyślnie off).
Techniczne wskazówki:
- w `renameSpeaker()` w `useMeetings`: emitować event który `TranscriptPanel` może obsłużyć.
- modal potwierdzenia: `SpeakerEnrollConfirmModal`.
- wywołanie `POST /voice-profiles/from-recording` jak w 068.

---

## PRIORYTET P2 — analiza głosu i coaching

---

## 078. [VOICE] GPT-4o audio-preview — coaching tonu głosu i wymowy
Status: `done`
Priorytet: `P2`
Cel: Analiza jakości mówienia bazując na rzeczywistym dźwięku głosu — ton, tempo, wymowa polskich głosek, dykcja, pauzy, wypełniacze. Dostarcza konkretnych wskazówek w języku polskim jak poprawić każdy aspekt.
Akceptacja:
- przycisk "Analiza głosu AI" przy każdym mówcy w panelu Voice Analytics (sidebar transcript).
- GPT-4o audio-preview słyszy rzeczywiste audio i odpowiada po polsku (~200-300 słów).
- ocenia: ton/emocje, tempo, wymowę, pauzy, wypełniacze, dykcję.
- wyniki widoczne w sidebar bez przeładowania strony.
- graceful error jeśli brak OpenAI API key lub plik audio niedostępny.
Techniczne wskazówki:
- `server/audioPipeline.js`: `generateVoiceCoaching(asset, speakerId, segments)` — FFmpeg extractuje audio speakera (do 60s), wysyła base64 do `gpt-4o-audio-preview`.
- `POST /media/recordings/:id/voice-coaching` endpoint w `server/index.js`.
- `VoiceSpeakerStats` component w `StudioMeetingView.js` — pokazuje metryki + "Analiza głosu AI" button.
- tylko w remote mode (`remoteApiEnabled()`).

---

## 079. [VOICE] Metryki mówienia z transkrypcji (WPM, wypełniacze, tury)
Status: `done`
Priorytet: `P2`
Cel: Bez API — natychmiastowe metryki stylu mówienia z istniejącej transkrypcji per mówca.
Akceptacja:
- słowa/minutę (WPM) per mówca widoczne w sidebar.
- czas mówienia (mm:ss) per mówca.
- liczba tur (wypowiedzi) i średnia długość tury.
- procent słów-wypełniaczy (ee, yyy, znaczy, jakby...) z ostrzeżeniem gdy > 5%.
Techniczne wskazówki:
- `src/lib/speakerAnalysis.js`: `analyzeSpeakingStyle(transcript, displaySpeakerNames)`.
- FILLER_WORDS_PL set: ee, eee, yyy, yyyy, znaczy, jakby, właśnie, tego, wiesz, hmm.
- wywoływane w `VoiceSpeakerStats` useMemo.

---

## 080. [VOICE] Acoustic features per speaker — librosa/parselmouth (roadmap)
Status: `todo`
Priorytet: `P3`
Cel: Głębsza analiza akustyczna: F0/pitch (jitter, shimmer), HNR (harmonics-to-noise), formants — wymaga Python server-side. Uzupełnia GPT-4o coaching o obiektywne dane.
Akceptacja:
- `POST /media/recordings/:id/acoustic-features` zwraca per-speaker: mean F0, F0 range, jitter %, shimmer %, HNR dB.
- wyniki widoczne w VoiceSpeakerStats obok metryk WPM.
- opcjonalne: Montreal Forced Aligner dla per-fonem scoring polskich głosek.
Techniczne wskazówki:
- `server/acousticFeatures.py`: librosa (F0, RMS), parselmouth/Praat (jitter, shimmer, HNR, formants).
- `server/requirements.txt`: `librosa>=0.10`, `praat-parselmouth>=0.4`.
- FFmpeg extractuje speaker clip → Python analizuje → wynik JSON.
- MFA dla Polish: wymaga modelu `polish-mfa` z modeldb.

---

## PRIORYTET P2 — niezawodność i ergonomia

---

## 046. [AUDIO] Exponential backoff i auto-retry w kolejce nagrań
Status: `todo`
Priorytet: `P2`
Cel: błąd sieciowy = item utknięty w `failed` bez auto-ponowienia; user musi kliknąć ręcznie.
Akceptacja:
- po błędzie item czeka 1s, 4s, 16s (3 próby) przed oznaczeniem jako trwały błąd.
- przy braku internetu (`navigator.onLine === false`) item czeka do powrotu sieci.
- po 3 nieudanych próbach: status `failed_permanent`, wyraźny komunikat + przycisk "Ponów ręcznie".
- licznik prób widoczny przy każdym itemie w kolejce.
Techniczne wskazówki:
- dodać `retryCount`, `backoffUntil`, `lastErrorMessage` do `RecordingQueueItem` w `recordingQueue.js`.
- w `useRecorder.js`: przed `processQueueItem` sprawdzić `item.backoffUntil > Date.now()`.
- `window.addEventListener("online", ...)` wznawia processing.

---

## 047. [AUDIO] Obsługa błędów odtwarzania audio w UnifiedPlayer
Status: `todo`
Priorytet: `P2`
Cel: `play().catch(() => {})` połyka błędy — user klika ▶ i nic się nie dzieje bez feedbacku.
Akceptacja:
- błąd odtwarzania pokazuje inline komunikat ("Nie można odtworzyć — plik może być uszkodzony").
- po błędzie ▶ zmienia się na ikonę ⚠ z tooltipem.
- błąd `NotAllowedError` obsługiwany osobno: "Kliknij aby odblokować audio".
Techniczne wskazówki:
- `src/studio/UnifiedPlayer.js`: `a.play().catch(err => setPlayError(err.message))`.
- lokalny stan `playError`, czyszczony przy zmianie `src`.

---

## 049. [AUDIO] VAD — automatyczne zatrzymanie przy długiej ciszy
Status: `todo`
Priorytet: `P2`
Cel: użytkownik zapomina zatrzymać nagranie → kilkugodzinne pliki, przepełnienie storage.
Akceptacja:
- jeśli cisza > 3 minuty (konfigurowalnie: 1/3/5/off) — nagranie zatrzymuje się automatycznie.
- 30s przed zatrzymaniem: widoczne odliczanie "Zatrzymanie za 30s — kliknij aby kontynuować".
- "Kontynuuj" resetuje licznik.
Techniczne wskazówki:
- w `useRecorder.js`: monitorować `AnalyserNode` max amplitude w oknie 3 min → trigger.
- countdown state eksponowany do `UnifiedPlayer` jako prop.

---

## 050. [AUDIO] Chunked upload dla dużych plików (>10MB)
Status: `todo`
Priorytet: `P2`
Cel: przy słabym WiFi upload dużego pliku często się przerywa i wymaga ponowienia od zera.
Akceptacja:
- pliki > 10MB dzielone na chunki 2MB wysyłane sekwencyjnie.
- postęp uploadu widoczny w UnifiedPlayer (pasek procentowy).
- przerwany upload może być wznowiony — serwer przechowuje chunki przez 24h.
Techniczne wskazówki:
- `src/services/mediaService.js`: `persistRecordingAudio()` → jeśli `blob.size > 10MB`, podzielić na `Blob.slice()` chunks.
- serwer: `PUT /media/recordings/:id/audio/chunk?index=N&total=M` → składa w jeden plik.
- po zakończeniu: `POST /media/recordings/:id/audio/finalize`.

---


---

## 024. AI — automatyczny coaching po spotkaniu (meeting debrief)
Status: `todo`
Priorytet: `P2`
Cel: AI generuje krótki debrief po spotkaniu: streszczenie, decyzje, ryzyka, follow-upy.
Akceptacja:
- sekcja "Debrief AI" w panelu spotkania po analizie transkrypcji.
- zawiera: streszczenie 3-5 zdań, decyzje (max 5), ryzyka (max 3), sugestie follow-up.
- eksport PDF lub kopia do schowka.
- debrief persystuje w `meeting.aiDebrief`.
Techniczne wskazówki:
- `src/lib/analysis.js`: `generateMeetingDebrief(meeting, transcript)` → proxy przez `/ai/analyze`.
- prompt po polsku, wynik przez `updateMeeting`.

---

## 039. Zarządzanie pamięcią audio — limity IndexedDB
Status: `todo`
Priorytet: `P2`
Cel: aplikacja może wypełnić quota storage przeglądarki bez żadnego ostrzeżenia.
Akceptacja:
- przy starcie sprawdzana dostępna i użyta przestrzeń IndexedDB.
- użyte > 80% quota: widoczne ostrzeżenie z informacją ile miejsca pozostało.
- w Profile/Settings lista nagrań z rozmiarami i przycisk "Usuń audio z pamięci lokalnej" per nagranie.
Techniczne wskazówki:
- `navigator.storage?.estimate()` przy starcie w `useRecorder`.
- `audioStore.deleteRecordingBlob(recordingId)` i `audioStore.listStoredSizes()`.
- widok w `ProfileTab.js`.

---

## 035. Delta sync zamiast pełnego PUT stanu workspace
Status: `todo`
Priorytet: `P2`
Cel: `stateService.syncWorkspaceState` wysyła cały state za każdym razem — wolne przy 50+ spotkaniach.
Akceptacja:
- server przyjmuje `PATCH /state/workspaces/{id}` z deltatem.
- payload synca przy edycji jednego taska < 5kB zamiast 500kB.
- full sync pozostaje jako fallback (GET /state/bootstrap).
Techniczne wskazówki:
- dirty flag w `useMeetings`: gdy zmieni się konkretne meeting/task → dodaj do `dirtySet`.
- PATCH przyjmuje `{ meetings?: [...], tasks?: [...] }`.
- server: merge patch z istniejącym state.

---

## 036. Backup i restore danych workspace (JSON export/import)
Status: `todo`
Priorytet: `P2`
Cel: użytkownik może stracić dane przy czyszczeniu localStorage lub zmianie urządzenia.
Akceptacja:
- w Profile/Settings przycisk "Eksportuj dane workspace" pobiera JSON ze wszystkimi spotkaniami i zadaniami (metadane, bez audio blob).
- "Importuj dane" ładuje JSON i merguje z bieżącym stanem.
- import waliduje schemat i pokazuje preview (ile spotkań, tasków zostanie dodanych).
Techniczne wskazówki:
- `exportWorkspaceJson(meetings, tasks, taskBoards)` → `downloadTextFile("backup.json", ...)`.
- `importWorkspaceJson(jsonString, currentMeetings, currentTasks)` → merge z deduplikacją po `id`.

---

## 010. Pełny live sync z Google Calendar i Google Tasks
Status: `in_progress`
Priorytet: `P2`
Cel: zamknąć integrację z Google — brakuje automatycznego wypychania lokalnych zmian.
Akceptacja:
- edycja taska lokalnie automatycznie aktualizuje odpowiadający Google Task.
- utworzenie spotkania z briefem automatycznie tworzy event w Google Calendar.
- widać status "zsynchronizowano X sekund temu".
Postęp:
- automatyczne odświeżanie z Google działa (45s timer).
- import/export manualny działa.
- brakuje: auto-push lokalnych zmian taska, auto-create eventu przy saveMeeting.
Techniczne wskazówki:
- w `useGoogleIntegrations`: po `resolveGoogleTaskConflict` i po `updateTask` gdy `googleTaskId` istnieje → wywołać `updateGoogleTask`.
- w `useMeetings`: po `saveMeeting` → jeśli `googleCalendarTokenRef.current` i spotkanie ma `googleEventId` → `syncCalendarEntryToGoogle`.

---

## 020. Dostępność i keyboard-only flows
Status: `todo`
Priorytet: `P2`
Cel: poprawić dostępność aplikacji i wygodę pracy bez myszy.
Akceptacja:
- główne widoki mają sensowne role ARIA, focus order i widoczne focus state.
- da się obsługiwać kluczowe flow klawiaturą: nagranie, review transkrypcji, taski, command palette.
- przyciski mają `aria-label` gdy nie mają tekstu (ikony, color swatche).
- podstawowy axe-core smoke test w CI.
Techniczne wskazówki:
- `npm install --save-dev @axe-core/react`.
- uzupełnić `aria-label` na: waveform SVG, cover-swatche, topbar record button, timeline segments.

---

## PRIORYTET P3 — usprawnienia i nice-to-have

---

## 033. Optymalizacja wydajności — code splitting i memoizacja
Status: `todo`
Priorytet: `P3`
Cel: skrócić czas pierwszego ładowania i poprawić responsywność przy dużych datasetach.
Zakres:
- `React.lazy` + `Suspense` dla: `TaskKanbanView`, `TranscriptPanel`, `KpiDashboard`, `NotesTab`.
- `React.memo` dla: `TaskListView`, `NoteCard`, `TranscriptSegment`.
- `useMemo` dla: `sortVisibleTasks`, `buildWorkspaceActivityFeed`, `groupTasks`.
Akceptacja:
- czas FCP na dev server < 1.5s po code splitting.
- brak widocznych "lag spikes" przy scrollowaniu listy 100+ tasków.
Techniczne wskazówki:
- `React.lazy(() => import("./tasks/TaskKanbanView"))` w `TasksTab.js`.
- sprawdzić czy `useMemo` w `taskViewUtils.js` ma stabilne deps.

---

## 025. AI — semantyczne wyszukiwanie zadań i spotkań
Status: `todo`
Priorytet: `P3`
Cel: wyszukiwanie naturalnym językiem zamiast słów kluczowych.
Akceptacja:
- command palette (Ctrl+K) obsługuje semantyczne zapytania przez proxy `/ai/search`.
- wyniki oznaczone "AI Match" odróżniają się od pełnotekstowych.
- brak API key → AI match ukryty, standardowe wyszukiwanie działa.
Techniczne wskazówki:
- `src/lib/aiSearch.js`: `semanticSearch(query, meetings, tasks)` → proxy przez `/ai/search`.
- przekazywać tylko tytuły i streszczenia (nie pełne transkrypty).
- cache wyników w Map przez sesję.

---

## 041. Podział App.css na moduły CSS
Status: `todo`
Priorytet: `P3`
Cel: App.css przekroczył 3500 linii i jest trudny w utrzymaniu.
Zakres:
- podzielić na: `layout.css`, `studio.css`, `tasks.css`, `calendar.css`, `notes.css`, `people.css`, `profile.css`, `animations.css`, `variables.css`.
- zmienne CSS pozostają w `:root` w `variables.css` importowanym przez `index.css`.
- zmiana czysto strukturalna — żadne style nie mogą się psuć.
Akceptacja:
- każdy plik < 500 linii.
- build przechodzi bez ostrzeżeń.

---

## 040. Email digest i powiadomienia poza przeglądarką
Status: `todo`
Priorytet: `P3`
Cel: Browser Notifications wymagają otwartej karty — usefulness poza sesją zerowa.
Akceptacja:
- "Dzienny digest" w Profile — email raz dziennie o 7:00 lokalnego czasu.
- zawiera: zadania zaległe, zadania na dziś, nadchodzące spotkania.
- serwer: endpoint `GET /digest/daily` wywoływalny przez cron.
Techniczne wskazówki:
- `nodemailer` + SMTP (env: `VOICELOG_SMTP_HOST/USER/PASS`).
- `user.notifyDailyDigest` już istnieje w profilu — podłączyć pod mailer.

---

## 018. Outlook / Microsoft To Do / Microsoft Calendar
Status: `todo`
Priorytet: `P3`
Cel: rozszerzyć integracje poza ekosystem Google.
Akceptacja:
- można połączyć konto Microsoft (MSAL OAuth2).
- zadania synchronizują się z Microsoft To Do.
- spotkania z Outlook Calendar.
Techniczne wskazówki:
- `@azure/msal-browser` jako alternatywa dla GSI.
- MS Graph API dla To Do: `https://graph.microsoft.com/v1.0/me/todo/lists`.
- analogiczna architektura jak `googleSync.js` → `msSync.js`.

---
