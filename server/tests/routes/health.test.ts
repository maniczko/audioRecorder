import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { registerHealthRoute } from '../../http/health.ts';

describe('Regression: Health endpoint — Supabase status', () => {
  let app: Hono;
  let mockDb: any;

  beforeEach(() => {
    app = new Hono();
    mockDb = {
      _get: vi.fn().mockResolvedValue({ ok: 1 }),
    };
    registerHealthRoute(app, mockDb);
  });

  it('reports supabaseRemote: false when env vars are missing', async () => {
    const originalEnv = { ...process.env };
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      const res = await app.request('/health');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.supabaseRemote).toBe(false);
    } finally {
      process.env = originalEnv;
    }
  });

  it('reports supabaseRemote: true when env vars are present', async () => {
    const originalEnv = { ...process.env };
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    try {
      const res = await app.request('/health');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.supabaseRemote).toBe(true);
    } finally {
      process.env = originalEnv;
    }
  });

  it('reports database status connected when db check succeeds', async () => {
    const res = await app.request('/health');
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.db).toBe('connected');
    expect(data.ok).toBe(true);
  });

  it('reports database status unreachable when db check fails', async () => {
    mockDb._get.mockRejectedValue(new Error('Connection failed'));

    const res = await app.request('/health');
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.db).toBe('unreachable');
    expect(data.ok).toBe(false);
  });
});
