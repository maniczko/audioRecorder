export const DISK_SPACE_BLOCK_UPLOAD_BYTES = 50 * 1024 * 1024;
export const DISK_SPACE_WARN_BYTES = 500 * 1024 * 1024;

export type DiskSpaceSeverity = 'ok' | 'warning' | 'critical';

export function classifyDiskSpace(freeBytes: number): {
  severity: DiskSpaceSeverity;
  blocksRecordingWrites: boolean;
} {
  const normalizedFreeBytes = Math.max(0, Number(freeBytes) || 0);

  if (normalizedFreeBytes < DISK_SPACE_BLOCK_UPLOAD_BYTES) {
    return {
      severity: 'critical',
      blocksRecordingWrites: true,
    };
  }

  if (normalizedFreeBytes < DISK_SPACE_WARN_BYTES) {
    return {
      severity: 'warning',
      blocksRecordingWrites: false,
    };
  }

  return {
    severity: 'ok',
    blocksRecordingWrites: false,
  };
}
