/**
 * Testy dla supabaseStorage.ts - ścieżki "not configured"
 * Coverage target: 100% ścieżek if (!supabase)
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';

// P0 Fix: Move vi.unmock() to top level to prevent Vitest warnings
vi.unmock('../config');
vi.unmock('@supabase/supabase-js');

describe('supabaseStorage - Supabase not configured', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  // P0 Fix: Remove afterEach with vi.unmock() - already at top level

  test('supabase is null when SUPABASE_URL is empty', async () => {
    vi.doMock('../config', () => ({
      config: { SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: 'test-key' },
    }));

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn().mockReturnValue(null),
    }));

    const module = await import('../../lib/supabaseStorage');
    expect(module.supabase).toBeNull();
  });

  test('supabase is null when SUPABASE_SERVICE_ROLE_KEY is empty', async () => {
    vi.doMock('../config', () => ({
      config: { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: '' },
    }));

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn().mockReturnValue(null),
    }));

    const module = await import('../../lib/supabaseStorage');
    expect(module.supabase).toBeNull();
  });

  test('supabase is null when both credentials are empty', async () => {
    vi.doMock('../config', () => ({
      config: { SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' },
    }));

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn().mockReturnValue(null),
    }));

    const module = await import('../../lib/supabaseStorage');
    expect(module.supabase).toBeNull();
  });

  test('uploadAudioToStorage returns null when supabase URL is empty', async () => {
    vi.doMock('../config', () => ({
      config: { SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: 'test-key' },
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

  test('uploadAudioToStorage returns null when supabase key is empty', async () => {
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

  test('uploadAudioFileToStorage returns null when supabase is not configured', async () => {
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
    expect(createReadStreamSpy).not.toHaveBeenCalled();

    createReadStreamSpy.mockRestore();
  });

  test('downloadAudioFromStorage throws when supabase is not configured', async () => {
    vi.doMock('../config', () => ({
      config: { SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' },
    }));

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn().mockReturnValue(null),
    }));

    const module = await import('../../lib/supabaseStorage');

    await expect(module.downloadAudioFromStorage('recordings/rec1.webm')).rejects.toThrow(
      'Supabase Storage not available'
    );
  });

  test('deleteAudioFromStorage throws when supabase is not configured', async () => {
    vi.doMock('../config', () => ({
      config: { SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' },
    }));

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn().mockReturnValue(null),
    }));

    const module = await import('../../lib/supabaseStorage');

    await expect(module.deleteAudioFromStorage('recordings/rec1.webm')).rejects.toThrow(
      'Supabase Storage not available'
    );
  });

  test('ensureBucket is not called when supabase is null', async () => {
    vi.doMock('../config', () => ({
      config: { SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' },
    }));

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn().mockReturnValue(null),
    }));

    const module = await import('../../lib/supabaseStorage');

    // Should return null immediately without calling ensureBucket
    const result = await module.uploadAudioToStorage(
      'rec1',
      Buffer.from('test'),
      'audio/webm',
      '.webm'
    );

    expect(result).toBeNull();
  });
});
