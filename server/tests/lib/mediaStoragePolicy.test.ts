import { describe, expect, it } from 'vitest';
import {
  MAX_RAW_UPLOAD_BYTES,
  SEGMENT_PART_MAX_BYTES,
  SINGLE_OBJECT_MAX_BYTES,
  buildSegmentedMediaManifest,
  buildPartTranscriptPath,
  createUploadPolicy,
  getManifestPartProgress,
  normalizeAudioMimeType,
  shouldUseSegmentedStorage,
  updateManifestPartTranscription,
  validateRawUploadSize,
} from '../../lib/mediaStoragePolicy.ts';

describe('mediaStoragePolicy', () => {
  it('publishes the 200MB raw upload policy with safe storage part limits', () => {
    const policy = createUploadPolicy();

    expect(policy.maxRawUploadBytes).toBe(200 * 1024 * 1024);
    expect(policy.singleObjectMaxBytes).toBe(24 * 1024 * 1024);
    expect(policy.segmentPartMaxBytes).toBe(20 * 1024 * 1024);
    expect(policy.storageContentType).toBe('audio/webm');
  });

  it('normalizes browser codec MIME variants before Supabase upload', () => {
    expect(normalizeAudioMimeType('audio/webm;codecs=opus')).toEqual({
      contentType: 'audio/webm',
      extension: '.webm',
      supported: true,
    });
    expect(normalizeAudioMimeType('audio/x-m4a')).toMatchObject({
      contentType: 'audio/mp4',
      extension: '.m4a',
      supported: true,
    });
  });

  it('rejects raw uploads above 200MB with a typed 413 error', () => {
    const result = validateRawUploadSize(MAX_RAW_UPLOAD_BYTES + 1);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(413);
    expect(result.code).toBe('audio_too_large');
  });

  it('chooses segmented storage only when normalized audio exceeds 24MB', () => {
    expect(shouldUseSegmentedStorage(SINGLE_OBJECT_MAX_BYTES)).toBe(false);
    expect(shouldUseSegmentedStorage(SINGLE_OBJECT_MAX_BYTES + 1)).toBe(true);
  });

  it('builds a durable manifest with parts capped below the STT object limit', () => {
    const manifest = buildSegmentedMediaManifest({
      recordingId: 'recording_big',
      workspaceId: 'workspace_1',
      sourceSizeBytes: 180 * 1024 * 1024,
      normalizedSizeBytes: 49 * 1024 * 1024,
      durationMs: 30 * 60 * 1000,
      parts: [
        {
          index: 0,
          path: 'workspace_1/recording_big/part-000.webm',
          startMs: 0,
          endMs: 10 * 60 * 1000,
          sizeBytes: SEGMENT_PART_MAX_BYTES,
          contentType: 'audio/webm',
        },
        {
          index: 1,
          path: 'workspace_1/recording_big/part-001.webm',
          startMs: 10 * 60 * 1000,
          endMs: 20 * 60 * 1000,
          sizeBytes: 18 * 1024 * 1024,
          contentType: 'audio/webm',
        },
      ],
    });

    expect(manifest.version).toBe(1);
    expect(manifest.storageMode).toBe('segmented');
    expect(manifest.parts).toHaveLength(2);
    expect(manifest.parts.every((part) => part.sizeBytes <= SEGMENT_PART_MAX_BYTES)).toBe(true);
  });

  it('tracks durable STT checkpoint state per segmented manifest part', () => {
    const manifest = buildSegmentedMediaManifest({
      recordingId: 'recording_big',
      workspaceId: 'workspace_1',
      sourceSizeBytes: 180 * 1024 * 1024,
      normalizedSizeBytes: 49 * 1024 * 1024,
      durationMs: 30 * 60 * 1000,
      parts: [
        {
          index: 0,
          path: 'workspace_1/recording_big/part-000.webm',
          startMs: 0,
          endMs: 10 * 60 * 1000,
          sizeBytes: 19 * 1024 * 1024,
          contentType: 'audio/webm',
        },
        {
          index: 1,
          path: 'workspace_1/recording_big/part-001.webm',
          startMs: 10 * 60 * 1000,
          endMs: 20 * 60 * 1000,
          sizeBytes: 18 * 1024 * 1024,
          contentType: 'audio/webm',
        },
      ],
    });

    const next = updateManifestPartTranscription(manifest, 1, {
      status: 'completed',
      attempts: 2,
      provider: 'openai',
      model: 'gpt-4o-transcribe',
      payloadPath: buildPartTranscriptPath('workspace_1', 'recording_big', 1),
      segmentCount: 12,
      textLength: 256,
    });

    expect(next.parts[0].transcription?.status).toBe('pending');
    expect(next.parts[1].transcription).toMatchObject({
      status: 'completed',
      attempts: 2,
      payloadPath: 'workspace_1/recording_big/transcripts/part-001.json',
      segmentCount: 12,
      textLength: 256,
    });
    expect(getManifestPartProgress(next)).toEqual({
      total: 2,
      completed: 1,
      failed: 0,
      processingIndex: null,
    });
  });
});
