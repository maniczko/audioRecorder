/**
 * Regression Tests — Bug History
 *
 * Each fixed bug = new test here to prevent regression
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
// Issue #502 - Rate limiting error logged as ERROR instead of INFO
// Date: 2026-03-28
// Bug: Rate limit messages were logged as errors causing false alarms
// Fix: Rate limit is expected behavior, log as INFO or WARN not ERROR
// ─────────────────────────────────────────────────────────────────────────────

describe('Regression: Issue #502 - Rate limiting error handling', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unmock('../config');
    // Clear rate limit map between tests
    vi.doMock('../lib/serverUtils', () => {
      const actual = vi.importActual('../lib/serverUtils');
      return { ...actual };
    });
  });

  test('rate limit error includes Polish message for better UX', async () => {
    const module = await import('../../lib/serverUtils');

    // Simulate rate limit scenario - login route has limit of 5
    // Call it 10 times to exceed the limit
    for (let i = 0; i < 10; i++) {
      try {
        module.checkRateLimit('test-ip', 'login');
      } catch (error: any) {
        // On 6th call should throw with Polish message
        if (i >= 5) {
          expect(error.message).toContain('Zbyt wiele prob');
          expect(error.message).toContain('Limit: 5 żądań/min');
          return;
        }
      }
    }

    // If we get here, the rate limit didn't trigger - fail the test
    expect.fail('Rate limit should have triggered after 5 requests');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue #601 - embedTextChunks fails silently without proper error handling
// Date: 2026-03-28
// Bug: Function threw unhandled promise rejection
// Fix: Added try-catch and proper error logging
// ─────────────────────────────────────────────────────────────────────────────

describe('Regression: Issue #601 - embedTextChunks error handling', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unmock('../config');
  });

  test('embedTextChunks returns empty array on API failure (not throw)', async () => {
    vi.doMock('../config', () => ({
      config: {
        OPENAI_API_KEY: 'test-key',
        OPENAI_BASE_URL: 'https://api.openai.com/v1',
      },
    }));

    // Mock fetch to fail immediately
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('embed failed')));

    const module = await import('../../postProcessing');

    // Should return empty array, not throw
    const result = await module.embedTextChunks(['test text']);

    expect(result).toEqual([]);

    vi.unstubAllGlobals();
  }, 10000);

  test('embedTextChunks returns empty array on HTTP 500', async () => {
    vi.doMock('../config', () => ({
      config: {
        OPENAI_API_KEY: 'test-key',
        OPENAI_BASE_URL: 'https://api.openai.com/v1',
      },
    }));

    // Mock fetch to return 500
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({ error: { message: 'Internal server error' } }),
      })
    );

    const module = await import('../../postProcessing');

    const result = await module.embedTextChunks(['test text']);

    expect(result).toEqual([]);

    vi.unstubAllGlobals();
  });

  test('embedTextChunks returns empty array when OPENAI_API_KEY not configured', async () => {
    vi.doMock('../config', () => ({
      config: {
        OPENAI_API_KEY: '',
        OPENAI_BASE_URL: '',
      },
    }));

    const module = await import('../../postProcessing');

    const result = await module.embedTextChunks(['test text']);

    expect(result).toEqual([]);
  });

  test('embedTextChunks returns empty array for empty input', async () => {
    vi.doMock('../config', () => ({
      config: {
        OPENAI_API_KEY: 'test-key',
        OPENAI_BASE_URL: 'https://api.openai.com/v1',
      },
    }));

    const module = await import('../../postProcessing');

    const result = await module.embedTextChunks([]);

    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue #703 - Bucket creation fails but upload continues
// Date: 2026-03-28
// Bug: Bucket creation error blocked uploads even when bucket already exists
// Fix: Log warning but continue if error is not critical
// ─────────────────────────────────────────────────────────────────────────────

describe('Regression: Issue #703 - Bucket creation error handling', () => {
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

  test('continues upload when bucket already exists', async () => {
    mockCreateBucket.mockResolvedValueOnce({
      data: null,
      error: { message: 'Bucket already exists' },
    });
    mockUpload.mockResolvedValueOnce({
      data: { path: 'recordings/rec1.webm' },
      error: null,
    });

    const module = await import('../../lib/supabaseStorage');

    // Should NOT throw, should continue with upload
    const result = await module.uploadAudioToStorage(
      'rec1',
      Buffer.from('test'),
      'audio/webm',
      '.webm'
    );

    expect(result).toBe('recordings/rec1.webm');
    expect(mockUpload).toHaveBeenCalled();
  });

  test('logs warning but continues when bucket creation fails with permission error', async () => {
    mockCreateBucket.mockResolvedValueOnce({
      data: null,
      error: { message: 'Permission denied' },
    });
    mockUpload.mockResolvedValueOnce({
      data: { path: 'recordings/rec1.webm' },
      error: null,
    });

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const module = await import('../../lib/supabaseStorage');

    const result = await module.uploadAudioToStorage(
      'rec1',
      Buffer.from('test'),
      'audio/webm',
      '.webm'
    );

    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Bucket creation warning'));
    expect(result).toBe('recordings/rec1.webm');

    consoleWarnSpy.mockRestore();
  });

  test('ensureBucket is called only once across multiple uploads', async () => {
    mockCreateBucket.mockResolvedValue({ data: {}, error: null });
    mockUpload.mockResolvedValue({
      data: { path: 'recordings/rec.webm' },
      error: null,
    });

    const module = await import('../../lib/supabaseStorage');

    // Multiple uploads
    await module.uploadAudioToStorage('rec1', Buffer.from('test'), 'audio/webm', '.webm');
    await module.uploadAudioToStorage('rec2', Buffer.from('test'), 'audio/webm', '.webm');
    await module.uploadAudioToStorage('rec3', Buffer.from('test'), 'audio/webm', '.webm');

    // Bucket should be created only once
    expect(mockCreateBucket).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue #804 - deleteAudioFromStorage blocks DB deletion on file not found
// Date: 2026-03-28
// Bug: Function threw error when file already deleted, blocking DB cleanup
// Fix: Log warning but don't throw - file might already be gone
// ─────────────────────────────────────────────────────────────────────────────

describe('Regression: Issue #804 - deleteAudioFromStorage error handling', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  const mockRemove = vi.fn();

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
          from: vi.fn().mockReturnValue({
            remove: mockRemove,
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

  test('does not throw when file not found (already deleted)', async () => {
    mockRemove.mockResolvedValueOnce({
      data: null,
      error: { message: 'File not found' },
    });

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const module = await import('../../lib/supabaseStorage');

    // Should NOT throw, just log warning
    await expect(
      module.deleteAudioFromStorage('recordings/nonexistent.webm')
    ).resolves.toBeUndefined();

    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  test('passes path as array element to Supabase remove', async () => {
    mockRemove.mockResolvedValueOnce({
      data: {},
      error: null,
    });

    const module = await import('../../lib/supabaseStorage');

    await module.deleteAudioFromStorage('recordings/rec1.webm');

    expect(mockRemove).toHaveBeenCalledWith(['recordings/rec1.webm']);
    expect(Array.isArray(mockRemove.mock.calls[0][0])).toBe(true);
  });
});
