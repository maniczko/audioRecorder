# CSS Layout Debt Audit

Generated: 2026-07-06T14:13:54.190Z

## Gate

- Local/CI command: `pnpm run audit:css-debt`
- The command compares current `!important` counts against `docs/ui/css-debt-baseline.json`.
- New `!important` usage fails the audit per file unless the baseline is intentionally updated.
- This issue is report-mode only: existing CSS debt is documented, not mass-refactored.

## Summary

- Files scanned: 55
- Total findings: 14780
- `!important`: 1700
- Duplicate selectors: 892
- Hardcoded spacing values: 5875
- Hardcoded colors: 4711
- z-index outside token scale: 28
- Global selectors: 1574

## Priority

- P0: `!important` and z-index values outside the token scale.
- P1: duplicate selectors and hardcoded colors.
- P2: hardcoded spacing and broad global selectors.

## Top Files

| Priority | File                                          | Total | !important | Duplicate selectors | Hardcoded spacing | Hardcoded colors | z-index | Global selectors |
| -------- | --------------------------------------------- | ----: | ---------: | ------------------: | ----------------: | ---------------: | ------: | ---------------: |
| P0       | `src/styles/tasks.css`                        |  2588 |        500 |                 184 |               819 |              847 |       2 |              236 |
| P0       | `src/tasks/TasksWorkspaceViewStyles.css`      |  2326 |       1042 |                  81 |               524 |              346 |       3 |              330 |
| P0       | `src/studio/StudioMeetingViewStyles.css`      |  1676 |         13 |                  54 |               790 |              667 |       7 |              145 |
| P1       | `src/NotesTabStyles.css`                      |   770 |          0 |                  51 |               338 |              211 |       0 |              170 |
| P0       | `src/PeopleTabStyles.css`                     |   672 |          1 |                  47 |               301 |              223 |       1 |               99 |
| P1       | `src/styles/reference-ui.css`                 |   579 |          0 |                  29 |               197 |              167 |       0 |              186 |
| P0       | `src/RecordingsTabStyles.css`                 |   511 |         17 |                  42 |               189 |              166 |       1 |               96 |
| P0       | `src/tasks/TaskDetailsPanelStyles.css`        |   506 |         69 |                  22 |               223 |              146 |       5 |               41 |
| P0       | `src/styles/modern-layout.css`                |   487 |         14 |                  41 |               234 |              185 |       3 |               10 |
| P1       | `src/styles/studio.css`                       |   478 |          0 |                  11 |               244 |              222 |       0 |                1 |
| P1       | `src/ProfileTabStyles.css`                    |   437 |          0 |                  37 |               241 |              123 |       0 |               36 |
| P1       | `src/App.css`                                 |   424 |          0 |                  24 |               228 |              162 |       0 |               10 |
| P0       | `src/studio/StudioBriefModalStyles.css`       |   313 |         33 |                  19 |               119 |               77 |       0 |               65 |
| P0       | `src/studio/UnifiedPlayerStyles.css`          |   289 |          1 |                  37 |               144 |               98 |       0 |                9 |
| P1       | `src/styles/calendar.css`                     |   258 |          0 |                  16 |               143 |               86 |       0 |               13 |
| P0       | `src/studio/TranscriptPanelStyles.css`        |   182 |          1 |                  34 |                92 |               55 |       0 |                0 |
| P1       | `src/index.css`                               |   179 |          0 |                   3 |                16 |              147 |       0 |               13 |
| P1       | `src/styles/reset.css`                        |   142 |          0 |                   7 |                61 |               63 |       0 |               11 |
| P1       | `src/CalendarTabStyles.css`                   |   137 |          0 |                   6 |                71 |               42 |       0 |               18 |
| P1       | `src/styles/variables.css`                    |   128 |          0 |                   0 |                 9 |              113 |       0 |                6 |
| P1       | `src/styles/JapaneseFlatDesign.css`           |   120 |          0 |                   5 |                22 |               92 |       0 |                1 |
| P1       | `src/styles/auth.css`                         |   110 |          0 |                   5 |                59 |               46 |       0 |                0 |
| P1       | `src/NotificationCenterStyles.css`            |   106 |          0 |                  10 |                60 |               30 |       0 |                6 |
| P1       | `src/CommandPaletteStyles.css`                |   102 |          0 |                   8 |                49 |               34 |       0 |               11 |
| P1       | `src/styles/recordings.css`                   |    99 |          0 |                  12 |                45 |               42 |       0 |                0 |
| P1       | `src/components/RecordingPipelineStatus.css`  |    91 |          0 |                   7 |                20 |               47 |       0 |               17 |
| P1       | `src/styles/layout.css`                       |    84 |          0 |                   5 |                46 |               33 |       0 |                0 |
| P1       | `src/TopbarStyles.css`                        |    65 |          0 |                  10 |                44 |                9 |       0 |                2 |
| P1       | `src/studio/AiTaskSuggestionsPanelStyles.css` |    64 |          0 |                  16 |                44 |                4 |       0 |                0 |
| P1       | `src/tasks/TaskKanbanViewStyles.css`          |    63 |          0 |                   0 |                39 |               24 |       0 |                0 |

## P0: Existing `!important` Debt

| File                                     | Count | First lines                                    |
| ---------------------------------------- | ----: | ---------------------------------------------- |
| `src/styles/tasks.css`                   |   500 | 18, 19, 20, 21, 25, 26, 27, 28                 |
| `src/tasks/TasksWorkspaceViewStyles.css` |  1042 | 78, 87, 91, 107, 108, 114, 118, 124            |
| `src/studio/StudioMeetingViewStyles.css` |    13 | 4003, 5562, 5563, 5564, 5565, 5573, 5574, 5581 |
| `src/PeopleTabStyles.css`                |     1 | 766                                            |
| `src/RecordingsTabStyles.css`            |    17 | 998, 1008, 1010, 1013, 1014, 1020, 1022, 1023  |
| `src/tasks/TaskDetailsPanelStyles.css`   |    69 | 31, 32, 1162, 1167, 1168, 1169, 1222, 1233     |
| `src/styles/modern-layout.css`           |    14 | 658, 680, 681, 682, 694, 695, 1367, 1368       |
| `src/studio/StudioBriefModalStyles.css`  |    33 | 227, 228, 229, 230, 231, 232, 233, 237         |
| `src/studio/UnifiedPlayerStyles.css`     |     1 | 820                                            |
| `src/studio/TranscriptPanelStyles.css`   |     1 | 564                                            |
| `src/styles/people.css`                  |     1 | 210                                            |
| `src/styles/foundation.css`              |     1 | 36                                             |
| `src/styles/mobile-utilities.css`        |     3 | 269, 270, 271                                  |
| `src/shared/TagBadge.css`                |     1 | 64                                             |
| `src/shared/MentionTextareaStyles.css`   |     3 | 11, 14, 39                                     |

## P0: z-index Outside Token Scale

| File                                     | Count | First lines                              |
| ---------------------------------------- | ----: | ---------------------------------------- |
| `src/styles/tasks.css`                   |     2 | 7, 5662                                  |
| `src/tasks/TasksWorkspaceViewStyles.css` |     3 | 13, 1197, 1382                           |
| `src/studio/StudioMeetingViewStyles.css` |     7 | 1005, 1299, 1323, 1327, 4001, 4018, 4894 |
| `src/PeopleTabStyles.css`                |     1 | 1928                                     |
| `src/RecordingsTabStyles.css`            |     1 | 10                                       |
| `src/tasks/TaskDetailsPanelStyles.css`   |     5 | 3, 26, 31, 55, 141                       |
| `src/styles/modern-layout.css`           |     3 | 578, 595, 758                            |
| `src/shared/AssigneeInput.css`           |     1 | 105                                      |
| `src/shared/TagInput.css`                |     1 | 101                                      |
| `src/styles/tasks.mobile.css`            |     3 | 19, 87, 114                              |
| `src/shared/Tooltip.css`                 |     1 | 11                                       |

## Recommended Cleanup Order

1. Remove or localize `!important` from the top P0 files, starting with component-owned CSS before legacy global bundles.
2. Replace out-of-scale `z-index` values with a documented token scale.
3. Consolidate duplicate selectors in the largest CSS bundles before changing visual styling.
4. Move repeated hardcoded colors and spacing into existing design tokens as files are touched.

## Notes

- Counts are static-analysis heuristics and should guide cleanup, not replace visual review.
- The report intentionally does not fail on existing debt. The baseline gate fails only when `!important` usage increases.
