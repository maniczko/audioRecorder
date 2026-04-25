# Automation Policy

## Default Rule

Automation may report, label, and summarize. Automation must not push code, open broad fix PRs, or update dependencies unless explicitly triggered by a maintainer.

## Allowed Automatically

- CI quality gates.
- Build checks.
- Error report collection.
- Monitoring summaries.
- Dependabot metadata without auto-merge.

## Manual Only

The following workflows are intentionally `workflow_dispatch` only:

- `auto-fix.yml`
- `ai-auto-fix.yml`
- `issue-to-pr.yml`
- `security-auto-patch.yml`
- `gpt-fix.yml`

This prevents duplicate automated PRs and keeps ownership clear.

## Security Updates

Security automation may generate an audit report. Applying package updates requires human triage unless a critical production incident explicitly authorizes emergency action.

## Triage Cadence

Review monitoring and auto-fix candidates once per week. Group similar failures by stable fingerprint before creating Linear or GitHub issues.
