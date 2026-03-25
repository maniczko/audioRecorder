import { Hono } from 'hono';
import type {
  AiPersonProfileRequest,
  AiSearchMatch,
  AiSearchRequest,
  AiSearchResponse,
  AiSuggestTasksRequest,
} from '../../src/shared/contracts.ts';
import type { AppMiddlewares } from './middleware.ts';
import { config } from '../config.ts';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

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

export function createAiRoutes(middlewares: AppMiddlewares) {
  const router = new Hono();
  const { applyRateLimit } = middlewares;

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
    } = (await c.req.json().catch(() => ({}))) as AiPersonProfileRequest;

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

    const { transcript = [], people = [] } = (await c.req
      .json()
      .catch(() => ({}))) as AiSuggestTasksRequest;

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

    const { query = '', items = [] } = (await c.req.json().catch(() => ({}))) as AiSearchRequest;
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
