# Costly Endpoints Security Audit

Date: 2026-06-20

Scope: server routes that can trigger LLM, STT, image generation, voice embedding, RAG answer generation, transcription, diarization, coaching or meeting analysis costs.

## Summary

All reviewed costly HTTP endpoints require authentication before invoking downstream costly work. Workspace-scoped endpoints run behind route-level auth and validate workspace membership before invoking STT, LLM, RAG, image, diarization or embedding work.

Validation evidence:

- `pnpm exec vitest run -c server/vitest.config.ts server/tests/routes/costly-endpoints-auth.test.ts --coverage.enabled=false` - covers anonymous `401`, no-membership `403`, and RAG `429` rate-limit behavior.
- `pnpm exec vitest run -c server/vitest.config.ts server/tests/lib/aiQuotaStore.test.ts server/tests/routes/ai.test.ts --coverage.enabled=false`
- `pnpm run test:server:retry`
- `pnpm run typecheck:all`

## Reviewed Endpoint Inventory

| Endpoint                                               | Cost surface                       | Auth                                   | Workspace check                                                | Rate/quota                              | Test evidence                                       |
| ------------------------------------------------------ | ---------------------------------- | -------------------------------------- | -------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------- |
| `POST /ai/person-profile`                              | Anthropic profile analysis         | `authMiddleware` on `/ai/*`            | body/session workspace via `ensureWorkspaceAccess` when scoped | `AiQuotaStore` + route rate limit       | `server/tests/routes/ai.test.ts`                    |
| `POST /ai/suggest-tasks`                               | Anthropic task extraction          | `authMiddleware` on `/ai/*`            | body/session workspace via `ensureWorkspaceAccess` when scoped | `AiQuotaStore` + route rate limit       | `server/tests/routes/ai.test.ts`                    |
| `POST /ai/search`                                      | Anthropic semantic ranking         | `authMiddleware` on `/ai/*`            | body/session workspace via `ensureWorkspaceAccess` when scoped | `AiQuotaStore` + route rate limit       | `server/tests/routes/ai.test.ts`                    |
| `POST /media/recordings/:recordingId/transcribe`       | STT/transcription pipeline         | route-level `/media/recordings/*` auth | handler validates workspace before queueing                    | media rate limits/pipeline backoff      | `server/tests/routes/costly-endpoints-auth.test.ts` |
| `POST /media/recordings/:recordingId/retry-transcribe` | STT retry                          | route-level `/media/recordings/*` auth | handler validates workspace before retry                       | media rate limits/pipeline backoff      | `server/tests/routes/costly-endpoints-auth.test.ts` |
| `POST /media/recordings/:recordingId/voice-coaching`   | AI voice coaching                  | route-level `/media/recordings/*` auth | recording/workspace ownership via media asset lookup           | media route controls                    | `server/tests/routes/costly-endpoints-auth.test.ts` |
| `POST /media/recordings/:recordingId/rediarize`        | diarization/GPT speaker assignment | route-level `/media/recordings/*` auth | recording/workspace ownership via media asset lookup           | media route controls                    | `server/tests/routes/costly-endpoints-auth.test.ts` |
| `POST /media/recordings/:recordingId/sketchnote`       | Gemini image generation            | route-level `/media/recordings/*` auth | recording/workspace ownership via media asset lookup           | media route controls + provider retry   | `server/tests/routes/costly-endpoints-auth.test.ts` |
| `POST /media/analyze`                                  | OpenAI meeting analysis            | explicit `authMiddleware`              | explicit `ensureWorkspaceAccess`                               | `applyRateLimit('analyze', 10)`         | `server/tests/routes/costly-endpoints-auth.test.ts` |
| `POST /transcribe/live`                                | live STT chunk                     | explicit `authMiddleware`              | session workspace via `ensureWorkspaceAccess` before body read | `applyRateLimit('live-transcribe', 60)` | `server/tests/routes/costly-endpoints-auth.test.ts` |
| `POST /workspaces/:workspaceId/rag/ask`                | RAG LLM answer                     | route-level `/workspaces/*` auth       | explicit `ensureWorkspaceAccess`                               | `applyRateLimit('rag-ask', 10)`         | `server/tests/routes/costly-endpoints-auth.test.ts` |
| `POST /voice-profiles`                                 | voice embedding/enrollment         | route-level `/voice-profiles` auth     | session workspace via `ensureWorkspaceAccess` before body read | `applyRateLimit('voice-profiles')`      | `server/tests/routes/costly-endpoints-auth.test.ts` |

## Grep Evidence

Search terms used:

- `ANTHROPIC`
- `OPENAI`
- `VOICELOG_OPENAI`
- `Groq`
- `GROQ`
- `transcribe`
- `diarization`
- `analyzeMeetingWithOpenAI`
- `generateVoiceCoaching`
- `ChatOpenAI`
- `ChatGoogle`
- `fetch(`

Relevant registered HTTP routes are in:

- `server/http/app-routes.ts`
- `server/routes/ai.ts`
- `server/routes/media.ts`
- `server/routes/workspaces.ts`

Non-route provider code such as `server/agents/dispatcher.ts`, `server/pipeline.ts`, `server/diarization.ts`, `server/lib/ragAnswer.ts` is only reachable through the reviewed route/service surfaces above or through internal tests.

## Residual Follow-Up

- Add per-endpoint persistent quota to non-`/ai` costly surfaces if product usage grows beyond current route-level rate limits.
- Consider a shared `costlyOperationGuard` helper so future STT/LLM/image routes cannot be registered without auth, membership and quota metadata.
