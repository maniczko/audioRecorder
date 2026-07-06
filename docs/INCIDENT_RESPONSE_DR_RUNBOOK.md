# Incident Response and Disaster Recovery Runbook

## Purpose

This runbook defines how VoiceLog operators respond to production incidents involving recordings,
transcription, providers, storage, database health, and deployment regressions.

Use it during active incidents, tabletop exercises, and post-incident review.

## Severity levels

| Severity | Definition                                                       | Examples                                                                                                                            | Target response                                                         |
| -------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| SEV-1    | Production data loss, security exposure, or total service outage | Supabase Storage unavailable with failed uploads, database unavailable, leaked credential, all recordings stuck                     | Page owner immediately, start incident channel, update every 15 minutes |
| SEV-2    | Major customer workflow degraded with workaround                 | STT provider outage with fallback available, high transcription failure rate, backend unhealthy after deploy but rollback available | Assign incident lead, update every 30 minutes                           |
| SEV-3    | Partial degradation or limited blast radius                      | Single workspace processing issue, stuck transcription job batch, observability-only outage                                         | Triage in normal ops channel, update hourly                             |
| SEV-4    | Non-urgent follow-up                                             | Documentation gap, runbook improvement, noisy expected auth failures                                                                | Track as GitHub issue                                                   |

## Roles and escalation

| Role                 | Responsibility                                                       |
| -------------------- | -------------------------------------------------------------------- |
| Incident lead        | Owns severity, timeline, decisions, and closure.                     |
| Backend owner        | Diagnoses Railway/API/database/transcription pipeline.               |
| Frontend owner       | Verifies Vercel deployment, UI reachability, and user-facing impact. |
| Data owner           | Verifies Supabase, storage, retention, and data consistency.         |
| Communications owner | Posts internal/customer updates and incident summary.                |

Escalate to the next owner when:

- Impact is unclear after 15 minutes.
- Data loss or credential exposure is possible.
- Rollback does not restore health.
- Provider status pages do not explain the failure.

## Communication

During SEV-1/SEV-2:

1. Open an incident channel or issue.
2. Pin severity, start time, suspected impact, owner, and current mitigation.
3. Post updates on the target cadence from Severity levels.
4. Separate facts from hypotheses.
5. Never paste secrets, raw transcript text, audio URLs, bearer tokens, provider payloads, or customer
   private data into the channel.

## Verification commands

Run the narrowest command that answers the incident question.

```powershell
pnpm run release:prod-smoke
pnpm run release:audio-prod-smoke
pnpm run errors:railway
pnpm run sentry:release-health
pnpm run verify:supabase:workspace
pnpm run release:prod-smoke:strict
pnpm run test:e2e:production-system
```

Useful manual checks:

```powershell
curl https://voicelog-production.up.railway.app/health
curl https://voicelog-production.up.railway.app/api/capabilities
gh run list --repo maniczko/audioRecorder --limit 10
gh pr checks <PR_NUMBER> --repo maniczko/audioRecorder --watch=false
```

## Rollback

Use rollback when a recent deploy caused or strongly correlates with the incident.

1. Identify the last healthy deployment on Vercel and Railway.
2. Confirm whether the incident is frontend-only, backend-only, or data/provider related.
3. Roll back the affected surface:
   - Vercel: redeploy the last healthy production deployment or revert the PR.
   - Railway: redeploy the last healthy backend build or revert the backend change.
   - Database: do not roll back migrations manually without a reviewed restore plan.
4. Verify with `/health`, `/api/capabilities`, production smoke, and the failing user journey.
5. Keep the incident open until the rollback is verified and follow-up work is filed.

## Scenario: Backend unhealthy after deploy

Symptoms:

- `/health` returns non-200 or `status=degraded`.
- Vercel frontend loads but API calls fail.
- Backend production smoke fails after a deploy.

Checks:

```powershell
curl https://voicelog-production.up.railway.app/health
pnpm run release:prod-smoke
pnpm run errors:railway
gh run list --repo maniczko/audioRecorder --workflow backend-production-smoke.yml --limit 5
```

Mitigation:

1. Compare failing deploy SHA with the last green backend smoke.
2. If the failure started after the deploy, roll back Railway or revert the PR.
3. If `/health` points to storage/database degradation, follow the matching scenario below.
4. Verify login, recordings list, and one non-destructive API request.

## Scenario: STT provider outage

Symptoms:

- Transcription jobs fail with provider errors.
- `/api/capabilities` marks `stt` unavailable or degraded.
- New recordings remain uploaded but not ready.

Checks:

```powershell
curl https://voicelog-production.up.railway.app/api/capabilities
pnpm run release:audio-prod-smoke
pnpm run errors:railway
```

Mitigation:

1. Check OpenAI and Groq provider status pages.
2. If fallback provider is configured, switch `VOICELOG_STT_PROVIDER` or
   `VOICELOG_STT_FALLBACK_PROVIDER` on Railway.
3. Pause bulk retries if the provider is rate-limiting.
4. Re-run failed/dead-letter transcription jobs after provider recovery.
5. Verify one upload/transcribe journey before lowering severity.

## Scenario: Supabase Storage unavailable

Symptoms:

- `/health.supabaseRemote=false`.
- Uploads fail or recordings disappear after redeploy.
- `supabaseStorage` capability is unavailable.

Checks:

```powershell
curl https://voicelog-production.up.railway.app/health
pnpm run verify:supabase:workspace
pnpm run release:audio-prod-smoke
```

Mitigation:

1. Confirm `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present in Railway.
2. Confirm the storage bucket exists and service-role access is valid.
3. Do not rely on Railway local filesystem as a production fallback.
4. If credentials are invalid, rotate Supabase service role and restart backend.
5. Verify upload, audio playback, transcript attachment, and storage readiness.

## Scenario: Database degraded

Symptoms:

- `/health` reports database unavailable.
- Login, workspace bootstrap, recordings list, or retention jobs fail.
- GitHub/Railway logs show connection errors or migration failures.

Checks:

```powershell
curl https://voicelog-production.up.railway.app/health
pnpm run release:prod-smoke
pnpm run verify:supabase:workspace
```

Mitigation:

1. Confirm `DATABASE_URL` or `VOICELOG_DATABASE_URL` points at the complete Supabase/Postgres host.
2. Check Supabase database status and connection limits.
3. If a migration caused the issue, stop new deploys and create a reviewed repair plan.
4. Avoid destructive migration rollback without backup verification.
5. Verify workspace bootstrap and one read/write smoke after recovery.

## Scenario: Stuck transcription jobs

Symptoms:

- Recordings stay in uploaded/processing states.
- Dead-letter jobs increase.
- Users report transcript was available once and then disappeared or failed to reload.

Checks:

```powershell
pnpm run errors:railway
pnpm run release:audio-prod-smoke
```

Admin checks:

- `GET /api/admin/transcription-jobs?workspaceId=<workspace>&status=failed`
- `GET /api/admin/transcription-jobs?workspaceId=<workspace>&status=dead_letter`

Mitigation:

1. Identify whether failures are provider, storage, database, or queue related.
2. Retry a small sample before replaying a large batch.
3. Cancel duplicate jobs if they point at stale recording data.
4. Replay dead-letter jobs only after provider/storage health is green.
5. Verify recording status, transcript presence, audio playback, and audit logs.

## Scenario: High failure rate

Symptoms:

- Error monitor opens multiple fresh reports.
- Railway/Sentry error volume increases.
- E2E or production smoke starts failing without a single obvious provider outage.

Checks:

```powershell
pnpm run errors:railway
pnpm run sentry:release-health
gh issue list --repo maniczko/audioRecorder --label auto:error-report --state open
gh run list --repo maniczko/audioRecorder --limit 20
```

Mitigation:

1. Group failures by service, route, provider, workspace, and deploy SHA.
2. Identify whether failures are expected client/auth errors or production runtime errors.
3. If tied to a deploy, roll back and verify.
4. If tied to a provider, apply provider-specific mitigation.
5. Create follow-up issues for noisy monitoring or missing classification.

## Tabletop exercise checklist

Run quarterly or before major enterprise launch.

- Pick one scenario from this runbook.
- Assign incident lead, backend owner, data owner, frontend owner, and communications owner.
- Start a timeline with timestamps.
- Run the documented Verification commands.
- Confirm rollback decision criteria.
- Confirm customer communication draft.
- Confirm evidence links and artifact retention.
- Confirm no secrets or customer content were posted in incident notes.
- Create follow-up GitHub issues for gaps found during the exercise.

## Post-incident review template

```markdown
# Incident Review: <title>

## Summary

- Severity:
- Start:
- End:
- Incident lead:
- Impact:

## Timeline

- <timestamp>:

## Root Cause

- What failed:
- Why it failed:
- Why detection did or did not catch it earlier:

## Customer/Data Impact

- Workspaces affected:
- Recordings affected:
- Data loss or exposure:

## Mitigation

- Immediate mitigation:
- Rollback used:
- Verification evidence:

## Follow-Up

- Prevent recurrence:
- Improve detection:
- Improve runbook:
- Owner and due date:
```

## Closure criteria

Close an incident only when:

- User-facing impact is resolved.
- `/health` and `/api/capabilities` are back to expected status.
- Relevant smoke checks pass.
- Any replay/retry/cleanup job is complete or tracked.
- Post-incident review exists for SEV-1/SEV-2.
- Follow-up issues are opened for root cause and monitoring gaps.
