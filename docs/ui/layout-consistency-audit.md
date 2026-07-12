# Layout Consistency Audit

Issue: #1282  
Date: 2026-07-12  
Scope: audit only; no application UI was changed.

## Evidence and method

- Source rules: `AGENTS.md`, `docs/DESIGN_SYSTEM_RULES.md`, `src/index.css`, and `src/styles/foundation.css`.
- Visual regression coverage: `tests/e2e/visual-regression.spec.ts` checks authenticated shell tabs, auth, mobile navigation, empty, failure, modal, popover, focus-visible, and global overflow states.
- Latest release CI evidence: 57 visual baselines passed on PR #1483.
- Static debt baseline: `docs/ui/css-layout-audit.md` reports 1,700 `!important` rules, 28 out-of-scale z-index values, 892 duplicate selectors, and 5,875 hardcoded spacing values across 55 CSS files.
- Limitation: this audit did not produce a new local browser screenshot set. The findings are therefore code- and CI-backed; each migration issue must capture its own before/after screenshots at the release viewport matrix.

## Page scorecard

| Surface | Score | Evidence | Main inconsistency | Highest-impact next slice |
| --- | ---: | --- | --- | --- |
| Studio | 7 | Shell, transcript-dropdown and brief-modal baselines | Large split style ownership; seven out-of-scale z-index values in `StudioMeetingViewStyles.css` | Normalize Studio shell, transcript popover and modal layering. |
| Nagrania | 7 | Shell, empty, failure, filters and table baselines | Recordings styles split across view and legacy files; 17 `!important` rules | Consolidate recording page header/table/filter anatomy. |
| Kalendarz | 7 | Shell baseline and `CalendarTabStyles.css` | Local radii, shadows and colour exceptions compete with tokens | Align calendar header, toolbar and event-card primitives. |
| Zadania | 5 | Shell, empty, conflict, detail and undo baselines | 1,542 `!important` rules across task CSS; duplicate selector and z-index debt | Establish task layout primitives before feature work. |
| Osoby | 6 | Shell and profile baselines | View-level styles use local spacing and one out-of-scale z-index | Normalize people header, list rows and profile side panel. |
| Notatki | 7 | Shell and note-detail baselines | 51 duplicate selectors and 338 hardcoded spacing values | Align list/detail density and empty-state anatomy. |
| Workspace and integrations | 7 | Reference profile/integrations baselines | Settings variants rely on mixed surfaces and button treatments | Standardize settings page header and integration state cards. |
| Voice profiles | 7 | Profile shell coverage and `ProfileTabStyles.css` | Local typography and layout rules duplicate shared patterns | Reuse page header, metadata row and empty-state primitives. |
| Auth | 8 | Login, register and reset visual baselines | Strong isolated surface; radii and shadows still use local values | Tokenize auth panel and form-control geometry. |
| Empty, error, loading, modals and popovers | 7 | Explicit visual state coverage | Coverage is strong, but state primitives are not consistently shared | Promote empty/loading/error and overlay primitives after task CSS stabilization. |

Overall score: **6/10**. The product is functionally visual-regression protected, but its CSS ownership and token discipline are below the 8/10 handoff gate.

## Findings

- **P0 — task CSS ownership and override debt.** `src/styles/tasks.css` and `src/tasks/TasksWorkspaceViewStyles.css` contain 1,542 `!important` declarations. This prevents predictable responsive and state styling. Extract layout primitives, then remove overrides slice by slice with visual baseline evidence.
- **P0 — stacking-scale drift.** 28 z-index values lie outside the documented scale, concentrated in Studio, Tasks, Recordings and People. Popovers, drawers and modal layers can therefore conflict across pages. Define one tokenized layering scale and migrate component-owned overlays first.
- **P1 — inconsistent page chrome.** Studio, recordings, calendar, people, notes and settings implement headers/toolbars in separate CSS ownership boundaries. Standardize title, metadata, action and responsive-collapse anatomy.
- **P1 — token bypass.** 4,711 hardcoded colours and 5,875 hardcoded spacing values make equivalent cards, rows and controls diverge as the UI evolves. Adopt existing tokens when touching each page; do not mass-rewrite legacy CSS.
- **P2 — visual coverage gaps.** Current CI covers the primary shell, selected states and core mobile views, but not a representative workspace/settings loading state, integrations error state, or voice-profile empty state.

## Anti-pattern scan

| Area | Finding | Severity | Follow-up |
| --- | --- | ---: | --- |
| UI/UX | Inconsistent spacing, component rhythm and local card treatments | P1 | Page-chrome and task-primitives issues. |
| Tailwind/CSS | Arbitrary values, duplicated selectors, mixed radii/shadows | P0 | Tokenize only in bounded migration slices. |
| Accessibility | Overlay layering can obscure focus and keyboard paths | P0 | z-index scale plus focus-visible browser checks. |
| React/frontend | Presentation ownership is distributed across global and component CSS | P1 | Move styles toward component-owned primitives without changing data flow. |
| Quality | Browser coverage is strong but not complete for settings/profile state variants | P2 | Add targeted visual tests with each corresponding migration. |

## Migration plan

1. **P0:** #1283 — define shared page layout contract using current tokens and a documented overlay scale.
2. **P1:** #1284 — add typed layout primitives for page header, toolbar, empty state and section layout.
3. **P1:** #1285–#1290 — migrate page surfaces one at a time, starting with Tasks before Studio and Recordings.
4. **P2:** #1291 — keep the CSS debt gate; add z-index and token-usage checks.
5. **P2:** #1292 — add this audit and the screenshot matrix to the agent/UI checklist.

## Layout brief for follow-up implementation

- Grid: one shared application shell; pages use a single primary content column before adding secondary panels.
- Density: page headers use compact metadata and one primary action; repeated content uses rows or meaningful cards, not nested surfaces.
- Hierarchy: title, context and primary action occupy predictable header positions; state badges stay secondary.
- Typography: reuse title, section, body and metadata roles from tokens; truncate intentionally.
- Component rhythm: 4px spacing scale, shared radii/borders, and semantic surface tokens.
- Responsive collapse: collapse secondary panels and toolbars before compressing primary reading/listing areas.
- Interaction states: focus-visible, empty, loading, error, disabled and overlay state must accompany every migrated primitive.
- Evidence: before/after screenshots at 1440x900, 1280x720, 1024x768, 768x1024 and 390x844; console and overflow checks.

## Verification and remaining risk

- Visual baseline suite currently provides real-browser regression evidence, including focus-visible and overflow assertions.
- `pnpm run audit:css-debt` is the quantitative guard for the existing debt baseline.
- No hard claim of premium readiness is made: the task surface score remains below 8/10 until the P0 task and overlay migration are completed.
