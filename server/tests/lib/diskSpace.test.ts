import { describe, expect, test } from 'vitest';
import {
  classifyDiskSpace,
  DISK_SPACE_BLOCK_UPLOAD_BYTES,
  DISK_SPACE_WARN_BYTES,
} from '../../lib/diskSpace.ts';

describe('diskSpace helpers', () => {
  test('classifies free space above warning threshold as ok', () => {
    expect(classifyDiskSpace(DISK_SPACE_WARN_BYTES + 1)).toEqual({
      severity: 'ok',
      blocksRecordingWrites: false,
    });
  });

  test('classifies free space between block and warning thresholds as warning', () => {
    expect(classifyDiskSpace(80 * 1024 * 1024)).toEqual({
      severity: 'warning',
      blocksRecordingWrites: false,
    });
  });

  test('classifies free space below upload hard limit as critical', () => {
    expect(classifyDiskSpace(DISK_SPACE_BLOCK_UPLOAD_BYTES - 1)).toEqual({
      severity: 'critical',
      blocksRecordingWrites: true,
    });
  });
});
