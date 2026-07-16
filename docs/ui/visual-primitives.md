# Reusable Visual Primitives

Issue: #1286

## Cards and sections

In React, use `Panel` for a self-contained tool, form, or repeated operational
item. Do not wrap a whole page section in a second card only to obtain spacing.
Use `Stack` for vertical sections and `Cluster` or `.button-row` for wrapping
controls. These wrappers are exported from `src/ui/LayoutPrimitives.tsx` and
provide the shared spacing and alignment API; use the raw `.ui-panel`,
`.ui-stack`, and `.ui-cluster` classes only in non-React markup. The canonical
surface values are `--surface-panel`, `--surface-stroke`, `--shadow-panel`,
`--panel-padding`, and `--panel-radius`.

## Empty, loading, and error states

Use `EmptyState` from `src/components/Skeleton.tsx` for a no-data surface,
`LoadingScreen` for a blocking load, and `ErrorState` when recovery is
available. Supply one clear action only when it advances the user from the
state. Existing VoiceBobr empty-state rendering remains the default.

## Status chips

Use `.status-chip` with its shared small control height and pill radius.
`RecordingPipelineStatus` owns recording-specific state labels, live-region
semantics, progress, and retry behavior. Do not recreate its status mapping in
page components or add local chip sizes and colors.

## Verification

Component tests must cover visible action rendering/click handling and the
accessible label or live-region role relevant to the state. Run typecheck,
lint, CSS lint, and the focused component tests before page adoption.
