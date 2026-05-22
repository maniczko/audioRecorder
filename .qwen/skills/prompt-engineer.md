# Prompt Engineer Workflow Skill

> **Full standards: see [AGENTS.md](../../AGENTS.md) section 7.1 and
> [docs/CODEX_ORCHESTRATION.md](../../docs/CODEX_ORCHESTRATION.md).**
> This file is a Qwen-specific wrapper only. The workspace Codex skill lives in
> `.agents/skills/prompt-engineer/SKILL.md`.

## Trigger

Use before non-trivial implementation, audit, debugging, release, or architecture
work when the request lacks clear goal, context, scope, acceptance criteria,
validation, or final reporting requirements.

Also use when the user explicitly asks to improve, rewrite, validate, or design
a prompt.

## Required Output Shape

Normalize rough prompts into:

1. Goal
2. Context
3. Scope
4. Acceptance Criteria
5. Validation
6. Final Report

If the user only asks for prompt improvement, return the rewritten prompt. If
the user asks for implementation and intent is clear, use the improved prompt
internally and continue.
