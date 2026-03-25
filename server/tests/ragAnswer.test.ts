import { describe, expect, it, vi } from 'vitest';
import { buildRagContext, generateRagAnswer } from '../lib/ragAnswer.ts';

const { invokeMock, ChatOpenAIMock } = vi.hoisted(() => {
  const invokeMock = vi.fn().mockResolvedValue({ content: '  Odpowiedz z LangChain  ' });
  const ChatOpenAIMock = vi.fn(function ChatOpenAI() {
    return {
      invoke: invokeMock,
    };
  });
  return { invokeMock, ChatOpenAIMock };
});

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: ChatOpenAIMock,
}));

describe('ragAnswer', () => {
  it('builds a readable context string', () => {
    expect(
      buildRagContext([
        { recording_id: 'rec1', speaker_name: 'Anna', text: 'Ustalono plan.' },
        { recording_id: 'rec2', speaker_name: 'Piotr', text: 'Do zrobienia.' },
      ])
    ).toBe('[Spotkanie: rec1] Anna: Ustalono plan.\n[Spotkanie: rec2] Piotr: Do zrobienia.');
  });

  it('uses LangChain to generate the answer', async () => {
    const answer = await generateRagAnswer({
      question: 'Co ustalono?',
      chunks: [{ recording_id: 'rec1', speaker_name: 'Anna', text: 'Ustalono plan.' }],
      workspaceId: 'ws1',
      config: {
        VOICELOG_OPENAI_API_KEY: 'key-1',
        VOICELOG_OPENAI_BASE_URL: 'https://api.example.test/v1',
      },
    });

    expect(answer).toBe('Odpowiedz z LangChain');
    expect(ChatOpenAIMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        apiKey: 'key-1',
        configuration: { baseURL: 'https://api.example.test/v1' },
      })
    );
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        tags: ['rag', 'answer'],
        metadata: {
          workspaceId: 'ws1',
          chunkCount: 1,
        },
      })
    );
  });

  it('throws when the API key is missing', async () => {
    await expect(
      generateRagAnswer({
        question: 'Co ustalono?',
        chunks: [],
        config: {},
      })
    ).rejects.toThrow('Brak klucza API do RAG LLMa.');
  });
});
