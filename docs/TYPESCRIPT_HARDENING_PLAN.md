# TypeScript Hardening Plan

## Goal

Increase type safety without destabilizing CI through a single broad strictness change.

## Sequence

1. Keep `pnpm run typecheck:all` green.
2. Remove avoidable `any` from audio queue and recording modules first.
3. Add explicit store interfaces for `recorderStore`.
4. Add server route input/output types around media and state routes.
5. Introduce stricter scoped configs only after the focused module is clean.

## First Targets

- `src/store/recorderStore.ts`
- `src/store/recorderQueueProcessor.ts`
- `src/hooks/useAudioHardware.ts`
- `server/routes/media.ts`
- `server/transcription.ts`
