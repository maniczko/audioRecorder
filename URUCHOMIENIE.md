# 🚀 VoiceLog OS - Instrukcja Uruchomienia

## ✅ Status Konfiguracji

Twoje `.env` jest **skompletne i poprawne**. Wszystkie klucze API są ustawione.

**Brakujący element:** Token HuggingFace (wymagany do diarizacji speakerów)

---

## 🔧 KROK 1: HuggingFace Token (wymagane)

### Dlaczego potrzebujesz?

- **Diarizacja** - rozpoznawanie kto mówi (Speaker A, Speaker B, etc.)
- Bez tokena: transkrypcja działa, ale bez podziału na mówców

### Jak uzyskać? (2 minuty)

1. **Wejdź na:** https://huggingface.co/settings/tokens
2. **Zaloguj się** (załóż darmowe konto)
3. **Kliknij:** "Create new token"
4. **Typ:** "Read" (wystarczy)
5. **Nazwa:** np. "VoiceLog"
6. **Skopiuj token** (zaczyna się od `hf_`)

### Wklej do .env:

Otwórz `c:\Users\user\new\audioRecorder\.env` i zamień:

```bash
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

na swój prawdziwy token:

```bash
HF_TOKEN=hf_AbCdEfGhIjKlMnOpQrStUvWxYz123456
```

---

## 🔧 KROK 2: Problem z Node.js

### ❌ Problem

Masz **Node.js 24.14.0**, ale projekt wymaga **Node.js 22.x**

To powoduje błędy przy uruchamianiu serwera backend.

### ✅ Rozwiązanie A: Zainstaluj Node.js 22.x (zalecane)

1. **Pobierz Node.js 22.x:**
   - Wejdź na https://nodejs.org/en/download/
   - Wybierz "Node.js 22.x LTS"
   - Pobierz instalator Windows

2. **Zainstaluj:**
   - Uruchom instalator
   - Zainstaluj (nadpisze 24.x)

3. **Sprawdź wersję:**

   ```bash
   node --version
   # Powinno być: v22.x.x
   ```

4. **Uruchom serwer:**
   ```bash
   cd c:\Users\user\new\audioRecorder
   pnpm run start:server
   ```

### ✅ Rozwiązanie B: Użyj nvm-windows (dla zaawansowanych)

Jeśli chcesz mieć obie wersje:

```bash
# 1. Pobierz nvm-windows
# https://github.com/coreybutler/nvm-windows/releases

# 2. Zainstaluj Node.js 22
nvm install 22
nvm use 22

# 3. Uruchom serwer
pnpm run start:server
```

---

## 🔧 KROK 3: Uruchomienie (gdy już masz Node.js 22.x)

### Terminal 1: Backend

```bash
cd c:\Users\user\new\audioRecorder
pnpm run start:server
```

**Powinieneś zobaczyć:**

```
✅ Configuration loaded successfully
[Bootstrap] Database initialized
[Server] Listening on http://127.0.0.1:4000
```

### Terminal 2: Frontend (jeśli nie działa)

```bash
cd c:\Users\user\new\audioRecorder
pnpm start
```

**Powinieneś zobaczyć:**

```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:3000/
```

---

## ✅ Sprawdzenie czy działa

### 1. Sprawdź backend

Otwórz w przeglądarce:

```
http://127.0.0.1:4000/health
```

**Powinno zwrócić:**

```json
{
  "status": "ok",
  "version": "0.1.0",
  "gitSha": "abc123"
}
```

### 2. Sprawdź frontend

Otwórz:

```
http://localhost:3000
```

**Powinieneś zobaczyć aplikację VoiceLog**

---

## 🎯 Tryby Pracy

### Tryb 1: Pełny (Backend + Frontend)

```bash
# Terminal 1 - Backend
pnpm run start:server

# Terminal 2 - Frontend
pnpm start
```

**Funkcje:**

- ✅ Transkrypcja z Whisper (Groq/OpenAI)
- ✅ Diarizacja (HuggingFace)
- ✅ Analizy AI (Claude/Gemini)
- ✅ Synchronizacja z Google Calendar
- ✅ Zapis do bazy danych (Supabase)

### Tryb 2: Tylko Frontend (lokalny)

```bash
# Tylko frontend
pnpm start
```

**Funkcje:**

- ✅ Nagrywanie audio
- ✅ Podstawowa transkrypcja (jeśli backend działa)
- ❌ Analizy AI (wymagają backend)
- ❌ Synchronizacja (wymaga backend)

---

## 🐛 Rozwiązywanie Problemów

### Problem: "Backend nie odpowiada"

**Przyczyna:** Serwer nie działa

**Rozwiązanie:**

```bash
# 1. Sprawdź Node.js
node --version
# Musi być 22.x.x

# 2. Sprawdź logi
pnpm run start:server
# Szukaj błędów

# 3. Sprawdź port
netstat -ano | findstr :4000
# Jeśli zajęty, zmień VOICELOG_API_PORT w .env
```

### Problem: "Brak kluczy API"

**Przyczyna:** Któryś klucz jest niepoprawny

**Rozwiązanie:**

```bash
# Sprawdź .env
notepad c:\Users\user\new\audioRecorder\.env

# Upewnij się że:
# - OPENAI_API_KEY zaczyna się od sk-proj-
# - GROQ_API_KEY zaczyna się od gsk_
# - HF_TOKEN zaczyna się od hf_
```

### Problem: "Database connection failed"

**Przyczyna:** Supabase nie odpowiada

**Rozwiązanie:**

```bash
# Użyj lokalnej bazy SQLite
# W .env dodaj:
VOICELOG_DB_PATH=./server/data/voicelog.sqlite
```

---

## 📞 Kontakt

- 📖 Dokumentacja: `LOCAL_PROCESSING_GUIDE.md`
- 🐛 Issues: https://github.com/voiceRecorder/issues
- 💬 Dyskusje: https://github.com/voiceRecorder/discussions

---

## 🎉 Gotowe!

Gdy już masz Node.js 22.x i HuggingFace Token:

1. ✅ Uruchom backend: `pnpm run start:server`
2. ✅ Uruchom frontend: `pnpm start`
3. ✅ Otwórz http://localhost:3000
4. ✅ Importuj nagranie i ciesz się transkrypcją!
