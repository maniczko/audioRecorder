# Security & Code Quality Audit Report

**Date:** 2026-03-17
**Auditor:** Principal Security & Software Engineer (AI-assisted)
**Scope:** Full repository audit — server + frontend

---

## Files Audited

| File | Lines | Status |
|------|-------|--------|
| `server/index.js` | 688 | Fixed |
| `server/database.js` | 1076 | Fixed |
| `server/audioPipeline.js` | ~1150 | Fixed |
| `server/speakerEmbedder.js` | 119 | No issues |
| `server/diarize.py` | — | Not audited (Python) |
| `src/services/httpClient.js` | 77 | No issues |
| `src/services/mediaService.js` | 154 | No issues |
| `src/services/authService.js` | 91 | No issues |
| `src/services/config.js` | 11 | No issues |
| `src/hooks/useMeetings.js` | ~600 | No issues |
| `src/MainApp.js` | 400+ | No issues |
| `src/lib/diarization.js` | 301 | No issues |
| `src/lib/speakerAnalysis.js` | 89 | No issues |
| `src/lib/auth.js` | 383 | No issues |
| `src/NotesTab.js` | — | DOMPurify used correctly |
| `.env` / `.env.example` | — | See CRITICAL finding |
| `package.json` | 52 | No issues |
| `.gitignore` | — | .env correctly excluded |

---

## Vulnerabilities Found & Fixed

### CRITICAL

#### C-01: Real API keys committed in `.env` (Needs Human Intervention)
- **File:** `.env`
- **Severity:** CRITICAL
- **Description:** The `.env` file contains live credentials:
  - `OPENAI_API_KEY=sk-proj-__lXxhENNN...` — real OpenAI API key
  - `SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...` — real Supabase service role JWT (admin-level access)
  - `SUPABASE_URL=https://tdikvnyrdpudlefjtqty.supabase.co` — real Supabase project URL
- **Risk:** If these keys were ever committed to version control (before `.gitignore` was set), they would be permanently in git history and potentially exposed. The OpenAI key can be used to run up large API bills. The Supabase service role key grants full database admin access.
- **Status:** Needs Human Intervention
- **Action required:**
  1. **Immediately rotate the OpenAI API key** at https://platform.openai.com/api-keys
  2. **Immediately rotate the Supabase service role key** in the Supabase dashboard
  3. Verify these keys never appeared in git history: `git log --all --oneline -- .env` and `git grep "sk-proj-" $(git log --all --oneline | awk '{print $1}')`
  4. If found in history, use `git filter-repo` or contact GitHub support for secret scanning
- **Note:** `.env` is correctly listed in `.gitignore`. No hardcoded secrets were found in `.js` source files.

---

### HIGH

#### H-01: Unbounded request body size — Denial of Service (Fixed)
- **File:** `server/index.js`
- **Severity:** HIGH
- **Description:** `readBinaryBody()` and `readRawBody()` collected all incoming data with no size limit. A malicious client could send a multi-GB request, exhausting server memory (OOM) and crashing the process. `readJsonBody()` had the same issue.
- **Fix:** Added a 100 MB cap on binary bodies and a 1 MB cap on JSON bodies. Requests exceeding the limit are rejected with HTTP 413 and the socket is destroyed.
- **Status:** Fixed

#### H-02: Rate limiting bypass via X-Forwarded-For header spoofing (Fixed)
- **File:** `server/index.js` lines 273-275
- **Severity:** HIGH
- **Description:** `clientIp` was derived from `request.headers["x-forwarded-for"]` unconditionally. An attacker can set arbitrary values in this header (e.g. `X-Forwarded-For: 1.2.3.4`) to bypass rate limiting by rotating through fake IPs.
- **Fix:** The socket's real IP is used by default. `X-Forwarded-For` is only trusted when `VOICELOG_TRUST_PROXY=true` is explicitly set in the environment (for deployments behind a real reverse proxy).
- **Status:** Fixed

#### H-03: Path traversal in media file upload (Fixed)
- **File:** `server/database.js` `upsertMediaAsset()`
- **Severity:** HIGH
- **Description:** The `recordingId` extracted from the URL (`[^/]+` regex) was used directly as a filename component via `path.join(UPLOAD_DIR, \`${recordingId}${extension}\`)`. Although `[^/]+` blocks forward slashes, on Windows the ID could contain `..` combined with backslashes or other special characters that `path.join` normalizes into a path traversal. Example: `recordingId = "..\\..\\server\\index"` could write outside UPLOAD_DIR.
- **Fix:** `recordingId` is sanitized with `/[^a-zA-Z0-9_-]/g` before use as a filename. A `path.resolve()` + `startsWith(UPLOAD_DIR)` guard is added as defence-in-depth.
- **Status:** Fixed

#### H-04: Health endpoint leaks server filesystem paths (Fixed)
- **File:** `server/database.js` `getHealth()`, `server/index.js` `/health` route
- **Severity:** HIGH (Information Disclosure)
- **Description:** The unauthenticated `/health` endpoint returned `dbPath` (full filesystem path to SQLite database) and `uploadDir` (full path to upload directory). This information is valuable to an attacker for planning further attacks (e.g., path traversal exploitation, understanding server layout).
- **Fix:** Removed `dbPath` and `uploadDir` from the health response. The endpoint now returns only `{ ok: true }`.
- **Status:** Fixed

---

### MEDIUM

#### M-01: Username/email enumeration via password reset (Fixed)
- **File:** `server/database.js` `requestPasswordReset()`
- **Severity:** MEDIUM
- **Description:** The function threw distinct errors: "Nie znaleziono konta z takim adresem" when no account existed vs. "To konto korzysta z logowania Google" when it did exist but used OAuth. This allowed an attacker to enumerate valid email addresses by observing the error response.
- **Fix:** Both non-existent accounts and Google-only accounts now return the same generic success response `{ expiresAt }` without revealing account existence. The reset code is only written for accounts with a password hash.
- **Status:** Fixed

#### M-02: Missing rate limiting on expensive API endpoints (Fixed)
- **File:** `server/index.js`
- **Severity:** MEDIUM
- **Description:** `POST /voice-profiles` (triggers ML embedding computation + file write) and `POST /transcribe/live` (calls OpenAI API per request) had no rate limiting. An authenticated attacker could abuse these to exhaust OpenAI API credits or saturate server CPU.
- **Fix:** Both endpoints now call `checkRateLimit(clientIp, route)` before processing, applying the same 10 req/min per IP policy used for auth routes.
- **Status:** Fixed

#### M-03: Reflected content_type header without sanitization (Fixed)
- **File:** `server/index.js` — `GET /media/recordings/:id/audio`
- **Severity:** MEDIUM
- **Description:** The `content_type` field stored in the database was reflected verbatim in the `Content-Type` response header: `"Content-Type": asset.content_type`. If an attacker uploaded a file with a crafted `content_type` (e.g. `text/html`) or if the database was compromised, arbitrary content types could be injected into responses. This combined with missing `Content-Disposition` header could enable stored XSS via audio endpoint.
- **Fix:** Added an allowlist of valid audio MIME types. Any value not in the allowlist falls back to `application/octet-stream`. Added `Content-Disposition: attachment` header. Applied `securityHeaders()` to the streaming response (previously missing).
- **Status:** Fixed

#### M-04: Missing body size limit on JSON payloads — JSON bomb (Fixed)
- **File:** `server/index.js` `readJsonBody()`
- **Severity:** MEDIUM
- **Description:** `readJsonBody()` had no size limit, enabling a JSON bomb attack: a deeply nested JSON structure that is small on the wire (e.g., 1KB gzipped) but expands to gigabytes in memory during `JSON.parse()`.
- **Fix:** Added a 1 MB limit before attempting parse. Requests exceeding the limit return HTTP 413.
- **Status:** Fixed

#### M-05: SSRF via VOICELOG_OPENAI_BASE_URL misconfiguration (Fixed)
- **File:** `server/audioPipeline.js`
- **Severity:** MEDIUM
- **Description:** `VOICELOG_OPENAI_BASE_URL` is used as the base URL for all OpenAI API calls. If misconfigured or overridden to point to an internal service (e.g. `http://169.254.169.254/` for AWS IMDS, or `http://internal-db:5432/`), the server would act as an SSRF proxy. This is an env-var risk, not a direct user-input risk, but deserves validation at startup.
- **Fix:** Added a validation function that checks the configured URL is either `https://` or `http://localhost`/`127.0.0.1`. Invalid values log a warning (server still starts with the configured URL to avoid service disruption, but operators are alerted).
- **Status:** Fixed

#### M-06: Overly long speaker name via X-Speaker-Name header (Fixed)
- **File:** `server/index.js` — `POST /voice-profiles`
- **Severity:** MEDIUM (Low-effort DoS / data storage abuse)
- **Description:** The `X-Speaker-Name` header value was accepted without length validation. An attacker could send a multi-MB speaker name, wasting database storage.
- **Fix:** Header value is now capped at 120 characters via `.slice(0, 120)`.
- **Status:** Fixed

---

### LOW

#### L-01: N+1 database queries in buildWorkspaceFromRow (Fixed)
- **File:** `server/database.js`
- **Severity:** LOW (Performance / reliability)
- **Description:** `buildWorkspaceFromRow()` executed 3 separate `SELECT` queries per workspace (memberIds, memberRoles, membership). Called via `accessibleWorkspaces()` which loops over all workspaces for a user — this produces 3N+1 queries for a user with N workspaces.
- **Fix:** Collapsed the 3 queries into 1 (`SELECT user_id, member_role FROM workspace_members WHERE workspace_id = ?`). The membership for `currentUserId` is derived in-memory from the single result set.
- **Status:** Fixed

#### L-02: readBinaryBody and readRawBody are functionally identical (Code Quality)
- **File:** `server/index.js`
- **Severity:** LOW (DRY violation)
- **Description:** `readBinaryBody` and `readRawBody` were byte-for-byte identical functions. After the size-limit fix, they remain identical (same implementation, same default limit).
- **Fix:** Not merged — the semantic distinction (binary audio vs. raw profile audio) is useful for future differentiation (e.g., different size limits). Both functions now share the size-limit logic. No code change beyond the size-limit fix.
- **Status:** Acknowledged, not merged (intentional)

---

## Items Requiring Human Intervention

| ID | Description | Action |
|----|-------------|--------|
| C-01 | Live OpenAI API key in `.env` | Rotate at https://platform.openai.com/api-keys |
| C-01 | Live Supabase service role key in `.env` | Rotate in Supabase dashboard |
| C-01 | Verify keys never in git history | `git log --all -- .env` + `git grep` |

---

## Summary of Changes

### `server/index.js`
- Added `MAX_JSON_BODY_BYTES = 1MB` constant and size-enforcement in `readJsonBody()`
- Added `MAX_BINARY_BODY_BYTES = 100MB` constant and size-enforcement in `readBinaryBody()` and `readRawBody()`
- Fixed IP extraction in `handleRequest` to use socket IP by default; respects `VOICELOG_TRUST_PROXY=true`
- Added `checkRateLimit()` to `POST /voice-profiles` and `POST /transcribe/live`
- Added speaker name length cap (120 chars) on `X-Speaker-Name` header
- Added MIME type allowlist + `Content-Disposition: attachment` + `securityHeaders()` to audio file GET response

### `server/database.js`
- Removed `dbPath` and `uploadDir` from `getHealth()` response
- Fixed `requestPasswordReset()` to return generic response regardless of account existence (prevents email enumeration)
- Added `recordingId` sanitization and path confinement check in `upsertMediaAsset()`
- Collapsed 3-query N+1 pattern in `buildWorkspaceFromRow()` into 1 query

### `server/audioPipeline.js`
- Added startup validation of `VOICELOG_OPENAI_BASE_URL` to prevent SSRF misconfiguration

---

## Build Verification

`npm run build` completed successfully after all fixes:

```
Compiled successfully.
160.77 kB  build/static/js/main.7537957a.js
```

`node --check` passed on all three server files.
