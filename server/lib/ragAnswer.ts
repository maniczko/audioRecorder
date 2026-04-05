// LangChain modules loaded lazily to reduce startup memory (Railway 512MB container)
let _langchain: { HumanMessage: any; SystemMessage: any; ChatOpenAI: any } | null = null;
async function getLangChain() {
  if (!_langchain) {
    const [messages, openai] = await Promise.all([
      import('@langchain/core/messages'),
      import('@langchain/openai'),
    ]);
    _langchain = {
      HumanMessage: messages.HumanMessage,
      SystemMessage: messages.SystemMessage,
      ChatOpenAI: openai.ChatOpenAI,
    };
  }
  return _langchain;
}

type RagChunk = {
  recording_id?: string;
  speaker_name?: string;
  text?: string;
};

type RagProviderCandidate = {
  id: 'groq' | 'anthropic' | 'gemini' | 'openai';
  label: string;
  createModel: () => Promise<any>;
};

function getOpenAiKey(config: any) {
  return String(config?.VOICELOG_OPENAI_API_KEY || config?.OPENAI_API_KEY || '').trim();
}

function getOpenAiBaseUrl(config: any) {
  return String(
    config?.VOICELOG_OPENAI_BASE_URL || config?.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  ).replace(/\/$/, '');
}

function toMessageText(content: unknown) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part)
          return String((part as any).text || '');
        return '';
      })
      .join('');
  }
  return String(content || '');
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
  const geminiKey = String(
    config?.GEMINI_API_KEY || config?.GOOGLE_API_KEY || config?.GOOGLE_GENAI_API_KEY || ''
  ).trim();

  if (!openAiKey && !groqKey && !anthropicKey && !geminiKey) {
    throw new Error('Brak klucza API do RAG LLMa.');
  }

  // Deduplicate chunks to prevent repetitive context
  const uniqueChunksMap = new Map<string, RagChunk>();
  chunks.forEach((c) => uniqueChunksMap.set(String(c.text || '').trim(), c));
  const uniqueChunks = Array.from(uniqueChunksMap.values());

  const contextStr = buildRagContext(uniqueChunks);
  const systemPrompt =
    'Jestes asystentem wiedzy bazy RAG. Udziel krotkiej, konkretnej odpowiedzi bazujac WYLACZNIE na ponizszym archiwalnym kontekscie ze spotkan klienta. Jezeli pytanie wykracza poza kontekst, powiedz, ze nie wiesz, ale nie przepraszaj.';
  const userPrompt = `Kontekst ze spotkan:\n${contextStr}\n\nPytanie uzytkownika: ${question}`;
  const candidates: RagProviderCandidate[] = [];
  if (groqKey) {
    candidates.push({
      id: 'groq',
      label: 'Groq llama-3.3-70b-versatile',
      createModel: async () => {
        const { ChatGroq } = await import('@langchain/groq');
        return new ChatGroq({
          apiKey: groqKey,
          model: 'llama-3.3-70b-versatile',
          temperature: 0.2,
        });
      },
    });
  }
  if (anthropicKey) {
    candidates.push({
      id: 'anthropic',
      label: `Anthropic ${config.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest'}`,
      createModel: async () => {
        const { ChatAnthropic } = await import('@langchain/anthropic');
        return new ChatAnthropic({
          apiKey: anthropicKey,
          model: config.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest',
          temperature: 0.2,
        });
      },
    });
  }
  if (geminiKey) {
    candidates.push({
      id: 'gemini',
      label: 'Gemini gemini-2.0-flash-exp',
      createModel: async () => {
        const { ChatGoogleGenAI } = await import('@langchain/google-genai');
        return new ChatGoogleGenAI({
          apiKey: geminiKey,
          modelName: 'gemini-2.0-flash-exp',
          temperature: 0.2,
        });
      },
    });
  }
  if (openAiKey) {
    candidates.push({
      id: 'openai',
      label: 'OpenAI gpt-4o-mini',
      createModel: async () => {
        const { ChatOpenAI } = await import('@langchain/openai');
        return new ChatOpenAI({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          apiKey: openAiKey,
          configuration: {
            baseURL: getOpenAiBaseUrl(config),
          },
        });
      },
    });
  }

  const { SystemMessage, HumanMessage } = await import('@langchain/core/messages');
  let lastError: Error | null = null;

  for (const candidate of candidates) {
    try {
      const model = await candidate.createModel();
      const response = (await Promise.race([
        model.invoke([new SystemMessage(systemPrompt), new HumanMessage(userPrompt)], {
          tags: ['rag', 'answer'],
          metadata: { workspaceId, chunkCount: uniqueChunks.length, providerId: candidate.id },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout LLM')), 15000)),
      ])) as any;

      return toMessageText(response.content).trim() || 'Brak odpowiedzi.';
    } catch (err: any) {
      lastError =
        err instanceof Error ? err : new Error(String(err || 'Unknown RAG provider error'));
      console.warn(
        `[RAG] Provider ${candidate.label} failed, trying next candidate if available:`,
        err?.message || err
      );
    }
  }

  if (lastError?.message === 'Timeout LLM' || (lastError as any)?.status === 429) {
    console.warn('[RAG] All configured LLM providers timed out or hit quota, falling back...');
  }

  throw lastError || new Error('No model instantiated');
}
