import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';

function createFakeQuotaDb() {
  const rows = new Map<
    string,
    { key: string; count: number; reset_at: number; updated_at: string }
  >();
  return {
    async _execute(sql: string, params: unknown[] = []) {
      if (/CREATE TABLE/i.test(sql)) return;
      if (/INSERT INTO ai_quota_counters/i.test(sql)) {
        const [key, count, resetAt, updatedAt] = params;
        rows.set(String(key), {
          key: String(key),
          count: Number(count),
          reset_at: Number(resetAt),
          updated_at: String(updatedAt),
        });
        return;
      }
      if (/DELETE FROM ai_quota_counters/i.test(sql)) {
        rows.clear();
        return;
      }
      throw new Error(`Unexpected quota SQL: ${sql}`);
    },
    async _get(_sql: string, params: unknown[] = []) {
      return rows.get(String(params[0])) || null;
    },
  };
}

function createIntegerOverflowQuotaDb() {
  return {
    async _execute(sql: string) {
      if (/CREATE TABLE/i.test(sql)) return;
      if (/ALTER TABLE ai_quota_counters/i.test(sql)) {
        throw new Error('permission denied for table ai_quota_counters');
      }
      if (/INSERT INTO ai_quota_counters/i.test(sql)) {
        throw new Error('value "1782975650185" is out of range for type integer');
      }
      throw new Error(`Unexpected quota SQL: ${sql}`);
    },
    async _get() {
      return null;
    },
  };
}

describe('AI Routes', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let mockAuthService: any;
  let mockWorkspaceService: any;
  let mockTranscriptionService: any;

  beforeEach(async () => {
    vi.resetModules();

    mockAuthService = {
      getSession: vi.fn().mockResolvedValue({ user_id: 'u1', workspace_id: 'ws1' }),
    };
    mockWorkspaceService = {
      getMembership: vi.fn().mockResolvedValue({ role: 'owner' }),
    };
    mockTranscriptionService = {};

    const { createApp } = await import('../../app.ts');
    app = createApp({
      authService: mockAuthService,
      workspaceService: mockWorkspaceService,
      transcriptionService: mockTranscriptionService,
      config: { allowedOrigins: '*', trustProxy: false, uploadDir: '/tmp' },
    });
  }, 15000);

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('POST /ai/person-profile', () => {
    test('anonymous request is rejected', async () => {
      mockAuthService.getSession.mockResolvedValueOnce(null);

      const res = await app.request('/ai/person-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personName: 'Anna',
          meetings: [{ id: 'm1' }],
          allSegments: Array(10).fill({ text: 'test', meetingTitle: 'Meeting' }),
        }),
      });

      expect(res.status).toBe(401);
    });

    test('returns no-key mode when ANTHROPIC_API_KEY is not configured', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', '');

      const res = await app.request('/ai/person-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body: JSON.stringify({
          personName: 'Anna',
          meetings: [{ id: 'm1' }],
          allSegments: Array(10).fill({ text: 'test', meetingTitle: 'Meeting' }),
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mode).toBe('no-key');
    });

    test('returns no-key mode when personName is missing', async () => {
      const res = await app.request('/ai/person-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body: JSON.stringify({
          meetings: [{ id: 'm1' }],
          allSegments: Array(10).fill({ text: 'test', meetingTitle: 'Meeting' }),
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mode).toBe('no-key');
    });

    test('returns no-key mode when allSegments has less than 5 items', async () => {
      const res = await app.request('/ai/person-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body: JSON.stringify({
          personName: 'Anna',
          meetings: [{ id: 'm1' }],
          allSegments: [{ text: 'test', meetingTitle: 'Meeting' }],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mode).toBe('no-key');
    });

    test('calls Anthropic API and returns parsed profile when API key is configured', async () => {
      // stubEnv must happen before resetModules+import so config reads the key
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
      vi.stubEnv('ANTHROPIC_MODEL', 'claude-sonnet-4-6');
      vi.resetModules();
      const { createApp: createAppWithKey } = await import('../../app.ts');
      const appWithKey = createAppWithKey({
        authService: mockAuthService,
        workspaceService: mockWorkspaceService,
        transcriptionService: mockTranscriptionService,
        config: { allowedOrigins: '*', trustProxy: false, uploadDir: '/tmp' },
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [
            {
              text: JSON.stringify({
                disc: { D: 65, I: 45, S: 70, C: 55 },
                discStyle: 'SC — stabilny',
                discDescription: 'Opis stylu',
                values: [{ value: 'bezpieczeństwo', icon: '🛡️', quote: 'cytat' }],
                communicationStyle: 'analytical',
                decisionStyle: 'data-driven',
                conflictStyle: 'collaborative',
                listeningStyle: 'active',
                stressResponse: 'Reaguje spokojnie',
                workingWithTips: ['Wskazówka 1'],
                communicationDos: ['Co robić'],
                communicationDonts: ['Czego unikać'],
                redFlags: ['Wzorzec'],
                coachingNote: 'Obserwacja',
              }),
            },
          ],
        }),
      });

      const res = await appWithKey.request('/ai/person-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body: JSON.stringify({
          personName: 'Anna',
          meetings: [{ id: 'm1', title: 'Meeting' }],
          allSegments: Array(10).fill({ text: 'test statement', meetingTitle: 'Meeting' }),
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mode).toBe('anthropic');
      expect(json.meetingsAnalyzed).toBe(1);
      expect(json.disc).toEqual({ D: 65, I: 45, S: 70, C: 55 });
      expect(json.discStyle).toBe('SC — stabilny');
    });

    test('returns no-key mode when Anthropic API fails', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const res = await app.request('/ai/person-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body: JSON.stringify({
          personName: 'Anna',
          meetings: [{ id: 'm1' }],
          allSegments: Array(10).fill({ text: 'test', meetingTitle: 'Meeting' }),
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mode).toBe('no-key');
    });

    test('returns no-key mode when Anthropic returns non-JSON response', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [{ text: 'This is not JSON' }],
        }),
      });

      const res = await app.request('/ai/person-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body: JSON.stringify({
          personName: 'Anna',
          meetings: [{ id: 'm1' }],
          allSegments: Array(10).fill({ text: 'test', meetingTitle: 'Meeting' }),
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mode).toBe('no-key');
    });

    test('returns no-key mode when Anthropic returns empty content body', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [],
        }),
      });

      const res = await app.request('/ai/person-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body: JSON.stringify({
          personName: 'Anna',
          meetings: [{ id: 'm1' }],
          allSegments: Array(10).fill({ text: 'test', meetingTitle: 'Meeting' }),
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mode).toBe('no-key');
    });
  });

  describe('POST /ai/suggest-tasks', () => {
    test('anonymous request is rejected', async () => {
      mockAuthService.getSession.mockResolvedValueOnce(null);

      const res = await app.request('/ai/suggest-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: [{ speakerName: 'Anna', text: 'We need to finish the report' }],
          people: [{ name: 'Anna' }],
        }),
      });

      expect(res.status).toBe(401);
    });

    test('returns 429 when AI quota is exceeded', async () => {
      const originalUserQuota = process.env.VOICELOG_AI_USER_QUOTA_PER_HOUR;
      process.env.VOICELOG_AI_USER_QUOTA_PER_HOUR = '1';
      vi.resetModules();
      const { createApp: createQuotaApp } = await import('../../app.ts');
      const quotaApp = createQuotaApp({
        authService: mockAuthService,
        workspaceService: mockWorkspaceService,
        transcriptionService: mockTranscriptionService,
        config: { allowedOrigins: '*', trustProxy: false, uploadDir: '/tmp' },
      });

      const body = JSON.stringify({
        transcript: [{ speakerName: 'Anna', text: 'We need to finish the report' }],
        people: [{ name: 'Anna' }],
      });
      const first = await quotaApp.request('/ai/suggest-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body,
      });
      const second = await quotaApp.request('/ai/suggest-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body,
      });

      expect(first.status).toBe(200);
      expect(second.status).toBe(429);
      process.env.VOICELOG_AI_USER_QUOTA_PER_HOUR = originalUserQuota;
    });

    test('returns 403 when request targets a workspace without membership', async () => {
      mockWorkspaceService.getMembership.mockResolvedValueOnce(null);

      const res = await app.request('/ai/suggest-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body: JSON.stringify({
          workspaceId: 'ws-denied',
          transcript: [{ speakerName: 'Anna', text: 'We need to finish the report' }],
          people: [{ name: 'Anna' }],
        }),
      });

      expect(res.status).toBe(403);
      expect(mockWorkspaceService.getMembership).toHaveBeenCalledWith('ws-denied', 'u1');
    });

    test('returns 429 when endpoint-specific quota is exceeded', async () => {
      vi.stubEnv('VOICELOG_AI_SUGGEST_TASKS_USER_QUOTA_PER_HOUR', '1');
      vi.resetModules();
      const { createApp: createQuotaApp } = await import('../../app.ts');
      const quotaApp = createQuotaApp({
        authService: mockAuthService,
        workspaceService: mockWorkspaceService,
        transcriptionService: mockTranscriptionService,
        config: { allowedOrigins: '*', trustProxy: false, uploadDir: '/tmp' },
      });

      const body = JSON.stringify({
        transcript: [{ speakerName: 'Anna', text: 'We need to finish the report' }],
        people: [{ name: 'Anna' }],
      });

      const first = await quotaApp.request('/ai/suggest-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body,
      });
      const second = await quotaApp.request('/ai/suggest-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body,
      });

      expect(first.status).toBe(200);
      expect(second.status).toBe(429);
    });

    test('shares quota across app instances when DB quota store is enabled', async () => {
      vi.stubEnv('VOICELOG_AI_QUOTA_STORE', 'db');
      vi.stubEnv('VOICELOG_AI_USER_QUOTA_PER_HOUR', '1');
      vi.resetModules();
      const { createApp: createQuotaApp } = await import('../../app.ts');
      const sharedDb = createFakeQuotaDb();
      const firstApp = createQuotaApp({
        authService: mockAuthService,
        workspaceService: mockWorkspaceService,
        transcriptionService: mockTranscriptionService,
        db: sharedDb,
        config: { allowedOrigins: '*', trustProxy: false, uploadDir: '/tmp' },
      });
      const secondApp = createQuotaApp({
        authService: mockAuthService,
        workspaceService: mockWorkspaceService,
        transcriptionService: mockTranscriptionService,
        db: sharedDb,
        config: { allowedOrigins: '*', trustProxy: false, uploadDir: '/tmp' },
      });

      const body = JSON.stringify({
        transcript: [{ speakerName: 'Anna', text: 'We need to finish the report' }],
        people: [{ name: 'Anna' }],
      });

      const first = await firstApp.request('/ai/suggest-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body,
      });
      const second = await secondApp.request('/ai/suggest-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body,
      });

      expect(first.status).toBe(200);
      expect(second.status).toBe(429);
      expect(second.headers.get('Retry-After')).toMatch(/^\d+$/);
    });

    test('Regression: #1360 - production AI quota integer overflow does not 500 suggest-tasks', async () => {
      vi.stubEnv('VOICELOG_AI_QUOTA_STORE', 'db');
      vi.stubEnv('ANTHROPIC_API_KEY', '');
      vi.resetModules();
      const { createApp: createQuotaApp } = await import('../../app.ts');
      const quotaApp = createQuotaApp({
        authService: mockAuthService,
        workspaceService: mockWorkspaceService,
        transcriptionService: mockTranscriptionService,
        db: createIntegerOverflowQuotaDb(),
        config: { allowedOrigins: '*', trustProxy: false, uploadDir: '/tmp' },
      });

      const res = await quotaApp.request('/ai/suggest-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body: JSON.stringify({
          transcript: [],
          people: [],
        }),
      });

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ tasks: [] });
    });

    test('returns empty tasks when ANTHROPIC_API_KEY is not configured', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', '');

      const res = await app.request('/ai/suggest-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body: JSON.stringify({
          transcript: [{ speakerName: 'Anna', text: 'We need to finish the report' }],
          people: [{ name: 'Anna' }],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.tasks).toEqual([]);
    });

    test('returns empty tasks when transcript is empty', async () => {
      const res = await app.request('/ai/suggest-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body: JSON.stringify({
          transcript: [],
          people: [{ name: 'Anna' }],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.tasks).toEqual([]);
    });

    test('calls Anthropic API and returns extracted tasks when API key is configured', async () => {
      // stubEnv must happen before resetModules+import so config reads the key
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
      vi.resetModules();
      const { createApp: createAppWithKey } = await import('../../app.ts');
      const appWithKey = createAppWithKey({
        authService: mockAuthService,
        workspaceService: mockWorkspaceService,
        transcriptionService: mockTranscriptionService,
        config: { allowedOrigins: '*', trustProxy: false, uploadDir: '/tmp' },
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                tasks: [
                  {
                    title: 'Finish report',
                    description: 'Complete the quarterly report by Friday',
                    owner: 'Anna',
                    dueDate: '2026-03-27',
                    priority: 'high',
                    tags: ['urgent', 'report'],
                  },
                ],
              }),
            },
          ],
        }),
      });

      const res = await appWithKey.request('/ai/suggest-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body: JSON.stringify({
          transcript: [{ speakerName: 'Anna', text: 'We need to finish the report by Friday' }],
          people: [{ name: 'Anna' }],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.tasks).toHaveLength(1);
      expect(json.tasks[0].title).toBe('Finish report');
      expect(json.tasks[0].owner).toBe('Anna');
      expect(json.tasks[0].priority).toBe('high');
    });

    test('returns empty tasks when Anthropic API fails', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const res = await app.request('/ai/suggest-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body: JSON.stringify({
          transcript: [{ speakerName: 'Anna', text: 'We need to finish the report' }],
          people: [{ name: 'Anna' }],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.tasks).toEqual([]);
    });

    test('returns empty tasks when Anthropic returns non-JSON response', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [{ text: 'This is not JSON' }],
        }),
      });

      const res = await app.request('/ai/suggest-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body: JSON.stringify({
          transcript: [{ speakerName: 'Anna', text: 'We need to finish the report' }],
          people: [{ name: 'Anna' }],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.tasks).toEqual([]);
    });

    test('returns empty tasks when Anthropic returns empty content body', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [],
        }),
      });

      const res = await app.request('/ai/suggest-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body: JSON.stringify({
          transcript: [{ speakerName: 'Anna', text: 'We need to finish the report' }],
          people: [{ name: 'Anna' }],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.tasks).toEqual([]);
    });

    test('returns empty tasks when response has no tasks array', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [{ text: JSON.stringify({ unexpected: true }) }],
        }),
      });

      const res = await app.request('/ai/suggest-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body: JSON.stringify({
          transcript: [{ speakerName: 'Anna', text: 'We need to finish the report' }],
          people: [{ name: 'Anna' }],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.tasks).toEqual([]);
    });
  });

  describe('POST /ai/search', () => {
    test('anonymous request is rejected', async () => {
      mockAuthService.getSession.mockResolvedValueOnce(null);

      const res = await app.request('/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'spotkanie o budzecie',
          items: [{ id: 'meeting-1', title: 'Budzet kwartalny' }],
        }),
      });

      expect(res.status).toBe(401);
    });

    test('checks membership when search request includes meeting workspace context', async () => {
      const res = await app.request('/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body: JSON.stringify({
          meetingId: 'meeting-1',
          meeting: { id: 'meeting-1', workspaceId: 'ws-search' },
          query: 'spotkanie o budzecie',
          items: [{ id: 'meeting-1', title: 'Budzet kwartalny' }],
        }),
      });

      expect(res.status).toBe(200);
      expect(mockWorkspaceService.getMembership).toHaveBeenCalledWith('ws-search', 'u1');
    });

    test('returns no-key mode when ANTHROPIC_API_KEY is not configured', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', '');
      vi.resetModules();
      const { createApp: createAppWithoutKey } = await import('../../app.ts');
      const appWithoutKey = createAppWithoutKey({
        authService: mockAuthService,
        workspaceService: mockWorkspaceService,
        transcriptionService: mockTranscriptionService,
        config: { allowedOrigins: '*', trustProxy: false, uploadDir: '/tmp' },
      });

      const res = await appWithoutKey.request('/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body: JSON.stringify({
          query: 'spotkanie o budzecie',
          items: [
            {
              id: 'meeting-1',
              title: 'Budzet kwartalny',
              subtitle: 'Plan finansowy',
              type: 'meeting',
              group: 'Spotkania',
            },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mode).toBe('no-key');
      expect(json.matches).toEqual([]);
    });

    test('returns no-key mode when query is empty or too short', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');

      const res = await app.request('/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body: JSON.stringify({
          query: 'a',
          items: [{ id: 'meeting-1', title: 'Budzet' }],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mode).toBe('no-key');
      expect(json.matches).toEqual([]);
    });

    test('returns no-key mode when items are empty', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');

      const res = await app.request('/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body: JSON.stringify({
          query: 'wazny dokument',
          items: [],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mode).toBe('no-key');
      expect(json.matches).toEqual([]);
    });

    test('returns empty matches when Anthropic API fails', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const res = await app.request('/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body: JSON.stringify({
          query: 'spotkanie o budzecie',
          items: [{ id: '1', title: 'T' }],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mode).toBe('no-key');
      expect(json.matches).toEqual([]);
    });

    test('returns empty matches when Anthropic returns non-JSON response', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [{ text: 'No json here' }],
        }),
      });

      const res = await app.request('/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body: JSON.stringify({
          query: 'spotkanie o budzecie',
          items: [{ id: '1', title: 'T' }],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mode).toBe('no-key');
      expect(json.matches).toEqual([]);
    });

    test('returns no-key mode when Anthropic returns empty content body', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [],
        }),
      });

      const res = await app.request('/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body: JSON.stringify({
          query: 'spotkanie o budzecie',
          items: [{ id: '1', title: 'T' }],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mode).toBe('no-key');
      expect(json.matches).toEqual([]);
    });

    test('calls Anthropic API and returns ranked matches when API key is configured', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
      vi.resetModules();
      const { createApp: createAppWithKey } = await import('../../app.ts');
      const appWithKey = createAppWithKey({
        authService: mockAuthService,
        workspaceService: mockWorkspaceService,
        transcriptionService: mockTranscriptionService,
        config: { allowedOrigins: '*', trustProxy: false, uploadDir: '/tmp' },
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [
            {
              text: JSON.stringify({
                matches: [
                  { id: 'task-2', reason: 'Semantycznie pasuje', score: 94 },
                  { id: 'meeting-1', reason: 'Pasuje do opisu', score: 88 },
                  { id: 'unknown-id', reason: 'ID not in list', score: 90 },
                ],
              }),
            },
          ],
        }),
      });

      const res = await appWithKey.request('/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-session' },
        body: JSON.stringify({
          query: 'przypomnienie o follow-upie po spotkaniu',
          items: [
            {
              id: 'meeting-1',
              title: 'Budzet kwartalny',
              subtitle: 'Plan finansowy',
              type: 'meeting',
              group: 'Spotkania',
            },
            {
              id: 'task-2',
              title: 'Wyslac raport',
              subtitle: 'Do piatku',
              type: 'task',
              group: 'Zadania',
            },
            { id: 'task-3', title: 'Empty title' },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mode).toBe('anthropic');
      expect(json.matches).toHaveLength(2);
      expect(json.matches[0].id).toBe('task-2');
      expect(json.matches[0].reason).toBe('Semantycznie pasuje');
      expect(json.matches[1].id).toBe('meeting-1');
    });
  });
});

async function createApp(config: any) {
  const { createApp } = await import('../../app.ts');
  return createApp(config);
}
