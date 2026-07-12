# Page Header and Toolbar Migration

Issue: #1285  
Date: 2026-07-12

## Shared anatomy

Route-level list and directory pages use one primary heading, a concise
description when it adds context, and one adjacent action group. Search,
filters, view toggles, and bulk actions form a following toolbar and must wrap
before the title or primary action is compressed. New work uses the layout
contract in `docs/ui/layout-contract.md` and existing `ui-page-header`,
`ui-cluster`, and layout-gap tokens.

## Surface decision matrix

| Surface | Header decision | Toolbar decision | Status |
| --- | --- | --- | --- |
| Nagrania | H1, description, and existing upload/action group use the shared page-header anatomy. | Filters, search, and view controls remain in the action group because they operate on the recording list. | Migrated in #1285. |
| Osoby | Existing H1, description, action group, and labelled filters toolbar already match the contract. | Keep `people-filter-chips` as the labelled toolbar. | Compliant; no markup rewrite. |
| Notatki | The note-list heading and count are part of the dense list surface, not an independent route title. | Search, sorting, and view toggle remain together in the list toolbar. | Exception: migrate only with the Notes layout issue so the count treatment and narrow layout are visually reviewed together. |
| Kalendarz | Period navigation and view switch define the active workspace context, so the board header is the page header. | Calendar view controls and create action remain in one responsive board toolbar. | Exception: migrate with calendar/planning layout work; do not duplicate month navigation with a second page header. |
| Studio | Meeting context and recording controls are the active workspace header. | Studio controls stay owned by the meeting surface. | Exception: migrate with #1288 to preserve transcript and overlay layering. |
| Zadania | Selected-list context and task actions are part of the task workspace. | Filters, grouping, and bulk actions are workspace controls. | Exception: migrate with planning/task layout work to preserve the selected-list hierarchy. |
| Workspace | Workspace context is selected in the shared application shell. | Workspace-specific controls stay with their owning settings section. | Exception: migrate with #1290 to avoid duplicate workspace titles. |
| Profile | Profile and settings sections have distinct subject headings. | Each section owns its associated actions. | Exception: migrate with #1290 because profile, voice-profile, and account variants do not share one page subject. |
| Integrations | Integration state is rendered in the settings/profile surface. | Connection controls stay local to the integration card or section. | Exception: migrate with #1290 to keep connection status and actions together. |

## Responsive and accessibility requirements

- The H1 remains the first primary heading for a route-level list or directory.
- Icon-only controls require accessible names and keep the existing
  focus-visible treatment.
- Toolbars use existing gap tokens and wrap at the current CSS breakpoints.
- The release viewport matrix is `1440x900`, `1280x720`, `1024x768`,
  `768x1024`, and `390x844`; no header may create horizontal overflow.

## Follow-up ownership

The documented exceptions are intentional scope boundaries, not waived quality
requirements. Their visual changes remain owned by #1288, #1289, and #1290,
where each workspace can be checked with its related loading, empty, overlay,
and mobile states.
