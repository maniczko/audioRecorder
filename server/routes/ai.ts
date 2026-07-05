import { Hono } from 'hono';
import type {
  AiPersonProfileRequest,
  AiSearchMatch,
  AiSearchRequest,
  AiSearchResponse,
  AiSuggestTasksRequest,
} from '../../src/shared/contracts.ts';
import { workspaceMembershipCan } from '../../src/lib/permissions.ts';
import type { AppMiddlewares } from './middleware.ts';
import type { AppServices } from './middleware.ts';
import { config } from '../config.ts';
import { aiRequestSchemaForPath } from '../lib/apiRequestSchemas.ts';
import { createAiQuotaStore, type AiQuotaStore } from '../lib/aiQuotaStore.ts';
import { validatePayload } from '../lib/requestValidation.ts';
import { logger } from '../logger.ts';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

type AiEndpoint = 'person-profile' | 'suggest-tasks' | 'search';

let activeAiQuotaStore: AiQuotaStore | null = null;

const endpointDefaults: Record<
  AiEndpoint,
  { userPerHour: number; workspacePerDay: number; ipPerMinute: number; maxTokens: number }
> = {
  'person-profile': { userPerHour: 10, workspacePerDay: 80, ipPerMinute: 5, maxTokens: 1800 },
  'suggest-tasks': { userPerHour: 20, workspacePerDay: 150, ipPerMinute: 8, maxTokens: 2000 },
  search: { userPerHour: 60, workspacePerDay: 500, ipPerMinute: 30, maxTokens: 800 },
};

function readPositiveIntEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function endpointEnvSuffix(endpoint: AiEndpoint) {
  return endpoint.replace(/-/g, '_').toUpperCase();
}

function getEndpointFromPath(path: string): AiEndpoint {
  if (path.endsWith('/person-profile')) return 'person-profile';
  if (path.endsWith('/suggest-tasks')) return 'suggest-tasks';
  return 'search';
}

function getQuotaPlan(endpoint: AiEndpoint) {
  const suffix = endpointEnvSuffix(endpoint);
  const defaults = endpointDefaults[endpoint];
  return {
    userPerHour: readPositiveIntEnv('VOICELOG_AI_USER_QUOTA_PER_HOUR', 20),
    workspacePerDay: readPositiveIntEnv(
      'VOICELOG_AI_WORKSPACE_QUOTA_PER_DAY',
      readPositiveIntEnv('VOICELOG_AI_WORKSPACE_QUOTA_PER_HOUR', 200)
    ),
    ipPerMinute: readPositiveIntEnv('VOICELOG_AI_IP_QUOTA_PER_MINUTE', 30),
    endpointUserPerHour: readPositiveIntEnv(
      `VOICELOG_AI_${suffix}_USER_QUOTA_PER_HOUR`,
      defaults.userPerHour
    ),
    endpointWorkspacePerDay: readPositiveIntEnv(
      `VOICELOG_AI_${suffix}_WORKSPACE_QUOTA_PER_DAY`,
      defaults.workspacePerDay
    ),
    endpointIpPerMinute: readPositiveIntEnv(
      `VOICELOG_AI_${suffix}_IP_QUOTA_PER_MINUTE`,
      defaults.ipPerMinute
    ),
    maxTokens: defaults.maxTokens,
  };
}

function getBodyString(value: unknown) {
  return String(value || '').trim();
}

function getWorkspaceContext(body: any, session: any) {
  const explicitWorkspaceId = getBodyString(
    body?.workspaceId ||
      body?.workspace_id ||
      body?.meeting?.workspaceId ||
      body?.meeting?.workspace_id ||
      body?.workspace?.id
  );
  const meetingId = getBodyString(body?.meetingId || body?.meeting_id || body?.meeting?.id);
  const sessionWorkspaceId = getBodyString(session?.workspace_id || session?.workspaceId);
  const workspaceId = explicitWorkspaceId || sessionWorkspaceId;
  return {
    workspaceId,
    mustCheckMembership: Boolean(explicitWorkspaceId || meetingId),
  };
}

function getClientIp(c: any) {
  return (
    String(c.req.header('x-forwarded-for') || '')
      .split(',')[0]
      .trim() ||
    String(c.req.header('x-real-ip') || '').trim() ||
    'local'
  );
}

async function enforceQuota({
  quotaStore,
  endpoint,
  userId,
  workspaceId,
  ip,
}: {
  quotaStore: AiQuotaStore;
  endpoint: AiEndpoint;
  userId: string;
  workspaceId: string;
  ip: string;
}) {
  const now = Date.now();
  const quota = getQuotaPlan(endpoint);
  const checks = [
    { key: `ai:user:${userId}:hour`, limit: quota.userPerHour, windowMs: HOUR_MS },
    {
      key: `ai:user:${userId}:endpoint:${endpoint}:hour`,
      limit: quota.endpointUserPerHour,
      windowMs: HOUR_MS,
    },
    { key: `ai:ip:${ip}:minute`, limit: quota.ipPerMinute, windowMs: MINUTE_MS },
    {
      key: `ai:ip:${ip}:endpoint:${endpoint}:minute`,
      limit: quota.endpointIpPerMinute,
      windowMs: MINUTE_MS,
    },
    ...(workspaceId
      ? [
          {
            key: `ai:workspace:${workspaceId}:day`,
            limit: quota.workspacePerDay,
            windowMs: DAY_MS,
          },
          {
            key: `ai:workspace:${workspaceId}:endpoint:${endpoint}:day`,
            limit: quota.endpointWorkspacePerDay,
            windowMs: DAY_MS,
          },
        ]
      : []),
  ];

  return quotaStore.increment(checks.map((check) => ({ ...check, now })));
}

function estimateInputTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function getModelForEndpoint(endpoint: AiEndpoint) {
  return endpoint === 'suggest-tasks' ? 'claude-sonnet-4-6' : config.ANTHROPIC_MODEL;
}

function estimateRequestTokens(endpoint: AiEndpoint, body: any) {
  if (endpoint === 'suggest-tasks') {
    return estimateInputTokens(
      (Array.isArray(body?.transcript) ? body.transcript : [])
        .map((segment: any) => String(segment?.text || ''))
        .join('\n')
    );
  }
  if (endpoint === 'person-profile') {
    return estimateInputTokens(
      (Array.isArray(body?.allSegments) ? body.allSegments : [])
        .slice(0, 100)
        .map((segment: any) => String(segment?.text || ''))
        .join('\n')
    );
  }
  return estimateInputTokens(String(body?.query || ''));
}

function logAiRequest(c: any, metadata: Record<string, unknown>) {
  logger.info('[AI] request', {
    requestId: c.get('reqId') || 'unknown',
    ...metadata,
  });
}

function getAiQuotaContext(c: any) {
  return (c.get('aiQuotaContext') || {}) as Partial<{
    endpoint: AiEndpoint;
    userId: string;
    workspaceId: string;
  }>;
}

async function callAnthropic(body: object): Promise<any> {
  if (!config.ANTHROPIC_API_KEY) return null;
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Anthropic ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json();
}

function normalizeSearchItems(items: unknown[]): AiSearchMatch[] {
  return (Array.isArray(items) ? items : [])
    .map((item: any) => ({
      id: String(item?.id || ''),
      title: String(item?.title || '').trim(),
      subtitle: String(item?.subtitle || '').trim(),
      type: String(item?.type || '').trim(),
      group: String(item?.group || '').trim(),
    }))
    .filter((item) => Boolean(item.id) && Boolean(item.title));
}

export function createAiRoutes(services: AppServices, middlewares: AppMiddlewares) {
  const router = new Hono<{
    Variables: {
      aiBody: any;
      aiQuotaContext: { endpoint: AiEndpoint; userId: string; workspaceId: string };
      session: any;
    };
  }>();
  const { applyRateLimit, authMiddleware, ensureWorkspaceAccess } = middlewares;
  const quotaStore = createAiQuotaStore({ db: services.db });
  activeAiQuotaStore = quotaStore;

  async function enforceAiAuthAndQuota(c: any, next: any) {
    return await authMiddleware(c, async () => {
      const session = c.get('session') || {};
      const userId = String(session.user_id || session.userId || '').trim();
      if (!userId) {
        return c.json({ message: 'Brak uzytkownika w sesji.' }, 401);
      }

      const rawBody = await c.req.json().catch(() => ({}));
      const validatedBody = validatePayload(c, aiRequestSchemaForPath(c.req.path), rawBody);
      if (validatedBody.ok === false) {
        return validatedBody.response;
      }
      const body = validatedBody.data;
      c.set('aiBody', body);

      const endpoint = getEndpointFromPath(c.req.path);
      const { workspaceId, mustCheckMembership } = getWorkspaceContext(body, session);

      if (mustCheckMembership && workspaceId && typeof ensureWorkspaceAccess === 'function') {
        const membership = await ensureWorkspaceAccess(c, workspaceId);
        if (!workspaceMembershipCan(membership, 'ai:analyze')) {
          return c.json({ message: 'Nie masz uprawnien do akcji AI w tym workspace.' }, 403);
        }
      }

      if (mustCheckMembership && !workspaceId) {
        return c.json({ message: 'Brak workspace dla zasobu AI.' }, 403);
      }

      const quotaExceeded = await enforceQuota({
        quotaStore,
        endpoint,
        userId,
        workspaceId,
        ip: getClientIp(c),
      });
      if (quotaExceeded) {
        c.header('Retry-After', String(quotaExceeded.retryAfter));
        logger.warn('[AI] quota exceeded', {
          requestId: c.get('reqId') || 'unknown',
          userId,
          workspaceId: workspaceId || undefined,
          endpoint,
          quotaKey: quotaExceeded.key,
          limit: quotaExceeded.limit,
          retryAfter: quotaExceeded.retryAfter,
        });
        return c.json(
          { message: 'Przekroczono limit AI.', retryAfter: quotaExceeded.retryAfter },
          429
        );
      }

      c.set('aiQuotaContext', { endpoint, userId, workspaceId });
      logAiRequest(c, {
        userId,
        workspaceId: workspaceId || undefined,
        endpoint,
        provider: config.ANTHROPIC_API_KEY ? 'anthropic' : 'none',
        model: config.ANTHROPIC_API_KEY ? getModelForEndpoint(endpoint) : 'none',
        estimatedInputTokens: estimateRequestTokens(endpoint, body),
        maxOutputTokens: getQuotaPlan(endpoint).maxTokens,
      });
      return await next();
    });
  }

  router.use('*', applyRateLimit('ai-cost', 5), enforceAiAuthAndQuota);

  /**
   * POST /ai/person-profile
   * Proxy: analyse communication style of a named person across their meeting statements.
   * Body: { personName: string, meetings: any[], allSegments: any[] }
   */
  router.post('/person-profile', applyRateLimit('ai-person-profile', 20), async (c) => {
    if (!config.ANTHROPIC_API_KEY) return c.json({ mode: 'no-key' }, 200);

    const {
      personName,
      meetings = [],
      allSegments = [],
    } = ((c.get('aiBody') as any) || {}) as AiPersonProfileRequest;

    if (!personName || !Array.isArray(allSegments) || allSegments.length < 5) {
      return c.json({ mode: 'no-key' }, 200); // fallback handled on client
    }

    const lines = (allSegments as any[])
      .slice(0, 100)
      .map((s: any) => `[${s.meetingTitle || 'Spotkanie'}] ${s.text}`)
      .join('\n');

    const prompt = [
      `You are an expert business psychologist. Analyze the communication patterns of "${personName}".`,
      `Base your analysis ONLY on their actual statements below from ${(meetings as any[]).length} meeting(s).`,
      `Respond in Polish for all text fields. Return valid JSON only — no prose outside the JSON.`,
      ``,
      `Statements by ${personName}:`,
      lines,
      ``,
      `Return exactly this JSON shape (all fields required):`,
      `{"disc":{"D":65,"I":45,"S":70,"C":55},"discStyle":"SC — stabilny i sumienny","discDescription":"2-zdaniowy opis dominującego stylu.","values":[{"value":"bezpieczeństwo","icon":"🛡️","quote":"cytat z wypowiedzi"}],"communicationStyle":"analytical","decisionStyle":"data-driven","conflictStyle":"collaborative","listeningStyle":"active","stressResponse":"Jak reaguje pod presją.","workingWithTips":["Wskazówka 1","Wskazówka 2","Wskazówka 3"],"communicationDos":["Co robić"],"communicationDonts":["Czego unikać"],"redFlags":["Ewentualny wzorzec"],"coachingNote":"Jedna obserwacja."}`,
    ].join('\n');

    try {
      const payload = await callAnthropic({
        model: config.ANTHROPIC_MODEL,
        max_tokens: 1800,
        messages: [{ role: 'user', content: prompt }],
      });
      const context = getAiQuotaContext(c);
      logAiRequest(c, {
        userId: context.userId,
        workspaceId: context.workspaceId || undefined,
        endpoint: 'person-profile',
        provider: 'anthropic',
        model: config.ANTHROPIC_MODEL,
        estimatedInputTokens: estimateInputTokens(lines),
        maxOutputTokens: 1800,
      });
      const text = payload?.content?.[0]?.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON in response');
      const parsed = JSON.parse(match[0]);
      return c.json(
        {
          mode: 'anthropic',
          meetingsAnalyzed: (meetings as any[]).length,
          generatedAt: new Date().toISOString(),
          ...parsed,
        },
        200
      );
    } catch (err: any) {
      console.error('[ai/person-profile] error:', err.message);
      return c.json({ mode: 'no-key' }, 200);
    }
  });

  /**
   * POST /ai/suggest-tasks
   * Proxy: extract actionable tasks from a meeting transcript.
   * Body: { transcript: TranscriptSegment[], people: { name: string }[] }
   */
  router.post('/suggest-tasks', applyRateLimit('ai-suggest-tasks', 20), async (c) => {
    if (!config.ANTHROPIC_API_KEY) return c.json({ tasks: [] }, 200);

    const { transcript = [], people = [] } = ((c.get('aiBody') as any) ||
      {}) as AiSuggestTasksRequest;

    const transcriptText = (Array.isArray(transcript) ? transcript : [])
      .map(
        (seg: any) =>
          `[${seg.speakerName || `Speaker ${Number(seg.speakerId || 0) + 1}`}]: ${seg.text || ''}`
      )
      .join('\n');

    if (!transcriptText.trim()) return c.json({ tasks: [] }, 200);

    const peopleList = (Array.isArray(people) ? people : [])
      .map((p: any) => p.name || p.email || '')
      .filter(Boolean)
      .join(', ');

    const systemPrompt =
      'Jestes asystentem spotkaniowym. Analizujesz transkrypcje spotkan i wyodrebniasz z nich konkretne zadania do wykonania. Odpowiadasz WYLACZNIE prawidlowym JSONem bez zadnego dodatkowego tekstu, bez markdown, bez komentarzy.';

    const userPrompt = `${peopleList ? `Uczestnicy spotkania: ${peopleList}\n\n` : ''}Transkrypcja:\n${transcriptText}\n\nWygeneruj JSON z lista zadan ktore jasno wynikaja z tej transkrypcji (decyzje, zobowiazania, follow-upy). Format:\n{\n  "tasks": [\n    {\n      "title": "krotki tytul zadania (max 80 znakow)",\n      "description": "szczegolowy opis co trzeba zrobic",\n      "owner": "imie osoby z transkryptu lub null jezeli nie wspomniano",\n      "dueDate": "YYYY-MM-DD lub null jezeli brak terminu",\n      "priority": "high|medium|low",\n      "tags": ["tag1", "tag2"]\n    }\n  ]\n}\n\nZasady:\n- Tylko zadania ktore jasno wynikaja z transkrypcji\n- Priorytet high = pilne/wazne sygnaly jezykowe\n- Maksymalnie 10 zadan\n- Odpowiedz WYLACZNIE JSONem`;

    try {
      const payload = await callAnthropic({
        model: 'claude-sonnet-4-6', // use more capable model for task extraction
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const context = getAiQuotaContext(c);
      logAiRequest(c, {
        userId: context.userId,
        workspaceId: context.workspaceId || undefined,
        endpoint: 'suggest-tasks',
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        estimatedInputTokens: estimateInputTokens(transcriptText),
        maxOutputTokens: 2000,
      });
      const text = (payload?.content || []).find((b: any) => b.type === 'text')?.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON in response');
      const parsed = JSON.parse(match[0]);
      return c.json({ tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [] }, 200);
    } catch (err: any) {
      console.error('[ai/suggest-tasks] error:', err.message);
      return c.json({ tasks: [] }, 200);
    }
  });

  /**
   * POST /ai/search
   * Semantic ranking proxy for command palette searches.
   * Body: { query: string, items: [{ id, title, subtitle, type, group }] }
   */
  router.post('/search', applyRateLimit('ai-search', 20), async (c) => {
    if (!config.ANTHROPIC_API_KEY) {
      return c.json({ mode: 'no-key', matches: [] }, 200);
    }

    const { query = '', items = [] } = ((c.get('aiBody') as any) || {}) as AiSearchRequest;
    const normalizedQuery = String(query || '').trim();
    const normalizedItems = normalizeSearchItems(items as unknown[]);

    if (normalizedQuery.length < 2 || !normalizedItems.length) {
      return c.json({ mode: 'no-key', matches: [] }, 200);
    }

    const prompt = [
      'You are helping with semantic search in a command palette.',
      'Return the most relevant items for the user query.',
      'Respond in valid JSON only, no prose.',
      '',
      `Query: ${normalizedQuery}`,
      '',
      'Items:',
      ...normalizedItems
        .slice(0, 20)
        .map(
          (item, index) =>
            `${index + 1}. id=${item.id} | title=${item.title} | subtitle=${item.subtitle || ''} | type=${item.type || ''} | group=${item.group || ''}`
        ),
      '',
      'Return exactly this JSON shape:',
      '{"matches":[{"id":"item-id","reason":"short reason","score":92}]}',
      'Rules:',
      '- Return up to 5 matches.',
      '- Only use ids from the provided items list.',
      '- Prefer semantic relevance over exact substring matches.',
      '- Keep reasons short.',
    ].join('\n');

    try {
      const payload = await callAnthropic({
        model: config.ANTHROPIC_MODEL,
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      });
      const context = getAiQuotaContext(c);
      logAiRequest(c, {
        userId: context.userId,
        workspaceId: context.workspaceId || undefined,
        endpoint: 'search',
        provider: 'anthropic',
        model: config.ANTHROPIC_MODEL,
        estimatedInputTokens: estimateInputTokens(normalizedQuery),
        itemCount: normalizedItems.length,
        maxOutputTokens: 800,
      });
      const text = payload?.content?.[0]?.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON in response');
      const parsed = JSON.parse(match[0]) as {
        matches?: Array<{ id?: string; reason?: string; score?: number }>;
      };
      const itemsById = new Map(normalizedItems.map((item) => [item.id, item]));
      const matches = (Array.isArray(parsed.matches) ? parsed.matches : [])
        .map((entry) => {
          const source = itemsById.get(String(entry.id || ''));
          if (!source) return null;
          return {
            ...source,
            reason: String(entry.reason || '').trim(),
            score: typeof entry.score === 'number' ? entry.score : 0,
          };
        })
        .filter(Boolean)
        .slice(0, 5);

      const response: AiSearchResponse = { mode: 'anthropic', matches: matches as AiSearchMatch[] };
      return c.json(response, 200);
    } catch (err: any) {
      console.error('[ai/search] error:', err.message);
      return c.json({ mode: 'no-key', matches: [] }, 200);
    }
  });

  return router;
}

export function resetAiQuotaForTests() {
  activeAiQuotaStore?.reset?.();
}
