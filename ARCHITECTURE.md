# Architecture

## System Boundary

VoiceLog OS is a browser-first meeting recorder with a Node/Hono backend for authenticated workspace state, media storage, transcription orchestration, and AI analysis.

The frontend owns capture UX, local queue state, lightweight client-side audio preparation, and meeting UI. The backend owns durable media operations, transcription/diarization jobs, server-side auth, cleanup, and production observability.

## Frontend

- `src/hooks/useAudioHardware.ts` manages microphone access, recorder lifecycle, live transcript hooks, visualizer state, and cleanup.
- `src/hooks/useRecorder.ts` coordinates meeting selection, recording state, hydration boundaries, and queue entry creation.
- `src/lib/recordingQueue.ts` defines queue item normalization, status handling, next-item selection, and summary counters.
- `src/store/recorderStore.ts` persists queue state and exposes store actions.
- `src/store/recorderQueueProcessor.ts` processes a single queued recording: bounded client-side audio preparation, upload, transcription start/retry, progress polling, final attachment, error mapping, and backoff.

## Backend

- `server/index.ts` composes startup, services, cleanup, and route wiring.
- `server/routes/*` expose auth, workspace, media, transcription, and state endpoints.
- `server/transcription.ts`, `server/pipeline.ts`, and audio pipeline helpers handle STT, diarization, post-processing, progress, and persistence.
- SQLite is the local default; PostgreSQL/Supabase are the production-oriented targets.

## Critical Audio Flow

1. User starts recording in the browser.
2. `useAudioHardware` requests microphone access and falls back to relaxed constraints when strict constraints are unsupported.
3. Recorded chunks are stored and queued.
4. `recorderStore.processQueue` selects a processable queue item.
5. `recorderQueueProcessor` applies client-side VAD/enhancement only for short, small recordings; long or large recordings skip local preprocessing and move directly to upload.
6. `recorderQueueProcessor` uploads audio, starts or resumes transcription, subscribes/polls progress, attaches the finished recording, and removes the queue item.
7. Failed transient work is requeued with backoff; permanent failures remain visible for user/manual action.

## Runtime Modes

Remote mode is the canonical development and release path for the audio pipeline because it exercises API auth, backend media persistence, transcription jobs, and progress events.

Local mode is useful for isolated UX work where backend state is not the behavior under test.

## Decision Records

Architecture decisions live in `docs/adr/`.
