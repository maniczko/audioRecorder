# Production CORS configuration

VoiceLog production must never use wildcard CORS with credentials.

## Environment variables

```bash
VOICELOG_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
VOICELOG_ALLOW_VERCEL_PREVIEWS=false
```

## Current VoiceLog Vercel/Railway setup

The stable production frontend origin is:

```bash
https://voicelog-audiorecorder.vercel.app
```

Railway production must include that exact origin:

```bash
VOICELOG_ALLOWED_ORIGINS=https://voicelog-audiorecorder.vercel.app
```

If the main-branch Vercel preview is used for production verification, include
it explicitly in the same comma-separated allowlist:

```bash
VOICELOG_ALLOWED_ORIGINS=https://voicelog-audiorecorder.vercel.app,https://audiorecorder-git-main-iwoczajka-2703s-projects.vercel.app
```

For temporary preview testing across Vercel preview URLs, set:

```bash
VOICELOG_ALLOW_VERCEL_PREVIEWS=true
```

Do not leave production with only `http://localhost:3000`; browsers will reject
preflight requests from Vercel because the API will answer with the local origin.

## Rules

- `VOICELOG_ALLOWED_ORIGINS` is the only production allowlist for browser origins.
- Use a comma-separated list of exact origins.
- Do not set `VOICELOG_ALLOWED_ORIGINS=*` in production.
- A disallowed origin receives the first configured fallback origin, but it does not receive `Access-Control-Allow-Credentials: true`.
- Vercel preview URLs are blocked in production unless `VOICELOG_ALLOW_VERCEL_PREVIEWS=true`.
- Wildcard Vercel patterns such as `https://*.vercel.app` are honored only when preview access is explicitly enabled.
- Startup logs include a sanitized `[Config] CORS` summary with origin count,
  explicit allowed origins, preview mode and wildcard status. It must not include
  API keys, service-role keys, tokens or secrets.

## Verification

```bash
pnpm exec vitest run -c server/vitest.config.ts server/tests/app-security.test.ts server/tests/serverUtils.test.ts server/tests/config.test.ts --coverage.enabled=false
```

Minimum cases covered by production verification:

- Allowed origin receives the configured origin and credentials.
- Disallowed origin does not receive credentialed wildcard access.
- `VOICELOG_ALLOWED_ORIGINS=*` is rejected for production credentials use.
- Vercel previews are rejected unless `VOICELOG_ALLOW_VERCEL_PREVIEWS=true`.
- `/health`, `/state/bootstrap`, `/integrations/google/status`, `notFound` and
  `onError` preserve CORS headers for the production origin.
- Startup CORS logs are sanitized.
