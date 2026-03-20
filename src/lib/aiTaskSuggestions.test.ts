import { describe, test, expect, vi, beforeEach } from 'vitest';
import { suggestTasksFromTranscript } from './aiTaskSuggestions';

describe('suggestTasksFromTranscript', () => {
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_API_KEY', mockApiKey);
    vi.stubGlobal('fetch', vi.fn());
  });

  test('should throw error if API key is not set', async () => {
    vi.stubEnv('VITE_ANTHROPIC_API_KEY', '');
    await expect(suggestTasksFromTranscript([])).rejects.toThrow('REACT_APP_ANTHROPIC_API_KEY nie jest ustawiony');
  });

  test('should return empty array if transcript is empty', async () => {
    const result = await suggestTasksFromTranscript([]);
    expect(result).toEqual([]);
  });

  test('should call Anthropic API and return parsed tasks', async () => {
    const mockTranscript = [
      { speakerName: 'Alice', text: 'We need to finish the report by Friday.' },
      { speakerId: 1, text: 'I will handle the design.' }
    ];
    
    const mockResponse = {
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              tasks: [
                {
                  title: 'Finish report',
                  description: 'Complete the final report by Friday',
                  owner: 'Alice',
                  dueDate: '2026-03-27',
                  priority: 'high',
                  tags: ['report']
                },
                {
                  title: 'Design',
                  description: 'Handle the design phase',
                  owner: 'Speaker 2',
                  dueDate: null,
                  priority: 'medium',
                  tags: ['design']
                }
              ]
            })
          }
        ]
      })
    };

    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await suggestTasksFromTranscript(mockTranscript);

    expect(global.fetch).toHaveBeenCalledWith('https://api.anthropic.com/v1/messages', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'x-api-key': mockApiKey,
      }),
    }));

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Finish report');
    expect(result[1].owner).toBe('Speaker 2');
  });

  test('should handle API errors gracefully', async () => {
    const mockResponse = {
      ok: false,
      status: 400,
      text: async () => 'Bad Request'
    };

    (global.fetch as any).mockResolvedValue(mockResponse);

    await expect(suggestTasksFromTranscript([{ text: 'test' }])).rejects.toThrow('Anthropic API error 400: Bad Request');
  });

  test('should handle malformed JSON in AI response', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: 'This is not JSON'
          }
        ]
      })
    };

    (global.fetch as any).mockResolvedValue(mockResponse);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await suggestTasksFromTranscript([{ text: 'test' }]);
    
    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('should parse JSON even if it is surrounded by other text', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: 'Sure, here is the JSON:\n{"tasks": [{"title": "Embedded task"}]}\nHope it helps!'
          }
        ]
      })
    };

    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await suggestTasksFromTranscript([{ text: 'test' }]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Embedded task');
  });
});
