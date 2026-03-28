# VoiceLog OS

VoiceLog to zaawansowany workspace do nagrywania, analizy (diarization) i optymalizacji spotkań za pomocą sztucznej inteligencji. Dostarcza środowisko ułatwiające współpracę, śledzenie decyzji i automatyzację zadań (action items).

---

## 🏛️ Architektura (High-Level)

Projekt bazuje na nowoczesnym, modularnym stosie technologicznym. 
Główne komponenty to:

### 1. Frontend (SPA)
- **Framework**: React.js (narzędzia `Vite`)
- **Stan (State Management)**: Zustand (obsługa autoryzacji, UI, Workspace)
- **Wygląd**: TailwindCSS + komponenty oparte o warianty (np. Radix UI / shadcn)
- **Audio API**: Przeglądarkowy `MediaRecorder` nagrywający ścieżkę z systemu i mikrofonu z bezpośrednim dostępem do sprzętu wbudowanego w nowoczesnych przeglądarkach.

### 2. Backend (API)
- **Framework**: Node.js + Hono (szybki router wspierający środowiska chmurowe i Edge)
- **Baza danych**: SQLite w fazie lokalnej, z abstrakcją pozwalającą na łagodne przejście pod PostgreSQL dla środowisk produkcyjnych (gotowy `pg client` oraz migracje).
- **Zabezpieczenia**: Autoryzacja i trasy chronione tokenami JWT / Session oraz polityki CORS.
- **Zadania (Jobs)**: Lekki system w locie wykorzystujący strumieniowanie Server-Sent Events (SSE) raportujący dla frontendu w jakim statusie znajduje się przetwarzane audio.

### 3. Pipeline AI Audio
1. **Upload**: Hono konsumuje Multiparty Audio od Reacta, a usługa plikowa uploaduje chunk-y lub przetwarza jako jednolite źródło w `temp_dir`.
2. **Diarization**: `gpt-4o-transcribe-diarize` dla silnego wyłowienia segmentów z rozpoznaniem różnic tonalnych uczestników.
3. **Logika korygująca**: Model weryfikujący `whisper-1` służy oznaczaniu fragmentów *low confidence*, żeby UI pozwalało uzytkownikowi szybko nanieść własne asercje i poprawki tekstu.
4. **Analiza (LLM)**: Rozpoznane zdania lądują u modelu Anthropic (np. `claude-3-5-haiku-latest`) by z podsumowania wyłonić ustrukturyzowane notacje: akcje-kroki do podjęcia (`action items`), ustalenia biznesowe oraz notatki ogólne (insights).

---

## 🚀 Quick Start

VoiceLog przewiduje elastyczność w doborze głębokości środowiska operacyjnego. 

### Krok 1: Klonowanie i Instalacja

```bash
git clone https://github.com/maniczko/audioRecorder.git
cd audioRecorder

# Zaciągnięcie paczek frontu
npm install

# Wsparcie pracy nad backendem (np. TypeScript)
pnpm install
```

### Krok 2: Uruchomienie Środowiska 

Domyślnym trybem rozwijania nowych funkcji logicznych obok interfejsu jest uruchomienie Frontend'u oraz stabilnego API (tzw. "Remote Mode").

1. Skopiuj szablon zmiennych `env`:
   ```bash
   cp .env.example .env
   ```
2. Odpal serwer backendowy Node (API 4000) jako osobny proces obserwujący:
   ```bash
   npm run start:server:watch
   ```
3. Włącz Hot-Repl server Vite (React na porcie 3000):
   ```bash
   npm start
   ```

Frontend zacznie odpytywać nowo podniesiony serwer backendowy.

---

## ⚙️ Tryby Działania i Konfiguracja (Fallbacks)

W pliku `.env` zarządzasz zachowaniem aplikacji poprzez zmienne `REACT_APP_DATA_PROVIDER` oraz klucze dostępu.

### A) Zdalne Zarządzanie (Tryb "Remote" API)
W tym trybie Frontend dopytuje bazę za pośrednictwem środowiska Node. API zajmuje się żądaniami dla LLM/AI.

**Parametry środowiskowe:**
```env
REACT_APP_DATA_PROVIDER=remote
REACT_APP_MEDIA_PROVIDER=remote
REACT_APP_API_BASE_URL=http://127.0.0.1:4000
```
**Wymagania brzegowe backendu do działania usług Audio:**
- `OPENAI_API_KEY` – do komunikacji z API analizującymi głos (`Whisper` / `ChatGPT`). Uruchomienie bez niego obetnie możliwość włączania STT w locie i raportowania insightów ze spotkania.
- `VOICELOG_OPENAI_API_KEY` i `VOICELOG_OPENAI_BASE_URL` – preferowane aliasy dla backendu, w tym endpointu RAG przerobionego na LangChain.
- `LANGSMITH_TRACING=true`, `LANGSMITH_API_KEY` i opcjonalnie `LANGSMITH_PROJECT` – jeśli chcesz sledzic wywolania modelu w LangSmith.
- *Fallback bazy*: Bez `DATABASE_URL` zdeklarowanego jako URL np. do zewnętrznego PostgreSQL, aplikacja Hono uruchamia i wpisuje rekordy do wolumenu lokalnego wskazanego w `VOICELOG_DB_PATH`.

### B) Izolowany UX (Tryb "Local")
System trzyma większość stanu (np. Workspace, spotkania) lokalnie w `localStorage`, a żądania AI wysyłane są bezpośrednio z przeglądarki. Idealne rozwiązanie do testowania prototypów Frontendu bez obciążania całego pipeline DB.

**Parametry środowiskowe:**
```env
REACT_APP_DATA_PROVIDER=local
REACT_APP_MEDIA_PROVIDER=local
```
**Wymagania w trybie bez API:**
- Przede wszystkim załadowane `REACT_APP_ANTHROPIC_API_KEY`, tak aby przeglądarka mogła samodzielnie zaciągnąć model językowy Claude. Brak tego wpisu poskutkuje zawieszeniem generatora poleceń.

### Zależności Logowania Kalendarz/Google
Do załadowania asystenta logowania Google z widżetem "Google O-auth Popup" aplikacja czyta parametr `REACT_APP_GOOGLE_CLIENT_ID`.
- **Typ Failover/Fallback**: Jeżeli zmienna wyżej jest osierocona u dewelopera, system w interfejsie nie wysypie się na *biały ekran*. Cicho zdezaktywuje przyciski SSO oraz opcję importu spotkań z gCal, wymuszając metodę tradycyjnej rejestracji opartą o Local Authorization Module (baza backendowa). Zapobiega to awarii produkcyjnej przez brak kont.

---

## 🛡️ Testy i Automatyzacja

Dysponujemy pipeline'em Continuous Integration dbającym o poprawność projektu. 
Zestaw użytecznych komend:

### 1. Testy Frontendowe & Komponentowe (Vitest)
Często testują wyrenderowanie szkieletu, zachowanie wirtualnych modeli i asercje dla store.
```bash
npm test
# Działa również z wbudowanym pokryciem plików:
pnpm exec vitest run --coverage
```

### 2. Testy End-to-End i Integracje dla Serwera (Vitest API)
Sprawdzanie działania tras HTTP jak `/auth`, poprawność kodów błędów i weryfikacja payloadów z limitem rate'ów i bezpieczeństwem.
```bash
npm run test:server
```

### 3. Weryfikacja Typów Zależności Typowych (Build/Smoke/Turbo)
Używamy **Turbo Build System**, żeby błyskawicznie sprawdzić błędy semantyczne po obu stronach sieci w zaledwie ułamki sekund.
```bash
npx turbo run typecheck lint
```
**Smoke Test**: Kiedy wykonujesz faktyczny deploy produkcyjny, kontener może uruchomić dedykowany plik pingujący status Node'a, po udanym restarcie Hono:
```bash
npm run test:smoke
```

---

## 🛠️ Rozwiązywanie problemów (Troubleshooting)

1. **Komunikacja frontu zwalnia powiadomieniem `TypeError: failed to fetch` lub błąd `CORS` z API**
   - Na 99% Frontend uderza pod niewłaściwy adres docelowy. Zweryfikuj, czy twój plik `.env` załadował poprawne `REACT_APP_API_BASE_URL` oraz czy deweloperski backend faktycznie podniósł się na docelowym porcie z akceptacją Twojego Host Originu `localhost`.

### CORS — konfiguracja dla Vercel/Railway

Błąd `Access-Control-Allow-Origin` oznacza, że backend nie zwraca nagłówka CORS dla Twojego origin frontendu.
Serwer akceptuje `*.vercel.app` automatycznie. Dla własnych domen ustaw zmienną na Railway:

```env
# Obsługiwana przez backend — preferowany alias:
CORS_ALLOWED_ORIGINS=https://twoja-aplikacja.vercel.app,https://twoja-domena.pl

# Alternatywna nazwa (równoważna):
VOICELOG_ALLOWED_ORIGINS=https://twoja-aplikacja.vercel.app
```

- Obie nazwy zmiennych są akceptowane; `CORS_ALLOWED_ORIGINS` ma pierwszeństwo.
- Wartość to lista origins oddzielona przecinkami (bez spacji).
- Użyj `*` by zezwolić na dowolny origin (niezalecane na produkcji).
- Po zmianie zmiennych zrestartuj serwis na Railway.

#### Diagnostyka CORS i 502 na Railway

```bash
# Sprawdź nagłówki i status health endpointu:
curl -i https://audiorecorder-production.up.railway.app/health

# Sprawdź preflight OPTIONS z originem frontendu:
curl -i -X OPTIONS https://audiorecorder-production.up.railway.app/health \
  -H "Origin: https://twoja-aplikacja.vercel.app" \
  -H "Access-Control-Request-Method: GET"
```

Jeśli `Access-Control-Allow-Origin` nie jest w odpowiedzi, sprawdź:
1. Zmienne środowiskowe (`CORS_ALLOWED_ORIGINS` / `VOICELOG_ALLOWED_ORIGINS`) na Railway.
2. Logi Railway (`Deploy Logs`) — czy serwer uruchomił się poprawnie.
3. Status usługi — `502 Bad Gateway` oznacza, że serwer nie działa; sprawdź logi Railway pod kątem crashu, braku pamięci lub brakujących zmiennych jak `OPENAI_API_KEY`.

#### AbortError / health probe timeout

Frontend wywołuje `/health` z 15-sekundowym timeoutem. Na Railway przy "cold start" pierwsze zapytanie może trwać dłużej. W logach przeglądarki pojawi się wtedy:

```
Hosted preview health probe failed. AbortError: signal is aborted without reason
```

Jest to normalne przy pierwszym wejściu po przerwie. Odśwież stronę, jeśli błąd nie znika po kilku sekundach.



2. **Zablokowanie "Locking Error" przy zapisie SQLite**
   - SQLite nie toleruje dwóch procesów operujących w trybie "Pragmas Exclusive Lock", co czasem może dotknąć Windowsa pod testami `watchNode`. 
   - Rozwiązaniem ratunkowym jest zatrzymanie konsoli Node, zamknięcie aplikacji bazodanowych GUI, oraz jeżeli trzeba, ręczne usunięcie starego woluminu bazodanowego `server/data/voicelog.sqlite` by skrypt `Bootstrap` Hono otworzył pusty schemat transakcyjny ponownie w całości.

3. **Błąd braku zmiennych przy podnoszeniu Dockera w CD (Crash pętli)**
   - Kontener deweloperski serwisu backendowego narzuca `fail-fast check` u bramki (od R24 z roadmapy). Musisz upewnić się, że obraz systemu Cloud ładuje mu zestaw zmiennych np. wymaganej bazy `DATABASE_URL`. Bez niej kontener zrzuci błąd `FATAL` w drugiej sekundzie po odpaleniu zamiast cierpieć na brak stabilności bazy później.

4. **Krzyczące importy (na Czerwono) przez TypeScript w edytorze VSCode**
   - Interfejs często zaimplementowano z wspólnymi umowami Typów z `src/shared/types.ts`. Po zmianach między branchami TypeScript potrafi zgubić orientacje co jest "współdzielone". By naprawić edytor by nie krzyczał, włącz u góry `Command Palette` (np. przez klawisz F1) i wybierz operację: **"Restart TS Server"**.
---

## Vercel Deploy z GitHub Actions

Workflowy Vercela wymagaja trzech sekretow GitHub Actions:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Skad je wziac:

- `VERCEL_TOKEN`: z konta Vercel
- `VERCEL_ORG_ID` i `VERCEL_PROJECT_ID`: po lokalnym `vercel link`, z pliku `.vercel/project.json`

Typowy objaw braku sekretow:

- w logu pojawia sie `No existing credentials found`
- polecenie ma postac `vercel pull --yes --environment=production --token=`

Repo ma guard workflowow Vercela. Lokalnie sprawdzisz go poleceniem:

```bash
pnpm run test:workflows
```

---

## Changelog

### 2026-03-23
- **[TESTS] TASK-209** — Pokrycie testami  wzrosło z 40% → 71% statements.
  Nowe testy izolowane (vi.doMock): analyzeAudioQuality, pyannote diarization, per-speaker normalization,
  LLM correction catch path, large-file in-memory chunking, Groq STT → OpenAI fallback.
  Uruchomienie: `pnpm run test:server` (351 passed).

## 📊 Project Stats

- **Source Files:** 37
- **Server Files:** 18
- **Test Files:** See test report
- **Test Coverage:** See coverage report

## 🤖 Automation

✅ Pre-commit hooks (lint, format, typecheck)
- ✅ Pre-push hooks (test)
- ✅ AI auto-fix on PR
- ✅ Issue-to-PR automation
- ✅ Security auto-patch (daily)
- ✅ Optimized CI/CD pipeline
- ✅ Smart lint staging
- ✅ Automated documentation
- ✅ Code migration scripts
