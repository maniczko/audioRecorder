import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

describe('index.ts — bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test(
    'bootstrap initializes services and returns server, db, and services',
    { timeout: 15000 },
    async () => {
      const { bootstrap } = await import('../index.ts');
      const result = await bootstrap();

      expect(result).toHaveProperty('server');
      expect(result).toHaveProperty('db');
      expect(result).toHaveProperty('authService');
      expect(result).toHaveProperty('workspaceService');
      expect(result).toHaveProperty('transcriptionService');
    }
  );

  test('bootstrap creates TranscriptionService instance', { timeout: 15000 }, async () => {
    const { bootstrap } = await import('../index.ts');
    const result = await bootstrap();

    expect(result.transcriptionService).toBeDefined();
    // TranscriptionService has these methods
    expect(typeof result.transcriptionService.upsertMediaAsset).toBe('function');
    expect(typeof result.transcriptionService.queueTranscription).toBe('function');
  });

  test('bootstrap initializes database', { timeout: 15000 }, async () => {
    const { bootstrap } = await import('../index.ts');
    const result = await bootstrap();

    expect(result.db).toBeDefined();
    expect(typeof result.db.checkHealth).toBe('function');
  });
});
