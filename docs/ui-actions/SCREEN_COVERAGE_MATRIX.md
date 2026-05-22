# UI Action Screen Coverage Matrix

| Screen              | Contract Source                    | Required Test Layer                                           |
| ------------------- | ---------------------------------- | ------------------------------------------------------------- |
| Auth                | `src/components/auth/*`            | component tests, a11y, E2E login/register/reset               |
| Topbar              | `src/Topbar.tsx` and modern shell  | component tests, `test:ui-actions`, command palette smoke     |
| Studio              | `src/studio/StudioMeetingView.tsx` | component regression tests, remote API E2E, `test:ui-actions` |
| Recordings          | `src/RecordingsTab.tsx`            | component tests, queue regression, remote upload E2E          |
| Calendar            | `src/CalendarTab.tsx`              | component tests, visual baseline                              |
| Tasks               | `src/TasksTab.tsx`                 | component tests, action E2E for creation/editing              |
| People              | `src/PeopleTab.tsx`                | component tests, visual baseline                              |
| Notes               | `src/NotesTab.tsx`                 | component tests, visual baseline                              |
| Profile             | `src/ProfileTab.tsx`               | component tests, auth integration, voice profile list tests   |
| Command Palette     | `src/CommandPalette.tsx`           | component tests, `test:ui-actions`                            |
| Notification Center | `src/NotificationCenter.tsx`       | component tests, `test:ui-actions`                            |

Premium bar:

- Every enabled action has an accessible name.
- Every P0 action has success and error feedback tests.
- Playwright covers navigation and shell actions on the real browser.
- Visual baselines cover desktop, tablet, and mobile after layout-affecting changes.
