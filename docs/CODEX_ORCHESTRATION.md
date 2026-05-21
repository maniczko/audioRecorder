# Codex Orchestration

This document defines how Codex and connected plugins should be used for VoiceLog OS work. It is a release governance document: when in doubt, prefer this flow over ad hoc tool use.

## Core Rule

Every production-impacting change follows the same path:

1. Reproduce the issue or define the expected behavior.
2. Write or update a failing regression test first.
3. Implement the smallest safe fix.
4. Run focused tests for the touched area.
5. Run the required release gate for the change type.
6. Deploy only from a SHA that passed CI.
7. Run production smoke and record evidence.

Do not treat a green local build as release evidence unless it ran on Node 22.x.

## Plugin Usage Matrix

| Plugin / tool        | Use when                                                                                                                         | Required evidence                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| GitHub               | Checking CI, publishing branches, reviewing PRs, validating workflow results, opening issues for release blockers.               | CI run link, commit SHA, PR checklist, or issue link.                         |
| Vercel               | Frontend deploys, production URL checks, environment variable review, deployment parity with backend SHA.                        | Deployment URL, frontend build SHA, production smoke output.                  |
| Supabase             | Database/storage verification, media asset state, workspace persistence, remote storage evidence.                                | Query result summary without secrets, asset/workspace IDs, persistence proof. |
| Sentry               | Production error triage, release health, source map/DSN verification, user-impact analysis.                                      | Issue/event IDs, affected release, sanitized error context.                   |
| Browser / Playwright | Any UI, layout, auth, recording, upload, queue, modal, mobile, or visual-regression work.                                        | Screenshot, trace, console summary, or Playwright report.                     |
| Figma / Canva        | Design-system clarification, visual direction, component audits, presentation artifacts. They are not required for every UI fix. | Repo-visible rules, screenshot comparison, or updated design notes.           |
| OpenAI Developers    | OpenAI API/Codex documentation, model/API behavior, API key setup flows, provider migration guidance.                            | Official-doc citation or explicit local verification result.                  |

## Fallbacks When A Plugin Is Not Callable

Plugins are helpful, but the repository must remain operable without them.

- GitHub unavailable: use `gh` CLI if authenticated, otherwise local `git` plus GitHub Actions URLs from the browser.
- Vercel unavailable: use Vercel CLI if configured; otherwise rely on GitHub deployment workflow summaries.
- Supabase unavailable: use existing backend health endpoints and server-side smoke scripts; never print `.env` secrets.
- Sentry unavailable: use sanitized production logs, browser console output, and GitHub issue evidence until Sentry access is restored.
- Browser plugin unavailable: use Playwright CLI and attach screenshots/traces from `playwright-report/` and `test-results/`.
- Figma/Canva unavailable: use `docs/DESIGN_SYSTEM_RULES.md`, existing components, and Playwright screenshots as source of truth.
- OpenAI docs unavailable: use local repo behavior first; if current OpenAI behavior matters, browse only official OpenAI docs.

If a plugin was requested but is not available in the current Codex session, state that clearly and continue with the safest fallback.

## Mandatory Bug-Fix Flow

Use this flow for every user-reported bug, runtime error, failed production smoke, or regression:

1. **Classify**
   - Identify affected surface: frontend, backend, DB/storage, deployment, observability, or tests.
   - Identify whether users are currently blocked.

2. **Reproduce**
   - Prefer real-browser or API reproduction.
   - Capture exact request, status code, console message, recording/workspace IDs, and current SHA.
   - Do not retry expensive STT jobs until DB state proves it is safe.

3. **Test First**
   - Add a regression test that fails on the broken behavior.
   - Frontend bugs belong next to the hook/store/component.
   - Backend route/lib bugs belong in `server/tests/` or `server/tests/regression/`.
   - E2E/product-contract bugs need Playwright coverage when the failure depends on browser state, persisted queue, auth, upload, workspace hydration, or production routing.

4. **Fix**
   - Keep the change inside the smallest ownership boundary.
   - Do not rewrite recorder, queue, media, workspace, or transcription modules broadly for a narrow bug.
   - Preserve completed transcripts and uploaded assets unless the user explicitly requests destructive cleanup.

5. **Verify Focused**
   - Recorder/queue changes:
     `pnpm exec vitest run src/hooks/useAudioHardware.test.ts src/hooks/useRecorder.test.tsx src/lib/recordingQueue.test.ts src/store/recorderStore.test.ts src/store/recorderQueueProcessor.test.ts --coverage.enabled=false`
   - Backend media/STT changes:
     `pnpm run test:server:retry`
   - UI/layout changes:
     `pnpm run test:visual:check` and a real-browser smoke.
   - Workflow/config changes:
     `pnpm run test:workflows` and `pnpm run audit:mojibake`.

6. **Verify Release**
   - Required for production-bound changes:
     `pnpm run release:rehearsal`
   - Required production evidence:
     `pnpm run release:prod-smoke` or `pnpm run release:prod-smoke:strict` when release secrets are present.

7. **Report**
   - Files changed.
   - Tests run and exact result.
   - Remaining risks.
   - Whether frontend/backend runtime or production smoke was verified.

## Change-Type Playbooks

### Frontend Or UI

- Use Browser/Playwright for real rendering checks.
- Verify desktop and mobile breakpoints when layout changes.
- Check console for new errors and repeated warnings.
- Use `docs/DESIGN_SYSTEM_RULES.md` for spacing, cards, typography, and visual baseline rules.

### UI Action Coverage

Every visible user action must have an automated interaction contract. A button,
menu item, icon button, tab, command palette item, or row action is release-ready
only when one of these is true:

- It has a component/store test that clicks or keyboard-activates it and asserts
  the user-visible result or outbound API request.
- It is covered by an E2E journey that exercises the real flow and asserts the
  next state.
- It is intentionally disabled for the current data state, with a test proving
  the disabled state or explanatory message.
- It has a dated exception in the owning test file or release checklist because
  the action is destructive, provider-bound, or not yet implemented.

Production-only branches must be tested explicitly. For example, actions gated by
`remoteApiEnabled()`, workspace hydration, Supabase-backed media, or authenticated
API requests need tests with that mode enabled, not only local/mock-provider tests.
No enabled button may silently return from its handler; if prerequisites are
missing, disable it or show a user-facing message.

### Recorder, Queue, Upload, Transcription

- Always test persisted queue state and recovery after reload.
- Test missing workspace, stale recording ID, backend 404, background processing, completed transcript attach, and retry protection.
- For long audio, avoid terminal frontend failure unless backend returns a real failure.

### Backend, Supabase, Or Storage

- Verify `/health` and `supabaseRemote`.
- Check auth/workspace guards before costly operations.
- Never log or paste service-role keys, database passwords, bearer tokens, or API keys.
- Prefer idempotent cleanup for stale remote assets.

### Deployment Or Environment

- Verify Node 22.
- Verify frontend and backend SHA parity.
- Vercel production deployment must not point at a stale Railway backend.
- Railway/Vercel/Supabase secrets stay in provider or GitHub secrets only.

### Observability

- Sentry DSN is required for production release evidence unless a dated exception exists.
- Error reports must include sanitized `recordingId`, `workspaceId`, status, provider/model, and git SHA where relevant.
- Console logs in production should be actionable; debug noise belongs behind explicit debug flags.

## Automation Safety

- Automations may create issues or PRs.
- Automations should not push directly to `main`.
- Avoid `--no-verify` in automated commits.
- Any workflow that writes repository files must be validated by `pnpm run test:workflows`.
- Auto-fix workflows must be treated as advisory unless they produce a reviewed PR with green CI.

## Release Evidence Checklist

Before handing a build to the user for testing:

- [ ] Current SHA identified.
- [ ] Node 22 used for release evidence.
- [ ] Regression test exists for the reported bug.
- [ ] Focused tests passed.
- [ ] `pnpm run release:rehearsal` passed or a scoped exception is documented.
- [ ] Production smoke passed for the deployed URL.
- [ ] Supabase persistence evidence is present for media/storage changes.
- [ ] Browser console checked for repeated errors.
- [ ] No secrets printed in logs, reports, screenshots, or documentation.
