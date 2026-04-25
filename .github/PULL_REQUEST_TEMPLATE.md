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

- [ ] `pnpm run typecheck:all`
- [ ] `pnpm run lint:all`
- [ ] Focused Vitest files for changed code
- [ ] `pnpm run test:server:retry` when backend changes
- [ ] `pnpm run build`
- [ ] Local frontend/backend smoke when runtime behavior changed

## Risk Notes

<!-- Known risks, intentionally deferred work, or rollout notes. -->

## Screenshots / Recordings

<!-- Required for visible UI changes. -->
