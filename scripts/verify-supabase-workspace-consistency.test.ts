import { describe, expect, it } from 'vitest';

import {
  buildWorkspaceConsistencyReport,
  extractRecordingRefs,
  safeJsonParse,
  validateSupabaseVerifierEnv,
} from './verify-supabase-workspace-consistency.mjs';

describe('Supabase workspace consistency verifier', () => {
  it('extracts recording references from current workspace meeting shapes', () => {
    expect(
      extractRecordingRefs({
        id: 'meeting_1',
        title: 'Demo',
        latestRecordingId: 'recording_latest',
        recordings: [{ id: 'recording_1', transcript: [{ text: 'hello' }] }],
      })
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          meetingId: 'meeting_1',
          recordingId: 'recording_latest',
          source: 'latestRecordingId',
        }),
        expect.objectContaining({
          meetingId: 'meeting_1',
          recordingId: 'recording_1',
          source: 'recordings',
          transcript: [{ text: 'hello' }],
        }),
      ])
    );
  });

  it('reports a healthy workspace when state, assets, storage, and transcript are aligned', () => {
    const report = buildWorkspaceConsistencyReport({
      workspaceId: 'workspace_1',
      storageChecked: true,
      storageStatusByPath: {
        'recording_1.webm': { exists: true },
      },
      workspaceRow: {
        workspace_id: 'workspace_1',
        calendar_meta_json: JSON.stringify({ meetingTombstones: [], recordingTombstones: [] }),
        meetings_json: JSON.stringify([
          {
            id: 'meeting_1',
            latestRecordingId: 'recording_1',
            recordings: [{ id: 'recording_1', transcript: [{ text: 'Pelny transcript' }] }],
          },
        ]),
      },
      mediaAssets: [
        {
          id: 'recording_1',
          workspace_id: 'workspace_1',
          meeting_id: 'meeting_1',
          file_path: 'recording_1.webm',
          transcription_status: 'completed',
          transcript_json: JSON.stringify([{ text: 'Pelny transcript' }]),
        },
      ],
    });

    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
  });

  it('detects resurrected tombstones, missing assets, missing storage, and stale UI transcripts', () => {
    const report = buildWorkspaceConsistencyReport({
      workspaceId: 'workspace_1',
      storageChecked: true,
      storageStatusByPath: {
        'recording_done.webm': { exists: false, error: 'Object not found' },
      },
      workspaceRow: {
        workspace_id: 'workspace_1',
        calendar_meta_json: JSON.stringify({
          meetingTombstones: [{ id: 'meeting_deleted' }],
          recordingTombstones: [{ id: 'recording_deleted' }],
        }),
        meetings_json: JSON.stringify([
          {
            id: 'meeting_deleted',
            latestRecordingId: 'recording_deleted',
            recordings: [{ id: 'recording_deleted', transcript: [] }],
          },
          {
            id: 'meeting_live',
            latestRecordingId: 'recording_missing',
            recordings: [
              { id: 'recording_done', transcript: [{ text: 'krotki' }] },
              { id: 'recording_missing', transcript: [] },
            ],
          },
        ]),
      },
      mediaAssets: [
        {
          id: 'recording_done',
          workspace_id: 'workspace_1',
          meeting_id: 'meeting_live',
          file_path: 'recording_done.webm',
          transcription_status: 'completed',
          transcript_json: JSON.stringify([{ text: 'duzo dluzszy transcript z Supabase' }]),
        },
      ],
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'meeting_resurrected_after_tombstone', severity: 'P0' }),
        expect.objectContaining({ code: 'recording_resurrected_after_tombstone', severity: 'P0' }),
        expect.objectContaining({ code: 'meeting_references_missing_media_asset', severity: 'P1' }),
        expect.objectContaining({
          code: 'media_asset_transcript_not_restored_to_workspace',
          severity: 'P1',
        }),
        expect.objectContaining({ code: 'supabase_storage_object_missing', severity: 'P0' }),
      ])
    );
  });

  it('flags production local file paths and media assets pointing to missing meetings', () => {
    const report = buildWorkspaceConsistencyReport({
      workspaceId: 'workspace_1',
      workspaceRow: {
        workspace_id: 'workspace_1',
        calendar_meta_json: '{}',
        meetings_json: '[]',
      },
      mediaAssets: [
        {
          id: 'recording_local',
          workspace_id: 'workspace_1',
          meeting_id: 'meeting_missing',
          file_path: '/app/server/data/uploads/recording_local.webm',
          transcript_json: '[]',
        },
      ],
    });

    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'media_asset_uses_local_audio_path', severity: 'P0' }),
        expect.objectContaining({ code: 'media_asset_points_to_missing_meeting', severity: 'P1' }),
      ])
    );
  });

  it('keeps stale production smoke media assets visible without blocking strict production gates', () => {
    const report = buildWorkspaceConsistencyReport({
      workspaceId: 'workspace_1',
      workspaceRow: {
        workspace_id: 'workspace_1',
        calendar_meta_json: '{}',
        meetings_json: '[]',
      },
      mediaAssets: [
        {
          id: 'production_smoke_1780905045265',
          workspace_id: 'workspace_1',
          meeting_id: 'production_smoke_meeting_1780905045265',
          file_path: 'production_smoke_1780905045265.wav',
          transcript_json: '[]',
        },
      ],
    });

    expect(report.ok).toBe(true);
    expect(report.summary.severityCounts).toEqual({ P0: 0, P1: 0, P2: 1 });
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'production_smoke_media_asset_points_to_missing_meeting',
          severity: 'P2',
        }),
      ])
    );
  });

  it('validates required production Supabase environment without exposing secrets', () => {
    expect(() => validateSupabaseVerifierEnv({})).toThrow(
      'SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY'
    );
    expect(() =>
      validateSupabaseVerifierEnv({
        SUPABASE_URL: 'postgresql://postgres:secret@db.example.supabase.co:5432/postgres',
        SUPABASE_SERVICE_ROLE_KEY: 'secret',
        WORKSPACE_ID: 'workspace_1',
      })
    ).toThrow('Supabase project API URL');
    expect(() =>
      validateSupabaseVerifierEnv({
        SUPABASE_URL: 'https://project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'secret',
        PRODUCTION_SMOKE_WORKSPACE_ID: 'workspace_1',
      })
    ).not.toThrow();
  });

  it('keeps JSON parsing tolerant for Supabase text and jsonb shapes', () => {
    expect(safeJsonParse('[{"id":"m1"}]', [])).toEqual([{ id: 'm1' }]);
    expect(safeJsonParse([{ id: 'm1' }], [])).toEqual([{ id: 'm1' }]);
    expect(safeJsonParse('not-json', [])).toEqual([]);
  });
});
