# ADR 0001: Extract Recorder Queue Processing

## Status

Accepted

## Context

`recorderStore.ts` had grown into a large module that mixed persisted state, queue selection, upload, polling, retry, attachment, and user-facing error mapping.

## Decision

Keep Zustand store responsibilities in `recorderStore.ts` and move single-item queue processing into `src/store/recorderQueueProcessor.ts`.

## Consequences

- Queue processing can be tested directly without rendering React hooks.
- Store tests can focus on orchestration and persisted state.
- Future upload, progress, analysis, and attachment steps can be split further without changing the public store API.
