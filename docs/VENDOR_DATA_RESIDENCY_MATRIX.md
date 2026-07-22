# VoiceLog Vendor and Data Residency Matrix

## Purpose

This register is the source for enterprise provider disclosure, data residency review, and
production readiness checks. It covers external AI, storage, identity, and observability
providers that may receive VoiceLog workspace data when the corresponding feature is enabled.

No provider listed here is enabled by documenting it. Runtime use still depends on the matching
environment variables and application feature flags.

## User-facing disclosure source

User-facing provider disclosure can be derived from the Provider Register table below:

- Provider name
- Data category
- Purpose
- Configuration flag
- Data residency note
- Retention assumption
- Disable or fallback path

The production UI and support runbooks should link this document or generate a shorter customer
notice from the same fields. Secrets must never be copied into customer-facing disclosure.

## Runtime Status Mapping

VoiceLog exposes production provider status through:

- `/api/capabilities` for feature-level readiness and fallback status
- `/health/live` for process liveness used by frontend availability probes
- `/health` for backend build metadata, storage readiness summary, STT policy, and diarization status
- `/ready` for strict production dependency readiness

Capability identifiers used by `/api/capabilities`:

| Capability        | Primary provider mapping                      | Notes                                                                           |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| `stt`             | OpenAI, Groq, or local Whisper                | Reports fallback when the primary STT provider is missing.                      |
| `diarization`     | Hugging Face / pyannote                       | Unavailable when `HF_TOKEN` or `HUGGINGFACE_TOKEN` is missing.                  |
| `meetingAnalysis` | Anthropic or local fallback                   | Requires `VOICELOG_ENABLE_MEETING_ANALYSIS=true` and `ANTHROPIC_API_KEY`.       |
| `supabaseStorage` | Supabase Storage or local filesystem fallback | Production should use Supabase because Railway filesystem storage is ephemeral. |
| `embeddings`      | OpenAI                                        | Requires `OPENAI_API_KEY` or `VOICELOG_OPENAI_API_KEY`.                         |
| `imageGeneration` | Google Gemini                                 | Requires `GEMINI_API_KEY`.                                                      |

## Provider Register

| Provider                | Data category                                                                                           | Purpose                                                                                                   | Configuration flags                                                                                                                                                 | Data residency considerations                                                                                                                         | Retention assumption                                                                                                                                             | Disable or fallback path                                                                                                                                            | Capabilities link                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Supabase                | Workspace records, user/workspace metadata, recording metadata, optional audio object storage           | Persistent database and remote audio storage                                                              | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `VOICELOG_DATABASE_URL`                                                                                | Residency depends on the selected Supabase project region and database/storage region. Confirm the project region before enterprise onboarding.       | VoiceLog retention policy controls workspace data; Supabase stores data until app-level retention/export/delete jobs remove it.                                  | Leave `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` unset for local filesystem fallback. Do not use this fallback for production on Railway.                        | `supabaseStorage`, `/health.supabaseRemote`                                                                                  |
| OpenAI                  | Audio chunks, transcript text, prompts for transcript correction, embeddings input                      | STT, embeddings, fallback diarization from transcript, optional transcript correction/RAG-like operations | `OPENAI_API_KEY`, `VOICELOG_OPENAI_API_KEY`, `VOICELOG_OPENAI_BASE_URL`, `OPENAI_BASE_URL`, `VOICELOG_STT_PROVIDER=openai`, `VOICELOG_STT_FALLBACK_PROVIDER=openai` | Processing region is controlled by the OpenAI account, product tier, and any enterprise data controls configured outside VoiceLog.                    | Provider retention follows the OpenAI account contract. VoiceLog stores returned transcript/embedding-derived outputs under workspace retention.                 | Use Groq or local Whisper for STT where supported. Disable embeddings by leaving OpenAI keys unset.                                                                 | `stt`, `embeddings`                                                                                                          |
| Groq                    | Audio chunks submitted for transcription                                                                | Fast or cost-optimized STT fallback                                                                       | `GROQ_API_KEY`, `VOICELOG_STT_PROVIDER=groq`, `VOICELOG_STT_FALLBACK_PROVIDER=groq`                                                                                 | Processing region follows Groq service terms and account configuration. Confirm enterprise processing location before regulated use.                  | Provider retention follows Groq account terms. VoiceLog stores returned transcript output under workspace retention.                                             | Leave `GROQ_API_KEY` unset and use OpenAI or local Whisper. `/api/capabilities` reports degraded STT fallback when primary OpenAI is missing and Groq is available. | `stt`                                                                                                                        |
| Anthropic               | Transcript text, meeting context, prompts for meeting analysis, coaching, profile, and task suggestions | Meeting analysis and AI assistant features                                                                | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `VOICELOG_ENABLE_MEETING_ANALYSIS`                                                                                          | Processing region follows Anthropic account terms and enterprise data controls. Confirm no-training/data-retention settings for regulated workspaces. | Provider retention follows Anthropic account contract. VoiceLog stores generated summaries/tasks under workspace retention.                                      | Leave `VOICELOG_ENABLE_MEETING_ANALYSIS=false` or omit `ANTHROPIC_API_KEY`; app uses local fallback for meeting analysis where available.                           | `meetingAnalysis`                                                                                                            |
| Hugging Face            | Audio files or audio chunks used by pyannote diarization                                                | Speaker diarization with pyannote                                                                         | `HF_TOKEN`, `HUGGINGFACE_TOKEN`, `DIARIZATION_MODEL`, `VOICELOG_DIARIZER=pyannote                                                                                   | auto`                                                                                                                                                 | Hosted model processing depends on Hugging Face account/model execution path. If the model runs locally after download, verify where model artifacts are cached. | Provider/model artifact retention follows Hugging Face terms and local cache policy. VoiceLog stores speaker labels under workspace retention.                      | Omit `HF_TOKEN` and `HUGGINGFACE_TOKEN`, or set `VOICELOG_DIARIZER=openai` where transcript-based diarization is acceptable. | `diarization` |
| Google Gemini           | Transcript context and generated image/sketchnote prompts                                               | Sketchnote and image generation                                                                           | `GEMINI_API_KEY`                                                                                                                                                    | Processing region follows Google AI/Gemini account settings and terms. Confirm Workspace/Cloud data location commitments separately.                  | Provider retention follows Google account contract. VoiceLog stores generated media metadata and assets under workspace retention.                               | Leave `GEMINI_API_KEY` unset. `/api/capabilities` marks `imageGeneration` unavailable.                                                                              | `imageGeneration`                                                                                                            |
| Google Workspace        | Calendar event metadata, task list metadata, OAuth tokens for user-authorized integrations              | Google Calendar and Google Tasks integrations                                                             | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `GOOGLE_CALENDAR_SCOPES`, `VITE_GOOGLE_CLIENT_ID`, `REACT_APP_GOOGLE_CLIENT_ID`            | Data location depends on the connected Google Workspace account and Google region controls. OAuth consent scope controls what VoiceLog can access.    | VoiceLog stores OAuth integration rows and sync metadata until disconnected or workspace data is deleted. Google retains source Calendar/Tasks data.             | Leave Google OAuth client variables unset or disconnect the integration. Frontend should show integration as not configured/not connected.                          | Not currently represented as a `/api/capabilities` item; check integration status endpoints.                                 |
| Sentry                  | Error events, stack traces, sanitized context, release metadata                                         | Error tracking and crash diagnostics                                                                      | `SENTRY_DSN`, `VITE_SENTRY_DSN`                                                                                                                                     | Event residency depends on Sentry organization region and plan. Do not send transcripts, audio, provider payloads, or secrets.                        | Sentry event retention follows the Sentry organization plan.                                                                                                     | Leave `SENTRY_DSN` and `VITE_SENTRY_DSN` unset. Logger skips Sentry when not configured.                                                                            | Observability only; not a production capability item.                                                                        |
| Datadog                 | Traces, metrics, HTTP route names, process metadata                                                     | APM and backend observability                                                                             | `DD_API_KEY`, `DD_SERVICE`, `DD_ENV`, `DD_APM_ENABLED`                                                                                                              | Telemetry region depends on the Datadog site/account. Avoid raw transcript/audio payloads in traces/logs.                                             | Telemetry retention follows Datadog plan and retention settings.                                                                                                 | Leave `DD_APM_ENABLED=false` or omit `DD_API_KEY`. `/health`, `/health/live`, `/ready`, and `/metrics` are blocklisted from tracing by default.                     | Observability only; not a production capability item.                                                                        |
| New Relic               | Traces, metrics, process metadata, optional logs                                                        | APM and backend observability                                                                             | `NEW_RELIC_LICENSE_KEY`, `NEW_RELIC_APP_NAME`, `NEW_RELIC_ENVIRONMENT`, `NEW_RELIC_ENABLED`                                                                         | Telemetry region depends on the New Relic account and ingest endpoint. Avoid raw transcript/audio payloads in telemetry.                              | Telemetry retention follows New Relic plan and retention settings.                                                                                               | Leave `NEW_RELIC_ENABLED` unset/false or omit `NEW_RELIC_LICENSE_KEY`.                                                                                              | Observability only; not a production capability item.                                                                        |
| OpenTelemetry collector | Traces and span attributes routed to the configured collector                                           | Vendor-neutral tracing export                                                                             | `VOICELOG_OTEL_ENABLED`, `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`                     | Residency depends on the configured OTLP collector and downstream backend. Treat collector selection as a subprocessor decision.                      | Retention is controlled by the downstream collector/backend.                                                                                                     | Keep `VOICELOG_OTEL_ENABLED=false` unless a collector is approved.                                                                                                  | Observability only; not a production capability item.                                                                        |

## Local and Fallback Processing

| Mode                       | Data category                                          | Purpose                                              | Configuration flags                                                              | Residency and retention note                                                                                         | Disable or fallback path                                                                   |
| -------------------------- | ------------------------------------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Local filesystem storage   | Audio files and derived media                          | Development fallback when Supabase is not configured | `VOICELOG_UPLOAD_DIR`, absence of `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`  | Files remain on the running host and may be lost on ephemeral platforms. Not enterprise-production ready on Railway. | Configure Supabase remote storage.                                                         |
| Local Whisper              | Audio chunks                                           | Offline STT fallback                                 | `USE_LOCAL_WHISPER`, `WHISPER_CPP_PATH`, `WHISPER_MODEL_PATH`, `WHISPER_THREADS` | Audio remains on the application host during processing. Model files are local artifacts.                            | Disable `USE_LOCAL_WHISPER` and configure OpenAI or Groq.                                  |
| Browser speech recognition | Microphone audio handled by the browser implementation | Live transcription                                   | Browser support and microphone permission                                        | Residency depends on the browser implementation and user device/browser vendor behavior.                             | Disable live transcription in product configuration or do not grant microphone permission. |

## Recording consent enforcement

The browser disclosure is only a user-interface prompt; it is not the production security
boundary. For every production `POST /media/recordings/:recordingId/transcribe` request, the
backend requires the versioned `recording-consent-v1` metadata with a current acceptance time,
the recording workspace, disclosure title, provider notice, and enabled STT category. The
authenticated user is recorded by the server, not trusted from the request body.

The accepted consent and original actor are stored with the recording. A retry reads that stored
consent; legacy/imported recordings without a valid stored consent return
`recording_consent_invalid` and cannot start or retry transcription until a new consent is
captured. The audit event stores only policy version, timestamp, and provider category IDs—never
audio, transcript text, prompts, or provider payloads.

Development and test environments keep the local workflow compatible with fixtures and do not
enforce the production request gate. They must still exercise the same contract in route tests;
production/Railway is the enforcement boundary.

## Manual Review Checklist

- Confirm every configured provider in Railway/Vercel secrets appears in the Provider Register.
- Confirm every provider row has a clear Disable or fallback path.
- Confirm `/api/capabilities`, `/health`, and `/ready` match the production provider state after deploy.
- Confirm no customer disclosure includes API keys, OAuth client secrets, bearer tokens, raw transcripts, or audio payloads.
- Confirm provider residency and retention statements against the current enterprise contract before regulated deployment.
- Confirm Google OAuth scopes are limited to the required Calendar/Tasks access before enabling integrations.
- Confirm observability integrations scrub request bodies, transcripts, prompts, provider payloads, and secrets.

## Review Cadence

Review this matrix whenever any of these change:

- A new external AI, storage, identity, analytics, or observability provider is added.
- A new environment flag changes where audio, transcripts, prompts, images, or telemetry are sent.
- `/api/capabilities` gains a new capability identifier.
- Production deployment moves to a new Railway, Vercel, Supabase, or observability region.
- Enterprise customer terms require a data processing addendum update.
