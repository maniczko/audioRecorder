# Shared Page Layout Contract

Issue: #1283  
Status: canonical usage contract for existing layout primitives.

## Purpose and boundaries

This contract standardizes page anatomy without introducing a second token or
component system. The source of truth remains `src/index.css` for tokens and
`src/styles/foundation.css` for the shared CSS primitives.

Use this document when adding or migrating a page. Do not add local spacing,
radius, width, or z-index values when an existing contract primitive applies.
This document does not authorize a broad CSS rewrite; migrations stay scoped to
one page surface and preserve its data flow.

## Page anatomy

Every application page starts with one `.ui-page-shell` and uses `.ui-stack`
for vertical rhythm. A page must not wrap its complete content in a second
framed card.

| Need | Canonical primitive | Use it when | Do not use it when |
| --- | --- | --- | --- |
| Page root | `.ui-page-shell` | The route owns a complete app surface. | Rendering a small region inside an existing page. |
| Page heading | `.ui-page-header` with `__copy`, `__title`, `__description`, `__actions` | A page needs title, context, and actions. | The title belongs to a repeated panel or dialog. |
| Vertical sections | `.ui-stack` | Grouping sections, forms, lists, or status blocks. | A one-line metadata/action group is needed. |
| Inline controls | `.ui-cluster`, `.button-row`, or `.status-cluster` | Controls may wrap while preserving their relationship. | The controls need a fixed grid or table layout. |
| Framed tool or repeated item | `.ui-panel` | The content is a tool, repeated card, form, or independently actionable region. | Framing a whole page section just for spacing. |
| Two or three reading regions | `.ui-split-pane` | A page has a persistent navigation/sidebar or contextual aside. | A responsive list can be represented as one primary column. |

`--layout-section-gap`, `--layout-gap-*`, `--space-*`, `--panel-padding`, and
`--panel-radius` are the only spacing and surface scales used by this contract.
Do not create page-specific alternatives for the same role.

## Page header contract

Use one page header per route-level surface. It has three semantic regions:

1. `__copy`: eyebrow when useful, title, then concise description or metadata.
2. `__actions`: at most one primary action plus clearly secondary controls.
3. Subsequent toolbars: place directly below the header in the same
   `.ui-stack`; do not make them another page header.

The header title is the primary landmark heading. Panel headers are subordinate
and use `.panel-header`; they must not visually compete with the page title.
Actions wrap before the title is compressed. On narrow screens, header actions
become full-width through the existing `foundation.css` mobile rule.

## Page variants

### Default: one primary column

Use for recordings, calendar, notes, people, and settings-like surfaces where
the primary task is scan, search, read, or edit.

```html
<main class="ui-page-shell">
  <header class="ui-page-header">...</header>
  <section class="ui-stack">...</section>
</main>
```

Content is full-width inside the app shell. Limit a particular reading measure
only when the content is prose; do not arbitrarily narrow a data workspace.

### Wide: dense data or workspace surface

Use the default shell with the application's full content width for tables,
timelines, and board views. Keep filters and bulk actions in a toolbar below
the page header. Repeated rows remain rows; do not convert each row into a
card just to create visual separation.

### Studio: primary content with contextual regions

Use `.ui-split-pane` with `data-columns="two"` or `data-columns="three"`.
The primary recording/transcript area is always `__main`; navigation belongs in
`__sidebar`, and supplementary analysis or metadata belongs in `__aside`.
Choose `data-sidebar-width="wide"` only for a genuinely persistent workspace
sidebar. At 1320 px, the third region moves below the primary pair; at 1120 px,
all regions become one ordered column.

```html
<main class="ui-page-shell">
  <header class="ui-page-header">...</header>
  <section class="ui-split-pane" data-columns="three">
    <nav class="ui-split-pane__sidebar">...</nav>
    <section class="ui-split-pane__main">...</section>
    <aside class="ui-split-pane__aside">...</aside>
  </section>
</main>
```

### Centered: authentication and focused setup

Use the existing authentication shell and `.auth-panel` for a focused,
single-task form. Center the shell at the route level, not by adding a local
page width to the panel. The panel still uses the shared surface, padding, and
radius tokens.

## Surfaces and density

- Use `.ui-panel` for a form, a repeated operational item, or a distinct tool.
- Use `.hero-panel` only for a short, high-priority introduction or summary;
  it is not a replacement for the normal page header.
- Use `.topbar` only for a legacy page-level toolbar that still needs its own
  visible surface. New pages use `.ui-page-header` plus a following toolbar.
- Keep related controls in a cluster and let them wrap. Avoid nested cards,
  duplicate active states, and decorative badge rows.
- Empty, loading, error, disabled, and retry states appear in the same primary
  content region as their successful state. They do not receive a new shell.

## Overlay and stacking contract

The page shell is the baseline content layer. A component that opens a menu,
popover, drawer, modal, or toast owns that overlay and must establish a local
stacking context where necessary. Its trigger must remain reachable by keyboard
and its focus-visible state must not be obscured by a neighboring panel.

Until the bounded overlay-token migration is completed, new UI must not invent
an arbitrary z-index. Reuse the owning component's established layer, document
any exception in its page migration PR, and add a browser check for overlap,
focus, and dismissal. This prevents #1283 from silently creating a parallel
z-index scale while #1284 prepares typed primitives.

## Responsive rules

| Width | Required behavior |
| --- | --- |
| Above 1320 px | Three-column split panes may keep their aside; headers and toolbars use natural inline layout. |
| 1120-1320 px | A three-column aside moves below the primary pair; no clipped horizontal region. |
| At or below 1120 px | Split panes become one column; secondary content follows primary content in meaningful reading order. |
| At or below 720 px | Panels use the shared compact padding/radius; page actions and topbar controls expand to full width before text or controls collide. |

The release viewport matrix is `1440x900`, `1280x720`, `1024x768`,
`768x1024`, and `390x844`. Mobile navigation, command search, notification,
record CTA, and profile control must remain reachable with no horizontal
overflow.

## Migration and verification checklist

For each page migration:

1. Keep one `.ui-page-shell` and replace only the local layout boundary.
2. Use the existing token scale; do not add radius or spacing aliases.
3. Verify default, empty, loading/error, focus-visible, and overlay states
   relevant to that page.
4. Capture before/after browser evidence at the release viewport matrix and
   inspect the Playwright report before approving a new baseline.
5. Run `pnpm run lint:css`, `pnpm run audit:mojibake`, and the affected visual
   regression test or `pnpm run test:visual:check` for cross-page CSS changes.

The next implementation slice is #1284: typed layout primitives can encode
this contract without changing page data flow. Page-specific CSS debt is then
migrated one surface at a time.
