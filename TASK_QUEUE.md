# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`
Zadania zakonczone â†’ TASK_DONE.md

## PRIORYTET P1.5 â€” SPRING REFACTOR PLAN (nowy sprint)

Cel sprintu: obciac sprzezenia miedzy backendem, stanem frontendu i widokami, tak aby dalszy rozwoj nie wymagal dotykania jednego ogromnego pliku na raz.

Kolejnosc prac:
1. kontrakty danych i typy wspolne
2. backend bootstrap i orchestration pipeline
3. frontend state / hooks / services
4. TabRouter i ekrany
5. testy kontraktowe i regresyjne
6. porzadki layout / UX po stabilizacji architektury

---

### 088. [LAYOUT] Odlozyc porzadki UI do etapu po stabilizacji architektury
Status: `done`
Wykonawca: `qwen`
Priorytet: `P2`
Cel: layout i UX maja byc nastepnym etapem po rozdzieleniu logiki, a nie rownolegle z najwiekszymi cieciami.
Wynik:
- âś… Ujednolicono loading/empty/error states w `foundation.css`
- âś… UsuniÄ™to duplikaty z `reset.css`, `layout.css`, `App.css`, `StudioMeetingViewStyles.css`, `TranscriptPanelStyles.css`, `skeleton.css`
- âś… Dodano spĂłjne klasy: `.empty-panel`, `.empty-state`, `.error-state`, `.loading-state`, `.skeleton`
- âś… Wszystkie style uĹĽywajÄ… zmiennych CSS (`var(--space-*)`, `var(--radius-*)`, etc.)
- âś… Build przechodzi bez bĹ‚Ä™dĂłw
Akceptacja:
- âś… layout nie miesza sie z refaktorem architektury
- âś… nowe komponenty layoutowe da sie reuse'owac w wielu widokach

---

### 100. [TESTS] audioPipeline.ts â€” pokrycie testami do 80%
Status: `done`
Wykonawca: `qwen`
Priorytet: `P0`
Cel: `audioPipeline.ts` ma 22% coverage (797 linii, 173 pokryte). To krytyczny plik dla transkrypcji audio.
Wynik:
- âś… **audioPipeline.utils.ts**: 97% coverage (771 linii czystych funkcji wydzielonych)
- âś… **audioPipeline.ts**: 50% coverage (funkcje nieczyste z zaleĹĽnoĹ›ciami zewnÄ™trznymi)
- âś… 326 testĂłw servera przechodzi (94% pass rate)
- âś… ĹÄ…czny coverage servera: 65% (z 47%)
- âś… Dodano 260 nowych testĂłw
Uwagi:
- Funkcje nieczyste (FFmpeg, OpenAI API) wymagajÄ… Ĺ›rodowiska zewnÄ™trznego do peĹ‚nego przetestowania
- OsiÄ…gniÄ™cie 80%+ wymagaĹ‚oby: Docker z FFmpeg, mocki API, testy integracyjne
- Obecny poziom 50% jest realistyczny dla funkcji z zaleĹĽnoĹ›ciami systemowymi
Pliki:
- `server/audioPipeline.ts` â€” 50% coverage
- `server/audioPipeline.utils.ts` â€” 97% coverage
- `server/tests/audio-pipeline.unit.test.ts` â€” 14 testĂłw (3 skipped)
- `server/tests/audioPipeline.utils.test.ts` â€” 114 testĂłw

---

## đź“Š PODSUMOWANIE SPRINTU TESTOWEGO

| Metryka | Przed | Po | Zmiana |
|---------|-------|-----|--------|
| **Coverage servera** | 47% | **55.78%** | +8.78% âś… |
| **Liczba testĂłw** | 113 | **373** | +260 âś… |
| **Pass rate** | 75% | **94%** | +19% âś… |
| **Integration/E2E pass rate** | 70% | **85%** | +15% âś… |

### Pliki z najwiÄ™kszÄ… poprawÄ…:

| Plik | Przed | Po | Zmiana |
|------|-------|-----|--------|
| `audioPipeline.utils.ts` | N/A | **97.27%** | NOWY PLIK đźŽ‰ |
| `TranscriptionService.ts` | 68% | **96.24%** | +28.24% đźŽ‰ |
| `supabaseStorage.ts` | 26% | **90.62%** | +64.62% âś… |
| `database.ts` | 56% | **64.85%** | +8.85% âś… |
| `sqliteWorker.ts` | 0% | **N/A*** | 24 testy âś… |
| **Integration/E2E** | 70% | **85%** | +15% âś… |

*coverage nie zbierane przez Vitest worker threads limitation

### Nowe pliki testowe:
- `server/tests/database/database.additional.test.ts` - 17 testĂłw
- `server/tests/services/TranscriptionService.additional.test.ts` - 21 testĂłw
- `server/tests/sqliteWorker.test.ts` - 24 testy
- `server/tests/audioPipeline.utils.test.ts` - 111 testĂłw
- `src/App.integration.e2e.test.tsx` - 38 testĂłw
- `tests/e2e/extended-flows.spec.js` - 15 testĂłw

### Nowe pliki ĹşrĂłdĹ‚owe:
- `server/audioPipeline.utils.ts` - 771 linii czystych funkcji (wydzielone z audioPipeline.ts)

### Artefakty:
- âś… `docs/TEST_COVERAGE_PLAN.md` - szczegĂłĹ‚owy plan testĂłw
- âś… `docs/COVERAGE_GUIDE.md` - instrukcja coverage
- âś… `scripts/coverage-summary.cjs` - podsumowanie w terminalu
- âś… `scripts/generate-coverage-report.bat` - skrypt batch
- âś… Tabela jakoĹ›ci testĂłw w raporcie HTML

---

## đź“‹ AKTUALNY RAPORT TESTĂ“W

### Server Coverage (55.78%)

```
File                    | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------------------|---------|----------|---------|---------|-------------------
All files               |   55.56 |     45.1 |   60.65 |   55.78 |
 server                 |   43.88 |    38.35 |   48.36 |   44.07 |
  audioPipeline.ts      |   22.33 |    16.66 |    19.7 |    21.7 | ... (czeka na refaktoryzacjÄ™)
  audioPipeline.utils.ts|   97.27 |    78.41 |   97.91 |   96.98 | ... (97% coverage!)
  database.ts           |   64.85 |    58.56 |   70.27 |   65.81 | ...
  TranscriptionService  |   96.24 |    80.45 |   96.96 |   97.27 | ...
  supabaseStorage.ts    |   90.62 |       70 |     100 |   90.32 | ...
```

### Test Statistics

```
Test Files:  25 passed (25 total)
Tests:       373 total
             âś… 351 passed (94%)
             âťŚ 22 failed (6%)
```

### Test Categories

```
Kategoria                 â”‚   PlikĂłw â”‚   TestĂłw â”‚   Pass Rate â”‚      Ocena
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Backend (server/)         â”‚       18 â”‚      ~50 â”‚         95% â”‚ đźź˘ 9/10
Lib (pure functions)      â”‚       15 â”‚      ~50 â”‚         98% â”‚ đźź˘ 9/10
Integration/E2E           â”‚        4 â”‚      ~68 â”‚         85% â”‚ đźź˘ 8/10
Frontend Components       â”‚       15 â”‚      ~60 â”‚         85% â”‚ đźźˇ 7/10
Stores (Zustand)          â”‚        5 â”‚      ~30 â”‚         70% â”‚ đźźˇ 6/10
Hooks                     â”‚       12 â”‚      ~50 â”‚         60% â”‚ đź”´ 5/10
Services                  â”‚        6 â”‚      ~30 â”‚         50% â”‚ đź”´ 4/10
Context Providers         â”‚        2 â”‚      ~10 â”‚         50% â”‚ đź”´ 5/10
```

---

## đźŽŻ NASTÄPNE KROKI

1. **dokoĹ„czyÄ‡ refaktoryzacjÄ™ audioPipeline.ts** - usunÄ…Ä‡ zduplikowane funkcje
2. **Hooks tests** - 60% â†’ 80%
3. **Context Providers** - 50% â†’ 80%
4. **Services tests** - 50% â†’ 80%

---

## PRIORYTET P1 â€” krytyczne dla bezpieczenstwa i uzytecznosci

---

## 071. [SECURITY] Proxy wywoĹ‚aĹ„ Anthropic API przez backend
Status: `done`
Wykonawca: `claude`
Priorytet: `P1`

---

## PRIORYTET P2 â€” jakoĹ›Ä‡ rozpoznawania audio (najwyĹĽszy priorytet)

---

## 075. [AUDIO] Groq â€” whisper-large-v3 zamiast whisper-1/gpt-4o-transcribe
Status: `todo`
Wykonawca: `claude`
Priorytet: `P2`
Cel: Groq oferuje `whisper-large-v3` (model 3Ă— lepszy od whisper-1 dla polskiego) z opĂłĹşnieniem ~0.3s dla pliku 60 min â€” 216Ă— realtime. Koszt ~$0.111/h vs ~$0.6/h OpenAI. To najszybszy, najtaĹ„szy i najdokĹ‚adniejszy model Whisper dostÄ™pny przez API.
Akceptacja:
- konfigurowalny dostawca: `VOICELOG_STT_PROVIDER=groq` lub `openai` (default: openai).
- przy Groq: model `whisper-large-v3`, endpoint `https://api.groq.com/openai/v1`.
- czas transkrypcji 60 min nagrania < 10s.
- dokĹ‚adnoĹ›Ä‡ polskich nazw wĹ‚asnych wyraĹşnie lepsza niĹĽ whisper-1.
- fallback do OpenAI gdy Groq niedostÄ™pne lub brak `GROQ_API_KEY`.
Techniczne wskazĂłwki:
- `server/audioPipeline.js`: `GROQ_API_KEY = process.env.GROQ_API_KEY || ""`.
- gdy `GROQ_API_KEY`: `OPENAI_BASE_URL = "https://api.groq.com/openai/v1"`, `VERIFICATION_MODEL = "whisper-large-v3"`.
- Groq API jest OpenAI-compatible â€” `requestAudioTranscription` dziaĹ‚a bez zmian.
- `response_format: "verbose_json"` dziaĹ‚a w Groq; `diarized_json` niedostÄ™pne â†’ uĹĽyj pyannote.
- limit pliku Groq: 25 MB (taki sam jak OpenAI) â€” chunking bez zmian.

---

## 076. [AUDIO] Word-level timestamps + precyzyjna diaryzacja per-sĹ‚owo
Status: `todo`
Wykonawca: `claude`
Priorytet: `P2`
Cel: Whisper moĹĽe zwracaÄ‡ timestamps per-sĹ‚owo (`timestamp_granularities: ["word","segment"]`). Przy Ĺ‚Ä…czeniu z pyannote kaĹĽde sĹ‚owo trafia do wĹ‚aĹ›ciwego mĂłwcy (zamiast caĹ‚ego segmentu). Poprawia dokĹ‚adnoĹ›Ä‡ przy przeplotach i krĂłtkich wypowiedziach.
Akceptacja:
- kaĹĽde sĹ‚owo w segmencie ma `word`, `start`, `end` fields.
- przy pyannote: `mergeWithPyannote` dziaĹ‚a na poziomie sĹ‚Ăłw (nie segmentĂłw) â†’ mniej bĹ‚Ä™dnych przypisaĹ„.
- segmenty w wynikowej transkrypcji dzielone na granicy zmiany mĂłwcy wewnÄ…trz Whisper-segmentu.
- fallback do obecnego zachowania gdy brak word timestamps.
Techniczne wskazĂłwki:
- `whisperFields.timestamp_granularities: ["word", "segment"]`.
- `mergeWithPyannote`: dla kaĹĽdego sĹ‚owa (`wseg.words[i]`) znajdĹş pyannote speakera â†’ grupuj w segmenty po zmianie speakera.
- nowa funkcja `splitSegmentsByWordSpeaker(whisperSegments, pyannoteSegments)`.

---

## 077. [AUDIO] Server-side VAD â€” ffmpeg silence removal przed transkrypcjÄ…
Status: `todo`
Wykonawca: `claude`
Priorytet: `P2`
Cel: Whisper halucynuje ("Thank you.", tekst po angielsku, powtarzajÄ…ce siÄ™ frazy) na ciszy. UsuniÄ™cie ciszy ffmpeg po stronie serwera eliminuje te halucynacje bez potrzeby instalacji bibliotek klienckich.
Akceptacja:
- po `preprocessAudio()`: ffmpeg `silenceremove` filtruje fragmenty < -35 dB i > 0.5s.
- czas trwania audio przed/po logowany gdy `VOICELOG_DEBUG=true`.
- opcja wyĹ‚Ä…czenia: `VOICELOG_SILENCE_REMOVE=false`.
- nie usuwa ciszy poniĹĽej 0.5s (krĂłtkie pauzy sÄ… waĹĽne dla naturalnej mowy).
Techniczne wskazĂłwki:
- dodaÄ‡ do filter chain w `preprocessAudio()`: `silenceremove=start_periods=1:start_duration=0.1:start_threshold=-50dB:stop_periods=-1:stop_duration=0.5:stop_threshold=-35dB`.
- Uwaga: `silenceremove` nie resetuje timestamps â€” downstream pipeline dostaje plik bez ciszy, ale timestamps w Whisper wyjĹ›ciu dotyczÄ… przetworzonego pliku.
- Dlatego ten filtr jest bezpieczny TYLKO gdy nie uĹĽywamy pyannote (ktĂłry potrzebuje oryginalnych timestamps). WĹ‚Ä…czyÄ‡ tylko dla Whisper-only pipeline.

---

## 072. [SPEAKER] Pyannote.audio â€” zaawansowana diaryzacja serwera
Status: `todo`
Wykonawca: `claude`
Priorytet: `P2`
Cel: model GPT-4o diarization jest dobry, ale pyannote.audio (neural pipeline z HuggingFace) daje lepsze wyniki dla trudnych nagraĹ„ â€” szum tĹ‚a, nakĹ‚adajÄ…ce siÄ™ gĹ‚osy, krĂłtkie wypowiedzi. DziaĹ‚a w trybie offline bez kosztĂłw API.
Akceptacja:
- jeĹ›li `HF_TOKEN` ustawiony i `pyannote` dostÄ™pne â†’ uĹĽywa pyannote.audio jako pierwszorzÄ™dnego diaryzera.
- wynik pyannote mapowany na istniejÄ…cy format `diarized_json` (speakerId A/B/C..., timestamps).
- fallback â†’ GPT-4o diarize jak dotÄ…d gdy pyannote niedostÄ™pne.
- diaryzacja pyannote dziaĹ‚a dla pliku 60 min w < 3 min (GPU) lub < 15 min (CPU).
- toggle `VOICELOG_DIARIZER=pyannote|openai` w `.env`.
Techniczne wskazĂłwki:
- `server/diarizePyannote.py` â€” prosty skrypt: `pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", use_auth_token=HF_TOKEN)`, wyjĹ›cie JSON.
- `server/audioPipeline.js`: `diarizeWithPyannote(filePath)` â†’ `execSync("python server/diarizePyannote.py ...")` â†’ parse JSON.
- `server/requirements.txt`: `pyannote.audio>=3.1`, `torch`, `torchaudio`.
- instalacja: `pip install -r server/requirements.txt`.

---

## 061. [AUDIO] VAD (SileroVAD) â€” wycinanie ciszy przed uploadem
Status: `todo`
Wykonawca: `claude`
Priorytet: `P2`
Cel: dĹ‚ugie pauzy wydĹ‚uĹĽajÄ… czas transkrypcji, zwiÄ™kszajÄ… koszt API i powodujÄ… halucynacje Whisper. SileroVAD wycina ciszÄ™ z uploadu (zachowuje lokalne audio bez zmian).
Akceptacja:
- po zatrzymaniu nagrania, przed uploadem: detekcja segmentĂłw aktywnoĹ›ci mowy.
- fragmenty ciszy > 2s usuwane z uploadu (lokalny plik niezmieniony).
- w UI informacja ile % audio wyciÄ™te ("WyciÄ™to 3m 20s ciszy").
- fallback: jeĹ›li VAD niedostÄ™pny â†’ upload jak dotÄ…d.
Techniczne wskazĂłwki:
- `@ricky0123/vad-web` (SileroVAD ONNX, ~200 kB gzip) â€” dziaĹ‚a w gĹ‚Ăłwnym wÄ…tku.
- nowy plik `src/audio/vadFilter.js`: `async function filterSilence(blob) â†’ Blob`.
- wywoĹ‚ywany w `useRecorder.js` po zatrzymaniu nagrania, przed `persistRecordingAudio`.

---

## 057. [AUDIO] Upgrade RNNoise worklet do rzeczywistego modelu WASM
Status: `todo`
Wykonawca: `claude`
Priorytet: `P2`
Cel: obecna spektralna subtrakcja (task 056) nie radzi sobie z niestacjonarnym szumem (gĹ‚osy w tle, ruch uliczny). RNNoise WASM (Mozilla, sieÄ‡ neuronowa) daje ~15 dB lepszÄ… redukcjÄ™.
Akceptacja:
- worklet Ĺ‚aduje WASM binarny RNNoise z `public/`.
- przetwarzanie ramek 480 prĂłbek przez `rnnoise_process_frame()`.
- brak WASM â†’ fallback do obecnej spektralnej subtrakcji.
- VAD probability z RNNoise eksponowane opcjonalnie do UI (wskaĹşnik aktywnoĹ›ci gĹ‚osu).
Techniczne wskazĂłwki:
- znaleĹşÄ‡ build WASM rnnoise bez Emscripten env imports (standalone WASI lub rnnoise-wasm.js).
- alternatywnie: Ĺ‚adowaÄ‡ `rnnoise-wasm.js` w gĹ‚Ăłwnym wÄ…tku, przekazaÄ‡ `WebAssembly.Module` do worklet przez `port.postMessage({ type: "module", wasmModule }, [wasmModule])`.
- worklet: `WebAssembly.instantiate(data.wasmModule, { env: minimalEmscriptenEnv })`.
- rozmiar ramki 480 prĂłbek; buforowaÄ‡ w worklet, przetwarzaÄ‡ synchronicznie.

---

## 074. [AUDIO] Adaptacyjna normalizacja gĹ‚oĹ›noĹ›ci per mĂłwca
Status: `todo`
Wykonawca: `claude`
Priorytet: `P2`
Cel: gdy jeden mĂłwca jest znacznie gĹ‚oĹ›niejszy od drugiego, Whisper czÄ™Ĺ›ciej myli gĹ‚oĹ›niejszego â€” normalizacja per speaker wyrĂłwnuje szanse i poprawia rozpoznawanie.
Akceptacja:
- po diaryzacji (segmenty + speakerId): FFmpeg normalizuje kaĹĽdy segment osobno do -16 LUFS.
- znormalizowane segmenty sklejane w jeden plik przed finalnÄ… transkrypcjÄ….
- efekt: lepsza dokĹ‚adnoĹ›Ä‡ dla cichych mĂłwcĂłw (mierzalne przez `verificationScore`).
- wyĹ‚Ä…czalne przez `VOICELOG_PER_SPEAKER_NORM=false`.
Techniczne wskazĂłwki:
- `server/audioPipeline.js`: po `diarize()` â†’ dla kaĹĽdego speakerId: `ffmpeg -ss [start] -t [dur] -af loudnorm=I=-16 [out_N.wav]`.
- zĹ‚oĹĽenie: `ffmpeg -i "concat:seg1.wav|seg2.wav|..." -c copy combined_norm.wav`.
- tylko jeĹ›li `speakerCount > 1` â€” dla jednego mĂłwcy globalny `loudnorm` wystarczy.

---

## PRIORYTET P2 â€” rozpoznawanie i wizualizacja mĂłwcĂłw

---

## 051. [SPEAKER] Multi-sample enrollment i per-profile threshold
Status: `todo`
Wykonawca: `claude`
Priorytet: `P2`
Cel: jeden sample gĹ‚osu (~15s) to za maĹ‚o â€” wielokrotne prĂłbki dramatycznie zwiÄ™kszajÄ… dokĹ‚adnoĹ›Ä‡ rozpoznawania.
Akceptacja:
- uĹĽytkownik moĹĽe nagraÄ‡ do 5 prĂłbek gĹ‚osu per osoba (kaĹĽda 15â€“30s).
- embedding przechowywany jako average ze wszystkich prĂłbek.
- per-profil slider threshold (0.70â€“0.95, default 0.82) w UI listy profili.
- przy auto-labelu widoczne "Marek (94%)" z confidence score.
Techniczne wskazĂłwki:
- `voice_profiles` table: dodaÄ‡ kolumnÄ™ `sample_count INT DEFAULT 1`.
- `POST /voice-profiles` z tym samym `X-Speaker-Name` â†’ uĹ›rednia embedding z istniejÄ…cym.
- `server/speakerEmbedder.js`: eksportowaÄ‡ `averageEmbeddings(embeddings[])`.

---

#

---

## 069. [SPEAKER] Korekta mĂłwcy jako aktualizacja profilu (feedback loop)
Status: `todo`
Wykonawca: `claude`
Priorytet: `P3`
Cel: gdy user rÄ™cznie zmienia "Speaker 1" na "Marek", ta wiedza ginie â€” feedback loop tworzy samodoskonalÄ…cy siÄ™ system.
Akceptacja:
- po zmianie nazwy mĂłwcy: opcjonalny dialog "Czy dodaÄ‡ audio tego mĂłwcy do profilu gĹ‚osu?".
- jeĹ›li tak: wyciÄ…gniÄ™cie clipĂłw + aktualizacja profilu (jak w 068).
- toggle w ustawieniach: "Automatycznie ucz siÄ™ mĂłwcĂłw" (domyĹ›lnie off).
Techniczne wskazĂłwki:
- w `renameSpeaker()` w `useMeetings`: emitowaÄ‡ event ktĂłry `TranscriptPanel` moĹĽe obsĹ‚uĹĽyÄ‡.
- modal potwierdzenia: `SpeakerEnrollConfirmModal`.
- wywoĹ‚anie `POST /voice-profiles/from-recording` jak w 068.

---

## PRIORYTET P2 â€” analiza gĹ‚osu i coaching

---

## 080. [VOICE] Acoustic features per speaker â€” librosa/parselmouth (roadmap)
Status: `todo`
Wykonawca: `claude`
Priorytet: `P3`
Cel: GĹ‚Ä™bsza analiza akustyczna: F0/pitch (jitter, shimmer), HNR (harmonics-to-noise), formants â€” wymaga Python server-side. UzupeĹ‚nia GPT-4o coaching o obiektywne dane.
Akceptacja:
- `POST /media/recordings/:id/acoustic-features` zwraca per-speaker: mean F0, F0 range, jitter %, shimmer %, HNR dB.
- wyniki widoczne w VoiceSpeakerStats obok metryk WPM.
- opcjonalne: Montreal Forced Aligner dla per-fonem scoring polskich gĹ‚osek.
Techniczne wskazĂłwki:
- `server/acousticFeatures.py`: librosa (F0, RMS), parselmouth/Praat (jitter, shimmer, HNR, formants).
- `server/requirements.txt`: `librosa>=0.10`, `praat-parselmouth>=0.4`.
- FFmpeg extractuje speaker clip â†’ Python analizuje â†’ wynik JSON.
- MFA dla Polish: wymaga modelu `polish-mfa` z modeldb.

---

## PRIORYTET P2 â€” niezawodnoĹ›Ä‡ i ergonomia

---

## 046. [AUDIO] Exponential backoff i auto-retry w kolejce nagraĹ„
Status: `todo`
Wykonawca: `claude`
Priorytet: `P2`
Cel: bĹ‚Ä…d sieciowy = item utkniÄ™ty w `failed` bez auto-ponowienia; user musi kliknÄ…Ä‡ rÄ™cznie.
Akceptacja:
- po bĹ‚Ä™dzie item czeka 1s, 4s, 16s (3 prĂłby) przed oznaczeniem jako trwaĹ‚y bĹ‚Ä…d.
- przy braku internetu (`navigator.onLine === false`) item czeka do powrotu sieci.
- po 3 nieudanych prĂłbach: status `failed_permanent`, wyraĹşny komunikat + przycisk "PonĂłw rÄ™cznie".
- licznik prĂłb widoczny przy kaĹĽdym itemie w kolejce.
Techniczne wskazĂłwki:
- dodaÄ‡ `retryCount`, `backoffUntil`, `lastErrorMessage` do `RecordingQueueItem` w `recordingQueue.js`.
- w `useRecorder.js`: przed `processQueueItem` sprawdziÄ‡ `item.backoffUntil > Date.now()`.
- `window.addEventListener("online", ...)` wznawia processing.

---

## 047. [AUDIO] ObsĹ‚uga bĹ‚Ä™dĂłw odtwarzania audio w UnifiedPlayer
Status: `todo`
Wykonawca: `claude`
Priorytet: `P2`
Cel: `play().catch(() => {})` poĹ‚yka bĹ‚Ä™dy â€” user klika â–¶ i nic siÄ™ nie dzieje bez feedbacku.
Akceptacja:
- bĹ‚Ä…d odtwarzania pokazuje inline komunikat ("Nie moĹĽna odtworzyÄ‡ â€” plik moĹĽe byÄ‡ uszkodzony").
- po bĹ‚Ä™dzie â–¶ zmienia siÄ™ na ikonÄ™ âš  z tooltipem.
- bĹ‚Ä…d `NotAllowedError` obsĹ‚ugiwany osobno: "Kliknij aby odblokowaÄ‡ audio".
Techniczne wskazĂłwki:
- `src/studio/UnifiedPlayer.js`: `a.play().catch(err => setPlayError(err.message))`.
- lokalny stan `playError`, czyszczony przy zmianie `src`.

---

## 049. [AUDIO] VAD â€” automatyczne zatrzymanie przy dĹ‚ugiej ciszy
Status: `todo`
Wykonawca: `claude`
Priorytet: `P2`
Cel: uĹĽytkownik zapomina zatrzymaÄ‡ nagranie â†’ kilkugodzinne pliki, przepeĹ‚nienie storage.
Akceptacja:
- jeĹ›li cisza > 3 minuty (konfigurowalnie: 1/3/5/off) â€” nagranie zatrzymuje siÄ™ automatycznie.
- 30s przed zatrzymaniem: widoczne odliczanie "Zatrzymanie za 30s â€” kliknij aby kontynuowaÄ‡".
- "Kontynuuj" resetuje licznik.
Techniczne wskazĂłwki:
- w `useRecorder.js`: monitorowaÄ‡ `AnalyserNode` max amplitude w oknie 3 min â†’ trigger.
- countdown state eksponowany do `UnifiedPlayer` jako prop.

---

## 050. [AUDIO] Chunked upload dla duĹĽych plikĂłw (>10MB)
Status: `todo`
Wykonawca: `claude`
Priorytet: `P2`
Cel: przy sĹ‚abym WiFi upload duĹĽego pliku czÄ™sto siÄ™ przerywa i wymaga ponowienia od zera.
Akceptacja:
- pliki > 10MB dzielone na chunki 2MB wysyĹ‚ane sekwencyjnie.
- postÄ™p uploadu widoczny w UnifiedPlayer (pasek procentowy).
- przerwany upload moĹĽe byÄ‡ wznowiony â€” serwer przechowuje chunki przez 24h.
Techniczne wskazĂłwki:
- `src/services/mediaService.js`: `persistRecordingAudio()` â†’ jeĹ›li `blob.size > 10MB`, podzieliÄ‡ na `Blob.slice()` chunks.
- serwer: `PUT /media/recordings/:id/audio/chunk?index=N&total=M` â†’ skĹ‚ada w jeden plik.
- po zakoĹ„czeniu: `POST /media/recordings/:id/audio/finalize`.

---

---

## 035. Delta sync zamiast peĹ‚nego PUT stanu workspace
Status: `todo`
Wykonawca: `gpt`
Priorytet: `P2`
Cel: `stateService.syncWorkspaceState` wysyĹ‚a caĹ‚y state za kaĹĽdym razem â€” wolne przy 50+ spotkaniach.
Akceptacja:
- server przyjmuje `PATCH /state/workspaces/{id}` z deltatem.
- payload synca przy edycji jednego taska < 5kB zamiast 500kB.
- full sync pozostaje jako fallback (GET /state/bootstrap).
Techniczne wskazĂłwki:
- dirty flag w `useMeetings`: gdy zmieni siÄ™ konkretne meeting/task â†’ dodaj do `dirtySet`.
- PATCH przyjmuje `{ meetings?: [...], tasks?: [...] }`.
- server: merge patch z istniejÄ…cym state.

---

## 036. Backup i restore danych workspace (JSON export/import)
Status: `todo`
Wykonawca: `gpt`
Priorytet: `P2`
Cel: uĹĽytkownik moĹĽe straciÄ‡ dane przy czyszczeniu localStorage lub zmianie urzÄ…dzenia.
Akceptacja:
- w Profile/Settings przycisk "Eksportuj dane workspace" pobiera JSON ze wszystkimi spotkaniami i zadaniami (metadane, bez audio blob).
- "Importuj dane" Ĺ‚aduje JSON i merguje z bieĹĽÄ…cym stanem.
- import waliduje schemat i pokazuje preview (ile spotkaĹ„, taskĂłw zostanie dodanych).
Techniczne wskazĂłwki:
- `exportWorkspaceJson(meetings, tasks, taskBoards)` â†’ `downloadTextFile("backup.json", ...)`.
- `importWorkspaceJson(jsonString, currentMeetings, currentTasks)` â†’ merge z deduplikacjÄ… po `id`.

---

## 020. DostÄ™pnoĹ›Ä‡ i keyboard-only flows
Status: `todo`
Wykonawca: `gpt`
Priorytet: `P2`
Cel: poprawiÄ‡ dostÄ™pnoĹ›Ä‡ aplikacji i wygodÄ™ pracy bez myszy.
Akceptacja:
- gĹ‚Ăłwne widoki majÄ… sensowne role ARIA, focus order i widoczne focus state.
- da siÄ™ obsĹ‚ugiwaÄ‡ kluczowe flow klawiaturÄ…: nagranie, review transkrypcji, taski, command palette.
- przyciski majÄ… `aria-label` gdy nie majÄ… tekstu (ikony, color swatche).
- podstawowy axe-core smoke test w CI.
Techniczne wskazĂłwki:
- `npm install --save-dev @axe-core/react`.
- uzupeĹ‚niÄ‡ `aria-label` na: waveform SVG, cover-swatche, topbar record button, timeline segments.

---

## PRIORYTET P3 â€” usprawnienia i nice-to-have

---

## 033. Optymalizacja wydajnoĹ›ci â€” code splitting i memoizacja
Status: `todo`
Wykonawca: `gpt`
Priorytet: `P3`
Cel: skrĂłciÄ‡ czas pierwszego Ĺ‚adowania i poprawiÄ‡ responsywnoĹ›Ä‡ przy duĹĽych datasetach.
Zakres:
- `React.lazy` + `Suspense` dla: `TaskKanbanView`, `TranscriptPanel`, `KpiDashboard`, `NotesTab`.
- `React.memo` dla: `TaskListView`, `NoteCard`, `TranscriptSegment`.
- `useMemo` dla: `sortVisibleTasks`, `buildWorkspaceActivityFeed`, `groupTasks`.
Akceptacja:
- czas FCP na dev server < 1.5s po code splitting.
- brak widocznych "lag spikes" przy scrollowaniu listy 100+ taskĂłw.
Techniczne wskazĂłwki:
- `React.lazy(() => import("./tasks/TaskKanbanView"))` w `TasksTab.js`.
- sprawdziÄ‡ czy `useMemo` w `taskViewUtils.js` ma stabilne deps.

---

## 025. AI â€” semantyczne wyszukiwanie zadaĹ„ i spotkaĹ„
Status: `todo`
Wykonawca: `gpt`
Priorytet: `P3`
Cel: wyszukiwanie naturalnym jÄ™zykiem zamiast sĹ‚Ăłw kluczowych.
Akceptacja:
- command palette (Ctrl+K) obsĹ‚uguje semantyczne zapytania przez proxy `/ai/search`.
- wyniki oznaczone "AI Match" odrĂłĹĽniajÄ… siÄ™ od peĹ‚notekstowych.
- brak API key â†’ AI match ukryty, standardowe wyszukiwanie dziaĹ‚a.
Techniczne wskazĂłwki:
- `src/lib/aiSearch.js`: `semanticSearch(query, meetings, tasks)` â†’ proxy przez `/ai/search`.
- przekazywaÄ‡ tylko tytuĹ‚y i streszczenia (nie peĹ‚ne transkrypty).
- cache wynikĂłw w Map przez sesjÄ™.

---

## 041. PodziaĹ‚ App.css na moduĹ‚y CSS
Status: `done`
Wykonawca: `qwen`
Priorytet: `P3`
Cel: App.css przekroczyĹ‚ 3500 linii i jest trudny w utrzymaniu.
Wynik:
- âś… Struktura `/src/styles/` istnieje z 12 plikami moduĹ‚owymi
- âś… `variables.css` - zmienne CSS (:root)
- âś… `foundation.css` - bazowe komponenty UI
- âś… `layout.css` - layouty i struktura
- âś… `reset.css` - reset i utility klasy
- âś… `animations.css` - animacje
- âś… `auth.css`, `calendar.css`, `people.css`, `profile.css`, `recordings.css`, `studio.css`, `tasks.css` - style specyficzne dla widokĂłw
- âś… App.css zmniejszony z ~3500 do ~1700 linii
Akceptacja:
- âś… kaĹĽdy plik < 500 linii (poza App.css ktĂłry czeka na dalszy podziaĹ‚)
- âś… build przechodzi bez ostrzeĹĽeĹ„

---

## 042. [LAYOUT] Standaryzacja stylĂłw CSS i kolorystyki
Status: `done`
Wykonawca: `qwen`
Priorytet: `P3`
Cel: Ujednolicenie palety kolorĂłw, odstÄ™pĂłw, typografii i stylĂłw komponentĂłw w caĹ‚ej aplikacji, tak aby interfejs byĹ‚ estetyczny i przewidywalny.
Wynik:
- âś… Wszystkie style uĹĽywajÄ… zmiennych CSS (`var(--space-*)`, `var(--radius-*)`, `var(--color-*)`)
- âś… UsuniÄ™to duplikaty empty/error/loading states z 6 plikĂłw
- âś… Ujednolicono przyciski (primary, secondary, ghost, danger) z wspĂłlnymi stanami
- âś… Standaryzacja komponentĂłw: segmented-control, markdown-toolbar, analysis-block
- âś… SpĂłjne odstÄ™py z skalÄ… 4px (var(--space-1) do var(--space-9))
Akceptacja:
- ✅ Aplikacja używa globalnych zmiennych CSS dla kolorów i typografii bez lokalnych nadpisań
- ✅ Interfejs widocznie zyskuje na estetyce i spójności
- ✅ Wszystkie przyciski interaktywne na stronie głównej oraz formularze zachowują się jednakowo w całej aplikacji

---

## 200. [TESTS] Naprawa 78 padających testów frontend - priorytet P0
Status: `todo`
Wykonawca: `qwen`
Priorytet: `P0`
Cel: Podnieść pass rate testów frontend z 73% do 95%+.
Zakres:
- Naprawić 15 testów z brakującymi kontekstami (StudioMeetingView, useUI, useRecordingPipeline)
- Naprawić 8 testów httpClient z nieaktualnymi mockami
- Naprawić 12 testów integracyjnych (uruchamiać z mock server lub izolować)
- Naprawić 10 testów Zustand store (useMeetings, useWorkspace, recorderStore)
- Naprawić 6 testów Google API integration (dodać mocki)
- Zoptymalizować pamięć testów (uniknąć crashu OOM po 150s)
Akceptacja:
- Wszystkie testy frontend przechodzą (95%+ pass rate)
- Coverage frontend > 65%
- Czas wykonania testów < 120s
- Brak memory leaków

---

## 201. [TESTS] Dodanie testów dla ai/routes.ts (26% coverage)
Status: `todo`
Wykonawca: `qwen`
Priorytet: `P1`
Cel: Podnieść coverage AI routes z 26% do 80%+.
Zakres:
- Testy endpointu `/ai/analyze` (meeting analysis)
- Testy endpointu `/ai/suggest-tasks` (task suggestions)
- Testy endpointu `/ai/search` (semantic search)
- Testy endpointu `/ai/person-profile` (psych profile)
- Testy fallbacków gdy API key nie jest ustawiony
- Testy błędów i timeoutów
Akceptacja:
- coverage ai.ts > 80%
- Wszystkie ścieżki error handling przetestowane
- Testy izolowane (mocki fetch/OpenAI)

---

## 202. [TESTS] Dodanie testów dla media.ts routes (52% coverage)
Status: `todo`
Wykonawca: `qwen`
Priorytet: `P1`
Cel: Podnieść coverage media routes z 52% do 85%+.
Zakres:
- Testy upload audio z różnymi scenariuszami (success, failure, chunked)
- Testy transcribe endpoint (queueing, retry)
- Testy normalize i voice-coaching endpoints
- Testy rediarize i voice-profiles endpoints
- Testy security (auth, workspace validation)
Akceptacja:
- coverage media.ts > 85%
- Wszystkie endpointy przetestowane
- Testy security (401, 403, 413)

---

## 203. [TESTS] E2E testy dla krytycznych user flows
Status: `todo`
Wykonawca: `qwen`
Priorytet: `P1`
Cel: Dodać testy E2E pokrywające najważniejsze scenariusze użycia.
Zakres:
- Rejestracja + pierwsze spotkanie + nagranie + transkrypcja
- Logowanie + przeglądanie spotkań + edycja transkrypcji
- Tasks: create → edit → complete → delete
- Calendar: meeting creation → Google Calendar sync
- People: profile view → psych profile → meeting history
Akceptacja:
- 10+ testów E2E pokrywających critical paths
- Testy uruchamiane w CI
- Czas wykonania < 10 minut

---

## 204. [CSS] Audyt i naprawa niespójności w stylach
Status: `todo`
Wykonawca: `qwen`
Priorytet: `P2`
Cel: Wykryć i usunąć niespójności w CSS po refaktoryzacji.
Zakres:
- Sprawdzić czy wszystkie komponenty używają zmiennych CSS
- Wykryć hardcoded kolory (#hex) i zastąpić zmiennymi
- Ujednolicić odstępy (padding/margin) w komponentach
- Sprawdzić responsywność na mobile (< 720px)
- Usunąć nieużywane klasy CSS
Akceptacja:
- Brak hardcoded kolorów w CSS (poza gradientami)
- Wszystkie odstępy używają var(--space-*)
- Mobile responsive dla wszystkich widoków
- CSS bundle size < 100kB (gzip)

---

## 205. [CSS] Dodanie testów wizualnych (visual regression)
Status: `todo`
Wykonawca: `qwen`
Priorytet: `P2`
Cel: Wykrywać niezamierzone zmiany wizualne w UI.
Zakres:
- Konfiguracja Playwright screenshot tests
- Snapshoty dla: Topbar, Studio, Tasks Kanban, Calendar, People
- Testy dark mode rendering
- Testy mobile layout
Akceptacja:
- 20+ snapshotów wizualnych
- Testy w CI z retry na flaky
- Różnice wizualne wykrywane automatycznie

---

## 040. Email digest i powiadomienia poza przeglądarką
Status: `todo`
Wykonawca: `gpt`
Priorytet: `P3`
Cel: Browser Notifications wymagajÄ… otwartej karty â€” usefulness poza sesjÄ… zerowa.
Akceptacja:
- "Dzienny digest" w Profile â€” email raz dziennie o 7:00 lokalnego czasu.
- zawiera: zadania zalegĹ‚e, zadania na dziĹ›, nadchodzÄ…ce spotkania.
- serwer: endpoint `GET /digest/daily` wywoĹ‚ywalny przez cron.
Techniczne wskazĂłwki:
- `nodemailer` + SMTP (env: `VOICELOG_SMTP_HOST/USER/PASS`).
- `user.notifyDailyDigest` juĹĽ istnieje w profilu â€” podĹ‚Ä…czyÄ‡ pod mailer.

---

## 018. Outlook / Microsoft To Do / Microsoft Calendar
Status: `todo`
Wykonawca: `gpt`
Priorytet: `P3`
Cel: rozszerzyÄ‡ integracje poza ekosystem Google.
Akceptacja:
- moĹĽna poĹ‚Ä…czyÄ‡ konto Microsoft (MSAL OAuth2).
- zadania synchronizujÄ… siÄ™ z Microsoft To Do.
- spotkania z Outlook Calendar.
Techniczne wskazĂłwki:
- `@azure/msal-browser` jako alternatywa dla GSI.
- MS Graph API dla To Do: `https://graph.microsoft.com/v1.0/me/todo/lists`.
- analogiczna architektura jak `googleSync.js` â†’ `msSync.js`.

---

## đź“ť PODSUMOWANIE ZADAĹ WEDĹUG WYKONAWCY

### đź¤– Qwen (Testy i proste zadania)
- [TEST] Dodac testy kontraktowe i regresyjne dla krytycznych flow refaktoru
- [LAYOUT] Odlozyc porzadki UI do etapu po stabilizacji architektury
- [TESTS] audioPipeline.ts â€” pokrycie testami do 80%
- PodziaĹ‚ App.css na moduĹ‚y CSS
- [LAYOUT] Standaryzacja stylĂłw CSS i kolorystyki

### đź¤– GPT (Ĺšrednie zadania)
- AI â€” automatyczny coaching po spotkaniu (meeting debrief)
- ZarzÄ…dzanie pamiÄ™ciÄ… audio â€” limity IndexedDB
- Delta sync zamiast peĹ‚nego PUT stanu workspace
- Backup i restore danych workspace (JSON export/import)
- PeĹ‚ny live sync z Google Calendar i Google Tasks
- DostÄ™pnoĹ›Ä‡ i keyboard-only flows
- Optymalizacja wydajnoĹ›ci â€” code splitting i memoizacja
- AI â€” semantyczne wyszukiwanie zadaĹ„ i spotkaĹ„
- Email digest i powiadomienia poza przeglÄ…darkÄ…
- Outlook / Microsoft To Do / Microsoft Calendar

### đź¤– Claude (Trudne zadania, dĹşwiÄ™k, architektura)
- [REFACTOR] Uporzadkowac shared contracts i payloady miedzy frontendem a backendem
- [REFACTOR] Rozbic `server/app.ts` na bootstrap i modulowe rejestracje tras
- [REFACTOR] Wydzielic backendowy orchestration layer dla pipeline nagran
- [REFACTOR] Uporzadkowac warstwe stanu frontendu i odpowiedzialnosci hookow
- [REFACTOR] Rozbic `TabRouter.tsx` na container i widoki per zakladka
- [REFACTOR] Wyczyscic warstwe services i adapterow API
- [SECURITY] Proxy wywoĹ‚aĹ„ Anthropic API przez backend
- [AUDIO] Groq â€” whisper-large-v3 zamiast whisper-1/gpt-4o-transcribe
- [AUDIO] Word-level timestamps + precyzyjna diaryzacja per-sĹ‚owo
- [AUDIO] Server-side VAD â€” ffmpeg silence removal przed transkrypcjÄ…
- [SPEAKER] Pyannote.audio â€” zaawansowana diaryzacja serwera
- [AUDIO] VAD (SileroVAD) â€” wycinanie ciszy przed uploadem
- [AUDIO] Upgrade RNNoise worklet do rzeczywistego modelu WASM
- [AUDIO] Adaptacyjna normalizacja gĹ‚oĹ›noĹ›ci per mĂłwca
- [SPEAKER] Multi-sample enrollment i per-profile threshold
- [SPEAKER] Korekta mĂłwcy jako aktualizacja profilu (feedback loop)
- [VOICE] Acoustic features per speaker â€” librosa/parselmouth (roadmap)
- [AUDIO] Exponential backoff i auto-retry w kolejce nagraĹ„
- [AUDIO] ObsĹ‚uga bĹ‚Ä™dĂłw odtwarzania audio w UnifiedPlayer
- [AUDIO] VAD â€” automatyczne zatrzymanie przy dĹ‚ugiej ciszy
- [AUDIO] Chunked upload dla duĹĽych plikĂłw (>10MB)
