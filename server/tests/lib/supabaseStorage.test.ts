/**
 * Testy dla supabaseStorage.ts
 * Coverage target: 100%
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';

// Mock Supabase client before importing the module
const mockCreateBucket = vi.fn();
const mockUpload = vi.fn();
const mockDownload = vi.fn();
const mockRemove = vi.fn();

const mockFrom = vi.fn().mockReturnValue({
  upload: mockUpload,
  download: mockDownload,
  remove: mockRemove,
});

const mockStorage = {
  createBucket: mockCreateBucket,
  from: mockFrom,
};

const mockCreateClient = vi.fn().mockReturnValue({
  storage: mockStorage,
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

// Mock config
vi.mock('../config', () => ({
  config: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
  },
}));

// Import after mocks
const {
  supabase,
  uploadAudioToStorage,
  uploadAudioFileToStorage,
  downloadAudioFromStorage,
  deleteAudioFromStorage,
} = await import('../../lib/supabaseStorage');

describe('supabaseStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockClear();
    mockFrom.mockReturnValue({
      upload: mockUpload,
      download: mockDownload,
      remove: mockRemove,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Supabase client', () => {
    test('exports supabase client instance', () => {
      expect(supabase).toBeDefined();
      expect(supabase.storage).toBeDefined();
    });
  });

  describe('uploadAudioToStorage()', () => {
    test('uploads buffer to Supabase Storage', async () => {
      mockCreateBucket.mockResolvedValueOnce({ data: {}, error: null });
      mockUpload.mockResolvedValueOnce({
        data: { path: 'recordings/rec1.webm' },
        error: null,
      });

      const result = await uploadAudioToStorage(
        'rec1',
        Buffer.from('test-audio'),
        'audio/webm',
        '.webm'
      );

      expect(result).toBe('recordings/rec1.webm');
      expect(mockUpload).toHaveBeenCalledWith('rec1.webm', expect.any(Buffer), {
        contentType: 'audio/webm',
        upsert: true,
      });
    });

    test('sanitizes recording ID with special characters', async () => {
      mockCreateBucket.mockResolvedValueOnce({ data: {}, error: null });
      mockUpload.mockResolvedValueOnce({
        data: { path: 'recordings/rec_test_123.webm' },
        error: null,
      });

      await uploadAudioToStorage('rec@test!123', Buffer.from('test'), 'audio/webm', '.webm');

      expect(mockUpload).toHaveBeenCalledWith(
        'rec_test_123.webm',
        expect.any(Buffer),
        expect.any(Object)
      );
    });

    test('handles empty recording ID', async () => {
      mockCreateBucket.mockResolvedValueOnce({ data: {}, error: null });
      mockUpload.mockResolvedValueOnce({
        data: { path: 'recordings/.webm' },
        error: null,
      });

      const result = await uploadAudioToStorage('', Buffer.from('test'), 'audio/webm', '.webm');

      expect(result).toBe('recordings/.webm');
      expect(mockUpload).toHaveBeenCalledWith('.webm', expect.any(Buffer), {
        contentType: 'audio/webm',
        upsert: true,
      });
    });

    test('throws error when upload fails', async () => {
      mockCreateBucket.mockResolvedValueOnce({ data: {}, error: null });
      mockUpload.mockResolvedValueOnce({
        data: null,
        error: new Error('Upload failed'),
      });

      await expect(uploadAudioToStorage('rec1', Buffer.from('test-audio'), 'audio/webm', '.webm')).rejects.toThrow('Upload failed');
    });
  });
});