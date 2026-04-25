# ADR 0002: CI Quality Gates

## Status

Accepted

## Context

The previous workflow mixed backend and frontend checks and did not make frontend Vitest a clear merge gate.

## Decision

CI now uses focused jobs for quality, security, frontend Vitest, backend Vitest, and build. Pull requests and pushes target `main` only.

## Consequences

- Frontend tests are explicit and blocking.
- Test files are included in lint.
- High and critical security audit findings block the pipeline.
- Auto-fix workflows are manual-only to reduce duplicate PR noise.
