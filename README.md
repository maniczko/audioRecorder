# VoiceLog OS

Workspace do planowania spotkan, nagrywania rozmow, diarization i analizy spotkan z uwzglednieniem potrzeb uzytkownika.

## Co jest w aplikacji

- lokalne logowanie i rejestracja
- logowanie przez Google Identity Services
- zakladka `Kalendarz` z miesiecznym widokiem spotkan w stylu Google Calendar
- import wydarzen z podstawowego Google Calendar po autoryzacji `calendar.readonly`
- recorder z live transcript i diarization oparta o sygnatury audio
- analiza spotkania z decyzjami, action items i odpowiedziami na zapisane potrzeby
- opcjonalny backend Node + SQLite dla auth, workspace, spotkan, zadan i audio

## Konfiguracja

Skopiuj `.env.example` do `.env` i uzupelnij potrzebne wartosci:

```env
REACT_APP_ANTHROPIC_API_KEY=
REACT_APP_ANTHROPIC_MODEL=claude-3-5-haiku-latest
REACT_APP_GOOGLE_CLIENT_ID=
REACT_APP_DATA_PROVIDER=local
REACT_APP_MEDIA_PROVIDER=local
REACT_APP_API_BASE_URL=
VOICELOG_API_PORT=4000
VOICELOG_API_HOST=127.0.0.1
VOICELOG_DB_PATH=server/data/voicelog.sqlite
VOICELOG_UPLOAD_DIR=server/data/uploads
OPENAI_API_KEY=
VOICELOG_AUDIO_LANGUAGE=pl
VOICELOG_AUDIO_DIARIZE_MODEL=gpt-4o-transcribe-diarize
VOICELOG_AUDIO_VERIFY_MODEL=whisper-1
```

### Google login i kalendarz

Potrzebujesz klienta OAuth dla aplikacji web w Google Cloud.

- zalogowanie przez Google korzysta z Google Identity Services
- import wydarzen korzysta ze scope `https://www.googleapis.com/auth/calendar.readonly`
- bez `REACT_APP_GOOGLE_CLIENT_ID` aplikacja nadal dziala, ale bez Google Sign-In i importu wydarzen

### Tryb backend + SQLite

Zeby przelaczyc aplikacje na prawdziwy backend:

```env
REACT_APP_DATA_PROVIDER=remote
REACT_APP_MEDIA_PROVIDER=remote
REACT_APP_API_BASE_URL=http://127.0.0.1:4000
```

Backend wystawia:

- auth i reset hasla
- workspace i role `owner / admin / member`
- trwaly stan spotkan, zadan i kalendarza w SQLite
- trwale pliki audio na dysku serwera
- serwerowy pipeline audio: upload, STT, diarization i confidence scoring

Pipeline audio korzysta z:

- `gpt-4o-transcribe-diarize` dla segmentow rozmowy i speaker diarization
- `whisper-1` w `verbose_json` jako przebiegu weryfikujacego do confidence score i oznaczania fragmentow do review

Uwaga: aktualna implementacja korzysta z limitu 25 MB po stronie API audio. Dla dlugich spotkan warto w kolejnym kroku dodac chunking plikow po stronie backendu.

## Uruchomienie

```bash
npm install
npm start
```

W osobnym terminalu uruchom API:

```bash
npm run start:server
```

## Weryfikacja

```bash
npm test -- --watchAll=false --runInBand
npm run build
```
