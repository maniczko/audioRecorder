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
      getMembership: vi.fn().mockResolvedValue({ member_role: 'owner' }),
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
      {
        id: 'vp_1',
        speaker_name: 'John',
        user_id: 'u1',
        created_at: '2024-01-01',
        updated_at: '2024-01-03',
        profile_source: 'manual_upload',
        embedding_model: 'voice-profile-embedding',
        embedding_version: '1',
        created_by: 'creator_1',
        embedding_json: JSON.stringify([0.1, 0.2, 0.3]),
        sample_count: 3,
        threshold: 0.87,
      },
      {
        id: 'vp_2',
        speaker_name: 'Jane',
        user_id: 'u1',
        created_at: '2024-01-02',
        embedding_json: null,
        sample_count: 0,
        threshold: 0.82,
      },
    ]);

    const res = await app.request('/voice-profiles', {
      method: 'GET',
      headers: { Authorization: 'Bearer fake_token' },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.profiles).toHaveLength(2);
    expect(data.profiles[0].speakerName).toBe('John');
    expect(data.profiles[0]).toMatchObject({
      hasEmbedding: true,
      sampleCount: 3,
      threshold: 0.87,
      source: 'manual_upload',
      model: 'voice-profile-embedding',
      version: '1',
      createdBy: 'creator_1',
      updatedAt: '2024-01-03',
    });
    expect(data.profiles[0]).not.toHaveProperty('embedding_json');
    expect(data.profiles[0]).not.toHaveProperty('embeddingJson');
    expect(data.profiles[0]).not.toHaveProperty('embedding');
    expect(data.profiles[0]).not.toHaveProperty('vector');
    expect(data.profiles[1]).toMatchObject({
      hasEmbedding: false,
      sampleCount: 0,
      threshold: 0.82,
      source: 'unknown',
      model: 'unknown',
      version: '1',
      createdBy: 'u1',
      updatedAt: '2024-01-02',
    });
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
      updated_at: '2024-01-04',
      profile_source: 'manual_upload',
      embedding_model: 'voice-profile-embedding',
      embedding_version: '1',
      created_by: 'u1',
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
    expect(data).toMatchObject({
      id: 'vp_new',
      speakerName: 'Alice',
      source: 'manual_upload',
      model: 'voice-profile-embedding',
      version: '1',
      createdBy: 'u1',
      updatedAt: '2024-01-04',
    });
    expect(data).not.toHaveProperty('embedding_json');
    expect(data).not.toHaveProperty('embeddingJson');
    expect(data).not.toHaveProperty('embedding');
    expect(data).not.toHaveProperty('vector');
    expect(mockTranscriptionService.computeEmbedding).toHaveBeenCalled();
    expect(mockWorkspaceService.upsertVoiceProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        speakerName: 'Alice',
        workspaceId: 'w1',
        source: 'manual_upload',
        model: 'voice-profile-embedding',
        version: '1',
        createdBy: 'u1',
      })
    );
  });

  it.each([
    ['empty array', []],
    ['null', null],
    ['undefined', undefined],
  ])(
    'POST /voice-profiles - rejects %s embedding before profile persistence',
    async (_label, embeddingValue) => {
      mockTranscriptionService.computeEmbedding.mockResolvedValue(embeddingValue);

      const res = await app.request('/voice-profiles', {
        method: 'POST',
        headers: {
          'X-Speaker-Name': 'Alice',
          'Content-Type': 'audio/webm',
          Authorization: 'Bearer fake_token',
        },
        body: Buffer.from('fake-audio-data-at-least-1k-bytes'.repeat(40)),
      });

      expect(res.status).toBe(503);
      await expect(res.json()).resolves.toEqual(
        expect.objectContaining({
          code: 'embedding_failed',
          stage: 'embedding',
          message: expect.any(String),
        })
      );
      expect(mockWorkspaceService.upsertVoiceProfile).not.toHaveBeenCalled();
    }
  );

  it.each(['owner', 'admin'])('DELETE /voice-profiles/:id - allows %s role', async (role) => {
    mockWorkspaceService.getMembership.mockResolvedValueOnce({ member_role: role });
    mockWorkspaceService.deleteVoiceProfile.mockResolvedValue(undefined);

    const res = await app.request('/voice-profiles/vp_1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer fake_token' },
    });
    expect(res.status).toBe(204);
    expect(mockWorkspaceService.deleteVoiceProfile).toHaveBeenCalledWith('vp_1', 'w1', {
      actorUserId: 'u1',
      source: 'api',
    });
  });

  // -----------------------------------------------------------------
  // Issue #1338 - voice profile delete permissions
  // Date: 2026-07-01
  // Bug: member/viewer roles could delete voice profiles without admin rights.
  // Fix: delete requires owner/admin membership before mutating profile data.
  // -----------------------------------------------------------------
  it.each(['member', 'viewer'])('DELETE /voice-profiles/:id - blocks %s role', async (role) => {
    mockWorkspaceService.getMembership.mockResolvedValueOnce({ member_role: role });

    const res = await app.request('/voice-profiles/vp_1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer fake_token' },
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.message).toBe('Tylko owner lub admin moze usunac profil glosowy.');
    expect(mockWorkspaceService.deleteVoiceProfile).not.toHaveBeenCalled();
  });

  it('DELETE /voice-profiles/:id - is idempotent on repeated deletes in parallel', async () => {
    mockWorkspaceService.deleteVoiceProfile.mockResolvedValue(undefined);

    const headers = { Authorization: 'Bearer fake_token' };
    const deleteOnce = app.request('/voice-profiles/vp_1', {
      method: 'DELETE',
      headers,
    });
    const deleteTwice = app.request('/voice-profiles/vp_1', {
      method: 'DELETE',
      headers,
    });

    const [first, second] = await Promise.all([deleteOnce, deleteTwice]);

    expect(first.status).toBe(204);
    expect(second.status).toBe(204);
    expect(mockWorkspaceService.deleteVoiceProfile).toHaveBeenCalledTimes(2);
    expect(mockWorkspaceService.deleteVoiceProfile).toHaveBeenNthCalledWith(1, 'vp_1', 'w1', {
      actorUserId: 'u1',
      source: 'api',
    });
    expect(mockWorkspaceService.deleteVoiceProfile).toHaveBeenNthCalledWith(2, 'vp_1', 'w1', {
      actorUserId: 'u1',
      source: 'api',
    });
  });

  describe('PATCH /voice-profiles/:id/threshold', () => {
    it.each(['owner', 'admin'])(
      'PATCH /voice-profiles/:id/threshold - allows %s role',
      async (role) => {
        mockWorkspaceService.getMembership.mockResolvedValueOnce({ member_role: role });
        mockWorkspaceService.updateVoiceProfileThreshold.mockResolvedValue({
          id: 'vp_1',
          threshold: 0.92,
        });

        const res = await app.request('/voice-profiles/vp_1/threshold', {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer fake_token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ threshold: 0.92 }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toEqual(
          expect.objectContaining({
            id: 'vp_1',
            threshold: 0.92,
          })
        );
        expect(mockWorkspaceService.updateVoiceProfileThreshold).toHaveBeenCalledWith(
          'vp_1',
          'w1',
          0.92
        );
      }
    );

    it('PATCH /voice-profiles/:id/threshold - happy path updates threshold', async () => {
      mockWorkspaceService.updateVoiceProfileThreshold.mockResolvedValue({
        id: 'vp_1',
        threshold: 0.92,
      });

      const res = await app.request('/voice-profiles/vp_1/threshold', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer fake_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ threshold: 0.92 }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(
        expect.objectContaining({
          id: 'vp_1',
          threshold: 0.92,
        })
      );
      expect(mockWorkspaceService.updateVoiceProfileThreshold).toHaveBeenCalledWith(
        'vp_1',
        'w1',
        0.92
      );
    });

    it('PATCH /voice-profiles/:id/threshold - rejects threshold below 0.50 with 400', async () => {
      const res = await app.request('/voice-profiles/vp_1/threshold', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer fake_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ threshold: 0.49 }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toEqual(
        expect.objectContaining({
          message: 'threshold musi byc liczba w zakresie 0.50-0.99.',
        })
      );
      expect(mockWorkspaceService.updateVoiceProfileThreshold).not.toHaveBeenCalled();
    });

    it('PATCH /voice-profiles/:id/threshold - rejects threshold above 0.99 with 400', async () => {
      const res = await app.request('/voice-profiles/vp_1/threshold', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer fake_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ threshold: 1 }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toBe('threshold musi byc liczba w zakresie 0.50-0.99.');
      expect(mockWorkspaceService.updateVoiceProfileThreshold).not.toHaveBeenCalled();
    });

    it('PATCH /voice-profiles/:id/threshold - rejects non-numeric threshold', async () => {
      const res = await app.request('/voice-profiles/vp_1/threshold', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer fake_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ threshold: 'invalid' }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toContain('0.50-0.99');
      expect(mockWorkspaceService.updateVoiceProfileThreshold).not.toHaveBeenCalled();
    });

    it('PATCH /voice-profiles/:id/threshold - returns 404 when profile is missing', async () => {
      mockWorkspaceService.updateVoiceProfileThreshold.mockResolvedValue(null);

      const res = await app.request('/voice-profiles/vp_missing/threshold', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer fake_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ threshold: 0.86 }),
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data).toEqual(
        expect.objectContaining({
          message: 'Profil nie znaleziony.',
        })
      );
    });

    it('PATCH /voice-profiles/:id/threshold - returns 500 when update fails', async () => {
      mockWorkspaceService.updateVoiceProfileThreshold.mockRejectedValue(
        new Error('transient storage outage')
      );

      const res = await app.request('/voice-profiles/vp_1/threshold', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer fake_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ threshold: 0.88 }),
      });

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data).toEqual(
        expect.objectContaining({
          message: expect.any(String),
        })
      );
      expect(mockWorkspaceService.updateVoiceProfileThreshold).toHaveBeenCalledTimes(1);
    });

    it('PATCH /voice-profiles/:id/threshold - maps 429 service errors to rate limit response', async () => {
      const rateLimitError: any = new Error('Rate limit exceeded');
      rateLimitError.statusCode = 429;
      rateLimitError.retryAfter = 30;
      mockWorkspaceService.updateVoiceProfileThreshold.mockRejectedValue(rateLimitError);

      const res = await app.request('/voice-profiles/vp_1/threshold', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer fake_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ threshold: 0.88 }),
      });

      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('30');
      const data = await res.json();
      expect(data).toEqual(
        expect.objectContaining({
          message: 'Rate limit exceeded',
        })
      );
      expect(mockWorkspaceService.updateVoiceProfileThreshold).toHaveBeenCalledOnce();
    });

    it('PATCH /voice-profiles/:id/threshold - maps transient infra errors to temporary-unavailable', async () => {
      mockWorkspaceService.updateVoiceProfileThreshold.mockRejectedValue(
        Object.assign(new Error('ENOTFOUND voice-profile service'), { statusCode: 503 })
      );

      const res = await app.request('/voice-profiles/vp_1/threshold', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer fake_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ threshold: 0.87 }),
      });

      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data).toEqual(
        expect.objectContaining({
          message: 'Serwer jest chwilowo niedostępny. Spróbuj ponownie za chwilę.',
        })
      );
      expect(mockWorkspaceService.updateVoiceProfileThreshold).toHaveBeenCalledWith(
        'vp_1',
        'w1',
        0.87
      );
    });

    it('PATCH /voice-profiles/:id/threshold - accepts boundary values 0.50 and 0.99', async () => {
      mockWorkspaceService.updateVoiceProfileThreshold
        .mockResolvedValueOnce({ id: 'vp_1', threshold: 0.5 })
        .mockResolvedValueOnce({ id: 'vp_1', threshold: 0.99 });

      const first = await app.request('/voice-profiles/vp_1/threshold', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer fake_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ threshold: 0.5 }),
      });
      const second = await app.request('/voice-profiles/vp_1/threshold', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer fake_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ threshold: 0.99 }),
      });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(await first.json()).toEqual(
        expect.objectContaining({
          id: 'vp_1',
          threshold: 0.5,
        })
      );
      expect(await second.json()).toEqual(
        expect.objectContaining({
          id: 'vp_1',
          threshold: 0.99,
        })
      );
      expect(mockWorkspaceService.updateVoiceProfileThreshold).toHaveBeenNthCalledWith(
        1,
        'vp_1',
        'w1',
        0.5
      );
      expect(mockWorkspaceService.updateVoiceProfileThreshold).toHaveBeenNthCalledWith(
        2,
        'vp_1',
        'w1',
        0.99
      );
    });

    it('PATCH /voice-profiles/:id/threshold - supports transient failure recovery with client retry', async () => {
      mockWorkspaceService.updateVoiceProfileThreshold
        .mockRejectedValueOnce(
          Object.assign(new Error('ECONNRESET while updating threshold'), { statusCode: 503 })
        )
        .mockResolvedValueOnce({ id: 'vp_1', threshold: 0.88 });

      const first = await app.request('/voice-profiles/vp_1/threshold', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer fake_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ threshold: 0.88 }),
      });
      const second = await app.request('/voice-profiles/vp_1/threshold', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer fake_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ threshold: 0.88 }),
      });

      expect(first.status).toBe(503);
      expect(second.status).toBe(200);
      expect(await second.json()).toEqual(
        expect.objectContaining({
          id: 'vp_1',
          threshold: 0.88,
        })
      );
      expect(mockWorkspaceService.updateVoiceProfileThreshold).toHaveBeenCalledTimes(2);
      expect(mockWorkspaceService.updateVoiceProfileThreshold).toHaveBeenNthCalledWith(
        1,
        'vp_1',
        'w1',
        0.88
      );
      expect(mockWorkspaceService.updateVoiceProfileThreshold).toHaveBeenNthCalledWith(
        2,
        'vp_1',
        'w1',
        0.88
      );
    });

    it('PATCH /voice-profiles/:id/threshold - requires auth', async () => {
      const unauthorizedApp = createApp({
        authService: { getSession: vi.fn().mockResolvedValue(null) } as any,
        workspaceService: mockWorkspaceService,
        transcriptionService: mockTranscriptionService,
        config: { allowedOrigins: '*', trustProxy: false, uploadDir: '/tmp' },
      });

      const res = await unauthorizedApp.request('/voice-profiles/vp_1/threshold', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: 0.85 }),
      });

      expect(res.status).toBe(401);
    });

    it('PATCH /voice-profiles/:id/threshold - supports repeated identical updates (idempotency edge)', async () => {
      mockWorkspaceService.updateVoiceProfileThreshold.mockResolvedValue({
        id: 'vp_1',
        threshold: 0.81,
      });

      const body = JSON.stringify({ threshold: 0.81 });
      const headers = {
        Authorization: 'Bearer fake_token',
        'Content-Type': 'application/json',
      };

      const first = await app.request('/voice-profiles/vp_1/threshold', {
        method: 'PATCH',
        headers,
        body,
      });
      const second = await app.request('/voice-profiles/vp_1/threshold', {
        method: 'PATCH',
        headers,
        body,
      });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      const firstData = await first.json();
      const secondData = await second.json();
      expect(firstData.threshold).toBe(0.81);
      expect(secondData.threshold).toBe(0.81);
      expect(mockWorkspaceService.updateVoiceProfileThreshold).toHaveBeenCalledTimes(2);
      expect(mockWorkspaceService.updateVoiceProfileThreshold).toHaveBeenNthCalledWith(
        1,
        'vp_1',
        'w1',
        0.81
      );
      expect(mockWorkspaceService.updateVoiceProfileThreshold).toHaveBeenNthCalledWith(
        2,
        'vp_1',
        'w1',
        0.81
      );
    });

    // -----------------------------------------------------------------
    // Issue #1338 - voice profile threshold permissions
    // Date: 2026-07-01
    // Bug: member role could update threshold while only viewer was blocked.
    // Fix: threshold update requires owner/admin membership consistently.
    // -----------------------------------------------------------------
    it.each(['member', 'viewer'])(
      'PATCH /voice-profiles/:id/threshold - blocks %s role',
      async (role) => {
        mockWorkspaceService.getMembership.mockResolvedValueOnce({ member_role: role });

        const res = await app.request('/voice-profiles/vp_1/threshold', {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer fake_token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ threshold: 0.83 }),
        });

        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.message).toBe('Tylko owner lub admin moze zmieniac threshold.');
        expect(mockWorkspaceService.updateVoiceProfileThreshold).not.toHaveBeenCalled();
      }
    );
  });
});
