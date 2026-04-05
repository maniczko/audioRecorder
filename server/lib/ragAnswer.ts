async function callWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout LLM')), ms)),
  ]);
}

async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Anthropic ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const data = (await res.json()) as any;
  return String(data?.content?.[0]?.text || '').trim();
}

async function callGroq(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 512,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Groq ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const data = (await res.json()) as any;
  return String(data?.choices?.[0]?.message?.content || '').trim();
}

async function callOpenAI(
  apiKey: string,
  model: string,
  baseUrl: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 512,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`OpenAI ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const data = (await res.json()) as any;
  return String(data?.choices?.[0]?.message?.content || '').trim();
}

type RagChunk = {
  recording_id?: string;
  speaker_name?: string;
  text?: string;
};

function getOpenAiKey(config: any) {
  return String(config?.VOICELOG_OPENAI_API_KEY || config?.OPENAI_API_KEY || '').trim();
}

function getOpenAiBaseUrl(config: any) {
  return String(
    config?.VOICELOG_OPENAI_BASE_URL || config?.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  ).replace(/\/$/, '');
}

export function buildRagContext(chunks: RagChunk[]) {
  return (Array.isArray(chunks) ? chunks : [])
    .map(
      (chunk) =>
        `[Spotkanie: ${chunk.recording_id || 'unknown'}] ${chunk.speaker_name || 'Nieznany'}: ${chunk.text || ''}`
    )
    .join('\n');
}

function normalizeChunkText(value: unknown) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatFallbackFragment(chunk: { speakerName: string; text: string; index: number }) {
  return `Fragment ${chunk.index} (${chunk.speakerName})\n${chunk.text}`;
}

export function buildFallbackRagAnswer({
  question,
  chunks,
  errorMessage = '',
}: {
  question: string;
  chunks: RagChunk[];
  errorMessage?: string;
}) {
  const normalizedQuestion = String(question || '').trim();
  const normalizedChunks = (Array.isArray(chunks) ? chunks : [])
    .map((chunk) => ({
      recordingId: String(chunk?.recording_id || '').trim(),
      speakerName: String(chunk?.speaker_name || 'Nieznany').trim() || 'Nieznany',
      text: normalizeChunkText(chunk?.text),
    }))
    .filter((chunk) => chunk.text);

  // Deduplicate on exact text match
  const uniqueChunksMap = new Map<string, (typeof normalizedChunks)[0]>();
  normalizedChunks.forEach((c) => uniqueChunksMap.set(c.text, c));
  const uniqueChunks = Array.from(uniqueChunksMap.values());

  if (!uniqueChunks.length) {
    return 'Nie znalazlem trafnych fragmentow w archiwalnych spotkaniach.';
  }

  const fragmentList = uniqueChunks
    .slice(0, 3)
    .map((chunk, index) => {
      return formatFallbackFragment({
        index: index + 1,
        speakerName: chunk.speakerName,
        text: chunk.text,
      });
    })
    .join('\n\n');

  const hintPrefix = errorMessage
    ? `Model AI jest chwilowo niedostepny, ale znalazlem ${Math.min(uniqueChunks.length, 3)} pasujace fragmenty archiwum:\n\n`
    : 'Na podstawie archiwalnych fragmentow znalazlem:\n\n';

  return `${hintPrefix}${fragmentList}${
    normalizedQuestion ? `\n\nPytanie: ${normalizedQuestion}` : ''
  }`;
}

type RagCandidate = {
  id: string;
  label: string;
  call: () => Promise<string>;
};

export async function generateRagAnswer({
  question,
  chunks,
  config,
  workspaceId = '',
}: {
  question: string;
  chunks: RagChunk[];
  config: any;
  workspaceId?: string;
}) {
  const openAiKey = getOpenAiKey(config);
  const groqKey = String(config?.GROQ_API_KEY || '').trim();
  const anthropicKey = String(config?.ANTHROPIC_API_KEY || '').trim();

  if (!openAiKey && !groqKey && !anthropicKey) {
    throw new Error(
      'Brak klucza API do RAG LLMa. Skonfiguruj ANTHROPIC_API_KEY, GROQ_API_KEY lub OPENAI_API_KEY.'
    );
  }

  // Deduplicate chunks to prevent repetitive context
  const uniqueChunksMap = new Map<string, RagChunk>();
  chunks.forEach((c) => uniqueChunksMap.set(String(c.text || '').trim(), c));
  const uniqueChunks = Array.from(uniqueChunksMap.values());

  const contextStr = buildRagContext(uniqueChunks);
  const systemPrompt =
    'Jestes asystentem wiedzy bazy RAG. Udziel krotkiej, konkretnej odpowiedzi bazujac WYLACZNIE na ponizszym archiwalnym kontekscie ze spotkan klienta. Jezeli pytanie wykracza poza kontekst, powiedz, ze nie wiesz, ale nie przepraszaj.';
  const userPrompt = `Kontekst ze spotkan:\n${contextStr}\n\nPytanie uzytkownika: ${question}`;
  const TIMEOUT_MS = 20000;

  const candidates: RagCandidate[] = [];

  if (anthropicKey) {
    const model = config?.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest';
    candidates.push({
      id: 'anthropic',
      label: `Anthropic ${model}`,
      call: () =>
        callWithTimeout(callAnthropic(anthropicKey, model, systemPrompt, userPrompt), TIMEOUT_MS),
    });
  }

  if (groqKey) {
    candidates.push({
      id: 'groq',
      label: 'Groq llama-3.3-70b-versatile',
      call: () =>
        callWithTimeout(
          callGroq(groqKey, 'llama-3.3-70b-versatile', systemPrompt, userPrompt),
          TIMEOUT_MS
        ),
    });
  }

  if (openAiKey) {
    const baseUrl = getOpenAiBaseUrl(config);
    candidates.push({
      id: 'openai',
      label: 'OpenAI gpt-4o-mini',
      call: () =>
        callWithTimeout(
          callOpenAI(openAiKey, 'gpt-4o-mini', baseUrl, systemPrompt, userPrompt),
          TIMEOUT_MS
        ),
    });
  }

  let lastError: Error | null = null;

  for (const candidate of candidates) {
    try {
      const text = await candidate.call();
      console.log(
        `[RAG] Provider ${candidate.label} answered successfully (workspace=${workspaceId}, chunks=${uniqueChunks.length})`
      );
      return text || 'Brak odpowiedzi.';
    } catch (err: any) {
      lastError =
        err instanceof Error ? err : new Error(String(err || 'Unknown RAG provider error'));
      console.warn(`[RAG] Provider ${candidate.label} failed:`, lastError.message);
    }
  }

  throw lastError || new Error('All RAG providers failed');
}
