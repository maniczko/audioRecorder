import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createMediaService } from './mediaService';
import { apiRequest } from './httpClient';

vi.mock('./httpClient', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('./config', () => ({
  MEDIA_PIPELINE_PROVIDER: 'remote',
}));

describe('mediaService - remote mode', () => {
  const mediaService = createMediaService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('persistRecordingAudio sends PUT to /media/recordings/:id/audio', async () => {
    const mockBlob = new Blob(['test'], { type: 'audio/webm' });
    await mediaService.persistRecordingAudio('rec_1', mockBlob, { workspaceId: 'w1', meetingId: 'm1' });

    expect(apiRequest).toHaveBeenCalledWith('/media/recordings/rec_1/audio', {
      method: 'PUT',
      body: mockBlob,
      headers: expect.objectContaining({
        'Content-Type': 'audio/webm',
        'X-Workspace-Id': 'w1',
        'X-Meeting-Id': 'm1'
      })
    });
  });

  test('startTranscriptionJob sends POST to /media/recordings/:id/transcribe', async () => {
    const meeting = { id: 'm1', workspaceId: 'w1', title: 'Test', attendees: ['Jan'] };
    const mockBlob = new Blob();

    (apiRequest as any).mockResolvedValue({ pipelineStatus: 'queued' });

    await mediaService.startTranscriptionJob({
      recordingId: 'rec_1',
      blob: mockBlob,
      meeting
    });

    expect(apiRequest).toHaveBeenCalledWith('/media/recordings/rec_1/transcribe', {
      method: 'POST',
      body: {
        meetingId: 'm1',
        workspaceId: 'w1',
        contentType: 'audio/webm',
        meetingTitle: 'Test',
        participants: ['Jan'],
        tags: []
      }
    });
  });

  test('getTranscriptionJobStatus sends GET to /media/recordings/:id/transcribe', async () => {
    (apiRequest as any).mockResolvedValue({ 
      pipelineStatus: 'done', 
      segments: [{ text: 'Done', speakerId: 0, timestamp: 0 }] 
    });

    const status = await mediaService.getTranscriptionJobStatus('rec_1');

    expect(apiRequest).toHaveBeenCalledWith('/media/recordings/rec_1/transcribe', {
      method: 'GET'
    });
    
    expect(status.pipelineStatus).toBe('done');
    expect(status.verifiedSegments).toHaveLength(1);
  });

  test('normalizeRecordingAudio sends POST to /media/recordings/:id/normalize', async () => {
    await mediaService.normalizeRecordingAudio('rec_1');
    expect(apiRequest).toHaveBeenCalledWith('/media/recordings/rec_1/normalize', {
      method: 'POST'
    });
  });
});
