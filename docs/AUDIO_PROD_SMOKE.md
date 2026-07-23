# Audio Production Smoke

Run after deploying the API to verify the production audio path end to end.

For local checks, keep the backend on `http://localhost:4001` and pass a smoke
workspace/user that has membership in the target workspace.

```bash
PRODUCTION_SMOKE_BASE_URL=https://api.example.com \
PRODUCTION_SMOKE_AUTH_TOKEN=... \
PRODUCTION_EXPECTED_GIT_SHA=... \
PRODUCTION_SMOKE_WORKSPACE_ID=... \
pnpm run release:audio-prod-smoke
```

Alternatively provide `PRODUCTION_SMOKE_EMAIL` and `PRODUCTION_SMOKE_PASSWORD` instead of
`PRODUCTION_SMOKE_AUTH_TOKEN`; the script will call `/auth/login` first.

The smoke writes a JSON report to `reports/audio-prod-smoke-<timestamp>.json` unless
`PRODUCTION_SMOKE_REPORT` is set.

The uploaded audio comes from the deterministic seeded fixture
`tests/fixtures/audio/smoke-short.wav.base64`, decoded as a tiny WAV file at runtime.

Local example:

```bash
PRODUCTION_SMOKE_BASE_URL=http://localhost:4001 \
PRODUCTION_SMOKE_AUTH_TOKEN=... \
PRODUCTION_SMOKE_WORKSPACE_ID=... \
pnpm run release:audio-prod-smoke
```

## Required Environment

| Variable                        | Required        | Description                                                                  |
| ------------------------------- | --------------- | ---------------------------------------------------------------------------- |
| `PRODUCTION_SMOKE_BASE_URL`     | Yes             | Deployed API base URL. Defaults to `http://localhost:4001` for local checks. |
| `PRODUCTION_EXPECTED_GIT_SHA`   | No              | Optional backend git SHA expected in `/health`.                              |
| `PRODUCTION_SMOKE_WORKSPACE_ID` | Yes             | Workspace used for upload/transcription membership checks.                   |
| `PRODUCTION_SMOKE_AUTH_TOKEN`   | One auth method | Bearer token for the smoke user.                                             |
| `PRODUCTION_SMOKE_EMAIL`        | One auth method | Login email when no token is provided.                                       |
| `PRODUCTION_SMOKE_PASSWORD`     | One auth method | Login password when no token is provided.                                    |
| `PRODUCTION_SMOKE_REPORT`       | No              | Explicit JSON report path.                                                   |
| `PRODUCTION_SMOKE_CLEANUP`      | No              | Set to `true` to delete the smoke recording after validation.                |

## Checks

- `/health/live` responds successfully.
- `/health` responds successfully and returns optional matching `PRODUCTION_EXPECTED_GIT_SHA`.
- `/ready` responds and indicates readiness.
- Remote Supabase storage is reported as enabled and ready.
- Auth login or provided bearer token works.
- A tiny WAV fixture uploads through `PUT /media/recordings/:id/audio`.
- Transcription starts through `POST /media/recordings/:id/transcribe`.
- Status polling uses `GET /media/recordings/:id/transcribe` until a terminal state.
- The smoke recording is reloaded from `GET /media/recordings/:id` to prove persistence.
- Transcript persistence is verified as:
  - `segmentCount > 0` when `pipelineStatus: done` and `transcriptOutcome` is successful, or
  - explicit `transcriptOutcome: empty` with diagnostics.
- Transcription failures (`failed`, `failed_permanent`, or pipeline failure) fail the smoke.
- Audio download works through `GET /media/recordings/:id/audio`.
- Retry-transcribe route responds for completed/processing states through `POST /media/recordings/:id/retry-transcribe`.
- Smoke data is either removed when `PRODUCTION_SMOKE_CLEANUP=true`, or left with the identifiable `smoke_` recording prefix and summarized in the report.

## Report Contract

Each report contains:

- `baseUrl`
- `startedAt`
- `finishedAt`
- `recordingId`
- `steps[]`

Each step contains:

- `name`
- `ok`
- `status`
- `requestId`, when the API provides `X-Request-Id`
- sanitized `details`
- `error`, when the step throws

The report intentionally does not include full transcript text, prompts, bearer tokens, passwords,
or raw provider payloads. Transcript evidence is summarized as counts, status, outcome, and
diagnostic metadata.

## Exit Codes

- `0` when all steps pass.
- `1` when any step fails or required auth/workspace evidence is missing.

## Common Failures

- Missing `PRODUCTION_SMOKE_WORKSPACE_ID`: the smoke cannot prove membership-sensitive upload/transcribe paths.
- Missing auth (`PRODUCTION_SMOKE_AUTH_TOKEN` or email/password): the smoke stops before upload.
- `/health` reports `supabaseRemote: false` or storage not ready: verify backend env and Supabase credentials before testing transcription.
- Pipeline fails with `failed`/`failed_permanent`: smoke fails and needs repair.
- Terminal transcript state is `empty`: acceptable only when the report includes an explicit empty transcript outcome and diagnostics.
