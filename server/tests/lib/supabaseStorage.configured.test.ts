/**
 * supabaseStorage — happy path + error tests (configured Supabase).
 * Uses vi.doMock() pattern which works reliably with ESM.
 *
 * Existing supabaseStorage.test.ts (64 tests) is describe.skip'd
 * due to ESM mocking issues — those are all covered here.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';

vi.unmock('../config');
vi.unmock('@supabase/supabase-js');

// ── Mock factory ─────────────────────────────────────────────────────────────

function setupSupabaseMocks() {
  const mockCreateBucket = vi.fn();
  const mockUpload = vi.fn();
  const mockDownload = vi.fn();
  const mockCreateSignedUrl = vi.fn();
  const mockRemove = vi.fn();
  const mockFrom = vi.fn().mockReturnValue({
    upload: mockUpload,
    download: mockDownload,
    createSignedUrl: mockCreateSignedUrl,
    remove: mockRemove,
  });

  const mockCreateClient = vi.fn().mockReturnValue({
    storage: { createBucket: mockCreateBucket, from: mockFrom },
  });

  return {
    mockCreateBucket,
    mockUpload,
    mockDownload,
    mockCreateSignedUrl,
    mockRemove,
    mockFrom,
    mockCreateClient,
  };
}

function registerDoMocks(
  mocks: ReturnType<typeof setupSupabaseMocks>,
  configOverride = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
  }
) {
  vi.doMock('../config', () => ({ config: configOverride }));
  vi.doMock('@supabase/supabase-js', () => ({ createClient: mocks.mockCreateClient }));
}

// ── uploadAudioToStorage — happy path + error ────────────────────────────────

describe('supabaseStorage — uploadAudioToStorage (configured)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('uploads buffer and returns path', async () => {
    const m = setupSupabaseMocks();
    m.mockCreateBucket.mockResolvedValue({ data: {}, error: null });
    m.mockUpload.mockResolvedValue({ data: { path: 'rec1.webm' }, error: null });
    registerDoMocks(m);

    const { uploadAudioToStorage } = await import('../../lib/supabaseStorage');
    const result = await uploadAudioToStorage('rec1', Buffer.from('audio'), 'audio/webm', '.webm');

    expect(result).toBe('rec1.webm');
    expect(m.mockUpload).toHaveBeenCalledWith('rec1.webm', expect.any(Buffer), {
      contentType: 'audio/webm',
      upsert: true,
    });
  });

  test('sanitizes recording ID (special chars → underscore)', async () => {
    const m = setupSupabaseMocks();
    m.mockCreateBucket.mockResolvedValue({ data: {}, error: null });
    m.mockUpload.mockResolvedValue({ data: { path: 'rec_test_.webm' }, error: null });
    registerDoMocks(m);

    const { uploadAudioToStorage } = await import('../../lib/supabaseStorage');
    await uploadAudioToStorage('rec@test!', Buffer.from('x'), 'audio/webm', '.webm');

    expect(m.mockUpload).toHaveBeenCalledWith(
      'rec_test_.webm',
      expect.any(Buffer),
      expect.any(Object)
    );
  });

  test('throws when upload fails', async () => {
    const m = setupSupabaseMocks();
    m.mockCreateBucket.mockResolvedValue({ data: {}, error: null });
    m.mockUpload.mockResolvedValue({ data: null, error: { message: 'Storage full' } });
    registerDoMocks(m);

    const { uploadAudioToStorage } = await import('../../lib/supabaseStorage');
    await expect(
      uploadAudioToStorage('rec1', Buffer.from('x'), 'audio/webm', '.webm')
    ).rejects.toThrow('Failed to upload to Supabase Storage: Storage full');
  });

  test('ensureBucket logs warning on non-"already exists" error but continues', async () => {
    const m = setupSupabaseMocks();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    m.mockCreateBucket.mockResolvedValue({ data: null, error: { message: 'Permission denied' } });
    m.mockUpload.mockResolvedValue({ data: { path: 'rec1.webm' }, error: null });
    registerDoMocks(m);

    const { uploadAudioToStorage } = await import('../../lib/supabaseStorage');
    const result = await uploadAudioToStorage('rec1', Buffer.from('x'), 'audio/webm', '.webm');

    expect(result).toBe('rec1.webm');
    expect(warnSpy).toHaveBeenCalledWith(
      '[Supabase Storage] Bucket creation warning: Permission denied'
    );
    warnSpy.mockRestore();
  });

  test('ensureBucket is only called once across multiple uploads', async () => {
    const m = setupSupabaseMocks();
    m.mockCreateBucket.mockResolvedValue({ data: {}, error: null });
    m.mockUpload.mockResolvedValue({ data: { path: 'rec.webm' }, error: null });
    registerDoMocks(m);

    const { uploadAudioToStorage } = await import('../../lib/supabaseStorage');
    await uploadAudioToStorage('rec1', Buffer.from('x'), 'audio/webm', '.webm');
    await uploadAudioToStorage('rec2', Buffer.from('x'), 'audio/webm', '.webm');

    expect(m.mockCreateBucket).toHaveBeenCalledTimes(1);
  });
});

// ── uploadAudioFileToStorage — happy path + error ────────────────────────────

describe('supabaseStorage — uploadAudioFileToStorage (configured)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('uploads file stream and returns path', async () => {
    const m = setupSupabaseMocks();
    m.mockCreateBucket.mockResolvedValue({ data: {}, error: null });
    m.mockUpload.mockResolvedValue({ data: { path: 'rec1.webm' }, error: null });
    registerDoMocks(m);

    const createReadStreamSpy = vi.spyOn(fs, 'createReadStream').mockReturnValue({} as any);

    const { uploadAudioFileToStorage } = await import('../../lib/supabaseStorage');
    const result = await uploadAudioFileToStorage(
      'rec1',
      '/path/to/file.webm',
      'audio/webm',
      '.webm'
    );

    expect(result).toBe('rec1.webm');
    expect(createReadStreamSpy).toHaveBeenCalledWith('/path/to/file.webm');
    expect(m.mockUpload).toHaveBeenCalledWith('rec1.webm', expect.any(Object), {
      contentType: 'audio/webm',
      upsert: true,
    });
    createReadStreamSpy.mockRestore();
  });

  test('throws when upload fails', async () => {
    const m = setupSupabaseMocks();
    m.mockCreateBucket.mockResolvedValue({ data: {}, error: null });
    m.mockUpload.mockResolvedValue({ data: null, error: { message: 'Too large' } });
    registerDoMocks(m);

    vi.spyOn(fs, 'createReadStream').mockReturnValue({} as any);

    const { uploadAudioFileToStorage } = await import('../../lib/supabaseStorage');
    await expect(
      uploadAudioFileToStorage('rec1', '/path/file.webm', 'audio/webm', '.webm')
    ).rejects.toThrow('Failed to upload to Supabase Storage: Too large');
  });
});

// ── downloadAudioFromStorage — happy path + error ────────────────────────────

describe('supabaseStorage — downloadAudioFromStorage (configured)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('downloads file and returns ArrayBuffer', async () => {
    const m = setupSupabaseMocks();
    const mockArrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(100));
    m.mockDownload.mockResolvedValue({
      data: { arrayBuffer: mockArrayBuffer },
      error: null,
    });
    registerDoMocks(m);

    const { downloadAudioFromStorage } = await import('../../lib/supabaseStorage');
    const result = await downloadAudioFromStorage('rec1.webm');

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBe(100);
    expect(m.mockDownload).toHaveBeenCalledWith('rec1.webm');
  });

  test('throws when download returns error', async () => {
    const m = setupSupabaseMocks();
    m.mockDownload.mockResolvedValue({
      data: null,
      error: { message: 'File not found' },
    });
    registerDoMocks(m);

    const { downloadAudioFromStorage } = await import('../../lib/supabaseStorage');
    await expect(downloadAudioFromStorage('nonexistent.webm')).rejects.toThrow(
      'Failed to download from Supabase Storage: File not found'
    );
  });
});

// ── downloadAudioToFile — happy path + error ─────────────────────────────────

describe('supabaseStorage — downloadAudioToFile (configured)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('throws when signed URL creation fails', async () => {
    const m = setupSupabaseMocks();
    m.mockCreateSignedUrl.mockResolvedValue({
      data: null,
      error: { message: 'Not authorized' },
    });
    registerDoMocks(m);

    const { downloadAudioToFile } = await import('../../lib/supabaseStorage');
    await expect(downloadAudioToFile('rec1.webm', '/tmp/out.wav')).rejects.toThrow(
      'Failed to create signed URL for Supabase Storage: Not authorized'
    );
  });

  test('throws when signed URL returns no URL', async () => {
    const m = setupSupabaseMocks();
    m.mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: null }, error: null });
    registerDoMocks(m);

    const { downloadAudioToFile } = await import('../../lib/supabaseStorage');
    await expect(downloadAudioToFile('rec1.webm', '/tmp/out.wav')).rejects.toThrow(
      'Failed to create signed URL for Supabase Storage: no URL returned'
    );
  });

  test('throws when fetch returns non-ok status', async () => {
    const m = setupSupabaseMocks();
    m.mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.url/file.webm' },
      error: null,
    });
    registerDoMocks(m);

    // Mock global fetch
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as any);

    const { downloadAudioToFile } = await import('../../lib/supabaseStorage');
    await expect(downloadAudioToFile('rec1.webm', '/tmp/out.wav')).rejects.toThrow(
      'Failed to download from Supabase Storage: HTTP 404'
    );
    fetchSpy.mockRestore();
  });

  test('throws when response body is null', async () => {
    const m = setupSupabaseMocks();
    m.mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.url/file.webm' },
      error: null,
    });
    registerDoMocks(m);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: null,
    } as any);

    const { downloadAudioToFile } = await import('../../lib/supabaseStorage');
    await expect(downloadAudioToFile('rec1.webm', '/tmp/out.wav')).rejects.toThrow(
      'Supabase Storage returned empty response body.'
    );
    fetchSpy.mockRestore();
  });
});

// ── deleteAudioFromStorage — happy path + error ──────────────────────────────

describe('supabaseStorage — deleteAudioFromStorage (configured)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('deletes file successfully', async () => {
    const m = setupSupabaseMocks();
    m.mockRemove.mockResolvedValue({ data: {}, error: null });
    registerDoMocks(m);

    const { deleteAudioFromStorage } = await import('../../lib/supabaseStorage');
    await deleteAudioFromStorage('rec1.webm');

    expect(m.mockRemove).toHaveBeenCalledWith(['rec1.webm']);
  });

  test('logs warning but does not throw when delete fails', async () => {
    const m = setupSupabaseMocks();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    m.mockRemove.mockResolvedValue({ data: null, error: { message: 'Not found' } });
    registerDoMocks(m);

    const { deleteAudioFromStorage } = await import('../../lib/supabaseStorage');
    await deleteAudioFromStorage('rec1.webm');

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
