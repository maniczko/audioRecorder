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
