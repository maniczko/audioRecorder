# VoiceLog OS

Workspace do planowania spotkan, nagrywania rozmow, diarization i analizy spotkan z uwzglednieniem potrzeb uzytkownika.

## Co jest w aplikacji

- lokalne logowanie i rejestracja
- logowanie przez Google Identity Services
- zakladka `Kalendarz` z miesiecznym widokiem spotkan w stylu Google Calendar
- import wydarzen z podstawowego Google Calendar po autoryzacji `calendar.readonly`
- recorder z live transcript i diarization oparta o sygnatury audio
- analiza spotkania z decyzjami, action items i odpowiedziami na zapisane potrzeby

## Konfiguracja

Skopiuj `.env.example` do `.env` i uzupelnij potrzebne wartosci:

```env
REACT_APP_ANTHROPIC_API_KEY=
REACT_APP_ANTHROPIC_MODEL=claude-3-5-haiku-latest
REACT_APP_GOOGLE_CLIENT_ID=
```

### Google login i kalendarz

Potrzebujesz klienta OAuth dla aplikacji web w Google Cloud.

- zalogowanie przez Google korzysta z Google Identity Services
- import wydarzen korzysta ze scope `https://www.googleapis.com/auth/calendar.readonly`
- bez `REACT_APP_GOOGLE_CLIENT_ID` aplikacja nadal dziala, ale bez Google Sign-In i importu wydarzen

## Uruchomienie

```bash
npm install
npm start
```

## Weryfikacja

```bash
npm test -- --watchAll=false --runInBand
npm run build
```
