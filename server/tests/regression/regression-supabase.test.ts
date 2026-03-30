/**
 * Regression Tests — Supabase Storage
 * 
 * Following AGENTS.md §2.1 and §8:
 * - Tests written BEFORE fix (TDD)
 * - Documents the exact bug scenario
 * - Must pass forever - if fails = bug is back!
 * 
 * Run: pnpm run test:regression
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';

// P0 Fix: Move vi.unmock() to top level to prevent Vitest warnings
vi.unmock('../config');
vi.unmock('@supabase/supabase-js');

// ─────────────────────────────────────────────────────────────────────────────
// Issue #341 - supabaseStorage returns undefined instead of null
// Date: 2026-03-28
// Bug: Function threw error instead of returning null when supabase not configured
// Fix: Check !supabase and return null for fallback to local storage
// ─────────────────────────────────────────────────────────────────────────────

describe('Regression: Issue #341 - supabaseStorage null handling', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unmock('../config');
    vi.unmock('@supabase/supabase-js');
  });

  test('uploadAudioToStorage returns null (not throws) when supabase URL is empty', async () => {
    vi.resetModules();

    vi.doMock('../config', () => ({
      config: { SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: 'test-key' },
    }));

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn().mockReturnValue(null),
    }));

    const module = await import('../../lib/supabaseStorage');

    // Verify supabase is null
    expect(module.supabase).toBeNull();

    // MUST return null, NOT throw
    const result = await module.uploadAudioToStorage(
      'rec1',
      Buffer.from('test'),
      'audio/webm',
      '.webm'
    );

    expect(result).toBeNull();
  }, 10000);

  test('uploadAudioToStorage returns null (not throws) when supabase key is empty', async () => {
    vi.doMock('../config', () => ({
      config: { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: '' },
    }));

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn().mockReturnValue(null),
    }));

    const module = await import('../../lib/supabaseStorage');

    const result = await module.uploadAudioToStorage(
      'rec1',
      Buffer.from('test'),
      'audio/webm',
      '.webm'
    );

    expect(result).toBeNull();
  });

  test('uploadAudioFileToStorage returns null (not throws) when supabase not configured', async () => {
    vi.doMock('../config', () => ({
      config: { SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' },
    }));

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn().mockReturnValue(null),
    }));

    const module = await import('../../lib/supabaseStorage');
    const createReadStreamSpy = vi.spyOn(fs, 'createReadStream').mockReturnValue({} as any);

    const result = await module.uploadAudioFileToStorage(
      'rec1',
      '/path/to/file.webm',
      'audio/webm',
      '.webm'
    );

    expect(result).toBeNull();
    // Should not even try to read file when supabase not configured
    expect(createReadStreamSpy).not.toHaveBeenCalled();

    createReadStreamSpy.mockRestore();
  });

  test('downloadAudioFromStorage throws with clear message when supabase not configured', async () => {
    vi.doMock('../config', () => ({
      config: { SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' },
    }));

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn().mockReturnValue(null),
    }));

    const module = await import('../../lib/supabaseStorage');

    await expect(module.downloadAudioFromStorage('recordings/rec1.webm')).rejects.toThrow(
      'Supabase credentials not configured.'
    );
  });

  test('deleteAudioFromStorage throws with clear message when supabase not configured', async () => {
    vi.doMock('../config', () => ({
      config: { SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' },
    }));

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn().mockReturnValue(null),
    }));

    const module = await import('../../lib/supabaseStorage');

    await expect(module.deleteAudioFromStorage('recordings/rec1.webm')).rejects.toThrow(
      'Supabase credentials not configured.'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue #456 - Recording ID sanitization breaks with unicode characters
// Date: 2026-03-28
// Bug: Unicode chars like 'ąćśź' were not properly sanitized
// Fix: Regex /[^a-zA-Z0-9_-]/g replaces all invalid chars with underscore
// ─────────────────────────────────────────────────────────────────────────────

describe('Regression: Issue #456 - Recording ID sanitization', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  const mockCreateBucket = vi.fn();
  const mockUpload = vi.fn();

  beforeEach(() => {
    vi.doMock('../config', () => ({
      config: {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      },
    }));

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn().mockReturnValue({
        storage: {
          createBucket: mockCreateBucket,
          from: vi.fn().mockReturnValue({
            upload: mockUpload,
          }),
        },
      }),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unmock('../config');
    vi.unmock('@supabase/supabase-js');
  });

  test('sanitizes Polish unicode characters to underscores', async () => {
    mockCreateBucket.mockResolvedValueOnce({ data: {}, error: null });
    mockUpload.mockResolvedValueOnce({
      data: { path: 'recordings/_____test.webm' },
      error: null,
    });

    const module = await import('../../lib/supabaseStorage');
    await module.uploadAudioToStorage('ąćśź@test', Buffer.from('test'), 'audio/webm', '.webm');

    // 'ąćśź@test' should become '_____test' (each unicode char → underscore)
    expect(mockUpload).toHaveBeenCalledWith(
      '_____test.webm',
      expect.any(Buffer),
      expect.any(Object)
    );
  });

  test('sanitizes all special characters not just some', async () => {
    mockCreateBucket.mockResolvedValueOnce({ data: {}, error: null });
    mockUpload.mockResolvedValueOnce({
      data: { path: 'recordings/rec_________test.webm' },
      error: null,
    });

    const module = await import('../../lib/supabaseStorage');
    await module.uploadAudioToStorage(
      'rec@#$%^&*()test',
      Buffer.from('test'),
      'audio/webm',
      '.webm'
    );

    // All special chars should be replaced
    expect(mockUpload).toHaveBeenCalledWith(
      'rec_________test.webm',
      expect.any(Buffer),
      expect.any(Object)
    );
  });

  test('sanitizes dots to prevent path traversal', async () => {
    mockCreateBucket.mockResolvedValueOnce({ data: {}, error: null });
    mockUpload.mockResolvedValueOnce({
      data: { path: 'recordings/rec_test.webm' },
      error: null,
    });

    const module = await import('../../lib/supabaseStorage');
    await module.uploadAudioToStorage('rec.test', Buffer.from('test'), 'audio/webm', '.webm');

    // Dot should be replaced to prevent path traversal
    expect(mockUpload).toHaveBeenCalledWith(
      'rec_test.webm',
      expect.any(Buffer),
      expect.any(Object)
    );
  });

  test('sanitizes slashes to prevent path traversal', async () => {
    mockCreateBucket.mockResolvedValueOnce({ data: {}, error: null });
    mockUpload.mockResolvedValueOnce({
      data: { path: 'recordings/rec_test.webm' },
      error: null,
    });

    const module = await import('../../lib/supabaseStorage');
    await module.uploadAudioToStorage('rec/test', Buffer.from('test'), 'audio/webm', '.webm');

    // Slash should be replaced to prevent path traversal
    expect(mockUpload).toHaveBeenCalledWith(
      'rec_test.webm',
      expect.any(Buffer),
      expect.any(Object)
    );
  });

  test('preserves valid characters (alphanumeric, underscore, hyphen)', async () => {
    mockCreateBucket.mockResolvedValueOnce({ data: {}, error: null });
    mockUpload.mockResolvedValueOnce({
      data: { path: 'recordings/rec_test-123.webm' },
      error: null,
    });

    const module = await import('../../lib/supabaseStorage');
    await module.uploadAudioToStorage('rec_test-123', Buffer.from('test'), 'audio/webm', '.webm');

    // Valid chars should be preserved
    expect(mockUpload).toHaveBeenCalledWith(
      'rec_test-123.webm',
      expect.any(Buffer),
      expect.any(Object)
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue #703 - Bucket creation error handling
// Date: 2026-03-29
// Bug: Bucket creation errors blocked uploads
// Fix: Log warning but continue if bucket already exists or non-critical error
// ─────────────────────────────────────────────────────────────────────────────

describe('Regression: Issue #703 - Bucket creation error handling', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unmock('../config');
    vi.unmock('@supabase/supabase-js');
  });

  test('continues upload when bucket already exists', async () => {
    const mockCreateBucket = vi.fn().mockResolvedValueOnce({
      data: null,
      error: { message: 'Bucket already exists' },
    });
    const mockUpload = vi.fn().mockResolvedValueOnce({
      data: { path: 'recordings/rec1.webm' },
      error: null,
    });

    vi.doMock('../config', () => ({
      config: {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      },
    }));

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn().mockReturnValue({
        storage: {
          createBucket: mockCreateBucket,
          from: vi.fn().mockReturnValue({
            upload: mockUpload,
          }),
        },
      }),
    }));

    const module = await import('../../lib/supabaseStorage');
    const result = await module.uploadAudioToStorage('rec1', Buffer.from('test'), 'audio/webm', '.webm');

    // Should continue with upload despite bucket error
    expect(result).not.toBeNull();
    expect(mockUpload).toHaveBeenCalled();
  });

  test('logs warning but continues when bucket creation fails with permission error', async () => {
    const mockCreateBucket = vi.fn().mockResolvedValueOnce({
      data: null,
      error: { message: 'Permission denied' },
    });
    const mockUpload = vi.fn().mockResolvedValueOnce({
      data: { path: 'recordings/rec1.webm' },
      error: null,
    });

    vi.doMock('../config', () => ({
      config: {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      },
    }));

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn().mockReturnValue({
        storage: {
          createBucket: mockCreateBucket,
          from: vi.fn().mockReturnValue({
            upload: mockUpload,
          }),
        },
      }),
    }));

    const module = await import('../../lib/supabaseStorage');
    const result = await module.uploadAudioToStorage('rec1', Buffer.from('test'), 'audio/webm', '.webm');

    // Should continue with upload
    expect(result).not.toBeNull();
    expect(mockUpload).toHaveBeenCalled();
  });

  test('ensureBucket is called only once across multiple uploads', async () => {
    const mockCreateBucket = vi.fn().mockResolvedValueOnce({ data: {}, error: null });
    const mockUpload = vi.fn().mockResolvedValue({ data: { path: 'recordings/rec.webm' }, error: null });

    vi.doMock('../config', () => ({
      config: {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      },
    }));

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn().mockReturnValue({
        storage: {
          createBucket: mockCreateBucket,
          from: vi.fn().mockReturnValue({
            upload: mockUpload,
          }),
        },
      }),
    }));

    const module = await import('../../lib/supabaseStorage');

    // Multiple uploads
    await module.uploadAudioToStorage('rec1', Buffer.from('test'), 'audio/webm', '.webm');
    await module.uploadAudioToStorage('rec2', Buffer.from('test'), 'audio/webm', '.webm');
    await module.uploadAudioToStorage('rec3', Buffer.from('test'), 'audio/webm', '.webm');

    // Bucket creation should only happen once (cached)
    expect(mockCreateBucket).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue #804 - deleteAudioFromStorage error handling
// Date: 2026-03-29
// Bug: Deleting non-existent file threw error instead of graceful handling
// Fix: Check if file exists before delete, handle 404 gracefully
// ─────────────────────────────────────────────────────────────────────────────

describe('Regression: Issue #804 - deleteAudioFromStorage error handling', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unmock('../config');
    vi.unmock('@supabase/supabase-js');
  });

  test('does not throw when file not found (already deleted)', async () => {
    const mockRemove = vi.fn().mockResolvedValueOnce({
      data: null,
      error: { message: 'Object not found', statusCode: '404' },
    });

    vi.doMock('../config', () => ({
      config: {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      },
    }));

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn().mockReturnValue({
        storage: {
          from: vi.fn().mockReturnValue({
            remove: mockRemove,
          }),
        },
      }),
    }));

    const module = await import('../../lib/supabaseStorage');

    // Should not throw - file already deleted is success
    await expect(module.deleteAudioFromStorage('recordings/nonexistent.webm')).resolves.toBeUndefined();
  });

  test('passes path as array element to Supabase remove', async () => {
    const mockRemove = vi.fn().mockResolvedValueOnce({ data: {}, error: null });

    vi.doMock('../config', () => ({
      config: {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      },
    }));

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn().mockReturnValue({
        storage: {
          from: vi.fn().mockReturnValue({
            remove: mockRemove,
          }),
        },
      }),
    }));

    const module = await import('../../lib/supabaseStorage');
    await module.deleteAudioFromStorage('recordings/rec1.webm');

    // Path should be passed as array element
    expect(mockRemove).toHaveBeenCalledWith(['recordings/rec1.webm']);
  });
});
