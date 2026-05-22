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
- [ ] Strict production smoke includes premium voice-profile journey (`voiceProfileChecked: true`) when release-critical.
- [ ] Sentry release health: `pnpm run sentry:release-health` or production workflow evidence.
- [ ] No new unresolved Sentry P0/P1 for this release SHA.
- [ ] CodeRabbit review requested for changes touching audio pipeline, Studio, media routes, Sentry/release scripts, or Playwright smoke.
- [ ] Supabase persistence evidence: upload -> restart/redeploy -> recording/transcript still available

## Regression Evidence

- [ ] Bug fixes include a failing regression test first.
- [ ] Sentry/GitHub/Vercel/Railway incidents have a linked issue with root cause, missing test, regression test path, target command, and release impact.

## Risk Notes

<!-- Known risks, intentionally deferred work, or rollout notes. -->

## Screenshots / Recordings

<!-- Required for visible UI changes. -->
