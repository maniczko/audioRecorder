# CodeRabbit Review Gate

CodeRabbit is used as a senior diff reviewer for high-risk changes. It is not a
replacement for tests, Sentry, or production smoke.

## Review Required

Request CodeRabbit review for changes touching:

- audio pipeline, recorder queue, upload, transcription, diarization, or STT;
- Studio, voice profiles, speaker assignment, or transcript interactions;
- media routes, auth/workspace guards, Supabase storage, or costly AI calls;
- Sentry, release scripts, GitHub Actions, Vercel, Railway, or Playwright smoke;
- design-system rules, UI action inventory, or visual baselines.

## Required Evidence

Every reviewed PR should include:

- test red/green evidence for bug fixes;
- targeted test command and result;
- release gate command and result when production-impacting;
- production smoke/Sentry evidence when deployed;
- risk notes for any deferred P1/P2.

## Escalation

If CodeRabbit flags a possible runtime regression, treat it as a required
investigation item until one of these is true:

- the finding is fixed and covered by a regression test;
- the finding is disproved with code evidence and a targeted test;
- the finding is converted into a GitHub issue with owner, due date, and release
  impact.
