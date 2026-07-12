# VoiceLog Documentation Index

This directory is the home for project documentation that is not a root entry point.

Root stays intentionally small:

- `README.md` - project overview and quick start
- `AGENTS.md` - canonical engineering and AI-agent workflow
- `ARCHITECTURE.md` - system boundaries and major runtime flows
- `CHANGELOG.md` - release history

## Active Guides

- `OPERATIONS.md` - local startup, monitoring triage, runtime operations
- `QUALITY_GATES.md` - required verification gates
- `AUTOMATION_POLICY.md` - automation and auto-fix rules
- `API.md` - API notes
- `SCRIPTS.md` - script reference
- `COMPONENTS.md` - component notes
- `CSS_GUIDELINES.md` - styling guidance
- `SOLUTION_AUDIT_2026-04-25.md` - current solution audit
- `RELEASE_AUDIT_2026-04-25_V0.1.3.md` - latest release audit
- `NEXT_WORK_PLAN.md` - current work plan

## Structure

- `adr/` - architecture decision records
- `ops/` - deployment, runtime, monitoring, APM, disk, and Node setup notes
  - `ops/BACKUP_RESTORE_RUNBOOK.md` - backup sources, restore drill checklist, and restore verification workflow
  - `ops/TRANSCRIPTION_JOB_OPERATIONS.md` - operator workflow for durable transcription jobs
  - `ops/PROVIDER_QUOTAS.md` - cost controls for AI, STT, live transcription, images, and embeddings
- `automation/` - automation workflows, task runners, and historical automation notes
- `testing/` - coverage, QA, push, and route test reports
- `archive/audits/` - historical audits and one-off reports
- `archive/plans/` - older plans and optimization notes

Prefer adding new operational docs under the relevant folder instead of the repository root.
