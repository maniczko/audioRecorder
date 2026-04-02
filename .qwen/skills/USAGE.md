# Anti-Regression & TDD Skill — Usage

> **Full standards: see [AGENTS.md](../../AGENTS.md) §2 (Testing).**

## For AI Agents

Before any implementation, follow the TDD workflow from AGENTS.md §2.2:

```
1. UNDERSTAND — What problem? Current vs expected behavior?
2. RED        — Write test that fails
3. GREEN      — Write minimum code to pass
4. REFACTOR   — Clean up with green tests
5. VERIFY     — Full suite passes
```

## For Humans

```powershell
# Windows
.\scripts\tdd-check.ps1 [feature-name]

# Linux/Mac
./scripts/tdd-check.sh [feature-name]

# Via package.json
pnpm run tdd [feature-name]
```
