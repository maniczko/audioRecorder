# Security Key Management and Secret Rotation Runbook

## Purpose

This runbook defines the VoiceLog secret inventory, Rotation procedure, Encryption assumptions,
and Emergency rotation checklist for production and enterprise readiness.

Secrets must live only in approved secret stores:

- GitHub Actions secrets
- Railway service variables
- Vercel project variables
- Supabase dashboard or database connection secret store
- Provider dashboards for AI, observability, and OAuth credentials

Do not commit production credentials to Git, issue comments, PR descriptions, logs, screenshots, or
customer evidence bundles.

## Secret inventory

| Category              | Production secrets                                                                                                         | Primary store                                 | Consumers                                                      | Rotation trigger                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| Backend admin and ops | `VOICELOG_ADMIN_TOKEN`, production smoke tokens                                                                            | GitHub Actions, Railway                       | Admin endpoints, production smoke, ops scripts                 | Suspected exposure, staff change, quarterly review                |
| Database              | `DATABASE_URL`, `VOICELOG_DATABASE_URL`                                                                                    | Railway, GitHub Actions, Supabase             | Backend API, migrations, production smoke                      | Supabase password rotation, incident, environment rebuild         |
| Supabase              | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`                                                                                | Railway, GitHub Actions, Vercel smoke secrets | Remote audio storage, workspace verification, production smoke | Any service-role exposure, bucket policy change, quarterly review |
| OpenAI                | `OPENAI_API_KEY`, `VOICELOG_OPENAI_API_KEY`, `VOICELOG_OPENAI_BASE_URL`                                                    | Railway, GitHub Actions                       | STT, embeddings, RAG-like operations                           | Provider rotation, usage anomaly, employee/vendor access change   |
| Groq                  | `GROQ_API_KEY`                                                                                                             | Railway, GitHub Actions                       | STT fallback or fast STT                                       | Usage anomaly, provider rotation, access change                   |
| Anthropic             | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`                                                                                     | Railway, GitHub Actions                       | Meeting analysis and AI assistant features                     | Usage anomaly, model/provider access change                       |
| Hugging Face          | `HF_TOKEN`, `HUGGINGFACE_TOKEN`                                                                                            | Railway, GitHub Actions                       | Pyannote diarization                                           | Model access change, token scope change, incident                 |
| Google OAuth          | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `GOOGLE_CALENDAR_SCOPES`, `VITE_GOOGLE_CLIENT_ID` | Google Cloud, Railway, Vercel, GitHub Actions | Google Calendar and Google Tasks integrations                  | OAuth client exposure, redirect URI change, consent scope change  |
| Vercel                | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, frontend env vars                                                    | GitHub Actions, Vercel                        | Production deploy workflow and frontend runtime                | Token owner change, failed deploy audit, incident                 |
| Railway               | `RAILWAY_TOKEN`, `RAILWAY_SERVICE_ID`                                                                                      | GitHub Actions, Railway                       | Railway sync and deployment metadata workflows                 | Token owner change, Railway project/service change, incident      |
| Sentry                | `SENTRY_DSN`, `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`                                       | GitHub Actions, Railway, Vercel, Sentry       | Error reporting and release health                             | DSN leak, auth token exposure, org/project move                   |
| Datadog               | `DD_API_KEY`, `DD_SERVICE`, `DD_ENV`, `DD_APM_ENABLED`                                                                     | Railway, Datadog                              | APM and trace ingestion                                        | API key exposure, Datadog site/account move                       |
| New Relic             | `NEW_RELIC_LICENSE_KEY`, `NEW_RELIC_APP_NAME`, `NEW_RELIC_ENVIRONMENT`, `NEW_RELIC_ENABLED`                                | Railway, New Relic                            | APM and telemetry                                              | License key exposure, account move                                |
| OpenTelemetry         | `VOICELOG_OTEL_ENABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`                                       | Railway, collector secret store               | Trace export to an approved collector                          | Collector migration, header/token exposure                        |
| Email and digest      | `VOICELOG_SMTP_HOST`, `VOICELOG_SMTP_USER`, `VOICELOG_SMTP_PASS`                                                           | Railway or mail provider                      | Digest and notification email                                  | SMTP credential exposure, provider account change                 |

## Rotation procedure

Use this procedure for each production secret category.

1. Identify affected environments: GitHub Actions, Railway, Vercel, Supabase, and provider
   dashboards.
2. Create the replacement secret in the provider dashboard with minimum required scope.
3. Add the replacement secret to the target secret store without deleting the old secret.
4. Deploy or restart the affected service.
5. Verify health:
   - `/health`
   - `/api/capabilities`
   - production smoke workflow relevant to the provider
   - provider dashboard usage/ingest logs
6. Revoke the old secret only after the new secret is confirmed active.
7. Record the rotation in the release or incident notes with:
   - date and time
   - rotated category
   - owner
   - environments updated
   - verification evidence links

### Provider-specific notes

- Supabase: rotate database password and service role separately. Verify storage bucket access
  after service-role rotation.
- OpenAI, Groq, Anthropic, Hugging Face: verify quota dashboards after rotation and ensure no
  frontend bundle contains backend-only keys.
- Google OAuth: update allowed JavaScript origins and redirect URIs before replacing client
  secrets in Railway/Vercel.
- Sentry, Datadog, New Relic, OpenTelemetry: verify telemetry ingestion without sending raw
  transcript, audio, prompt, provider payload, or bearer token data.
- Vercel and Railway: rotate deploy tokens from the owning account and update GitHub Actions
  secrets before rerunning deployment workflows.

## Encryption assumptions

| Surface                | Assumption                                                                                          | Required operator check                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Database at rest       | PostgreSQL/Supabase managed storage encryption is provided by the hosting platform.                 | Confirm the Supabase project and Railway Postgres region and encryption posture before enterprise onboarding. |
| Supabase Storage       | Object storage encryption is managed by Supabase/storage provider.                                  | Confirm bucket privacy, signed URL policy, and service-role access.                                           |
| Backups                | Backup encryption and retention are provider-managed unless a separate backup system is configured. | Confirm backup region, retention window, restore access, and deletion policy.                                 |
| Local development data | Local SQLite files, downloaded audio, and debug exports are not assumed encrypted.                  | Developers must keep local workstations encrypted and avoid real customer data locally.                       |
| CI artifacts           | GitHub Actions artifacts are not a secret store.                                                    | Do not upload `.env`, audio, transcripts, provider payloads, or secret-bearing logs.                          |
| Logs and telemetry     | Structured logging and Sentry/trace sanitizers must redact tokens and content-like payloads.        | Verify redaction tests and inspect sample production events after provider changes.                           |

## Emergency rotation checklist

Use this checklist when a credential may have been exposed.

1. Freeze automation that could reuse the exposed credential.
2. Identify the secret category, owner, environments, and last known good deploy.
3. Revoke or disable the exposed credential in the provider dashboard.
4. Create a replacement with minimum required scope.
5. Update GitHub Actions, Railway, Vercel, Supabase, and provider secret stores as needed.
6. Redeploy or restart affected services.
7. Verify `/health`, `/api/capabilities`, production smoke, and provider usage dashboards.
8. Search recent logs and audit events for unexpected use.
9. Rotate downstream credentials if the exposed secret could access them.
10. Open or update the incident issue with evidence, impact, and follow-up hardening tasks.

## Repository guard

`node scripts/validate-secret-hygiene.mjs` scans tracked text files for high-confidence secret
literals such as OpenAI, Anthropic, Groq, Hugging Face, GitHub PAT, Google OAuth client secret, and
Supabase service-role JWT formats.

The guard allows obvious placeholders, dummy CI values, and test fixtures. It is part of
`pnpm run audit:repo-hygiene`, so CI and local release checks can block accidental secret commits.

## Documentation review checklist

- Secret inventory includes backend, frontend, CI, Railway, Vercel, Supabase, AI providers, and
  observability tools.
- Rotation procedure exists for every production secret category.
- Emergency rotation checklist has an owner, verification steps, and incident evidence step.
- Encryption assumptions cover database, Supabase Storage, backups, local development, CI
  artifacts, and telemetry.
- Repository guard is run before release and blocks obvious secret leaks.
