# Test Quality Audit 2026-05-19

## Decision

Current test quality after the audit is **7.1/10**. The project is **CONDITIONAL**, not yet premium release-ready, because CI can still miss production-class regressions in remote upload, production smoke evidence, Sentry setup, and long-running pipeline recovery.

## Category Scores

| Category | Score | Note |
| --- | ---: | --- |
| Quantitative coverage | 7 | Thresholds exist, but frontend/backend targets are below the desired premium bar. |
| Critical user flows | 7 | Auth, workspace, recording and server media paths are covered, but realistic remote journeys need more active E2E. |
| Production regression value | 6 | Recent production bugs were not all caught before deploy. |
| E2E realism | 6 | Local smoke is stronger than production smoke; remote API coverage must be mandatory. |
| Visual/layout regression | 6 | Visual tooling exists, but legacy skipped suites and baselines reduce signal. |
| Security/API contracts | 8 | Auth, workspace and admin guards have meaningful coverage. |
| CI signal and flakiness | 7 | Gates are broad, but Node 22 evidence and strict prod smoke must be enforced. |
| Observability evidence | 6 | Sentry and known build SHA are not yet hard release evidence everywhere. |
| Maintainability | 7 | Many tests are structured well, but skip governance and old aspirational suites need cleanup. |
| Performance/load readiness | 5 | Load and mutation coverage are still early-stage. |

## P0 Gaps

- Remote upload must never call `/media/recordings/:id/audio` without `Authorization`, `X-Workspace-Id`, and `X-Meeting-Id`.
- Production smoke must fail when audio upload/persistence evidence is missing.
- Critical E2E journeys must be active; global `describe.skip` cannot cover P0 flows.

## P1 Gaps

- Node 22 must be the only accepted release evidence runtime.
- Visual regression baselines need a stable viewport matrix and CI artifacts.
- Sentry DSN and known backend git SHA should be part of release evidence.
- Mojibake audit must include E2E and audit documentation.

## Top 10 Test Additions

1. Remote upload positive contract with all required headers.
2. Remote upload negative contract when workspace hydration is missing.
3. Production smoke strict mode requiring audio upload evidence.
4. Completed long transcript recovery without destructive retry.
5. STT failure with visible retry and no transcript reset.
6. Denied microphone with friendly UI and clean queue state.
7. Command palette navigation through real app surfaces.
8. Task creation from meeting context.
9. Visual snapshots for 1440, 1280, 1024, 768, and 390 widths.
10. Sentry/build metadata smoke that fails on missing DSN or unknown backend SHA.

## Immediate Plan

The next implementation pass should strengthen E2E gates, add skip governance, expand mojibake scanning, and make strict production smoke a release requirement. The target rescore is **9/10** only after Node 22 `release:rehearsal` and strict production smoke are green.
