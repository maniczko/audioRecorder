# Production CORS configuration

VoiceLog production must never use wildcard CORS with credentials.

## Environment variables

```bash
VOICELOG_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
VOICELOG_ALLOW_VERCEL_PREVIEWS=false
```

## Current VoiceLog Vercel/Railway setup

If the frontend is served from the Vercel preview deployment used by the main
branch, Railway must include that exact origin:

```bash
VOICELOG_ALLOWED_ORIGINS=https://audiorecorder-git-main-iwoczajka-2703s-projects.vercel.app
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

## Verification

```bash
pnpm exec vitest run -c server/vitest.config.ts server/tests/app-security.test.ts server/tests/serverUtils.test.ts --coverage.enabled=false
```

Minimum cases covered by production verification:

- Allowed origin receives the configured origin and credentials.
- Disallowed origin does not receive credentialed wildcard access.
- `VOICELOG_ALLOWED_ORIGINS=*` is rejected for production credentials use.
- Vercel previews are rejected unless `VOICELOG_ALLOW_VERCEL_PREVIEWS=true`.
