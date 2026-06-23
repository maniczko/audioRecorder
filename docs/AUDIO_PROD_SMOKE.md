# Audio Production Smoke

Run after deploying the API to verify the production audio path end to end.

For local checks, keep the backend on `http://localhost:4001` and pass a smoke
workspace/user that has membership in the target workspace.

```bash
VOICELOG_SMOKE_BASE_URL=https://api.example.com \
VOICELOG_SMOKE_TOKEN=... \
VOICELOG_SMOKE_WORKSPACE_ID=... \
pnpm run release:audio-prod-smoke
```

Alternatively provide `VOICELOG_SMOKE_EMAIL` and `VOICELOG_SMOKE_PASSWORD` instead of
`VOICELOG_SMOKE_TOKEN`; the script will call `/auth/login` first.

The smoke writes a JSON report to `reports/audio-prod-smoke-<timestamp>.json` unless
`VOICELOG_SMOKE_REPORT` is set.

Local example:

```bash
VOICELOG_SMOKE_BASE_URL=http://localhost:4001 \
VOICELOG_SMOKE_TOKEN=... \
VOICELOG_SMOKE_WORKSPACE_ID=... \
pnpm run release:audio-prod-smoke
```

## Required Environment

| Variable                      | Required        | Description                                                                  |
| ----------------------------- | --------------- | ---------------------------------------------------------------------------- |
| `VOICELOG_SMOKE_BASE_URL`     | Yes             | Deployed API base URL. Defaults to `http://localhost:4001` for local checks. |
| `VOICELOG_SMOKE_WORKSPACE_ID` | Yes             | Workspace used for upload/transcription membership checks.                   |
| `VOICELOG_SMOKE_TOKEN`        | One auth method | Bearer token for the smoke user.                                             |
| `VOICELOG_SMOKE_EMAIL`        | One auth method | Login email when no token is provided.                                       |
| `VOICELOG_SMOKE_PASSWORD`     | One auth method | Login password when no token is provided.                                    |
| `VOICELOG_SMOKE_REPORT`       | No              | Explicit JSON report path.                                                   |

## Checks

- `/health` responds successfully.
- Remote Supabase storage is reported as enabled and ready.
- Auth login or provided bearer token works.
- A tiny WAV fixture uploads through `PUT /media/recordings/:id/audio`.
- Transcription starts through `POST /media/recordings/:id/transcribe`.
- Status polling uses `GET /media/recordings/:id/transcribe` until a terminal state.
- Transcript persistence is verified by checking that transcript segments exist, or that an empty/failed transcript outcome is explicitly reported.
- Audio download works through `GET /media/recordings/:id/audio`.
- Retry-transcribe route responds for completed/processing states through `POST /media/recordings/:id/retry-transcribe`.

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

- Missing `VOICELOG_SMOKE_WORKSPACE_ID`: the smoke cannot prove membership-sensitive upload/transcribe paths.
- Missing auth (`VOICELOG_SMOKE_TOKEN` or email/password): the smoke stops before upload.
- `/health` reports `supabaseRemote: false` or storage not ready: verify backend env and Supabase credentials before testing transcription.
- Terminal transcript state is `empty`: acceptable only when the report includes an explicit empty transcript outcome and diagnostics.
