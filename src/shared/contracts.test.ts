import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import type { AiPersonProfileResponse, AiSuggestTasksResponse } from './contracts';
import {
  applyWorkspaceStateDelta,
  normalizeMediaTranscriptionResponse,
  normalizeTranscriptionStatusPayload,
  normalizeWorkspaceState,
  serializeWorkspaceState,
} from './contracts';

describe('shared contracts', () => {
  test('normalizes workspace state with safe defaults', () => {
    expect(
      normalizeWorkspaceState({
        meetings: [{ id: 'm1' }],
        vocabulary: ['crm'],
        updatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).toEqual({
      meetings: [{ id: 'm1' }],
      manualTasks: [],
      taskState: {},
      taskBoards: {},
      calendarMeta: {},
      vocabulary: ['crm'],
      updatedAt: '2026-03-23T10:00:00.000Z',
    });
  });

  test('normalizes workspace meetings by dropping nulls, deduplicating ids, and applying meeting tombstones', () => {
    expect(
      normalizeWorkspaceState({
        meetings: [
          null,
          { id: 'm1', title: 'Old', updatedAt: '2026-05-28T07:00:00.000Z' },
          { id: 'm2', title: 'Deleted', updatedAt: '2026-05-28T07:01:00.000Z' },
          { id: 'm1', title: 'New', updatedAt: '2026-05-28T07:02:00.000Z' },
          { id: '', title: 'Broken' },
          { id: 'm3', title: 'First duplicate' },
          { id: 'm3', title: 'Last duplicate wins' },
        ],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {
          meetingTombstones: [{ id: 'm2', deletedAt: '2026-05-28T07:03:00.000Z' }],
        },
        vocabulary: [],
      })
    ).toMatchObject({
      meetings: [
        { id: 'm1', title: 'New' },
        { id: 'm3', title: 'Last duplicate wins' },
      ],
    });
  });

  test('Regression: #0 - meeting remove delta creates meeting and recording tombstones', () => {
    const next = applyWorkspaceStateDelta(
      {
        meetings: [
          {
            id: 'meeting_delete_contract',
            title: 'Delete contract',
            latestRecordingId: 'rec_latest_contract',
            recordings: [{ id: 'rec_latest_contract' }, { recordingId: 'rec_legacy_contract' }],
          },
        ],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
      },
      {
        meetings: {
          removeIds: ['meeting_delete_contract'],
        },
      }
    );

    expect(next.meetings).toEqual([]);
    expect(next.calendarMeta?.meetingTombstones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'meeting_delete_contract', source: 'meeting-delete' }),
      ])
    );
    expect(next.calendarMeta?.recordingTombstones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'rec_latest_contract', source: 'meeting-delete' }),
        expect.objectContaining({ id: 'rec_legacy_contract', source: 'meeting-delete' }),
      ])
    );
  });

  test('serializes workspace state into a stable json snapshot', () => {
    expect(
      serializeWorkspaceState({
        meetings: [{ id: 'm1' }],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
      })
    ).toBe(
      JSON.stringify({
        meetings: [{ id: 'm1' }],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
        updatedAt: '',
      })
    );
  });

  test('normalizes transcription status payloads from storage rows', () => {
    expect(
      normalizeTranscriptionStatusPayload({
        id: 'rec1',
        transcription_status: 'completed',
        transcript_json: JSON.stringify([{ id: 'seg1', text: 'hello' }]),
        diarization_json: JSON.stringify({
          transcriptOutcome: 'normal',
          speakerCount: 1,
          speakerNames: { '0': 'Anna' },
        }),
        updated_at: '2026-03-23T11:00:00.000Z',
      } as any)
    ).toMatchObject({
      recordingId: 'rec1',
      pipelineStatus: 'done',
      segments: [{ id: 'seg1', text: 'hello' }],
      speakerNames: { '0': 'Anna' },
      speakerCount: 1,
      updatedAt: '2026-03-23T11:00:00.000Z',
    });
  });

  test('Regression: #0 - exposes segmented manifest duration in transcription status', () => {
    expect(
      normalizeTranscriptionStatusPayload({
        id: 'rec_segmented',
        transcription_status: 'completed',
        media_manifest_json: JSON.stringify({
          durationMs: 5_455_388,
          parts: [{ path: 'recordings/rec_segmented/part-000.webm' }],
        }),
        transcript_json: JSON.stringify([
          { id: 'seg1', text: 'hello', timestamp: 0, endTimestamp: 12 },
        ]),
        diarization_json: JSON.stringify({
          transcriptOutcome: 'normal',
          audioQuality: { durationSeconds: 5400 },
        }),
        updated_at: '2026-06-01T20:04:00.000Z',
      } as any)
    ).toMatchObject({
      recordingId: 'rec_segmented',
      pipelineStatus: 'done',
      durationMs: 5_455_388,
    });
  });

  test('AiSuggestTasksResponse has the correct shape', () => {
    const response: AiSuggestTasksResponse = {
      tasks: [
        {
          title: 'Finish report',
          owner: 'Alice',
          priority: 'high',
          tags: ['report'],
          dueDate: '2026-03-27',
        },
        {
          title: 'Design review',
          owner: null,
          priority: 'medium',
          tags: [],
          description: 'review design',
        },
      ],
    };
    expect(response.tasks).toHaveLength(2);
    expect(response.tasks[0].title).toBe('Finish report');
    expect(response.tasks[1].owner).toBeNull();
  });

  test('AiPersonProfileResponse accepts anthropic mode with full DISC', () => {
    const profile: AiPersonProfileResponse = {
      mode: 'anthropic',
      disc: { D: 70, I: 50, S: 40, C: 80 },
      discStyle: 'DC — dominujący analityk',
      workingWithTips: ['Przedstawiaj fakty', 'Dawaj czas na analizę'],
      meetingsAnalyzed: 3,
      generatedAt: '2026-03-23T00:00:00.000Z',
    };
    expect(profile.disc?.D).toBe(70);
    expect(profile.workingWithTips).toHaveLength(2);
  });

  test('AiPersonProfileResponse accepts no-key fallback mode', () => {
    const profile: AiPersonProfileResponse = { mode: 'no-key' };
    expect(profile.mode).toBe('no-key');
    expect(profile.disc).toBeUndefined();
  });

  test('normalizes remote transcription responses through the same contract shape', () => {
    expect(
      normalizeMediaTranscriptionResponse({
        recordingId: 'rec2',
        pipelineStatus: 'queued',
        segments: [{ id: 'seg2', text: 'hi' }],
        diarization: {
          transcriptOutcome: 'empty',
          emptyReason: 'no_segments_from_stt',
          speakerCount: 2,
        },
        userMessage: 'Brak wypowiedzi.',
      } as any)
    ).toMatchObject({
      recordingId: 'rec2',
      pipelineStatus: 'queued',
      transcriptOutcome: 'empty',
      emptyReason: 'no_segments_from_stt',
      userMessage: 'Brak wypowiedzi.',
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Issue #0 — shared ESM helpers break NodeNext typecheck without .js extensions
  // Date: 2026-04-11
  // Bug: shared modules imported ./types without explicit .js extensions,
  //      which breaks TypeScript NodeNext/Node16 resolution during typecheck.
  // Fix: keep explicit .js extensions in shared source imports.
  // ─────────────────────────────────────────────────────────────────
  test('Regression: Issue #0 — shared modules keep explicit .js extensions', () => {
    const sharedDir = path.resolve(process.cwd(), 'src/shared');
    const contractsSource = fs.readFileSync(path.join(sharedDir, 'contracts.ts'), 'utf8');
    const meetingFeedbackSource = fs.readFileSync(
      path.join(sharedDir, 'meetingFeedback.ts'),
      'utf8'
    );

    expect(contractsSource).toContain("from './types.js'");
    expect(meetingFeedbackSource).toContain("from './types.js'");
  });
});
