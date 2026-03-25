import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from '../../app.ts';

describe('Voice Profiles Routes', () => {
  let app: ReturnType<typeof createApp>;
  let mockWorkspaceService: any;
  let mockTranscriptionService: any;

  beforeEach(() => {
    mockWorkspaceService = {
      getWorkspaceVoiceProfiles: vi.fn(),
      saveVoiceProfile: vi.fn(),
      upsertVoiceProfile: vi.fn(),
      updateVoiceProfileThreshold: vi.fn(),
      deleteVoiceProfile: vi.fn(),
    };
    mockTranscriptionService = {
      computeEmbedding: vi.fn(),
    };

    const testAuthService = {
      getSession: vi.fn().mockResolvedValue({ user_id: 'u1', workspace_id: 'w1' }),
    };

    app = createApp({
      authService: testAuthService as any,
      workspaceService: mockWorkspaceService,
      transcriptionService: mockTranscriptionService,
      config: { allowedOrigins: '*', trustProxy: false, uploadDir: '/tmp' },
    });
  });

  it('GET /voice-profiles - happy path', async () => {
    mockWorkspaceService.getWorkspaceVoiceProfiles.mockResolvedValue([
      { id: 'vp_1', speaker_name: 'John', user_id: 'u1', created_at: '2024-01-01' },
      { id: 'vp_2', speaker_name: 'Jane', user_id: 'u1', created_at: '2024-01-02' },
    ]);

    const res = await app.request('/voice-profiles', {
      method: 'GET',
      headers: { Authorization: 'Bearer fake_token' },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.profiles).toHaveLength(2);
    expect(data.profiles[0].speakerName).toBe('John');
    expect(mockWorkspaceService.getWorkspaceVoiceProfiles).toHaveBeenCalledWith('w1');
  });

  it('POST /voice-profiles - fails when X-Speaker-Name is missing', async () => {
    const res = await app.request('/voice-profiles', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake_token' },
      body: Buffer.from('fake-audio-data-at-least-1k-bytes'.repeat(40)), // >1000 bytes
    });
    expect(res.status).toBe(400);
  });

  it('POST /voice-profiles - happy path', async () => {
    mockTranscriptionService.computeEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    mockWorkspaceService.upsertVoiceProfile.mockResolvedValue({
      id: 'vp_new',
      user_id: 'u1',
      workspace_id: 'w1',
      speaker_name: 'Alice',
      created_at: '2024',
      sample_count: 1,
      threshold: 0.82,
      isUpdate: false,
    });

    const res = await app.request('/voice-profiles', {
      method: 'POST',
      headers: {
        'X-Speaker-Name': 'Alice',
        'Content-Type': 'audio/webm',
        Authorization: 'Bearer fake_token',
      },
      body: Buffer.from('fake-audio-data-at-least-1k-bytes'.repeat(40)), // >1000 bytes
    });

    if (res.status !== 201) console.log('POST /voice-profiles error:', await res.clone().json());
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe('vp_new');
    expect(data.speakerName).toBe('Alice');
    expect(mockTranscriptionService.computeEmbedding).toHaveBeenCalled();
    expect(mockWorkspaceService.upsertVoiceProfile).toHaveBeenCalledWith(
      expect.objectContaining({ speakerName: 'Alice', workspaceId: 'w1' })
    );
  });

  it('DELETE /voice-profiles/:id', async () => {
    mockWorkspaceService.deleteVoiceProfile.mockResolvedValue(undefined);

    const res = await app.request('/voice-profiles/vp_1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer fake_token' },
    });
    expect(res.status).toBe(204);
    expect(mockWorkspaceService.deleteVoiceProfile).toHaveBeenCalledWith('vp_1', 'w1');
  });
});
