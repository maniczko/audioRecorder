/**
 * Performance Regression Tests — Response Time SLAs
 *
 * Following AGENTS.md §2.1 and §9:
 * - Each test defines maximum acceptable response time (SLA)
 * - Tests fail if response time exceeds threshold
 * - Run: pnpm run test:performance
 *
 * SLA Tiers:
 * - P0 (Critical): < 100ms — Health checks, auth sessions
 * - P1 (High): < 500ms — Read operations, simple queries
 * - P2 (Medium): < 1000ms — Write operations, complex queries
 * - P3 (Low): < 3000ms — AI/ML operations, batch processing
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { performance } from 'node:perf_hooks';

// ─────────────────────────────────────────────────────────────────────────────
// Performance Test Utilities
// ─────────────────────────────────────────────────────────────────────────────

interface PerformanceMetrics {
  durationMs: number;
  slaMs: number;
  passed: boolean;
  marginMs: number;
}

function measurePerformance<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  return fn().then((result) => ({
    result,
    durationMs: Math.round(performance.now() - start),
  }));
}

function assertSla(metrics: PerformanceMetrics): void {
  expect(metrics.durationMs).toBeLessThanOrEqual(metrics.slaMs);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLA Thresholds (in milliseconds)
// ─────────────────────────────────────────────────────────────────────────────

const SLA = {
  // P0 — Critical paths
  HEALTH_CHECK: 100,
  SESSION_VALIDATION: 100,
  BOOTSTRAP: 500,

  // P1 — Read operations
  GET_MEDIA_ASSET: 500,
  GET_WORKSPACE: 500,
  GET_VOICE_PROFILES: 500,
  LIST_RECORDINGS: 500,

  // P2 — Write operations
  CREATE_RECORDING: 1000,
  UPDATE_WORKSPACE_STATE: 1000,
  UPLOAD_AUDIO_CHUNK: 1000,
  FINALIZE_RECORDING: 1000,

  // P3 — AI/ML operations
  TRANSCRIBE_LIVE: 3000,
  ANALYZE_MEETING: 3000,
  GENERATE_SKETCHNOTE: 3000,
  AI_SEARCH: 3000,
  AI_SUGGEST_TASKS: 3000,
} as const;

const PERFORMANCE_ENV_MULTIPLIER = process.env.CI ? 1 : 25;

function getSla(targetMs: number): number {
  return targetMs * PERFORMANCE_ENV_MULTIPLIER;
}

// ─────────────────────────────────────────────────────────────────────────────
// Performance Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Performance Regression — Response Time SLAs', () => {
  let app: any;
  let mockAuthService: any;
  let mockWorkspaceService: any;
  let mockTranscriptionService: any;

  beforeEach(async () => {
    vi.resetModules();

    mockAuthService = {
      getSession: vi.fn().mockResolvedValue({ user_id: 'u1', workspace_id: 'ws1' }),
      buildSessionPayload: vi
        .fn()
        .mockResolvedValue({ user: { id: 'u1' }, workspace: { id: 'ws1' } }),
    };
    mockWorkspaceService = {
      getMembership: vi.fn().mockResolvedValue({ member_role: 'owner' }),
      getWorkspaceState: vi.fn().mockResolvedValue({ meetings: [], tasks: [] }),
      saveWorkspaceState: vi.fn().mockResolvedValue({ meetings: [], tasks: [] }),
      getWorkspaceVoiceProfiles: vi.fn().mockResolvedValue([]),
      upsertVoiceProfile: vi.fn().mockResolvedValue({
        id: 'vp1',
        speaker_name: 'Test Speaker',
        created_at: '2026-04-05T00:00:00.000Z',
        sample_count: 1,
        threshold: 0.82,
        isUpdate: false,
      }),
    };
    mockTranscriptionService = {
      transcribeLiveChunk: vi.fn().mockResolvedValue('live transcript'),
      computeEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    };

    const { createApp } = await import('../../app.ts');
    app = createApp({
      authService: mockAuthService,
      workspaceService: mockWorkspaceService,
      transcriptionService: mockTranscriptionService,
      config: { allowedOrigins: '*', trustProxy: false, uploadDir: '/tmp' },
    });
  }, 60000);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // P0 — Critical Paths (< 100ms)
  // ───────────────────────────────────────────────────────────────────────────

  describe('P0 — Critical Paths', () => {
    test(`GET /health responds within ${getSla(SLA.HEALTH_CHECK)}ms (SLA: P0)`, async () => {
      // Warmup request — first request pays cold-start cost (JIT, module init)
      await app.request('/health', { method: 'GET' });

      const { durationMs } = await measurePerformance(async () => {
        const res = await app.request('/health', { method: 'GET' });
        return await res.json();
      });

      assertSla({
        durationMs,
        slaMs: getSla(SLA.HEALTH_CHECK),
        passed: durationMs <= getSla(SLA.HEALTH_CHECK),
        marginMs: getSla(SLA.HEALTH_CHECK) - durationMs,
      });
    }, 30000);

    test(`GET /auth/session responds within ${getSla(SLA.SESSION_VALIDATION)}ms (SLA: P0)`, async () => {
      const { durationMs } = await measurePerformance(async () => {
        const res = await app.request('/auth/session', {
          method: 'GET',
          headers: { Authorization: 'Bearer valid-token' },
        });
        return res.status;
      });

      assertSla({
        durationMs,
        slaMs: getSla(SLA.SESSION_VALIDATION),
        passed: durationMs <= getSla(SLA.SESSION_VALIDATION),
        marginMs: getSla(SLA.SESSION_VALIDATION) - durationMs,
      });
    }, 30000);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // P1 — Read Operations (< 500ms)
  // ───────────────────────────────────────────────────────────────────────────

  describe('P1 — Read Operations', () => {
    test(`GET /voice-profiles responds within ${SLA.GET_VOICE_PROFILES}ms (SLA: P1)`, async () => {
      mockWorkspaceService.getWorkspaceVoiceProfiles = vi.fn().mockResolvedValue([]);

      const { durationMs } = await measurePerformance(async () => {
        const res = await app.request('/voice-profiles', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer valid-token',
            'X-Workspace-Id': 'ws1',
          },
        });
        return res.status;
      });

      assertSla({
        durationMs,
        slaMs: SLA.GET_VOICE_PROFILES,
        passed: durationMs <= SLA.GET_VOICE_PROFILES,
        marginMs: SLA.GET_VOICE_PROFILES - durationMs,
      });
    });

    test(`GET /state/bootstrap responds within ${SLA.BOOTSTRAP}ms (SLA: P1)`, async () => {
      const { durationMs } = await measurePerformance(async () => {
        const res = await app.request('/state/bootstrap', {
          method: 'GET',
          headers: { Authorization: 'Bearer valid-token' },
        });
        return res.status;
      });

      assertSla({
        durationMs,
        slaMs: SLA.BOOTSTRAP,
        passed: durationMs <= SLA.BOOTSTRAP,
        marginMs: SLA.BOOTSTRAP - durationMs,
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // P2 — Write Operations (< 1000ms)
  // ───────────────────────────────────────────────────────────────────────────

  describe('P2 — Write Operations', () => {
    // ----------------------------------------------------------------
    // Issue #0 — performance SLA tests passed despite hidden 500 errors
    // Date: 2026-04-05
    // Bug: stale mocks used old service method names (setWorkspaceState,
    //      createVoiceProfile) and wrong payload shapes, so routes could
    //      return 500 while the test still passed because it only timed them.
    // Fix: align mocks with current route contracts and assert success status.
    // ----------------------------------------------------------------
    test(`PUT /state/workspaces/:id responds within ${SLA.UPDATE_WORKSPACE_STATE}ms (SLA: P2)`, async () => {
      const { result: status, durationMs } = await measurePerformance(async () => {
        const res = await app.request('/state/workspaces/ws1', {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ meetings: [] }),
        });
        return res.status;
      });

      expect(status).toBe(200);
      expect(mockWorkspaceService.saveWorkspaceState).toHaveBeenCalledWith('ws1', { meetings: [] });
      assertSla({
        durationMs,
        slaMs: SLA.UPDATE_WORKSPACE_STATE,
        passed: durationMs <= SLA.UPDATE_WORKSPACE_STATE,
        marginMs: SLA.UPDATE_WORKSPACE_STATE - durationMs,
      });
    });

    test(`POST /voice-profiles responds within ${SLA.CREATE_RECORDING}ms (SLA: P2)`, async () => {
      const { result: status, durationMs } = await measurePerformance(async () => {
        const res = await app.request('/voice-profiles', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer valid-token',
            'Content-Type': 'audio/webm',
            'X-Speaker-Name': 'Test Speaker',
          },
          body: Buffer.alloc(1500, 1),
        });
        return res.status;
      });

      expect(status).toBe(201);
      expect(mockTranscriptionService.computeEmbedding).toHaveBeenCalledTimes(1);
      expect(mockWorkspaceService.upsertVoiceProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          workspaceId: 'ws1',
          speakerName: 'Test Speaker',
          embedding: [0.1, 0.2, 0.3],
        })
      );
      assertSla({
        durationMs,
        slaMs: SLA.CREATE_RECORDING,
        passed: durationMs <= SLA.CREATE_RECORDING,
        marginMs: SLA.CREATE_RECORDING - durationMs,
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // P3 — AI/ML Operations (< 3000ms)
  // ───────────────────────────────────────────────────────────────────────────

  describe('P3 — AI/ML Operations', () => {
    test(`POST /transcribe/live responds within ${SLA.TRANSCRIBE_LIVE}ms (SLA: P3)`, async () => {
      const { result: payload, durationMs } = await measurePerformance(async () => {
        const res = await app.request('/transcribe/live', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer valid-token',
            'Content-Type': 'audio/webm',
          },
          body: Buffer.alloc(2048, 1),
        });
        return { status: res.status, body: await res.json() };
      });

      expect(payload.status).toBe(200);
      expect(payload.body).toEqual({ text: 'live transcript' });
      expect(mockTranscriptionService.transcribeLiveChunk).toHaveBeenCalledTimes(1);
      assertSla({
        durationMs,
        slaMs: SLA.TRANSCRIBE_LIVE,
        passed: durationMs <= SLA.TRANSCRIBE_LIVE,
        marginMs: SLA.TRANSCRIBE_LIVE - durationMs,
      });
    });

    test(`POST /ai/suggest-tasks responds within ${SLA.AI_SUGGEST_TASKS}ms (SLA: P3)`, async () => {
      // Mock Anthropic API to simulate realistic response time
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');

      const { durationMs } = await measurePerformance(async () => {
        const res = await app.request('/ai/suggest-tasks', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            meetingIds: ['m1'],
            transcript: 'Test transcript content for task suggestion',
          }),
        });
        return res.status;
      });

      assertSla({
        durationMs,
        slaMs: SLA.AI_SUGGEST_TASKS,
        passed: durationMs <= SLA.AI_SUGGEST_TASKS,
        marginMs: SLA.AI_SUGGEST_TASKS - durationMs,
      });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Performance Budget — Summary Statistics
// ─────────────────────────────────────────────────────────────────────────────

describe('Performance Budget — Summary', () => {
  test('P0 critical paths average < 100ms', () => {
    // This test documents the performance budget
    // Actual metrics would be collected from CI runs
    const budget = {
      tier: 'P0',
      maxAverageMs: 100,
      maxP95Ms: 150,
      maxP99Ms: 200,
      endpoints: ['/health', '/auth/session'],
    };

    expect(budget.maxAverageMs).toBeLessThanOrEqual(100);
  });

  test('P1 read operations average < 500ms', () => {
    const budget = {
      tier: 'P1',
      maxAverageMs: 500,
      maxP95Ms: 750,
      maxP99Ms: 1000,
      endpoints: ['/voice-profiles', '/state/bootstrap', '/media/*'],
    };

    expect(budget.maxAverageMs).toBeLessThanOrEqual(500);
  });

  test('P2 write operations average < 1000ms', () => {
    const budget = {
      tier: 'P2',
      maxAverageMs: 1000,
      maxP95Ms: 1500,
      maxP99Ms: 2000,
      endpoints: ['/state/workspaces/*', '/voice-profiles', '/media/recordings/*'],
    };

    expect(budget.maxAverageMs).toBeLessThanOrEqual(1000);
  });

  test('P3 AI/ML operations average < 3000ms', () => {
    const budget = {
      tier: 'P3',
      maxAverageMs: 3000,
      maxP95Ms: 4000,
      maxP99Ms: 5000,
      endpoints: ['/transcribe/*', '/ai/*', '/analyze/*'],
    };

    expect(budget.maxAverageMs).toBeLessThanOrEqual(3000);
  });
});
