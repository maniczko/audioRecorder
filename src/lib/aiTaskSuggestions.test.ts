import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockApiRequest = vi.hoisted(() => vi.fn());

vi.mock('../services/httpClient', () => ({
  apiRequest: mockApiRequest,
}));

vi.mock('../services/config', () => ({
  API_BASE_URL: 'http://localhost:3001',
}));

import { suggestTasksFromTranscript } from './aiTaskSuggestions';

describe('aiTaskSuggestions', () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls server proxy endpoint with transcript and people', async () => {
    mockApiRequest.mockResolvedValue({ tasks: [{ title: 'Do X' }] });

    const transcript = [{ speakerName: 'Anna', text: 'Let us do X' }];
    const people = [{ name: 'Anna' }];

    const result = await suggestTasksFromTranscript(transcript, people);

    expect(mockApiRequest).toHaveBeenCalledWith('/ai/suggest-tasks', {
      method: 'POST',
      body: { transcript, people },
    });
    expect(result).toEqual([{ title: 'Do X' }]);
  });

  it('returns empty array when server returns non-array tasks', async () => {
    mockApiRequest.mockResolvedValue({ tasks: 'not an array' });

    const result = await suggestTasksFromTranscript([{ text: 'test' }]);
    expect(result).toEqual([]);
  });

  it('returns empty array when server returns null', async () => {
    mockApiRequest.mockResolvedValue(null);

    const result = await suggestTasksFromTranscript([{ text: 'test' }]);
    expect(result).toEqual([]);
  });

  it('returns empty array on server error', async () => {
    mockApiRequest.mockRejectedValue(new Error('500'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await suggestTasksFromTranscript([{ text: 'test' }]);

    expect(result).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it('passes people as empty array by default', async () => {
    mockApiRequest.mockResolvedValue({ tasks: [] });

    await suggestTasksFromTranscript([{ text: 'meeting' }]);

    expect(mockApiRequest).toHaveBeenCalledWith('/ai/suggest-tasks', {
      method: 'POST',
      body: { transcript: [{ text: 'meeting' }], people: [] },
    });
  });

  it('returns tasks array from server response', async () => {
    const tasks = [
      { title: 'Task 1', owner: 'Anna', priority: 'high' },
      { title: 'Task 2', owner: null, priority: 'low' },
    ];
    mockApiRequest.mockResolvedValue({ tasks });

    const result = await suggestTasksFromTranscript([{ text: 'do work' }]);
    expect(result).toEqual(tasks);
    expect(result).toHaveLength(2);
  });
});
