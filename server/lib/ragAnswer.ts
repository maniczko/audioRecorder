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

  if (!normalizedChunks.length) {
    return 'Nie znalazlem trafnych fragmentow w archiwalnych spotkaniach.';
  }

  const bulletList = normalizedChunks
    .slice(0, 3)
    .map((chunk) => {
      const source = chunk.recordingId ? `Spotkanie ${chunk.recordingId}` : 'Archiwum';
      return `- ${source}, ${chunk.speakerName}: ${chunk.text}`;
    })
    .join('\n');

  const hintPrefix = errorMessage
    ? 'Model AI jest chwilowo niedostepny, ale znalazlem pasujace fragmenty archiwum:\n'
    : 'Na podstawie archiwalnych fragmentow znalazlem:\n';

  return `${hintPrefix}${bulletList}${
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
  const apiKey = getOpenAiKey(config);
  if (!apiKey) {
    throw new Error('Brak klucza API do RAG LLMa.');
  }

  const { ChatOpenAI, SystemMessage, HumanMessage } = await getLangChain();

  const contextStr = buildRagContext(chunks);
  const model = new ChatOpenAI({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    apiKey,
    configuration: {
      baseURL: getOpenAiBaseUrl(config),
    },
  });

  const response = await model.invoke(
    [
      new SystemMessage(
        'Jestes asystentem wiedzy bazy RAG. Udziel krotkiej, konkretnej odpowiedzi bazujac WYLACZNIE na ponizszym archiwalnym kontekscie ze spotkan klienta. Jezeli pytanie wykracza poza kontekst, powiedz, ze nie wiesz.'
      ),
      new HumanMessage(`Kontekst ze spotkan:\n${contextStr}\n\nPytanie uzytkownika: ${question}`),
    ],
    {
      tags: ['rag', 'answer'],
      metadata: {
        workspaceId,
        chunkCount: Array.isArray(chunks) ? chunks.length : 0,
      },
    }
  );

  return toMessageText(response.content).trim() || 'Blad RAG.';
}
