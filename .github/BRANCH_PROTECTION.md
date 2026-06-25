# Branch protection checklist for `main`

Configure this in GitHub repository settings or an organization ruleset. Repository files cannot enforce these settings by themselves.

## Required target

```text
main
```

## Required rules

- Require a pull request before merging.
- Require at least one approval before merge.
- Require conversation resolution before merge.
- Require status checks to pass before merging.
- Require branches to be up to date before merging.
- Block force pushes.
- Block branch deletion.
- Limit bypass permissions to repository administrators only, if bypass is needed at all.

## Recommended required checks

Start with the checks below once they are stable and green:

```text
CI / Quality Gates
CI / Security Audit
CI / Backend Vitest
CI / Frontend Vitest
Docker Build
Preview Deployment (Vercel)
CodeQL / codeql javascript-typescript
```

If `Quality Gates` is red because of a known accessibility audit failure, fix that issue first before making it a required merge gate.

## Codex queue protection

The production-readiness queue assumes that human review and CI remain the release gate. Do not enable automatic merge for Codex-created P0/P1 pull requests until:

- the linked issue is marked `codex:pr-open`,
- the PR body contains `Closes #<issue-number>`,
- relevant tests are reported in the PR body,
- required checks pass,
- a human has reviewed the migration, privacy, security, and rollback notes.

## Manual verification

After enabling the rule, open a small test PR and verify that GitHub blocks merge until the required checks pass and the branch is up to date.
