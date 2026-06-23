# Screenshot evidence workflow

Purpose: keep visual audit evidence useful without polluting the repository root.

## Where to save screenshots

- Durable audit evidence: `docs/audits/screenshots/`
- Playwright visual baselines: `tests/e2e/**-snapshots/`
- Temporary local screenshots: repository root or temp directories, ignored by git

## Naming

Use descriptive names with the surface and viewport:

```text
people-detail-mobile-390x844.png
recordings-desktop-1440x900.png
task-modal-tablet-768x1024.png
```

## Rules

- Do not commit random root-level PNG/JPG/WebP files.
- Keep only screenshots that prove an acceptance criterion or a regression state.
- Mention screenshot paths in the relevant audit, task, or PR notes.
- If a screenshot is only a temporary comparison, leave it in the root; `.gitignore` hides it.
