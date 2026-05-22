# Twilio Scope Policy

Twilio is currently not a VoiceLog runtime dependency. The Twilio Developer Kit
is available as an optional planning and implementation plugin, but VoiceLog does
not ship Twilio code paths today.

## Current Status

- No Twilio runtime SDK is required by the product.
- No Twilio secrets are required for local development, CI, Vercel, Railway, or
  Supabase smoke.
- Twilio should not block release readiness while it remains out of scope.

## Activation Checklist

If Twilio functionality is added, complete this activation checklist before
release:

- document the Twilio product area and required compliance posture;
- add server-side secret validation without printing values;
- add regression tests for auth, webhooks, retries, and rate limits;
- add production smoke or sandbox smoke for the new integration;
- add Sentry context for Twilio request IDs and sanitized error codes;
- update `docs/tooling/TOOLING_READINESS.md` and the tooling audit evidence.

Until the activation checklist is complete, Twilio remains intentionally
governed as not-applicable rather than partially configured.
