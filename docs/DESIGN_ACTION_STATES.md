# Design Action States

All controls must communicate state clearly in dark theme and responsive layouts.

Required states:

- default: readable label, clear affordance, stable size
- hover: visible but not layout-shifting
- focus-visible: keyboard-visible outline or ring
- disabled: clear contrast and no misleading hover
- busy: disabled or aria-busy with visible progress text
- success: toast, inline status, changed data, or navigation
- error: actionable copy near the control or in the relevant panel

Control sizing:

- Icon-only buttons need `aria-label` and tooltip/title.
- Checkboxes inside dense transcript rows stay compact and aligned.
- Select menus and popovers must have a solid dark background, border, and z-index above transcript rows.
- Text cannot overflow its control; use wrapping or shorter labels before reducing readability.

Validation:

```bash
pnpm run audit:ui-actions
pnpm run test:ui-actions
pnpm run test:visual:check
```
