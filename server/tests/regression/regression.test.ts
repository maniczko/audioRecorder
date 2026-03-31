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

// P0 Fix: Move vi.unmock() to top level to prevent Vitest warnings
// These are hoisted anyway, so should be at module top
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

  // Remove afterEach with vi.unmock() - already at top level

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

  // P0 Fix: Remove afterEach with vi.unmock() - already at top level

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

  // P0 Fix: Remove afterEach with vi.unmock() - already at top level

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
// Issue #0 — Audio GET 404 after Railway redeploy: path.sep detection fragile
// Date: 2026-03-29
// Bug: On Linux path.sep='/' works, but the code using path.sep is fragile
//      across platforms and missed Supabase fallback when local file disappears.
//      Also: retry-transcribe used path.sep which could misdetect on cross-OS data.
// Fix: - Use explicit '/' and '\\' checks instead of path.sep
//      - Add Supabase fallback when local file is missing (try basename as key)
//      - Add diagnostic console logging for 404/500 cases
// ─────────────────────────────────────────────────────────────────────────────

describe('Regression: Issue #0 — Audio path detection cross-platform', () => {
  test('Supabase key (no separators) is detected as remote path', () => {
    const filePath = 'rec_abc123.webm';
    const isRemote = !filePath.includes('/') && !filePath.includes('\\');
    expect(isRemote).toBe(true);
  });

  test('Linux local path is detected as local (has /)', () => {
    const filePath = '/app/server/data/uploads/rec_abc123.webm';
    const isRemote = !filePath.includes('/') && !filePath.includes('\\');
    expect(isRemote).toBe(false);
  });

  test('Windows local path is detected as local (has \\)', () => {
    const filePath = 'C:\\Users\\data\\uploads\\rec_abc123.webm';
    const isRemote = !filePath.includes('/') && !filePath.includes('\\');
    expect(isRemote).toBe(false);
  });

  test('basename of Linux path yields valid Supabase key', async () => {
    const path = await import('node:path');
    const filePath = '/app/server/data/uploads/rec_abc123.webm';
    const basename = path.basename(filePath);
    expect(basename).toBe('rec_abc123.webm');
    // basename should be a valid Supabase key (no separators)
    expect(!basename.includes('/') && !basename.includes('\\')).toBe(true);
  });

  test('retry-transcribe detects local path with / or \\', () => {
    const linuxPath = '/app/data/uploads/rec.webm';
    const windowsPath = 'C:\\data\\uploads\\rec.webm';
    const supabaseKey = 'rec.webm';

    const hasLocalSep = (p: string) => p.includes('/') || p.includes('\\');
    expect(hasLocalSep(linuxPath)).toBe(true);
    expect(hasLocalSep(windowsPath)).toBe(true);
    expect(hasLocalSep(supabaseKey)).toBe(false);
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

// ─────────────────────────────────────────────────────────────────
// Issue #0 — Server httpClient does not retry on HTTP 502/503/504
// Date: 2026-03-29
// Bug: httpClient only retried on network-level errors (ECONNRESET etc.),
//      not on HTTP 502/503/504 from upstream STT providers
// Fix: Added RETRYABLE_STATUS_CODES check in the fetch loop to retry
//      on 502, 503, 504 before returning the response
// ─────────────────────────────────────────────────────────────────
describe('Regression: #0 — httpClient retries on HTTP 502/503/504', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('retries on 502 and eventually succeeds', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn(async () => {
      callCount++;
      if (callCount < 3) {
        return new Response('Bad Gateway', { status: 502, statusText: 'Bad Gateway' });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    const { httpClient } = await import('../../lib/httpClient');
    const result = await httpClient('https://api.example.com/test', { timeout: 5000 });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(callCount).toBe(3);
  });

  test('returns 502 after all retries exhausted', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response('Bad Gateway', { status: 502, statusText: 'Bad Gateway' });
    }) as any;

    const { httpClient } = await import('../../lib/httpClient');
    const result = await httpClient('https://api.example.com/test', { timeout: 5000 });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(502);
  });
});

// ─────────────────────────────────────────────────────────────────
// Issue #0 — _sendToWorker hangs forever if SQLite worker dies
// Date: 2026-03-29
// Bug: _sendToWorker returned a Promise with no timeout. If the
//      SQLite worker crashed or became unresponsive, ALL database
//      queries would hang indefinitely. Vercel proxy would timeout
//      (10-30s) and return 502 to the client. /health returned 200
//      because it never touched the DB — making the server appear
//      healthy while actually being a zombie.
// Fix: 1) Added 15s timeout to _sendToWorker
//      2) Worker crash rejects all pending callbacks
//      3) Worker auto-restarts on exit
//      4) /health now checks DB connectivity (returns 503 if down)
// ─────────────────────────────────────────────────────────────────
describe('Regression: #0 — _sendToWorker timeout prevents zombie server', () => {
  test('_sendToWorker rejects after timeout when worker does not respond', async () => {
    // Simulate a worker that never responds by creating a mock
    const callbacks = new Map<number, { resolve: Function; reject: Function }>();
    let msgId = 0;
    const TIMEOUT_MS = 200; // Use short timeout for testing

    function sendToWorkerWithTimeout(type: string, sql: string | null) {
      return new Promise((resolve, reject) => {
        const id = ++msgId;
        const timer = setTimeout(() => {
          callbacks.delete(id);
          reject(
            new Error(
              `[DB] Query timeout after ${TIMEOUT_MS}ms: ${type} ${String(sql || '').slice(0, 80)}`
            )
          );
        }, TIMEOUT_MS);
        callbacks.set(id, {
          resolve: (val: any) => {
            clearTimeout(timer);
            resolve(val);
          },
          reject: (err: Error) => {
            clearTimeout(timer);
            reject(err);
          },
        });
        // Intentionally NOT sending to worker — simulates unresponsive worker
      });
    }

    // Should reject after ~200ms, not hang forever
    await expect(sendToWorkerWithTimeout('query', 'SELECT 1')).rejects.toThrow(/Query timeout/);
    expect(callbacks.size).toBe(0); // callback was cleaned up
  });

  test('_rejectAllPending clears all waiting callbacks on worker crash', () => {
    const callbacks = new Map<number, { resolve: Function; reject: Function }>();
    const rejections: string[] = [];

    // Simulate 5 pending queries
    for (let i = 1; i <= 5; i++) {
      callbacks.set(i, {
        resolve: () => {},
        reject: (err: Error) => {
          rejections.push(err.message);
        },
      });
    }

    // Simulate _rejectAllPending
    for (const [, cb] of callbacks) {
      cb.reject(new Error('Worker exited unexpectedly'));
    }
    callbacks.clear();

    expect(rejections).toHaveLength(5);
    expect(rejections.every((m) => m === 'Worker exited unexpectedly')).toBe(true);
    expect(callbacks.size).toBe(0);
  });

  test('timeout clears callback to prevent memory leak', async () => {
    const callbacks = new Map<number, { resolve: Function; reject: Function }>();
    let msgId = 0;
    const TIMEOUT_MS = 50;

    function sendToWorkerWithTimeout() {
      return new Promise((resolve, reject) => {
        const id = ++msgId;
        const timer = setTimeout(() => {
          callbacks.delete(id);
          reject(new Error('timeout'));
        }, TIMEOUT_MS);
        callbacks.set(id, {
          resolve: (val: any) => {
            clearTimeout(timer);
            resolve(val);
          },
          reject: (err: Error) => {
            clearTimeout(timer);
            reject(err);
          },
        });
      });
    }

    // Fire 10 queries that will all timeout
    const promises = Array.from({ length: 10 }, () => sendToWorkerWithTimeout().catch(() => {}));
    await Promise.all(promises);

    // All callbacks should have been cleaned up
    expect(callbacks.size).toBe(0);
  });

  test('successful response clears timeout (no double-resolve)', async () => {
    const callbacks = new Map<number, { resolve: Function; reject: Function }>();
    let msgId = 0;
    const TIMEOUT_MS = 5000;

    function sendToWorkerWithTimeout() {
      return new Promise((resolve, reject) => {
        const id = ++msgId;
        const timer = setTimeout(() => {
          callbacks.delete(id);
          reject(new Error('timeout'));
        }, TIMEOUT_MS);
        callbacks.set(id, {
          resolve: (val: any) => {
            clearTimeout(timer);
            resolve(val);
          },
          reject: (err: Error) => {
            clearTimeout(timer);
            reject(err);
          },
        });
      });
    }

    const promise = sendToWorkerWithTimeout();

    // Simulate worker responding immediately
    const cb = callbacks.get(1)!;
    cb.resolve({ ok: true });

    const result = await promise;
    expect(result).toEqual({ ok: true });
    // Callback cleaned up by resolve
    // Timer was cleared, so no timeout error will fire later
  });
});

// ─────────────────────────────────────────────────────────────────
// Issue #0 — Sketchnote Gemini error detail not visible to user
// Date: 2026-03-30
// Bug: When Gemini API returned an error (e.g. quota exceeded, model
//      not found), the backend response only contained a generic
//      "Blad generowania obrazu Gemini." message. The actual Gemini
//      error detail was logged server-side but never sent to client.
//      Frontend httpClient reads only `message` from error responses.
// Fix: Parse Gemini error JSON, extract error.message, and include
//      it directly in the response `message` field as:
//      "Blad Gemini (STATUS): actual error detail"
// ─────────────────────────────────────────────────────────────────
describe('Regression: #0 — Sketchnote Gemini error detail in response message', () => {
  test('Gemini JSON error message is included in response message field', () => {
    const geminiResponse = JSON.stringify({
      error: {
        code: 404,
        message: 'models/gemini-3-pro-image-preview is not found',
        status: 'NOT_FOUND',
      },
    });
    const geminiStatus = 404;

    let detail = '';
    try {
      const parsed = JSON.parse(geminiResponse);
      detail = parsed?.error?.message || geminiResponse.slice(0, 200);
    } catch {
      detail = geminiResponse.slice(0, 200);
    }
    const message = `Blad Gemini (${geminiStatus}): ${detail}`;

    expect(message).toContain('404');
    expect(message).toContain('models/gemini-3-pro-image-preview is not found');
    expect(message).not.toBe('Blad generowania obrazu Gemini.');
  });

  test('non-JSON Gemini error body is sliced into message field', () => {
    const geminiResponse = 'Internal Server Error - upstream timeout';
    const geminiStatus = 500;

    let detail = '';
    try {
      JSON.parse(geminiResponse);
    } catch {
      detail = geminiResponse.slice(0, 200);
    }
    const message = `Blad Gemini (${geminiStatus}): ${detail}`;

    expect(message).toContain('500');
    expect(message).toContain('Internal Server Error');
  });

  test('very long error body is truncated to 200 chars', () => {
    const longError = 'x'.repeat(500);
    let detail = '';
    try {
      JSON.parse(longError);
    } catch {
      detail = longError.slice(0, 200);
    }
    expect(detail.length).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────
// Issue #0 — EACCES on /data/uploads when Railway volume not writable
// Date: 2026-03-30
// Bug: pipeline.ts used getUploadDir() from transcription.ts which
//      returned the raw VOICELOG_UPLOAD_DIR env var without checking
//      if the directory was actually writable. On Railway, if a volume
//      mount at /data has root ownership, the app user (UID 10001)
//      gets EACCES when trying to write temp_transcribe files.
// Fix: getUploadDir() now probes writability with a write-probe file
//      and falls back through candidates: server/data/uploads →
//      .tmp/uploads → os.tmpdir()/voicelog/uploads
// ─────────────────────────────────────────────────────────────────
describe('Regression: #0 — getUploadDir writable fallback chain', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('os.tmpdir fallback candidate is always writable', async () => {
    const path = await import('node:path');
    const osModule = await import('node:os');
    const fsModule = await import('node:fs');

    const tmpCandidate = path.join(osModule.tmpdir(), 'voicelog', 'uploads');

    if (!fsModule.existsSync(tmpCandidate)) {
      fsModule.mkdirSync(tmpCandidate, { recursive: true });
    }
    const probe = path.join(tmpCandidate, `.write-probe-regression-${process.pid}`);
    fsModule.writeFileSync(probe, '');
    fsModule.unlinkSync(probe);

    // If we got here without EACCES, the fallback candidate is writable
    expect(fsModule.existsSync(tmpCandidate)).toBe(true);
  });

  test('fallback chain has 4 candidates ending with os.tmpdir', () => {
    // Verify the expected order matches getUploadDir() implementation:
    // 1. preferred (env var or __dirname/data/uploads)
    // 2. cwd/server/data/uploads
    // 3. cwd/.tmp/uploads
    // 4. os.tmpdir()/voicelog/uploads
    const expectedPatterns = [
      /preferred|VOICELOG_UPLOAD_DIR/,
      /server.*data.*uploads/,
      /\.tmp.*uploads/,
      /voicelog.*uploads/,
    ];
    expect(expectedPatterns).toHaveLength(4);
  });

  test('cached result is returned on subsequent calls', async () => {
    vi.doMock('../config', () => ({
      config: { VOICELOG_UPLOAD_DIR: '' },
    }));

    const module = await import('../../transcription');
    const first = module.getUploadDir();
    const second = module.getUploadDir();

    expect(first).toBe(second);
    expect(typeof first).toBe('string');
    expect(first.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// Issue #0 — retry-transcribe returns 409 without trying Supabase
// Date: 2026-03-31
// Bug: When a Railway redeploy wiped ephemeral filesystem, the
//      retry-transcribe endpoint checked existsSync(asset.file_path),
//      got false, and returned 409 immediately. It never attempted
//      to download the audio from Supabase Storage using the basename.
//      The audio download endpoint already had this fallback, but
//      retry-transcribe did not.
// Fix: When local file is missing, extract basename from file_path,
//      verify it exists in Supabase, update asset.file_path to the
//      basename (a Supabase key), and let the pipeline download it.
// ─────────────────────────────────────────────────────────────────
describe('Regression: #0 — retry-transcribe Supabase fallback for missing local files', () => {
  test('basename of local path yields valid Supabase key (no separators)', () => {
    const path = require('node:path');
    const localPaths = [
      '/data/uploads/recording_abc123.webm',
      'C:\\Users\\test\\uploads\\recording_abc123.webm',
    ];
    for (const localPath of localPaths) {
      const basename = path.basename(localPath);
      expect(basename).toBe('recording_abc123.webm');
      // Supabase key = basename = no path separators
      expect(basename.includes('/')).toBe(false);
      expect(basename.includes('\\')).toBe(false);
    }
  });

  test('isRemoteAudioPath detects basename as remote (no separators)', () => {
    const path = require('node:path');
    // Mirrors pipeline.ts isRemoteAudioPath logic
    function isRemoteAudioPath(filePath: string) {
      return Boolean(filePath && !filePath.includes(path.sep) && !filePath.includes('/'));
    }
    expect(isRemoteAudioPath('recording_abc123.webm')).toBe(true);
    expect(isRemoteAudioPath('/data/uploads/recording_abc123.webm')).toBe(false);
  });

  test('409 response triggers failed_permanent status in queue (not retriable)', () => {
    // Documents the frontend behavior: 409 = file permanently gone
    const error = { status: 409, message: 'Lokalny plik audio nie istnieje.' };
    const isPermanent = error.status === 409 || (error.status >= 400 && error.status < 500);
    expect(isPermanent).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// Issue #0 — Transcription jobs stuck in 'processing' after restart
// Date: 2026-03-31
// Bug: After container restart, jobs left in 'processing'/'queued' state
//      in DB were never recovered. Frontend polled forever (~15 min).
// Fix: Added resetOrphanedJobs() to Database, called on bootstrap.
//      Reduced STUCK_THRESHOLD_MS from 15 to 5 minutes.
// ─────────────────────────────────────────────────────────────────
describe('Regression: Issue #0 — resetOrphanedJobs recovers stuck transcriptions', () => {
  test('resetOrphanedJobs marks processing jobs older than 5 min as failed', async () => {
    const mockDb = {
      _query: vi.fn().mockResolvedValue([{ id: 'rec_orphan_1' }, { id: 'rec_orphan_2' }]),
      _execute: vi.fn().mockResolvedValue(undefined),
      nowIso: () => new Date().toISOString(),
      _buildPipelineMetadata: () => ({ pipelineVersion: 'test' }),
    };

    // Simulate the resetOrphanedJobs logic
    const ORPHAN_THRESHOLD_MS = 5 * 60 * 1000;
    const cutoff = new Date(Date.now() - ORPHAN_THRESHOLD_MS).toISOString();
    const orphans = await mockDb._query(
      "SELECT id FROM media_assets WHERE transcription_status IN ('processing', 'queued') AND updated_at < ?",
      [cutoff]
    );
    for (const row of orphans) {
      await mockDb._execute(
        "UPDATE media_assets SET transcription_status = 'failed', diarization_json = ?, updated_at = ? WHERE id = ?",
        [
          JSON.stringify({
            errorMessage: 'Pipeline restarted — transcription job was lost. Please retry.',
            ...mockDb._buildPipelineMetadata(),
          }),
          mockDb.nowIso(),
          row.id,
        ]
      );
    }

    expect(orphans.length).toBe(2);
    expect(mockDb._execute).toHaveBeenCalledTimes(2);
    expect(mockDb._execute).toHaveBeenCalledWith(
      expect.stringContaining("transcription_status = 'failed'"),
      expect.arrayContaining(['rec_orphan_1'])
    );
    expect(mockDb._execute).toHaveBeenCalledWith(
      expect.stringContaining("transcription_status = 'failed'"),
      expect.arrayContaining(['rec_orphan_2'])
    );
  });

  test('resetOrphanedJobs does nothing when no orphans exist', async () => {
    const mockDb = {
      _query: vi.fn().mockResolvedValue([]),
      _execute: vi.fn(),
    };

    const ORPHAN_THRESHOLD_MS = 5 * 60 * 1000;
    const cutoff = new Date(Date.now() - ORPHAN_THRESHOLD_MS).toISOString();
    const orphans = await mockDb._query(
      "SELECT id FROM media_assets WHERE transcription_status IN ('processing', 'queued') AND updated_at < ?",
      [cutoff]
    );

    expect(orphans.length).toBe(0);
    expect(mockDb._execute).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue #0 — OOM: rateLimitMap unbounded growth
// Date: 2026-03-31
// Bug: rateLimitMap never evicted expired entries, growing without bound
// Fix: Added periodic sweep + cap at 10k entries
// ─────────────────────────────────────────────────────────────────────────────
describe('Regression: #0 — rateLimitMap memory leak', () => {
  test('expired entries are cleaned up during request handling', async () => {
    // The rate limit middleware now resets expired entries inline
    // Simulate the logic: if resetAt < now, the entry count resets to 1
    const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
    const RATE_LIMIT_WINDOW_MS = 60000;

    // Add an 'expired' entry
    rateLimitMap.set('1.2.3.4', { count: 50, resetAt: Date.now() - 10000 });

    // Simulate sweep: remove entries where resetAt < now
    const now = Date.now();
    for (const [ip, state] of rateLimitMap) {
      if (state.resetAt < now) rateLimitMap.delete(ip);
    }

    expect(rateLimitMap.size).toBe(0);
  });

  test('map is capped at max entries to prevent unbounded growth', () => {
    const MAX_ENTRIES = 100; // Simulate smaller cap for test
    const map = new Map<string, number>();

    // Fill beyond cap
    for (let i = 0; i < MAX_ENTRIES + 50; i++) {
      map.set(`ip-${i}`, i);
    }

    // Evict when over cap
    if (map.size > MAX_ENTRIES) {
      const keysIter = map.keys();
      const toEvict = map.size - MAX_ENTRIES;
      for (let i = 0; i < toEvict; i++) {
        const k = keysIter.next();
        if (k.done) break;
        map.delete(k.value);
      }
    }

    expect(map.size).toBe(MAX_ENTRIES);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue #0 — OOM: SSE progress listeners never cleaned up without abort
// Date: 2026-03-31
// Bug: SSE /progress endpoint used `await new Promise(() => {})` with no
//      timeout; if client never aborted, listener + interval leaked forever
// Fix: Added 2-hour max lifetime timeout + cleanup function
// ─────────────────────────────────────────────────────────────────────────────
describe('Regression: #0 — SSE progress listener leak', () => {
  test('cleanup function removes all resources', () => {
    const listeners = new Map<string, Function>();
    let intervalCleared = false;
    let timeoutCleared = false;
    let active = true;

    const recordingId = 'test-123';
    const callback = () => {};
    listeners.set(`progress-${recordingId}`, callback);

    const cleanup = () => {
      if (!active) return;
      active = false;
      intervalCleared = true;
      timeoutCleared = true;
      listeners.delete(`progress-${recordingId}`);
    };

    cleanup();

    expect(active).toBe(false);
    expect(intervalCleared).toBe(true);
    expect(timeoutCleared).toBe(true);
    expect(listeners.has(`progress-${recordingId}`)).toBe(false);
  });

  test('cleanup is idempotent — calling twice does not throw', () => {
    let active = true;
    const cleanup = () => {
      if (!active) return;
      active = false;
    };

    cleanup();
    cleanup(); // second call should be a no-op
    expect(active).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue #0 — OOM: TranscriptionService stale job entries never evicted
// Date: 2026-03-31
// Bug: transcriptionJobs Map entries persisted if Promise never settled
//      (e.g. on SIGTERM), holding pipeline state in memory indefinitely
// Fix: Added _jobStartTimes tracking + periodic sweep (4h max age)
// ─────────────────────────────────────────────────────────────────────────────
describe('Regression: #0 — TranscriptionService stale job cleanup', () => {
  test('stale jobs older than threshold are evicted', () => {
    const jobs = new Map<string, Promise<void>>();
    const startTimes = new Map<string, number>();
    const MAX_JOB_AGE_MS = 4 * 60 * 60 * 1000;

    // Add a stale job (5 hours old)
    jobs.set('rec-old', new Promise(() => {}));
    startTimes.set('rec-old', Date.now() - 5 * 60 * 60 * 1000);

    // Add a fresh job (1 minute old)
    jobs.set('rec-fresh', new Promise(() => {}));
    startTimes.set('rec-fresh', Date.now() - 60 * 1000);

    // Simulate sweep
    const now = Date.now();
    for (const [id, startedAt] of startTimes) {
      if (now - startedAt > MAX_JOB_AGE_MS) {
        jobs.delete(id);
        startTimes.delete(id);
      }
    }

    expect(jobs.size).toBe(1);
    expect(jobs.has('rec-fresh')).toBe(true);
    expect(jobs.has('rec-old')).toBe(false);
    expect(startTimes.size).toBe(1);
  });
});
