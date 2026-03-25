import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';

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
