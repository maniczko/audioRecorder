# Tooling Readiness

VoiceLog treats external tools as release infrastructure, not decoration. The
canonical score is produced by:

```bash
pnpm run audit:tooling
```

Target: average `>= 9.0/10` and zero blockers.

## Scored Surfaces

The audit covers:

- GitHub Actions and required secret references.
- Supabase MCP governance and Supabase persistence evidence.
- Sentry release health.
- Vercel production deployment and smoke.
- Railway backend SHA and health verification.
- Playwright/Browser UI action inventory.
- Codex project config and local skills.
- Prompt Engineer skill.
- CodeRabbit review gate.
- Figma/Canva design workflow.
- Twilio scope policy.
- OpenAI Developers policy.
- Local environment readiness.

## Operating Rule

For production-impacting changes:

1. Improve the prompt or execution brief when scope is unclear.
2. Reproduce the issue.
3. Add a failing regression test.
4. Implement the smallest safe fix.
5. Run targeted tests.
6. Run `pnpm run release:rehearsal` on Node 22.
7. Deploy only from a SHA that passed CI.
8. Run strict production smoke and Sentry release health.

Tooling readiness is release evidence only. It does not replace product tests,
visual checks, production smoke, or Sentry runtime truth.
