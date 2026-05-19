## Summary

<!-- What changed and why? -->

## Linear

<!-- Link Linear issues, e.g. VAT-123 -->

## Change Type

- [ ] Fix
- [ ] Feature
- [ ] Refactor
- [ ] Test
- [ ] Docs
- [ ] CI/build
- [ ] Chore

## Audio Recorder Checklist

- [ ] Recording start/stop behavior is unchanged or explicitly tested.
- [ ] Microphone denial, missing device, busy device, and unsupported constraints are handled.
- [ ] Recorder cleanup stops active tracks on stop/error/unmount.
- [ ] Queue statuses remain valid: `queued`, `uploading`, `processing`, `diarization`, `review`, `failed`, `failed_permanent`, `done`.
- [ ] Failed queue items remain retryable or are intentionally permanent.
- [ ] Large/long audio behavior is bounded or documented.

## Verification

- [ ] Node 22.x used for release verification (`node -v` attached or CI green).
- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm run release:rehearsal`
- [ ] `pnpm run typecheck:all`
- [ ] `pnpm run lint:all`
- [ ] `pnpm run lint:css`
- [ ] `pnpm run audit:a11y:ci`
- [ ] `pnpm run audit:build-warnings`
- [ ] `pnpm run audit:mojibake`
- [ ] Focused Vitest files for changed code
- [ ] `pnpm run test:server:retry` when backend changes
- [ ] `pnpm run test:frontend:ci` when frontend or shared code changes
- [ ] `pnpm run test:visual:check` for UI/layout changes, with artifacts reviewed
- [ ] Local frontend/backend smoke when runtime behavior changed
- [ ] Production smoke: `pnpm run release:prod-smoke`
- [ ] Supabase persistence evidence: upload -> restart/redeploy -> recording/transcript still available

## Risk Notes

<!-- Known risks, intentionally deferred work, or rollout notes. -->

## Screenshots / Recordings

<!-- Required for visible UI changes. -->
