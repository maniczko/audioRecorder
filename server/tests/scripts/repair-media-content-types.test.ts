import { describe, expect, test } from 'vitest';
import {
  buildRepairPlan,
  isRepairableWebmContentTypeMismatch,
} from '../../scripts/repair-media-content-types.ts';

describe('repair-media-content-types script', () => {
  test('Regression: #0 - dry-run plan includes only WebM assets mislabeled as MPEG', () => {
    const rows = [
      {
        id: 'rec_webm_mismatch',
        workspace_id: 'ws_1',
        file_path: 'ws_1/rec_webm_mismatch/audio.webm',
        content_type: 'audio/mpeg',
      },
      {
        id: 'rec_mp3',
        workspace_id: 'ws_1',
        file_path: 'ws_1/rec_mp3/audio.mp3',
        content_type: 'audio/mpeg',
      },
      {
        id: 'rec_webm_ok',
        workspace_id: 'ws_1',
        file_path: 'ws_1/rec_webm_ok/audio.webm',
        content_type: 'audio/webm',
      },
    ];

    expect(isRepairableWebmContentTypeMismatch(rows[0])).toBe(true);
    expect(buildRepairPlan(rows)).toEqual([
      {
        id: 'rec_webm_mismatch',
        workspaceId: 'ws_1',
        filePath: 'ws_1/rec_webm_mismatch/audio.webm',
        from: 'audio/mpeg',
        to: 'audio/webm',
      },
    ]);
  });
});
