# P0/P1 EXECUTION BACKLOG (implementation-ready)

Data: 2026-06-04

## P0 (blockers) â€” checklist with direct test mapping

### P0-A1 Frontend audio queue hardening

- [x] `src/hooks/useRecorder.test.tsx`  
      `describe('useRecorder')`
  - `it('quota exceeded error keeps recording queued as retryable')`
  - `it('transitions blob upload error into recoverable queue state')`

### P0-A2 Media critical API

- [x] `server/tests/routes/media.test.ts`  
      `describe('Media Routes')`
  - `it('POST /media/recordings/:recordingId/retry-transcribe - returns same job id on repeated retries')`
  - `it('GET /media/recordings/:recordingId/audio - serves reconstructed key when source asset was moved atomically')`
  - `it('POST /media/recordings/:recordingId/transcribe - returns payload for race polling / empty transcript edge cases')`

- [x] `server/tests/routes/media.additional.test.ts`  
      `describe('Media Routes - Additional Coverage')`
  - `it('GET /media/recordings/:recordingId/audio/chunk-status integration - returns isolated status ...')`
  - `it('GET /media/recordings/:recordingId/audio/chunk-status integration - parallel session isolation')`

### P0-A3 Auth/session/bootstrap

- [x] `server/tests/routes/auth.test.ts`  
      `describe('Auth Routes')`
  - `it('POST /auth/google - returns 401 on token mismatch')` (added in current pass)

- [x] `server/tests/routes/state.test.ts`  
      `describe('State Routes')`
  - `it('GET /state/bootstrap - retryable 401 path with same payload after refresh')` (already covered in [x] on execution checklist)
  - `it('PATCH /state/workspaces/:workspaceId - serializes concurrent deltas without losing writes')` (already covered in [x] on execution checklist)

### P0-A4 Skip cleanup + unblock critical descriptors

- [x] `server/tests/pipeline-coverage.test.ts` `it` skip cleanup
- [x] `server/tests/audio-pipeline.unit.test.ts` `it` skip cleanup
- [x] `src/App.test.tsx` `test` skip removal
- [x] `src/App.integration.test.tsx` `describe` unblocked
- [x] `src/AuthScreen.a11y.test.tsx` describe active
- [x] `src/CommandPalette.a11y.test.tsx` describe active
- [x] `rg -n "(describe\\.skip|it\\.skip|test\\.skip)"` verify on P0/P1 files in final gate

## P1 (stabilizacja)

### P1-A1 Workspace RBAC

- [ ] `server/tests/routes/workspaces.test.ts`  
      `describe('Workspace Routes')`
  - `it('viewer role denied for role change')`

### P1-A2 Voice profiles

- [ ] `server/tests/routes/voice-profiles.test.ts`
  - `describe('PATCH /voice-profiles/:id/threshold')`
    - `it('viewer role no-ops for threshold update')`
  - `describe('Voice Profiles Routes')`
    - `it('supports repeated identical updates (idempotency edge)')`
    - `it('parallel delete idempotency/second delete edge')`

### P1-A3 External AI + transcribe stability

- [x] `server/tests/routes/ai.test.ts`
  - `it('POST /ai/person-profile - transient empty response provider handled as structured fallback')`
  - `it('POST /ai/search - transient empty provider body handled as fallback')`
  - `it('POST /ai/suggest-tasks - transient empty provider body handled as fallback')`

- [ ] `server/tests/routes/media.test.ts`
  - `describe('Media Routes')`
    - `it('POST /media/recordings/:recordingId/retry-transcribe - returns same job id on repeated retries')`

- [ ] `server/tests/transcribe.test.ts`
  - `it('timeout/perf scenario')`

### P1-A4 Security and retention hardening

- [ ] `server/tests/routes/clientErrors.test.ts`
  - `it('retention policy and cleanup by limit')`
- [ ] `server/tests/security.test.ts`
  - `it('positive admin token path and invalid token rejection for metrics/endpoints')`

## Baza runĂłw (ready-to-run)

### Q1-front

```bash
npx vitest run src/hooks/useAudioHardware.test.ts src/hooks/useRecorder.test.tsx src/lib/recordingQueue.test.ts src/store/recorderStore.test.ts src/store/recorderQueueProcessor.test.ts
```

### Q2-media

```bash
npx vitest run -c server/vitest.config.ts server/tests/routes/media.test.ts server/tests/routes/media.additional.test.ts server/tests/transcribe.test.ts
```

### Q3-auth-state

```bash
npx vitest run -c server/vitest.config.ts server/tests/routes/auth.test.ts server/tests/routes/state.test.ts
```

### Q4-qa

```bash
npx vitest run -c server/vitest.config.ts server/tests/routes/workspaces.test.ts server/tests/routes/voice-profiles.test.ts server/tests/routes/clientErrors.test.ts server/tests/security.test.ts server/tests/routes/ai.test.ts
```

## Proponowana kolejnoĹ›Ä‡ commitow dla implementacji

1. `test(frontend): p0 recorder queue hardening`
   - `src/hooks/useAudioHardware.test.ts`
   - `src/hooks/useRecorder.test.tsx`
   - `src/lib/recordingQueue.test.ts`
   - `src/store/recorderStore.test.ts`
   - `src/store/recorderQueueProcessor.test.ts`
2. `test(server): p0 media critical gap hardening`
   - `server/tests/routes/media.test.ts`
   - `server/tests/routes/media.additional.test.ts`
   - `server/tests/transcribe.test.ts`
3. `test(server): p0 auth session bootstrap hardening`
   - `server/tests/routes/auth.test.ts`
   - `server/tests/routes/state.test.ts`
4. `test(qa): p0 unblock skips + final acceptance`
   - `server/tests/pipeline-coverage.test.ts`
   - `server/tests/audio-pipeline.unit.test.ts`
   - `src/App.test.tsx`
   - `src/App.integration.test.tsx`
   - `src/AuthScreen.a11y.test.tsx`
   - `src/CommandPalette.a11y.test.tsx`
5. `test(server): p1 stabilizacja RBAC + AI + retry`
   - `server/tests/routes/workspaces.test.ts`
   - `server/tests/routes/voice-profiles.test.ts`
   - `server/tests/routes/ai.test.ts`
   - `server/tests/routes/clientErrors.test.ts`
   - `server/tests/security.test.ts`
   - `server/tests/transcribe.test.ts`
