# PLAN NAPRAWCZY P01-P04 - VOICELOG AUDIT

## 📋 PODSUMOWANIE ZNALEZISK

### P01: Stale closures w hookach React (Medium - memory leaks)

**Status:** ✅ CZĘŚCIOWO NAPRAWIONE

- `useLiveTranscript.tsx`: Już używa `useRef` dla `transcribeLiveRef` i `inflightRef` ✅
- `useRecorder.ts`: Używa `userMeetingsRef` prawidłowo ✅
- **Problem**: Brak TypeScript types powoduje trudności w wykrywaniu closure issues

### P02: Infinite loops w testach (High - CI timeouty)

**Status:** ⚠️ WYMAGA NAPRAWY

- `App.integration.test.tsx:284`: `setTimeout(r, 2000)` bez cleanup w skipped teście
- Brak `vi.useFakeTimers()` w testach z timerami
- Brak `cleanup()` w `afterEach` dla niektórych testów

### P03: Brak indeksów w bazie (High - slow queries)

**Status:** ⚠️ CZĘŚCIOWO ROZWIĄZANE

- `migrations/002_add_indexes.sql`: Istnieją indeksy ale NIEKOMPLETNE
- **Brakujące indeksy**:
  - `meetings(user_id)` ❌
  - `meetings(created_at)` ❌
  - `meetings(status)` ❌
  - `media_assets(transcription_status)` ❌
  - `users(email)` - jest UNIQUE ale brak index na created_at ❌

### P04: Eksport dużych plików blokuje main thread (Medium - UI freeze)

**Status:** ❌ NIE ZAIMPLEMENTOWANE

- `printMeetingPdf()` w `export.tsx:76` działa synchronicznie w main thread
- Dla >50min nagrań generowanie PDF może zablokować UI na 2-5s
- Brak Web Worker lub Server-Sent Events dla eksportu

---

## 🔧 SZCZEGÓŁOWY PLAN NAPRAWCZY

### P01: Stale closures - AKCJE NAPRAWCZE

#### 1.1 Dodajemy TypeScript strict types do hooków

```typescript
// src/hooks/useRecorder.ts - DODAĆ INTERFEJSY
interface UseRecorderProps {
  selectedMeeting: Meeting | null;
  userMeetings: Meeting[];
  createAdHocMeeting: () => Meeting | null;
  attachCompletedRecording: (meetingId: string, recordingId: string) => void;
  isHydratingRemoteState: boolean;
}

interface UseRecorderReturn {
  // ... wszystkie zwracane wartości z typami
  liveText: string;
  currentSegments: Segment[];
  recordingMeetingId: string | null;
  startRecording: (options?: { adHoc?: boolean }) => void;
  // ... itd.
}
```

#### 1.2 Sprawdzić dependency arrays we wszystkich hookach

```bash
# Uruchom ESLint z react-hooks pluginem
npx eslint src/hooks/**/*.ts --rule 'react-hooks/exhaustive-deps: error'
```

#### 1.3 Refaktoryzacja useLiveTranscript (już dobry, ale dodać types)

```typescript
// Już dobrze zrobione z useRef, ale dodać types:
interface UseLiveTranscriptParams {
  chunksRef: React.MutableRefObject<Blob[]>;
  isRecording: boolean;
  enabled: boolean;
  transcribeLive: (blob: Blob) => Promise<string>;
  mimeType?: string;
}
```

---

### P02: Infinite loops w testach - AKCJE NAPRAWCZE

#### 2.1 Naprawić App.integration.test.tsx

```typescript
// src/App.integration.test.tsx - LINIA 284
test.skip("restores an autosaved meeting draft after refresh", async () => {
  // DODAĆ FAKE TIMERS
  vi.useFakeTimers();

  try {
    const { unmount } = render(<App />);
    await screen.findByText(/Nowe spotkanie/i);

    const titleInput = screen.getByPlaceholderText("np. Spotkanie z klientem");
    await userEvent.type(titleInput, "Plan retro");

    // Advance timers instead of real setTimeout
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    unmount();
    render(<App />);

    expect(await screen.findByDisplayValue("Plan retro")).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});
```

#### 2.2 Dodać globalny cleanup w vitest.config.ts

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ['./src/tests/setup.ts'],
    globals: true,
    environment: 'jsdom',
    // DODAĆ:
    clearMocks: true,
    restoreMocks: true,
  },
});
```

#### 2.3 Dodać beforeEach/afterEach cleanup

```typescript
// src/tests/setup.ts
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.clearAllMocks();
});
```

---

### P03: Indeksy bazy danych - AKCJE NAPRAWCZE

#### 3.1 Utworzyć migrację 003_add_missing_indexes.sql

```sql
-- server/migrations/003_add_missing_indexes.sql

-- Meetings table indexes
CREATE INDEX IF NOT EXISTS idx_meetings_user_id ON meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_workspace_id ON meetings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON meetings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_updated_at ON meetings(updated_at DESC);

-- Media assets indexes
CREATE INDEX IF NOT EXISTS idx_media_assets_transcription_status ON media_assets(transcription_status);
CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON media_assets(created_at DESC);

-- Users additional indexes
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider);
CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);

-- Workspace state
CREATE INDEX IF NOT EXISTS idx_workspace_state_updated_at ON workspace_state(updated_at DESC);

-- Voice profiles
CREATE INDEX IF NOT EXISTS idx_voice_profiles_user_id ON voice_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_profiles_created_at ON voice_profiles(created_at DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_meetings_workspace_created ON meetings(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_assets_meeting_status ON media_assets(meeting_id, transcription_status);
```

#### 3.2 Dodać skrypt migracyjny

```typescript
// server/scripts/run-migrations.ts
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export function runMigrations(dbPath: string) {
  const db = new DatabaseSync(dbPath);
  const migrationsDir = path.join(__dirname, '../migrations');

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    console.log(`Running migration: ${file}`);
    db.exec(sql);
  }

  db.close();
}
```

---

### P04: Eksport do Web Worker - AKCJE NAPRAWCZE

#### 4.1 Utworzyć exportWorker.ts

```typescript
// src/workers/exportWorker.ts
export type ExportMessageType =
  | { type: 'EXPORT_PDF'; payload: ExportPdfPayload }
  | { type: 'EXPORT_NOTES'; payload: ExportNotesPayload };

export type ExportResultMessage =
  | { type: 'EXPORT_SUCCESS'; payload: { url: string; filename: string } }
  | { type: 'EXPORT_PROGRESS'; payload: { percent: number } }
  | { type: 'EXPORT_ERROR'; payload: { error: string } };

interface ExportPdfPayload {
  meeting: Meeting;
  recording: Recording;
  speakerNames: Record<string, string>;
}

self.onmessage = async (event: MessageEvent<ExportMessageType>) => {
  const { type, payload } = event.data;

  try {
    if (type === 'EXPORT_PDF') {
      self.postMessage({
        type: 'EXPORT_PROGRESS',
        payload: { percent: 10 },
      });

      // Generowanie PDF w workerze
      const htmlContent = generatePdfHtml(payload.meeting, payload.recording, payload.speakerNames);

      self.postMessage({
        type: 'EXPORT_PROGRESS',
        payload: { percent: 80 },
      });

      // Konwersja HTML do Blob
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);

      self.postMessage({
        type: 'EXPORT_SUCCESS',
        payload: { url, filename: `${payload.meeting.title}.pdf` },
      });
    }
  } catch (error) {
    self.postMessage({
      type: 'EXPORT_ERROR',
      payload: { error: error.message },
    });
  }
};

function generatePdfHtml(meeting, recording, speakerNames): string {
  // Przenieść logikę z printMeetingPdf tutaj
  // ...
}
```

#### 4.2 Zaktualizować useUI.ts z użyciem Workera

```typescript
// src/hooks/useUI.ts
import { useEffect, useRef } from 'react';

const exportMeetingPdfFile = useCallback(() => {
  if (!meetings.selectedMeeting) return;

  // Create worker
  const worker = new Worker(new URL('../workers/exportWorker.ts', import.meta.url));

  // Handle messages
  worker.onmessage = (event: MessageEvent<ExportResultMessage>) => {
    const { type, payload } = event.data;

    if (type === 'EXPORT_SUCCESS') {
      // Open print dialog
      const popup = window.open(payload.url, '_blank', 'noopener,noreferrer');
      popup?.focus();
      popup?.print();

      // Cleanup
      setTimeout(() => URL.revokeObjectURL(payload.url), 1000);
    } else if (type === 'EXPORT_PROGRESS') {
      setExportProgress(payload.percent);
    } else if (type === 'EXPORT_ERROR') {
      console.error('Export failed:', payload.error);
      setExportError(payload.error);
    }
  };

  // Send export request
  worker.postMessage({
    type: 'EXPORT_PDF',
    payload: {
      meeting: meetings.selectedMeeting,
      recording: displayRecording,
      speakerNames: displaySpeakerNames,
    },
  });

  // Store worker reference for potential cancellation
  activeExportWorkerRef.current = worker;
}, [meetings.selectedMeeting, displayRecording, displaySpeakerNames]);
```

#### 4.3 Alternatywa: Server-Sent Events dla backend export

```typescript
// server/routes/export.ts
import { Hono } from 'hono';

const exportRoutes = new Hono();

exportRoutes.get('/export/:meetingId/pdf', async (c) => {
  const meetingId = c.req.param('meetingId');

  // Stream response with SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      controller.enqueue(encoder.encode(`data: {"type":"progress","percent":10}\n\n`));

      // Generate PDF in chunks
      const pdfBuffer = await generatePdfInChunks(meetingId);

      controller.enqueue(encoder.encode(`data: {"type":"progress","percent":90}\n\n`));

      // Send final result
      controller.enqueue(
        encoder.encode(`data: {"type":"complete","url":"/downloads/${meetingId}.pdf"}\n\n`)
      );

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
});
```

---

## 📊 HARMONOGRAM WDROŻENIA

| Zadanie                                 | Priorytet | Estymat | Status |
| --------------------------------------- | --------- | ------- | ------ |
| P01.1: TypeScript types dla hooków      | High      | 4h      | TODO   |
| P01.2: ESLint react-hooks check         | Medium    | 1h      | TODO   |
| P02.1: Naprawa App.integration.test.tsx | High      | 2h      | TODO   |
| P02.2: Global test cleanup              | Medium    | 1h      | TODO   |
| P03.1: Migracja 003_add_indexes.sql     | High      | 2h      | TODO   |
| P03.2: Skrypt migracyjny                | Medium    | 2h      | TODO   |
| P04.1: exportWorker.ts                  | High      | 6h      | TODO   |
| P04.2: Integracja z useUI.ts            | High      | 3h      | TODO   |
| **RAZEM**                               |           | **21h** |        |

---

## ✅ KRYTERIA AKCEPTACJI

### P01 - Stale closures:

- [ ] Wszystkie hooki mają pełne TypeScript types
- [ ] ESLint `react-hooks/exhaustive-deps` nie zgłasza błędów
- [ ] Zero warningów w konsoli React DevTools

### P02 - Test stability:

- [ ] Żaden test nie używa `setTimeout` bez `vi.useFakeTimers()`
- [ ] Wszystkie testy kończą się w <10s
- [ ] CI timeout rate <1%

### P03 - Database performance:

- [ ] Wszystkie często queryowane kolumny mają indeksy
- [ ] Query time dla `SELECT * FROM meetings WHERE user_id = ? ORDER BY created_at DESC` <50ms przy 10k rekordów
- [ ] Migration script działa idempotentnie

### P04 - Export performance:

- [ ] Eksport PDF dla 60min nagrania nie blokuje UI
- [ ] Progress bar pokazuje postęp eksportu
- [ ] Możliwość anulowania eksportu
- [ ] Memory usage <100MB podczas eksportu

---

## 🚀 NEXT STEPS

1. **Natychmiast** (Dzień 1):
   - Utwórz `003_add_missing_indexes.sql`
   - Napraw `App.integration.test.tsx` z fake timers
2. **Krótkoterminowe** (Dzień 2-3):
   - Dodaj TypeScript types do wszystkich hooków
   - Uruchom ESLint z react-hooks pluginem
3. **Średnioterminowe** (Dzień 4-7):
   - Zaimplementuj exportWorker.ts
   - Przetestuj z dużymi plikami (>60min)

4. **Monitorowanie**:
   - Dodaj performance metrics do eksportu
   - Trackuj query times w production

---

_Wygenerowano: 2026-03-20_
_Autor: VoiceLog Audit Team_
