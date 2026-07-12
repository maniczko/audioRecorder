# Backup And Restore Runbook

Issue #1247 establishes the minimum business-continuity path for VoiceLog data. The restore drill must use staging or sandbox resources by default; production restore verification is break-glass only.

## Backup Sources

| Source                       | What to capture                                                                                                   | Minimum frequency                                         | Owner            | Restore evidence                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------- | ------------------------------------------------------------ |
| Postgres / Supabase database | `workspace_state`, `media_assets`, auth-linked workspace metadata, audit logs, task data, transcription job state | Daily automated backup plus pre-migration snapshot        | Platform owner   | Restored workspace id, row counts, schema migration version  |
| Supabase Storage             | Recording objects in the `recordings` bucket or configured bucket                                                 | Daily object backup or provider-managed storage retention | Platform owner   | Signed URL or object existence check for restored recordings |
| Environment configuration    | Railway, Vercel, Supabase, Google, AI provider, Sentry, and scheduled job variables                               | On every config change and before release                 | Release owner    | Redacted env export checksum and change ticket               |
| Deployment metadata          | Git SHA, Railway deploy id, Vercel deployment id, migration set, build id                                         | Every deployment                                          | Release owner    | Matching Git SHA and deployment links                        |
| Operational docs             | Runbooks, incident contacts, restore checklist, decision log                                                      | On every process change                                   | Engineering lead | PR link and runbook version                                  |

Never store secrets, service-role keys, raw audio, transcripts, or database dumps in GitHub issues, PRs, or artifacts. Artifacts from restore verification should contain only structured health results and identifiers needed for follow-up.

## Restore Drill Checklist

Use this checklist for monthly drills and after any backup tooling change.

1. Create or refresh an isolated staging/sandbox Supabase project.
2. Restore the latest approved Postgres backup into the staging/sandbox database.
3. Restore the matching Supabase Storage objects into the staging/sandbox storage bucket.
4. Apply any pending migrations that are part of the target release.
5. Configure staging app secrets from the redacted environment manifest.
6. Set these GitHub secrets for the restore verification workflow:
   - `STAGING_SUPABASE_URL`
   - `STAGING_SUPABASE_SERVICE_ROLE_KEY`
   - `RESTORE_VERIFY_WORKSPACE_ID`
   - optional `RESTORE_VERIFY_EXPECTED_RECORDING_IDS`
   - optional `RESTORE_VERIFY_STORAGE_BUCKET`
7. Run **Production Data Maintenance** with `run_restore_verification=true` or wait for the scheduled weekly verification.
8. Confirm the report artifact under `reports/backup-restore-verification/`.
9. Record the restore id, backup id, workspace id, Git SHA, and any limitations in the incident or drill ticket.
10. If any P0 or P1 issue appears, do not mark the restore drill complete until the data or process gap is fixed.

## Automated Verification

Run locally against staging or sandbox:

```bash
RESTORE_VERIFY_ENVIRONMENT=staging \
SUPABASE_URL=https://project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
RESTORE_VERIFY_WORKSPACE_ID=workspace_restore \
RESTORE_VERIFY_EXPECTED_RECORDING_IDS=recording_1,recording_2 \
pnpm run verify:backup-restore
```

The verifier is read-only. It checks:

- the restored `workspace_state` row exists;
- restored meetings still reference valid recordings;
- expected recordings exist in `media_assets`;
- completed recordings still have transcript metadata;
- restored audio objects are available in Supabase Storage;
- workspace consistency checks from `verify-supabase-workspace-consistency.mjs` remain green.

By default the verifier refuses `RESTORE_VERIFY_ENVIRONMENT=production`. A production verification requires an explicit break-glass override:

```bash
RESTORE_VERIFY_ALLOW_PRODUCTION=true RESTORE_VERIFY_ENVIRONMENT=production pnpm run verify:backup-restore
```

Use this only during an approved incident response, and include the approver in the incident record.

## Rollback Decision Points

Stop and roll back to the previous known-good restore point when any of these are true:

- restored workspace data has P0 consistency issues;
- expected recording ids are missing;
- restored audio objects are unavailable;
- transcript metadata is missing for completed recordings;
- schema migrations cannot be replayed cleanly;
- app smoke tests cannot authenticate or load the restored workspace.

Continue with limited release only when issues are P2, documented, and accepted by the release owner.

## Known Limitations

- The verifier proves a restored sample workspace, not every workspace in the database.
- Supabase Storage object checks use signed URL creation as an availability proxy.
- Environment config verification is evidence-based; secrets are never printed or uploaded.
- Provider-specific backup retention settings still need to be reviewed outside this repository.
- A successful restore drill does not replace production smoke tests after deployment.
