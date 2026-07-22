# Studio scenarios

## STU-001 — Open completed recording in Studio

### Metadata

- Area: Studio / completed recording
- Priority: P0
- Type: M + E2E
- Status: ready
- Automation: partial
- Target tests: `tests/e2e/studio.spec.ts`, `tests/e2e/visual-regression.spec.ts`

### Goal

Verify that a completed recording opens in Studio with the correct meeting, transcript, speakers, analysis, and player state without runtime or network errors.

### Environments

- Local development with deterministic fixture
- Vercel preview
- Staging
- Production using a dedicated QA recording

### Viewports

- Primary: `1440x900`
- Responsive confirmation: `390x844`

### Test data

- Meeting: `QA_STUDIO_MEETING_TITLE`
- Completed recording with:
  - non-empty transcript,
  - at least two speakers,
  - summary,
  - at least one decision,
  - at least one action item,
  - available audio or an explicit safe audio-unavailable state.

### Preconditions

1. `AUTH-001` passes.
2. The completed recording belongs to `QA_WORKSPACE_NAME`.
3. The recording is visible in Nagrania.
4. Test data contains no private production transcript.

### Steps

1. Log in and open Nagrania.
2. Locate `QA_STUDIO_MEETING_TITLE`.
3. Confirm its status is completed or ready.
4. Open the recording.
5. Confirm Studio becomes the active workspace.
6. Confirm the title and meeting metadata match the selected item.
7. Confirm the selected recording is the intended recording when the meeting has more than one recording.
8. Confirm transcript segments are visible and speaker labels match the fixture.
9. Confirm summary, decision, and action-item sections are visible.
10. Confirm the player loads audio or shows an explicit audio-unavailable state.
11. Select a transcript timestamp and confirm the player seeks to the expected time when audio is available.
12. Switch between Studio analysis tabs.
13. Confirm selected meeting and recording do not reset.
14. Refresh the page.
15. Confirm the same meeting remains open or is restored according to product policy.
16. Inspect browser console and network requests.
17. Repeat core opening and reading checks at `390x844`.

### Expected result

- The correct meeting and recording open once.
- Transcript, speakers, analysis, and player represent the same recording.
- No stale content from a previously selected meeting appears.
- Tab changes do not lose selection.
- Refresh restores a coherent state.
- Audio failure is explicit and does not break transcript/analysis access.
- No uncaught exception or unexpected `5xx` occurs.
- Mobile content is usable without horizontal overflow.

### Evidence

Capture:

- Nagrania row before opening,
- Studio desktop result,
- Studio mobile result,
- final URL path,
- environment and build SHA,
- selected meeting/recording IDs when available,
- sanitized console/network failures.

### Cleanup

Do not delete the stable shared fixture. Close the browser context or return to the default QA meeting.

### Failure follow-up

Create a P0 defect when the wrong recording opens, content mixes between meetings, Studio crashes, audio failure blocks transcript access, or mobile is unusable. Reference `STU-001`.

---

## STU-002 — Player does not cover meeting content

### Metadata

- Area: Studio / layout and sticky player
- Priority: P0
- Type: M + V
- Status: ready
- Automation: candidate
- Target test: `tests/e2e/visual-regression.spec.ts`

### Goal

Verify that the sticky audio player never covers the last visible action item, transcript segment, primary action, error message, or scrollable content.

### Environments

- Local deterministic visual fixture
- Vercel preview
- Staging

### Viewports

- `320x844`
- `390x844`
- `768x1024`
- `1024x768`
- `1366x768`
- `1440x900`
- `1600x900`
- `1920x1080`

### Test data

A Studio fixture containing:

- at least ten transcript segments,
- at least five action items,
- enough summary/decision content to require scrolling,
- available player controls,
- one long speaker name and one long action item.

### Preconditions

1. The completed Studio fixture opens successfully.
2. Browser zoom is 100% for baseline screenshots.
3. Reduced motion is enabled for deterministic visual execution.

### Steps

1. Open the fixture in Studio.
2. Confirm the sticky player is visible.
3. Scroll the analysis column to the final action item.
4. Confirm the full final item and its action controls are visible above or outside the player.
5. Scroll the transcript to the final segment.
6. Confirm the full segment, timestamp, speaker, and menu action are visible.
7. Open any error, details, or menu state near the bottom of the screen.
8. Confirm it renders above the player and is not clipped.
9. Use Tab to focus each player control.
10. Confirm focus rings are visible and not clipped.
11. Resize through every required viewport.
12. At mobile viewports, confirm the player does not occupy excessive vertical space or cover navigation/content.
13. Confirm no body-level horizontal scrollbar appears.
14. Capture full-page or clipped-area screenshots at each required viewport.

### Expected result

- All bottom content is reachable and readable.
- The player reserves sufficient layout space.
- Player controls remain usable and visible.
- Menus, toasts, and messages follow the expected layer order.
- No horizontal overflow occurs.
- Mobile content remains practical despite the sticky player.

### Evidence

Capture desktop and mobile screenshots showing the final action item and final transcript segment above the player, plus overflow measurements when a failure occurs.

### Cleanup

Return zoom and viewport settings to defaults and close any open menu or modal.

### Failure follow-up

Create a P0 visual/UX defect when any content or focus ring is obscured. Include `STU-002`, viewport, screenshot, DOM element, and suspected CSS selector.

---

## STU-003 — Last transcript segment and action item remain reachable

### Metadata

- Area: Studio / scrolling and content reachability
- Priority: P0
- Type: M + V
- Status: ready
- Automation: candidate
- Target tests: `tests/e2e/visual-regression.spec.ts`, new Studio scroll E2E

### Goal

Verify that independent or shared scroll containers allow the user to reach the complete end of both analysis and transcript content without scroll traps, jumps, or hidden final items.

### Environments

- Local deterministic fixture
- Vercel preview
- Staging

### Viewports

- `390x844`
- `768x1024`
- `1024x768`
- `1440x900`

### Test data

- Transcript: at least 50 segments
- Action items: at least 10
- Summary: at least 800 characters
- Decisions: at least 8
- One active playback segment near the end

### Preconditions

1. The long-content fixture is loaded.
2. Player is visible.
3. No browser extension modifies scrolling.

### Steps

1. Open Studio at `1440x900`.
2. Scroll the transcript panel to the last segment using mouse wheel or scrollbar.
3. Confirm the last segment is fully visible and its actions can be opened.
4. Scroll the analysis content to the last action item.
5. Confirm the final item is fully visible and can receive focus.
6. Start audio playback and seek near the last transcript segment.
7. Confirm active-segment auto-scroll does not permanently trap or prevent manual scrolling.
8. Manually scroll away from the active segment.
9. Confirm the product follows the documented auto-follow policy and does not oscillate.
10. Use Page Down, End, Shift+Tab, and Tab to verify keyboard reachability.
11. Switch Studio tabs and return.
12. Confirm scroll position behavior is consistent with product policy.
13. Repeat at tablet and mobile viewports.
14. Confirm the user can reach both transcript end and analysis end even when the mobile layout changes tabs or stacking.
15. Inspect console errors and layout overflow.

### Expected result

- Last content items are fully reachable by pointer, touch, and keyboard.
- No nested-scroll trap prevents reaching the page end.
- Auto-follow behavior is predictable.
- Tab switching does not corrupt scroll containers.
- Mobile layout provides a clear route to both transcript and analysis content.
- The player does not cover final items.

### Evidence

Capture end-of-transcript and end-of-analysis screenshots for desktop, tablet, and mobile; record scroll container selectors and dimensions when failing.

### Cleanup

Stop playback, close open actions, and restore the default viewport.

### Failure follow-up

Create a P0 defect when final content is unreachable, auto-scroll oscillates, keyboard focus is trapped, or mobile hides a content area. Reference `STU-003`.
