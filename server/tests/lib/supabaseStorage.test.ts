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

      await uploadAudioToStorage('', Buffer.from('test'), 'audio/webm', '.webm');

      expect(mockUpload).toHaveBeenCalledWith('.webm', expect.any(Buffer), expect.any(Object));
    });

    test('throws error when upload fails', async () => {
      mockCreateBucket.mockResolvedValueOnce({ data: {}, error: null });
      mockUpload.mockResolvedValueOnce({
        data: null,
        error: { message: 'Storage upload failed' },
      });

      await expect(
        uploadAudioToStorage('rec1', Buffer.from('test'), 'audio/webm', '.webm')
      ).rejects.toThrow('Failed to upload to Supabase Storage: Storage upload failed');
    });

    test('handles different content types', async () => {
      mockCreateBucket.mockResolvedValueOnce({ data: {}, error: null });
      mockUpload.mockResolvedValueOnce({
        data: { path: 'recordings/rec1.mp3' },
        error: null,
      });

      await uploadAudioToStorage('rec1', Buffer.from('test'), 'audio/mpeg', '.mp3');

      expect(mockUpload).toHaveBeenCalledWith(expect.any(String), expect.any(Buffer), {
        contentType: 'audio/mpeg',
        upsert: true,
      });
    });

    test('handles different file extensions', async () => {
      mockCreateBucket.mockResolvedValueOnce({ data: {}, error: null });
      mockUpload.mockResolvedValueOnce({
        data: { path: 'recordings/rec1.m4a' },
        error: null,
      });

      await uploadAudioToStorage('rec1', Buffer.from('test'), 'audio/mp4', '.m4a');

      expect(mockUpload).toHaveBeenCalledWith('rec1.m4a', expect.any(Buffer), expect.any(Object));
    });

    test('uploads with upsert enabled', async () => {
      mockCreateBucket.mockResolvedValueOnce({ data: {}, error: null });
      mockUpload.mockResolvedValueOnce({
        data: { path: 'recordings/rec1.webm' },
        error: null,
      });

      await uploadAudioToStorage('rec1', Buffer.from('test'), 'audio/webm', '.webm');

      const uploadCall = mockUpload.mock.calls[0];
      expect(uploadCall[2]?.upsert).toBe(true);
    });

    test('handles empty buffer', async () => {
      mockCreateBucket.mockResolvedValueOnce({ data: {}, error: null });
      mockUpload.mockResolvedValueOnce({
        data: { path: 'recordings/rec1.webm' },
        error: null,
      });

      const result = await uploadAudioToStorage('rec1', Buffer.from(''), 'audio/webm', '.webm');

      expect(result).toBe('recordings/rec1.webm');
    });

    test('handles null recording ID', async () => {
      mockCreateBucket.mockResolvedValueOnce({ data: {}, error: null });
      mockUpload.mockResolvedValueOnce({
        data: { path: 'recordings/.webm' },
        error: null,
      });

      const result = await uploadAudioToStorage(
        null as any,
        Buffer.from('test'),
        'audio/webm',
        '.webm'
      );

      expect(result).toBe('recordings/.webm');
    });
  });

  describe('uploadAudioFileToStorage()', () => {
    test('uploads file to Supabase Storage', async () => {
      mockCreateBucket.mockResolvedValueOnce({ data: {}, error: null });
      mockUpload.mockResolvedValueOnce({
        data: { path: 'recordings/rec1.webm' },
        error: null,
      });

      // Mock fs.createReadStream
      const mockReadStream = { pipe: vi.fn() };
      const createReadStreamSpy = vi
        .spyOn(fs, 'createReadStream')
        .mockReturnValue(mockReadStream as any);

      const result = await uploadAudioFileToStorage(
        'rec1',
        '/path/to/file.webm',
        'audio/webm',
        '.webm'
      );

      expect(result).toBe('recordings/rec1.webm');
      expect(createReadStreamSpy).toHaveBeenCalledWith('/path/to/file.webm');
      expect(mockUpload).toHaveBeenCalledWith('rec1.webm', mockReadStream, {
        contentType: 'audio/webm',
        upsert: true,
      });

      createReadStreamSpy.mockRestore();
    });

    test('sanitizes recording ID', async () => {
      mockCreateBucket.mockResolvedValueOnce({ data: {}, error: null });
      mockUpload.mockResolvedValueOnce({
        data: { path: 'recordings/rec_test_.webm' },
        error: null,
      });

      const createReadStreamSpy = vi.spyOn(fs, 'createReadStream').mockReturnValue({} as any);

      await uploadAudioFileToStorage('rec@test!', '/path/to/file.webm', 'audio/webm', '.webm');

      expect(mockUpload).toHaveBeenCalledWith(
        'rec_test_.webm',
        expect.any(Object),
        expect.any(Object)
      );

      createReadStreamSpy.mockRestore();
    });

    test('throws error when upload fails', async () => {
      mockCreateBucket.mockResolvedValueOnce({ data: {}, error: null });
      mockUpload.mockResolvedValueOnce({
        data: null,
        error: { message: 'Upload error' },
      });

      const createReadStreamSpy = vi.spyOn(fs, 'createReadStream').mockReturnValue({} as any);

      await expect(
        uploadAudioFileToStorage('rec1', '/path/to/file.webm', 'audio/webm', '.webm')
      ).rejects.toThrow('Failed to upload to Supabase Storage: Upload error');

      createReadStreamSpy.mockRestore();
    });

    test('handles different file extensions', async () => {
      mockCreateBucket.mockResolvedValueOnce({ data: {}, error: null });
      mockUpload.mockResolvedValueOnce({
        data: { path: 'recordings/rec1.mp3' },
        error: null,
      });

      const createReadStreamSpy = vi.spyOn(fs, 'createReadStream').mockReturnValue({} as any);

      await uploadAudioFileToStorage('rec1', '/path/to/file.mp3', 'audio/mpeg', '.mp3');

      expect(mockUpload).toHaveBeenCalledWith('rec1.mp3', expect.any(Object), expect.any(Object));

      createReadStreamSpy.mockRestore();
    });
  });

  describe('downloadAudioFromStorage()', () => {
    test('downloads file from Supabase Storage', async () => {
      const mockBlob = {
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      };
      mockDownload.mockResolvedValueOnce({
        data: mockBlob,
        error: null,
      });

      const result = await downloadAudioFromStorage('recordings/rec1.webm');

      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(result.byteLength).toBe(100);
      expect(mockDownload).toHaveBeenCalledWith('recordings/rec1.webm');
    });

    test('throws error when download fails', async () => {
      mockDownload.mockResolvedValueOnce({
        data: null,
        error: { message: 'File not found' },
      });

      await expect(downloadAudioFromStorage('recordings/nonexistent.webm')).rejects.toThrow(
        'Failed to download from Supabase Storage: File not found'
      );
    });

    test('handles different file paths', async () => {
      const mockBlob = {
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(50)),
      };
      mockDownload.mockResolvedValueOnce({
        data: mockBlob,
        error: null,
      });

      await downloadAudioFromStorage('recordings/subfolder/rec1.mp3');

      expect(mockDownload).toHaveBeenCalledWith('recordings/subfolder/rec1.mp3');
    });

    test('handles special characters in file path', async () => {
      const mockBlob = {
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      };
      mockDownload.mockResolvedValueOnce({
        data: mockBlob,
        error: null,
      });

      await downloadAudioFromStorage('recordings/rec with spaces.webm');

      expect(mockDownload).toHaveBeenCalledWith('recordings/rec with spaces.webm');
    });
  });

  describe('deleteAudioFromStorage()', () => {
    test('deletes file from Supabase Storage', async () => {
      mockRemove.mockResolvedValueOnce({
        data: {},
        error: null,
      });

      await deleteAudioFromStorage('recordings/rec1.webm');

      expect(mockRemove).toHaveBeenCalledWith(['recordings/rec1.webm']);
    });

    test('logs warning but does not throw when delete fails', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockRemove.mockResolvedValueOnce({
        data: null,
        error: { message: 'File not found' },
      });

      await deleteAudioFromStorage('recordings/rec1.webm');

      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    test('handles different file paths', async () => {
      mockRemove.mockResolvedValueOnce({
        data: {},
        error: null,
      });

      await deleteAudioFromStorage('recordings/subfolder/rec1.mp3');

      expect(mockRemove).toHaveBeenCalledWith(['recordings/subfolder/rec1.mp3']);
    });
  });

  describe('Integration scenarios', () => {
    test('upload then download flow', async () => {
      const mockBlob = {
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      };

      mockCreateBucket.mockResolvedValueOnce({ data: {}, error: null });
      mockUpload.mockResolvedValueOnce({
        data: { path: 'recordings/rec1.webm' },
        error: null,
      });
      mockDownload.mockResolvedValueOnce({
        data: mockBlob,
        error: null,
      });

      // Upload
      const uploadPath = await uploadAudioToStorage(
        'rec1',
        Buffer.from('test'),
        'audio/webm',
        '.webm'
      );
      expect(uploadPath).toBe('recordings/rec1.webm');

      // Download
      const downloadResult = await downloadAudioFromStorage(uploadPath);
      expect(downloadResult).toBeInstanceOf(ArrayBuffer);
    });

    test('upload then delete flow', async () => {
      mockCreateBucket.mockResolvedValueOnce({ data: {}, error: null });
      mockUpload.mockResolvedValueOnce({
        data: { path: 'recordings/rec1.webm' },
        error: null,
      });
      mockRemove.mockResolvedValueOnce({
        data: {},
        error: null,
      });

      // Upload
      const uploadPath = await uploadAudioToStorage(
        'rec1',
        Buffer.from('test'),
        'audio/webm',
        '.webm'
      );
      expect(uploadPath).toBe('recordings/rec1.webm');

      // Delete
      await deleteAudioFromStorage(uploadPath);
      expect(mockRemove).toHaveBeenCalledWith(['recordings/rec1.webm']);
    });

    test('error handling in upload-download-delete flow', async () => {
      mockCreateBucket.mockResolvedValueOnce({ data: {}, error: null });
      mockUpload.mockResolvedValueOnce({
        data: { path: 'recordings/rec1.webm' },
        error: null,
      });
      mockDownload.mockResolvedValueOnce({
        data: null,
        error: { message: 'Download failed' },
      });
      mockRemove.mockResolvedValueOnce({
        data: {},
        error: null,
      });

      // Upload succeeds
      const uploadPath = await uploadAudioToStorage(
        'rec1',
        Buffer.from('test'),
        'audio/webm',
        '.webm'
      );
      expect(uploadPath).toBe('recordings/rec1.webm');

      // Download fails
      await expect(downloadAudioFromStorage(uploadPath)).rejects.toThrow();

      // Cleanup still happens
      await deleteAudioFromStorage(uploadPath);
      expect(mockRemove).toHaveBeenCalled();
    });
  });
});
