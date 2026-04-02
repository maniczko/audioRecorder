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

## /workspaces

- `PUT /users/:userId/profile`
- `POST /users/:userId/password`
- `GET /state/bootstrap`
- `PUT /state/workspaces/:workspaceId`
- `PATCH /state/workspaces/:workspaceId`
- `PUT /workspaces/:workspaceId/members/:targetUserId/role`
- `POST /workspaces/:workspaceId/rag/ask`
- `GET /voice-profiles`
- `POST /voice-profiles`
- `PATCH /voice-profiles/:id/threshold`
- `DELETE /voice-profiles/:id`
