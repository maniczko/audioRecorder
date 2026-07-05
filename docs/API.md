# API Documentation

Auto-generated API documentation.

## /ai

- `POST /person-profile`
- `POST /suggest-tasks`
- `POST /search`

## /auth

- `POST /google`
- `GET /session`

## /digest

- `GET /daily`

## /media

- `PUT /recordings/:recordingId/audio`
- `GET /recordings/:recordingId/audio`
- `GET /recordings`
- `DELETE /recordings/:recordingId`
- `POST /recordings/:recordingId/transcribe`
- `POST /recordings/:recordingId/retry-transcribe`
- `GET /recordings/:recordingId/transcribe`
- `POST /recordings/:recordingId/progress-token`
- `GET /recordings/:recordingId/progress`
- `POST /recordings/:recordingId/normalize`
- `POST /recordings/:recordingId/voice-profiles/from-speaker`
- `POST /recordings/:recordingId/voice-coaching`
- `POST /recordings/:recordingId/acoustic-features`
- `POST /recordings/:recordingId/rediarize`
- `POST /recordings/:recordingId/sketchnote`
- `POST /analyze`
- `PUT /recordings/:recordingId/audio/chunk`
- `POST /recordings/:recordingId/audio/finalize`
- `GET /disk-space/status`
- `POST /disk-space/cleanup`
- `POST /live`

### Progress stream auth

`GET /media/recordings/:recordingId/progress` accepts the normal session
`Authorization: Bearer <session-token>` header. Short-lived progress tokens must
use `X-Progress-Token: <token>` or the same-site `progressToken` cookie. Do not
send progress tokens in the URL query string; query transport is reserved only
for temporary migrations with `VOICELOG_ALLOW_PROGRESS_QUERY_TOKEN=true`.

## /workspaces

- `PUT /users/:userId/profile`
- `POST /users/:userId/password`
- `GET /state/bootstrap`
- `PUT /state/workspaces/:workspaceId`
- `PATCH /state/workspaces/:workspaceId`
- `PUT /workspaces/:workspaceId/members/:targetUserId/role`
- `PUT /workspaces/:workspaceId/retention-hold`
- `DELETE /workspaces/:workspaceId/retention-hold`
- `GET /workspaces/:workspaceId/retention-holds`
- `PUT /workspaces/:workspaceId/recordings/:recordingId/retention-hold`
- `DELETE /workspaces/:workspaceId/recordings/:recordingId/retention-hold`
- `POST /workspaces/:workspaceId/rag/ask`
- `GET /voice-profiles`
- `POST /voice-profiles`
- `PATCH /voice-profiles/:id/threshold`
- `DELETE /voice-profiles/:id`
