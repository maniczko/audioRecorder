# Lokalne Przetwarzanie Audio - Instrukcja

## 📋 Spis treści
1. [Tryby przetwarzania](#tryby-przetwarzania)
2. [Konfiguracja API (domyślna)](#konfiguracja-api-domyślna)
3. [Lokalne przetwarzanie z Whisper.cpp](#lokalne-przetwarzanie-z-whispercpp)
4. [Lokalne przetwarzanie z Faster-Whisper](#lokalne-przetwarzanie-z-faster-whisper)
5. [Diagnostyka błędów](#diagnostyka-błędów)

---

## Tryby przetwarzania

VoiceLog OS obsługuje **3 tryby transkrypcji**:

| Tryb | Wymagania | Prędkość | Koszt | Prywatność |
|------|-----------|----------|-------|------------|
| **OpenAI Whisper API** | `OPENAI_API_KEY` | ⚡⚡⚡ | $0.006/min | 🔒 Dane wysyłane do OpenAI |
| **Groq Whisper API** | `GROQ_API_KEY` | ⚡⚡⚡⚡ | Darmowe (limit) | 🔒 Dane wysyłane do Groq |
| **Lokalny Whisper** | whisper.cpp LUB faster-whisper | ⚡⚡ | Darmowe | 🔐🔐🔐 Wszystko lokalnie |

---

## Konfiguracja API (domyślna)

### Krok 1: Uzyskaj klucze API

**OpenAI Whisper:**
1. Wejdź na https://platform.openai.com/api-keys
2. Zaloguj się / załóż konto
3. Kliknij "Create new secret key"
4. Skopiuj klucz (zaczyna się od `sk-proj-`)

**Groq (darmowe, szybsze):**
1. Wejdź na https://console.groq.com/keys
2. Zaloguj się / załóż konto
3. Wygeneruj nowy klucz
4. Skopiuj klucz (zaczyna się od `gsk_`)

### Krok 2: Dodaj do `.env`

```bash
cd c:\Users\user\new\audioRecorder

# Otwórz .env i dodaj:
OPENAI_API_KEY=sk-proj-TWOJ_KLUCZ
# LUB
GROQ_API_KEY=gsk_TWOJ_KLUCZ

# Opcjonalnie - oba naraz (z fallback):
OPENAI_API_KEY=sk-proj-...
GROQ_API_KEY=gsk_...
```

### Krok 3: Uruchom serwer

```bash
# Terminal 1 - serwer backend
pnpm run start:server

# Terminal 2 - frontend (jeśli nie działa)
pnpm start
```

### Krok 4: Sprawdź czy działa

Otwórz http://localhost:3000 i zaimportuj nagranie.

---

## Lokalne przetwarzanie z Whisper.cpp

### Krok 1: Pobierz whisper.cpp

**Windows:**
```powershell
# Opcja A: Pre-built binary (najłatwiej)
# Pobierz z: https://github.com/ggerganov/whisper.cpp/releases
# Rozpakuj do np. C:\whisper.cpp

# Opcja B: Build z source
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
make whisper-main
```

**macOS (Homebrew):**
```bash
brew install whisper.cpp
```

**Linux:**
```bash
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
make whisper-main
```

### Krok 2: Pobierz model Whisper

Modele GGML (wybierz jeden):

| Model | Rozmiar | Prędkość | Jakość |
|-------|---------|----------|--------|
| `ggml-tiny.bin` | 75 MB | ⚡⚡⚡⚡⚡ | Słaba |
| `ggml-base.bin` | 142 MB | ⚡⚡⚡⚡ | Dobra |
| `ggml-small.bin` | 466 MB | ⚡⚡⚡ | Bardzo dobra |
| `ggml-medium.bin` | 1.5 GB | ⚡⚡ | Doskonała |
| `ggml-large-v3.bin` | 3 GB | ⚡ | Najlepsza |

**Pobierz (przykład - base):**
```bash
cd c:\Users\user\new\audioRecorder
mkdir models
cd models

# Base model (dobry balans)
curl -L -o ggml-base.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin

# Lub small (lepsza jakość)
curl -L -o ggml-small.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin
```

### Krok 3: Skonfiguruj `.env`

```bash
# Włącz lokalny tryb
USE_LOCAL_WHISPER=true

# Ścieżka do whisper.cpp main
WHISPER_CPP_PATH=C:/whisper.cpp/main.exe
# Lub na macOS/Linux:
# WHISPER_CPP_PATH=/usr/local/bin/whisper-main

# Ścieżka do modelu
WHISPER_MODEL_PATH=./models/ggml-base.bin

# Liczba wątków (domyślnie 4)
WHISPER_THREADS=4
```

### Krok 4: Test

```bash
# Uruchom serwer
pnpm run start:server

# Sprawdź logi - powinien być komunikat:
# ✅ Local Whisper available
```

---

## Lokalne przetwarzanie z Faster-Whisper

Faster-Whisper to Pythonowa implementacja - łatwiejsza w instalacji, szybsza na GPU.

### Krok 1: Zainstaluj Python (jeśli nie masz)

**Windows:**
```powershell
# Z Microsoft Store lub https://python.org
# Upewnij się że Python jest w PATH
```

### Krok 2: Zainstaluj faster-whisper

```bash
cd c:\Users\user\new\audioRecorder

# Utwórz wirtualne środowisko (opcjonalnie)
python -m venv .venv
.venv\Scripts\Activate.ps1

# Zainstaluj
pip install faster-whisper
```

### Krok 3: Skonfiguruj `.env`

```bash
# Nie musisz ustawiać USE_LOCAL_WHISPER
# Serwer automatycznie wykryje faster-whisper

# Opcjonalnie - wybierz model
WHISPER_MODEL=base
# tiny, base, small, medium, large-v3

# Urządzenie (cpu lub cuda)
WHISPER_DEVICE=cpu
# cuda jeśli masz NVIDIA GPU
```

### Krok 4: Test

```bash
python server/whisper_local.py --help

# Powinien pokazać pomoc
```

---

## Diagnostyka błędów

### Błąd: "Pipeline zakończył przetwarzanie, ale nie zwrócił segmentów"

**Przyczyny:**
1. ❌ Brak kluczy API
2. ❌ Plik audio uszkodzony
3. ❌ Zbyt ciche nagranie
4. ❌ Nieobsługiwany format pliku

**Rozwiązanie:**

```bash
# 1. Sprawdź logi serwera
# Szukaj komunikatów:
[stt] Provider chain: openai → groq
[stt] openai: model=whisper-1 key=sk-proj-...

# 2. Sprawdź czy klucze są poprawne
echo $OPENAI_API_KEY
# Powinien zaczynać się od sk-proj-

# 3. Sprawdź format pliku
# Obsługiwane: WAV, MP3, FLAC, WebM, M4A, OGG, OPUS

# 4. Sprawdź jakość audio
# Otwórz plik w Audacity i sprawdź czy fala jest widoczna
```

### Błąd: "Brak skonfigurowanego providera STT"

```bash
# Dodaj do .env:
OPENAI_API_KEY=sk-proj-...
# LUB
GROQ_API_KEY=gsk_...
# LUB włącz lokalny:
USE_LOCAL_WHISPER=true
WHISPER_CPP_PATH=/path/to/main
```

### Błąd: "HF_TOKEN not set - diarization disabled"

```bash
# To tylko warning - transkrypcja będzie działać
# Ale bez diarizacji (rozpoznawania mówców)

# Jeśli chcesz diarizację:
# 1. Wejdź na https://huggingface.co/settings/tokens
# 2. Zaloguj się
# 3. Utwórz nowy token (read access)
# 4. Dodaj do .env:
HF_TOKEN=hf_...
```

### Błąd: "402 Payment Required" (OpenAI)

```bash
# Twoje konto OpenAI nie ma środków
# 1. Wejdź na https://platform.openai.com/usage
# 2. Sprawdź balance
# 3. Dodaj środki (minimum $5)

# LUB użyj Groq (darmowe):
GROQ_API_KEY=gsk_...
```

---

## Szybka konfiguracja (5 minut)

### Opcja A: Najszybsza (Groq - darmowe)

```bash
# 1. Pobierz klucz Groq
# https://console.groq.com/keys

# 2. Dodaj do .env
GROQ_API_KEY=gsk_...

# 3. Uruchom serwer
pnpm run start:server

# ✅ Gotowe!
```

### Opcja B: Najlepsza jakość (OpenAI)

```bash
# 1. Pobierz klucz OpenAI
# https://platform.openai.com/api-keys

# 2. Dodaj do .env
OPENAI_API_KEY=sk-proj-...

# 3. Uruchom serwer
pnpm run start:server

# ✅ Gotowe!
```

### Opcja C: Prywatność (Lokalny Whisper)

```bash
# 1. Pobierz whisper.cpp
# https://github.com/ggerganov/whisper.cpp/releases

# 2. Pobierz model
curl -L -o models/ggml-base.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin

# 3. Dodaj do .env
USE_LOCAL_WHISPER=true
WHISPER_CPP_PATH=C:/whisper.cpp/main.exe
WHISPER_MODEL_PATH=./models/ggml-base.bin

# 4. Uruchom serwer
pnpm run start:server

# ✅ Gotowe! Wszystko działa lokalnie
```

---

## Kontakt i pomoc

- 📧 GitHub Issues: https://github.com/voiceRecorder/issues
- 📖 Dokumentacja: https://github.com/voiceRecorder/docs
- 💬 Dyskusje: https://github.com/voiceRecorder/discussions
