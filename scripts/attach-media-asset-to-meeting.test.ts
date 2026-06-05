import { describe, expect, it, vi } from 'vitest';

import {
  applyAttachMediaAssetRepairPlan,
  buildAttachMediaAssetRepairPlan,
  toPublicAttachMediaAssetRepairReport,
  validateAttachMediaAssetRepairPlanForApply,
} from './attach-media-asset-to-meeting.mjs';

const NOW = '2026-06-02T07:00:00.000Z';
const workspaceId = 'workspace_1';
const targetMeetingId = 'meeting_visible';
const recordingId = 'recording_big';

function workspaceRow(meetings: unknown[]) {
  return {
    workspace_id: workspaceId,
    meetings_json: JSON.stringify(meetings),
    calendar_meta_json: '{}',
    updated_at: '2026-06-02T06:00:00.000Z',
  };
}

function completedAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: recordingId,
    workspace_id: workspaceId,
    meeting_id: 'meeting_missing',
    content_type: 'audio/mpeg',
    size_bytes: 33_130_096,
    storage_mode: 'segmented',
    source_size_bytes: 87_286_893,
    normalized_size_bytes: 33_130_096,
    media_manifest_json: JSON.stringify({
      durationMs: 5_455_388,
      parts: Array.from({ length: 10 }, (_, index) => ({ index })),
    }),
    transcription_status: 'completed',
    transcript_json: JSON.stringify([
      { id: 'seg_1', speakerId: '0', text: 'Pierwszy segment.', timestamp: 0, endTimestamp: 3 },
      { id: 'seg_2', speakerId: '0', text: 'Drugi segment.', timestamp: 3, endTimestamp: 6 },
    ]),
    diarization_json: JSON.stringify({
      transcriptOutcome: 'normal',
      speakerNames: { '0': 'Speaker 1' },
      speakerCount: 1,
      confidence: 0.91,
      audioQuality: { durationSeconds: 5455.388, qualityLabel: 'good' },
      transcriptionDiagnostics: { chunksAttempted: 10 },
    }),
    created_at: '2026-06-02T06:18:14.555Z',
    updated_at: '2026-06-02T06:23:04.662Z',
    ...overrides,
  };
}

describe('attach media asset to meeting repair', () => {
  it('builds a dry-run repair plan that restores transcript-rich recording state', () => {
    const plan = buildAttachMediaAssetRepairPlan({
      workspaceId,
      targetMeetingId,
      recordingId,
      workspaceRow: workspaceRow([
        {
          id: targetMeetingId,
          title: 'Ad hoc 02 cze, 08:33',
          recordings: [],
          latestRecordingId: null,
        },
      ]),
      mediaAsset: completedAsset(),
      now: NOW,
    });

    expect(plan.workspaceStateChanged).toBe(true);
    expect(plan.mediaAssetMeetingChanged).toBe(true);
    expect(plan.updatedMediaAssetMeetingId).toBe(targetMeetingId);
    expect(plan.updatedWorkspaceState.meetings[0]).toMatchObject({
      id: targetMeetingId,
      latestRecordingId: recordingId,
      updatedAt: NOW,
    });
    expect(plan.updatedWorkspaceState.meetings[0].recordings[0]).toMatchObject({
      id: recordingId,
      duration: 5455.388,
      pipelineStatus: 'done',
      transcriptionStatus: 'completed',
      transcriptOutcome: 'normal',
      speakerNames: { '0': 'Speaker 1' },
      speakerCount: 1,
      storageMode: 'segmented',
      contentType: 'audio/mpeg',
      sizeBytes: 33_130_096,
      sourceSizeBytes: 87_286_893,
      normalizedSizeBytes: 33_130_096,
      partCount: 10,
    });
    expect(plan.updatedWorkspaceState.meetings[0].recordings[0].transcript).toHaveLength(2);
  });

  it('redacts transcript text from the public report', () => {
    const plan = buildAttachMediaAssetRepairPlan({
      workspaceId,
      targetMeetingId,
      recordingId,
      workspaceRow: workspaceRow([{ id: targetMeetingId, recordings: [] }]),
      mediaAsset: completedAsset(),
      now: NOW,
    });

    const report = toPublicAttachMediaAssetRepairReport({ ...plan, applied: false });
    const serialized = JSON.stringify(report);

    expect(serialized).not.toContain('Pierwszy segment');
    expect(report.updatedMeeting.recordings[0]).toMatchObject({
      id: recordingId,
      transcriptSegments: 2,
      transcriptTextLength: 31,
    });
  });

  it('refuses to attach an asset with an empty transcript', () => {
    expect(() =>
      buildAttachMediaAssetRepairPlan({
        workspaceId,
        targetMeetingId,
        recordingId,
        workspaceRow: workspaceRow([{ id: targetMeetingId, recordings: [] }]),
        mediaAsset: completedAsset({
          transcript_json: '[]',
          diarization_json: JSON.stringify({ transcriptOutcome: 'empty' }),
        }),
        now: NOW,
      })
    ).toThrow('transcript_json must contain at least one segment');
  });

  it('refuses to attach an asset from another workspace', () => {
    expect(() =>
      buildAttachMediaAssetRepairPlan({
        workspaceId,
        targetMeetingId,
        recordingId,
        workspaceRow: workspaceRow([{ id: targetMeetingId, recordings: [] }]),
        mediaAsset: completedAsset({ workspace_id: 'workspace_other' }),
        now: NOW,
      })
    ).toThrow('does not belong to workspace');
  });

  it('refuses apply when the plan has no changes', () => {
    expect(() =>
      validateAttachMediaAssetRepairPlanForApply({
        workspaceId,
        targetMeetingId,
        recordingId,
        workspaceStateChanged: false,
        mediaAssetMeetingChanged: false,
      })
    ).toThrow('nothing to apply');
  });

  it('does not require media_assets update when asset already points to target meeting', () => {
    const plan = buildAttachMediaAssetRepairPlan({
      workspaceId,
      targetMeetingId,
      recordingId,
      workspaceRow: workspaceRow([{ id: targetMeetingId, recordings: [] }]),
      mediaAsset: completedAsset({ meeting_id: targetMeetingId }),
      now: NOW,
    });

    expect(plan.mediaAssetMeetingChanged).toBe(false);
    expect(plan.workspaceStateChanged).toBe(true);
    expect(() => validateAttachMediaAssetRepairPlanForApply(plan)).not.toThrow();
  });

  it('apply updates workspace_state and media_assets only for the selected ids', async () => {
    const plan = buildAttachMediaAssetRepairPlan({
      workspaceId,
      targetMeetingId,
      recordingId,
      workspaceRow: workspaceRow([{ id: targetMeetingId, recordings: [] }]),
      mediaAsset: completedAsset(),
      now: NOW,
    });
    const update = vi.fn(() => query);
    const eq = vi.fn(() => query);
    const query = { update, eq };
    const from = vi.fn(() => query);
    const supabase = { from };

    await applyAttachMediaAssetRepairPlan({ supabase, plan, now: () => NOW });

    expect(from).toHaveBeenCalledWith('workspace_state');
    expect(from).toHaveBeenCalledWith('media_assets');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        meetings_json: expect.stringContaining(recordingId),
      })
    );
    expect(update).toHaveBeenCalledWith({ meeting_id: targetMeetingId, updated_at: NOW });
    expect(eq).toHaveBeenCalledWith('workspace_id', workspaceId);
    expect(eq).toHaveBeenCalledWith('id', recordingId);
  });
});
