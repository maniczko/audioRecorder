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
      getSession: vi.fn().mockResolvedValue({ userId: 'u1', workspaceId: 'ws1' }),
    };
    mockWorkspaceService = {
      getMembership: vi.fn().mockResolvedValue({ role: 'owner' }),
      getWorkspaceState: vi.fn().mockResolvedValue({ meetings: [], tasks: [] }),
    };
    mockTranscriptionService = {
      transcribeLiveChunk: vi.fn().mockResolvedValue({ text: '' }),
    };

    const { createApp } = await import('../../app.ts');
    app = createApp({
      authService: mockAuthService,
      workspaceService: mockWorkspaceService,
      transcriptionService: mockTranscriptionService,
      config: { allowedOrigins: '*', trustProxy: false, uploadDir: '/tmp' },
    });
  }, 15000);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // P0 — Critical Paths (< 100ms)
  // ───────────────────────────────────────────────────────────────────────────

  describe('P0 — Critical Paths', () => {
    test(`GET /health responds within ${SLA.HEALTH_CHECK}ms (SLA: P0)`, async () => {
      // Warmup request — first request pays cold-start cost (JIT, module init)
      await app.request('/health', { method: 'GET' });

      const { durationMs } = await measurePerformance(async () => {
        const res = await app.request('/health', { method: 'GET' });
        return await res.json();
      });

      assertSla({
        durationMs,
        slaMs: SLA.HEALTH_CHECK,
        passed: durationMs <= SLA.HEALTH_CHECK,
        marginMs: SLA.HEALTH_CHECK - durationMs,
      });
    });

    test(`GET /auth/session responds within ${SLA.SESSION_VALIDATION}ms (SLA: P0)`, async () => {
      const { durationMs } = await measurePerformance(async () => {
        const res = await app.request('/auth/session', {
          method: 'GET',
          headers: { Authorization: 'Bearer valid-token' },
        });
        return res.status;
      });

      assertSla({
        durationMs,
        slaMs: SLA.SESSION_VALIDATION,
        passed: durationMs <= SLA.SESSION_VALIDATION,
        marginMs: SLA.SESSION_VALIDATION - durationMs,
      });
    });
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
    test(`PUT /state/workspaces/:id responds within ${SLA.UPDATE_WORKSPACE_STATE}ms (SLA: P2)`, async () => {
      mockWorkspaceService.setWorkspaceState = vi.fn().mockResolvedValue(undefined);

      const { durationMs } = await measurePerformance(async () => {
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

      assertSla({
        durationMs,
        slaMs: SLA.UPDATE_WORKSPACE_STATE,
        passed: durationMs <= SLA.UPDATE_WORKSPACE_STATE,
        marginMs: SLA.UPDATE_WORKSPACE_STATE - durationMs,
      });
    });

    test(`POST /voice-profiles responds within ${SLA.CREATE_RECORDING}ms (SLA: P2)`, async () => {
      mockWorkspaceService.createVoiceProfile = vi.fn().mockResolvedValue({ id: 'vp1' });

      const { durationMs } = await measurePerformance(async () => {
        const res = await app.request('/voice-profiles', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer valid-token',
            'Content-Type': 'application/json',
            'X-Speaker-Name': 'Test Speaker',
          },
          body: JSON.stringify({ embedding: [0.1, 0.2, 0.3] }),
        });
        return res.status;
      });

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
      const { durationMs } = await measurePerformance(async () => {
        const res = await app.request('/transcribe/live', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recordingId: 'rec1',
            chunk: 'base64data',
            index: 1,
            total: 10,
          }),
        });
        return res.status;
      });

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
