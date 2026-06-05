# ROADMAP P0-P1 -- wykonalny plan testow (2026-06-04)

## Cel

Podzial zadan na punkty P0/P1 gotowy do wykonania z jasnym porzadkiem odpalania.

## Priorytety wg wykonywania

### P0.0: skip + hardening QA (pre-check)

- `src/App.test.tsx`
- `src/App.integration.test.tsx`
- `src/AuthScreen.a11y.test.tsx`
- `src/CommandPalette.a11y.test.tsx`
- `server/tests/pipeline-coverage.test.ts`
- `server/tests/audio-pipeline.unit.test.ts`

### P0.1: Audio / Recorder front

- `src/hooks/useAudioHardware.test.ts`
- `src/hooks/useRecorder.test.tsx`
- `src/lib/recordingQueue.test.ts`
- `src/store/recorderStore.test.ts`
- `src/store/recorderQueueProcessor.test.ts`

### P0.2: Media backend critical

- `server/tests/routes/media.test.ts`
- `server/tests/routes/media.additional.test.ts`

### P0.3: Auth + State bootstrap

- `server/tests/routes/auth.test.ts`
- `server/tests/routes/state.test.ts`

### P1.1: Access control / RBAC

- `server/tests/routes/workspaces.test.ts`
- `server/tests/routes/voice-profiles.test.ts`

### P1.2: AI + retry/transcribe hardening

- `server/tests/routes/ai.test.ts`
- `server/tests/routes/media.test.ts`
- `server/tests/routes/media.additional.test.ts`

### P1.3: Policies / security / perf polish

- `server/tests/routes/clientErrors.test.ts`
- `server/tests/security.test.ts`
- `server/tests/routes/transcribe.test.ts`

## Komendy uruchomieniowe

### Q1-front

```bash
npx vitest run src/hooks/useAudioHardware.test.ts src/hooks/useRecorder.test.tsx src/lib/recordingQueue.test.ts src/store/recorderStore.test.ts src/store/recorderQueueProcessor.test.ts
```

### Q2-media

```bash
npx vitest run -c server/vitest.config.ts server/tests/routes/media.test.ts server/tests/routes/media.additional.test.ts
```

### Q3-auth-state

```bash
npx vitest run -c server/vitest.config.ts server/tests/routes/auth.test.ts server/tests/routes/state.test.ts
```

### Q4-security-and-p1

```bash
npx vitest run server/tests/routes/workspaces.test.ts server/tests/routes/voice-profiles.test.ts server/tests/routes/ai.test.ts server/tests/routes/clientErrors.test.ts server/tests/security.test.ts server/tests/routes/transcribe.test.ts
```

### Q5-gates

```bash
pnpm run test:server:retry
pnpm run test:frontend:ci
pnpm run test:coverage:all
```
