# Production smoke scenarios

## SMOKE-001 — Health, auth, upload, processing, persistence, download, and delete

### Metadata

- Area: Production release / exact deployed business journey
- Priority: P0
- Type: S + E2E
- Status: ready
- Automation: partial and currently blocked by production configuration
- Target tests and commands:
  - `tests/e2e/production-system-audit.spec.js`
  - `tests/e2e/production-persistence.spec.js`
  - `pnpm run release:prod-smoke:strict`
  - `pnpm run release:audio-prod-smoke`

### Goal

Verify the complete VoiceLog production journey against the exact deployed frontend and backend Git SHA. A successful deployment or `/health` response alone is not sufficient.

The smoke must prove:

```text
health/readiness
→ authentication
→ workspace bootstrap
→ deterministic audio upload
→ transcription job
→ terminal result
→ browser reload
→ recording persistence
→ audio download
→ retry/idempotency
→ delete
→ database and storage cleanup
```

### Environments

- Staging or sandbox for initial validation
- Production release candidate after all P0 dependencies are satisfied

Never execute this scenario against an uncontrolled personal workspace or real customer recording.

### Required configuration

- `PRODUCTION_FRONTEND_URL`
- `PRODUCTION_API_BASE_URL`
- dedicated smoke account or `PRODUCTION_SMOKE_AUTH_TOKEN`
- `PRODUCTION_SMOKE_WORKSPACE_ID`
- expected frontend Git SHA
- expected backend Git SHA
- deterministic synthetic audio fixture
- storage bucket configured for production use
- cleanup permission

Missing required configuration must produce `FAIL`, not `SKIP`, in a required release workflow.

### Viewports

- Browser business-path confirmation: `1440x900`
- Mobile post-processing confirmation: `390x844`

### Test data

- Workspace dedicated to release smoke
- Unique run prefix: `qa_prod_smoke_<sha>_<timestamp>`
- Synthetic fixture duration: 3–15 seconds
- Fixture contains no private speech
- Expected transcript may be deterministic text or a controlled empty outcome, depending on provider fixture design

### Preconditions

1. The frontend and backend deployments are complete.
2. Their reported build identities match the expected release SHA.
3. Production PostgreSQL is active; SQLite fallback is impossible.
4. Required persistent storage reports ready.
5. The smoke account has only the permissions needed for the test.
6. Recording consent metadata can be supplied and persisted.
7. All created data can be identified and removed safely.
8. No active release-blocking monitoring incident is being ignored.

### Steps

#### A. Deployment and readiness

1. Record the expected release SHA.
2. Request `/health/live` and confirm `200`.
3. Request `/health` and confirm database connectivity and remote storage mode.
4. Request `/ready` and confirm release readiness returns `200` and `status=ready`.
5. Confirm health/readiness responses identify active adapters/providers without exposing URLs, credentials, or tokens.
6. Confirm frontend and backend build metadata match the expected SHA.

#### B. Authentication and workspace

7. Authenticate using the dedicated smoke account or configured token.
8. Confirm `/auth/session` resolves exactly one user identity and the intended smoke workspace.
9. Bootstrap the workspace state.
10. Confirm no unexpected `4xx`/`5xx` occurs and no foreign workspace data is visible.
11. Open the deployed frontend with the smoke session.
12. Confirm the main shell and all core tabs load without runtime errors.

#### C. Create meeting and consent

13. Create or select a dedicated smoke meeting with the unique run prefix.
14. Confirm the meeting belongs to the intended workspace.
15. Record valid, current, versioned recording consent for the smoke run.
16. Confirm consent is associated with the actor, workspace, and recording path.

#### D. Upload and processing

17. Upload the deterministic audio fixture.
18. Confirm exactly one media/recording identifier is returned.
19. Confirm the storage operation uses the production remote adapter.
20. Where practical, execute both single-object and segmented/chunked upload contracts.
21. Finalize upload exactly once.
22. Start transcription exactly once.
23. Poll status with bounded retry until `done`, controlled `empty`, or explicit failure.
24. Confirm queued/processing states are observable and do not masquerade as final no-transcript state.
25. Record request IDs, durations, retry counts, and terminal status without capturing transcript/audio contents.

#### E. Result and persistence

26. For `done`, confirm transcript metadata and the expected result shape exist.
27. For controlled `empty`, confirm the result is explicitly classified as empty rather than failed.
28. Confirm the meeting and recording are visible in Nagrania and open correctly in Studio.
29. Reload the browser.
30. Re-bootstrap workspace state.
31. Confirm the same meeting, recording, terminal status, and transcript metadata remain visible.
32. Restart or redeploy the backend when this is the dedicated persistence rehearsal.
33. Repeat health/readiness checks after restart.
34. Confirm the recording and transcript metadata still exist.

#### F. Download and idempotency

35. Download the stored audio using the authorized API/UI.
36. Confirm success, non-zero content, expected content type, and no local-filesystem fallback.
37. Request transcription/retry for the already queued, processing, or completed recording according to the test fixture.
38. Confirm the API returns the existing job/result or one controlled replay path.
39. Confirm no duplicate storage object, recording row, meeting, or transcription job is created.

#### G. Delete and cleanup

40. Delete the QA recording through the supported product/API path.
41. Confirm database metadata is removed or tombstoned according to policy.
42. Confirm the remote storage object is removed.
43. Reload and bootstrap again.
44. Confirm the deleted item does not return.
45. Confirm audit events exist for create/process/delete without raw audio, transcript, prompt, or token content.
46. Delete the temporary QA meeting when safe.
47. Verify that no smoke-prefixed orphan data remains.

#### H. Browser and operational checks

48. Inspect console errors and unexpected failed network responses.
49. Confirm the production capability banner matches actual provider/storage state.
50. Open the resulting state at `390x844` and confirm critical status/recovery UI is usable.
51. Generate a redacted JSON and Markdown report linked to the exact SHA.
52. Retain the report, Playwright trace, screenshots, and cleanup result as release artifacts.

### Expected result

- Health, readiness, and build identity match the release candidate.
- Authentication and workspace bootstrap succeed.
- One deterministic audio fixture creates one durable recording path.
- Upload, transcription, reload, download, retry/idempotency, and delete all succeed.
- The recording survives browser refresh and backend restart/redeploy before deletion.
- Production uses PostgreSQL and remote durable storage only.
- Controlled empty transcript is not treated as pipeline failure.
- Missing configuration fails the required release gate.
- No duplicate meeting, recording, storage object, or job exists.
- Cleanup is complete and verified.
- Reports contain no credentials, raw audio, raw transcript, or provider payload.
- No unexpected browser exception or `5xx` remains unexplained.

### Evidence

The release artifact must include:

- expected and observed frontend/backend SHA,
- environment and URLs without secrets,
- step-by-step PASS/FAIL status,
- request IDs and durations,
- smoke workspace/meeting/recording identifiers,
- terminal pipeline status,
- persistence confirmation after reload/restart,
- download byte count and content type,
- duplicate-count assertions,
- deletion and storage-cleanup result,
- sanitized console/network errors,
- screenshots for Studio/Nagrania desktop and mobile,
- Playwright trace/video on failure.

### Cleanup

1. Delete every object created with the smoke prefix.
2. Confirm database, workspace state, queue, transcription jobs, and storage contain no uncontrolled smoke data.
3. Revoke temporary sessions/tokens where applicable.
4. Never leave a production smoke run in a retrying or processing state.

### Failure follow-up

A failure is release-blocking. Create or update a P0 issue containing:

- `SMOKE-001`,
- failed step number,
- expected and deployed SHA,
- environment,
- sanitized request IDs/statuses,
- persistence and cleanup state,
- artifact links,
- owner and next action.

Do not approve public production while any SMOKE-001 step is failed, skipped, or blocked.

### Exit rule

Before public rollout, this scenario must pass three consecutive release-candidate executions with complete cleanup and no unexplained active monitoring issue.
