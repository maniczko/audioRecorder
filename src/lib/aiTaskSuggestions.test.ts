import { describe, test, expect, vi, beforeEach } from 'vitest';
import { apiRequest } from '../services/httpClient';
import { suggestTasksFromTranscript } from './aiTaskSuggestions';

// Mock httpClient so proxy calls are intercepted
vi.mock('../services/httpClient', () => ({
  apiRequest: vi.fn(),
}));

describe('suggestTasksFromTranscript', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_ANTHROPIC_API_KEY', 'test-api-key');
    vi.stubGlobal('fetch', vi.fn());
  });

  test('returns empty array if transcript is empty', async () => {
    const result = await suggestTasksFromTranscript([]);
    expect(result).toEqual([]);
  });

  test('calls server proxy when VITE_API_BASE_URL is set', async () => {
    const mockTasks = [
      { title: 'Finish report', owner: 'Alice', priority: 'high', tags: [] },
    ];
    (apiRequest as any).mockResolvedValue({ tasks: mockTasks });

    const transcript = [{ speakerName: 'Alice', text: 'We need to finish the report by Friday.' }];
    const result = await suggestTasksFromTranscript(transcript);

    expect(apiRequest).toHaveBeenCalledWith('/ai/suggest-tasks', expect.objectContaining({ method: 'POST' }));
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Finish report');
  });

  test('returns empty array when proxy fails', async () => {
    (apiRequest as any).mockRejectedValue(new Error('Network error'));

    const result = await suggestTasksFromTranscript([{ text: 'test' }]);
    expect(result).toEqual([]);
  });

  test('returns empty array when proxy returns no tasks', async () => {
    (apiRequest as any).mockResolvedValue({ tasks: [] });

    const result = await suggestTasksFromTranscript([{ text: 'test' }]);
    expect(result).toEqual([]);
  });

  test('returns empty array when proxy returns unexpected shape', async () => {
    (apiRequest as any).mockResolvedValue({ unexpected: true });

    const result = await suggestTasksFromTranscript([{ text: 'test' }]);
    expect(result).toEqual([]);
  });
});
