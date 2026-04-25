# Operations

## Local Startup

```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm run start:server:watch
pnpm start
```

Frontend runs on `http://localhost:3000`. Backend runs on `http://127.0.0.1:4000`.

## Audio Processing Limits

Client-side audio preparation is best-effort. If silence filtering or enhancement fails, the original blob is uploaded rather than blocking the recording.

Large-file and long-running processing must be bounded at the backend. The user-facing path must keep the queue item visible with retry or permanent-failure state.

## Error Monitoring Triage

Use a stable grouping key:

- source service
- route or component
- normalized error message
- status code
- runtime mode

Do not create duplicate issues for repeated occurrences of the same group. Update the existing issue or monitoring report.

## Uncaught Exceptions

Production policy: log context, stop accepting new work, let in-flight cleanup finish where possible, then exit so the process manager restarts a clean instance. Do not silently continue after unknown top-level failures.

Implementation notes:

- `uncaughtException` and `unhandledRejection` are treated as fatal.
- Fatal handlers log the event type, process id, uptime, and original error.
- Shutdown clears the periodic cleanup timer, closes the HTTP server, shuts down database resources, and exits with code `1`.
- `SIGTERM` and `SIGINT` use the same graceful shutdown path and exit with code `0`.
- A force-exit timeout protects against shutdown hangs.
