# Voice Profile Labeling Diagnostics

Issue #1332 adds a small diagnostics contract for profile-based speaker labels:
`transcriptionDiagnostics.voiceProfileLabeling`.

The same object can also be exposed as top-level `voiceProfileLabeling` in media
responses so older and newer clients can read the status without guessing from
speaker names.

## Fields

| Field                   | Meaning                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `applied`               | `true` when at least one speaker label came from a matched voice profile.            |
| `reason`                | Machine-readable reason for the current status.                                      |
| `mode`                  | Processing mode that produced the status: `fast`, `full`, `segmented`, or `unknown`. |
| `profileCount`          | Number of voice profiles available to the pipeline.                                  |
| `attemptedSpeakerCount` | Number of speakers with enough audio to compare against profiles.                    |
| `matchedSpeakerCount`   | Number of speakers that matched a profile.                                           |
| `partCount`             | Present for segmented results; total processed and failed parts.                     |
| `appliedPartCount`      | Present for segmented results; parts where at least one profile label was applied.   |

## Processing Modes

| Mode        | Behavior                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `full`      | Attempts profile matching when profiles exist and speaker audio is eligible. Returns `matched`, `no_match`, `no_voice_profiles`, `no_speakers`, or `no_eligible_speaker_audio`. |
| `fast`      | Skips profile matching by design. Returns `disabled_by_processing_mode`.                                                                                                        |
| `segmented` | Per-part transcriptions skip profile matching by design. The merged result returns `disabled_by_processing_mode` when all completed parts were skipped.                         |

The Studio UI should treat this as diagnostics, not as an error. A skipped status
means the selected processing mode did not run profile labeling; it does not mean
the transcription failed.
