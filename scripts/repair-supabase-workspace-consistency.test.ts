import { describe, expect, it } from 'vitest';

import {
  buildWorkspaceRepairPlan,
  toPublicRepairReport,
  validateRepairPlanForApply,
} from './repair-supabase-workspace-consistency.mjs';
import { buildWorkspaceConsistencyReport } from './verify-supabase-workspace-consistency.mjs';

const NOW = '2026-05-30T12:00:00.000Z';

function row({
  meetings,
  calendarMeta = {},
  workspaceId = 'workspace_1',
}: {
  meetings: unknown[];
  calendarMeta?: Record<string, unknown>;
  workspaceId?: string;
}) {
  return {
    workspace_id: workspaceId,
    meetings_json: JSON.stringify(meetings),
    calendar_meta_json: JSON.stringify(calendarMeta),
    updated_at: NOW,
  };
}

describe('Supabase workspace consistency repair plan', () => {
  it('preserves a legacy local-path transcript as transcript-only UI state and removes the invalid media asset', () => {
    const recordingId = 'recording_legacy_local';
    const meetingId = 'meeting_legacy';
    const plan = buildWorkspaceRepairPlan({
      workspaceId: 'workspace_1',
      now: NOW,
      workspaceRow: row({
        meetings: [
          {
            id: meetingId,
            title: 'Legacy meeting',
            latestRecordingId: recordingId,
            recordings: [{ id: recordingId, transcript: [{ text: 'old partial' }] }],
          },
        ],
      }),
      mediaAssets: [
        {
          id: recordingId,
          workspace_id: 'workspace_1',
          meeting_id: meetingId,
          file_path: '/app/server/data/uploads/recording_legacy_local.mp3',
          transcription_status: 'completed',
          transcript_json: JSON.stringify([
            { id: 'seg_1', speakerId: 0, text: 'Pelny tekst z bazy danych.' },
          ]),
        },
      ],
    });

    expect(plan.operations.mediaAssetIdsToDelete).toEqual([recordingId]);
    expect(plan.workspaceStateChanged).toBe(true);
    expect(plan.mediaAssetsToKeep).toEqual([]);
    expect(plan.updatedWorkspaceState.meetings).toHaveLength(1);
    expect(plan.updatedWorkspaceState.meetings[0]).toMatchObject({
      id: meetingId,
      latestRecordingId: recordingId,
    });
    expect(plan.updatedWorkspaceState.meetings[0].recordings[0]).toMatchObject({
      id: recordingId,
      audioAvailable: false,
      audioUnavailable: true,
      audioUnavailableReason: 'legacy_local_audio_unavailable',
      pipelineStatus: 'done',
      transcriptionStatus: 'completed',
      transcript: [{ id: 'seg_1', speakerId: 0, text: 'Pelny tekst z bazy danych.' }],
    });

    const report = buildWorkspaceConsistencyReport({
      workspaceId: 'workspace_1',
      workspaceRow: {
        workspace_id: 'workspace_1',
        meetings_json: JSON.stringify(plan.updatedWorkspaceState.meetings),
        calendar_meta_json: JSON.stringify(plan.updatedWorkspaceState.calendarMeta),
      },
      mediaAssets: plan.mediaAssetsToKeep,
    });

    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
  });

  it('removes local-path recordings without transcript and tombstones them to prevent resurrection', () => {
    const plan = buildWorkspaceRepairPlan({
      workspaceId: 'workspace_1',
      now: NOW,
      workspaceRow: row({
        meetings: [
          {
            id: 'meeting_empty_audio',
            latestRecordingId: 'recording_empty_audio',
            recordings: [{ id: 'recording_empty_audio', transcript: [] }],
          },
        ],
      }),
      mediaAssets: [
        {
          id: 'recording_empty_audio',
          workspace_id: 'workspace_1',
          meeting_id: 'meeting_empty_audio',
          file_path: '/app/server/data/uploads/recording_empty_audio.webm',
          transcription_status: 'failed',
          transcript_json: '[]',
        },
      ],
    });

    expect(plan.operations.mediaAssetIdsToDelete).toEqual(['recording_empty_audio']);
    expect(plan.updatedWorkspaceState.meetings[0]).toMatchObject({
      id: 'meeting_empty_audio',
      recordings: [],
    });
    expect(plan.updatedWorkspaceState.meetings[0]).not.toHaveProperty('latestRecordingId');
    expect(plan.updatedWorkspaceState.calendarMeta.recordingTombstones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'recording_empty_audio',
          source: 'legacy-local-audio-repair',
        }),
      ])
    );
  });

  it('removes only audit/smoke orphan media assets by default and keeps non-audit orphans for manual review', () => {
    const plan = buildWorkspaceRepairPlan({
      workspaceId: 'workspace_1',
      now: NOW,
      workspaceRow: row({ meetings: [] }),
      mediaAssets: [
        {
          id: 'production_smoke_audio_1',
          workspace_id: 'workspace_1',
          meeting_id: 'production_smoke_missing_meeting',
          file_path: 'production_smoke_audio_1.webm',
          transcript_json: '[]',
        },
        {
          id: 'recording_smoke_voice_profile_20260522',
          workspace_id: 'workspace_1',
          meeting_id: 'meeting_smoke_voice_profile_20260522',
          file_path: 'recording_smoke_voice_profile_20260522.webm',
          transcript_json: '[]',
        },
        {
          id: 'recording_user_orphan',
          workspace_id: 'workspace_1',
          meeting_id: 'meeting_user_missing',
          file_path: 'recording_user_orphan.webm',
          transcript_json: '[]',
        },
      ],
    });

    expect(plan.operations.mediaAssetIdsToDelete).toEqual([
      'production_smoke_audio_1',
      'recording_smoke_voice_profile_20260522',
    ]);
    expect(plan.operations.storagePathsToRemove).toEqual([
      'production_smoke_audio_1.webm',
      'recording_smoke_voice_profile_20260522.webm',
    ]);
    expect(plan.mediaAssetsToKeep.map((asset) => asset.id)).toEqual(['recording_user_orphan']);
    expect(plan.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'orphan_media_asset_requires_manual_review',
          recordingId: 'recording_user_orphan',
        }),
      ])
    );
  });

  it('normalizes invalid and duplicate meetings without losing tombstones', () => {
    const plan = buildWorkspaceRepairPlan({
      workspaceId: 'workspace_1',
      now: NOW,
      workspaceRow: row({
        calendarMeta: {
          meetingTombstones: [{ id: 'meeting_deleted', deletedAt: NOW, source: 'test' }],
        },
        meetings: [
          null,
          { id: 'meeting_duplicate', title: 'old', updatedAt: '2026-05-01T00:00:00.000Z' },
          { id: 'meeting_duplicate', title: 'new', updatedAt: '2026-05-02T00:00:00.000Z' },
          { id: 'meeting_deleted', title: 'should be filtered' },
        ],
      }),
      mediaAssets: [],
    });

    expect(plan.updatedWorkspaceState.meetings).toEqual([
      { id: 'meeting_duplicate', title: 'new', updatedAt: '2026-05-02T00:00:00.000Z' },
    ]);
    expect(plan.updatedWorkspaceState.calendarMeta.meetingTombstones).toEqual([
      { id: 'meeting_deleted', deletedAt: NOW, source: 'test' },
    ]);
    expect(plan.actions.map((action) => action.code)).toEqual(
      expect.arrayContaining(['invalid_meeting_removed', 'duplicate_meeting_removed'])
    );
  });

  it('requires an explicit changed plan before apply', () => {
    const noop = buildWorkspaceRepairPlan({
      workspaceId: 'workspace_1',
      now: NOW,
      workspaceRow: row({ meetings: [] }),
      mediaAssets: [],
    });
    const changed = buildWorkspaceRepairPlan({
      workspaceId: 'workspace_1',
      now: NOW,
      workspaceRow: row({ meetings: [] }),
      mediaAssets: [
        {
          id: 'audit_orphan',
          workspace_id: 'workspace_1',
          meeting_id: 'audit_missing',
          file_path: 'audit_orphan.webm',
          transcript_json: '[]',
        },
      ],
    });

    expect(() => validateRepairPlanForApply(noop)).toThrow('nothing to apply');
    expect(() => validateRepairPlanForApply(changed)).not.toThrow();
  });

  it('redacts transcript text from logs and persisted maintenance reports', () => {
    const plan = buildWorkspaceRepairPlan({
      workspaceId: 'workspace_1',
      now: NOW,
      workspaceRow: row({
        meetings: [
          {
            id: 'meeting_private',
            latestRecordingId: 'recording_private',
            recordings: [{ id: 'recording_private' }],
          },
        ],
      }),
      mediaAssets: [
        {
          id: 'recording_private',
          workspace_id: 'workspace_1',
          meeting_id: 'meeting_private',
          file_path: '/app/server/data/uploads/private.mp3',
          transcription_status: 'completed',
          transcript_json: JSON.stringify([{ text: 'bardzo prywatna tresc rozmowy' }]),
        },
      ],
    });

    const publicReport = toPublicRepairReport({ ...plan, applied: false });
    const serialized = JSON.stringify(publicReport);

    expect(serialized).not.toContain('bardzo prywatna tresc rozmowy');
    expect(publicReport.updatedWorkspaceState.meetings).toMatchObject([
      expect.objectContaining({
        id: 'meeting_private',
        recordings: [
          expect.objectContaining({
            id: 'recording_private',
            transcriptSegments: 1,
            transcriptTextLength: 29,
          }),
        ],
      }),
    ]);
  });
});
