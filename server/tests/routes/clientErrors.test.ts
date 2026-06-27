import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { createClientErrorRoutes, _resetStoreForTest } from '../../routes/clientErrors.ts';

describe('clientErrors route', () => {
  let app: Hono;

  beforeEach(() => {
    _resetStoreForTest();
    app = new Hono();
    app.route('/api/client-errors', createClientErrorRoutes());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('POST accepts a single error and GET retrieves it', async () => {
    const error = {
      id: 'err-123',
      timestamp: new Date().toISOString(),
      type: 'runtime',
      message: 'Test error occurred',
      stack: 'Error: Test\n  at foo.js:1:1',
    };

    const postRes = await app.request('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(error),
    });
    expect(postRes.status).toBe(200);
    const postBody = await postRes.json();
    expect(postBody.ok).toBe(true);
    expect(postBody.received).toBe(1);

    const getRes = await app.request('/api/client-errors', { method: 'GET' });
    const getBody: any = await getRes.json();
    expect(getBody.count).toBe(1);
    expect(getBody.errors[0].message).toBe('Test error occurred');
  });

  it('POST accepts an array of errors', async () => {
    const errors = [
      { id: 'err-1', type: 'runtime', message: 'Error 1', timestamp: new Date().toISOString() },
      { id: 'err-2', type: 'network', message: 'Error 2', timestamp: new Date().toISOString() },
    ];

    const res = await app.request('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errors),
    });
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.received).toBe(2);
  });

  it('POST deduplicates errors by id', async () => {
    const error = {
      id: 'err-dup',
      type: 'runtime',
      message: 'Duplicate error',
      timestamp: new Date().toISOString(),
    };

    await app.request('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(error),
    });

    const res = await app.request('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(error),
    });
    const body = await res.json();
    expect(body.received).toBe(0);

    const getRes = await app.request('/api/client-errors', { method: 'GET' });
    const getBody: any = await getRes.json();
    expect(getBody.count).toBe(1);
  });

  it('POST rejects empty message', async () => {
    const res = await app.request('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'runtime', message: '' }),
    });
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.received).toBe(0);
  });

  it('POST truncates oversized fields', async () => {
    const error = {
      id: 'err-long',
      type: 'runtime',
      message: 'x'.repeat(3000),
      stack: 'y'.repeat(6000),
      timestamp: new Date().toISOString(),
    };

    await app.request('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(error),
    });

    const getRes = await app.request('/api/client-errors', { method: 'GET' });
    const getBody: any = await getRes.json();
    expect(getBody.errors[0].message.length).toBeLessThanOrEqual(2000);
    expect(getBody.errors[0].stack.length).toBeLessThanOrEqual(5000);
  });

  it('POST treats malformed JSON as best-effort telemetry and does not return 500', async () => {
    const res = await app.request('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{malformed-json',
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.received).toBe(0);
    expect(body.persisted).toBe(false);
    expect(body.ignored).toBe('invalid-json');
  });

  it('POST acknowledges valid errors even when file persistence fails', async () => {
    vi.stubEnv('VOICELOG_UPLOAD_DIR', '/proc/voicelog-client-errors');

    const res = await app.request('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'disk-fail', type: 'runtime', message: 'Disk failure test' }),
    });

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.received).toBe(1);
    expect(body.persisted).toBe(false);
  });

  it('GET returns empty array when no errors', async () => {
    const res = await app.request('/api/client-errors', { method: 'GET' });
    const body: any = await res.json();
    expect(body.count).toBe(0);
    expect(body.errors).toEqual([]);
  });

  it('DELETE clears all stored errors', async () => {
    await app.request('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'e1', type: 'runtime', message: 'Err', timestamp: 'now' }),
    });

    const delRes = await app.request('/api/client-errors', { method: 'DELETE' });
    expect(((await delRes.json()) as any).cleared).toBe(true);

    const getRes = await app.request('/api/client-errors', { method: 'GET' });
    expect(((await getRes.json()) as any).count).toBe(0);
  });

  it('cleans up stale entries based on retention policy', async () => {
    const now = Date.now();
    vi.stubEnv('VOICELOG_CLIENT_ERROR_RETENTION_MS', '500');

    await app.request('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        {
          id: 'old',
          type: 'runtime',
          message: 'Old error',
          timestamp: new Date(now - 1000).toISOString(),
        },
        {
          id: 'fresh',
          type: 'runtime',
          message: 'Fresh error',
          timestamp: new Date(now).toISOString(),
        },
      ]),
    });

    const res = await app.request('/api/client-errors', { method: 'GET' });
    const body: any = await res.json();
    expect(body.count).toBe(1);
    expect(body.errors[0].id).toBe('fresh');
  });

  it('keeps at most the configured maximum of stored errors', async () => {
    const now = Date.now();
    const errors = Array.from({ length: 510 }, (_, index) => ({
      id: `err-${index + 1}`,
      type: 'runtime',
      message: `Error ${index + 1}`,
      timestamp: new Date(now - index * 1000).toISOString(),
    }));

    for (let offset = 0; offset < 500; offset += 50) {
      const res = await app.request('/api/client-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errors.slice(offset, offset + 50)),
      });
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.received).toBe(50);
    }

    const overflowRes = await app.request('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errors.slice(500)),
    });

    const overflowBody = await overflowRes.json();
    expect(overflowBody.ok).toBe(true);
    expect(overflowBody.received).toBe(10);

    const getRes = await app.request('/api/client-errors', { method: 'GET' });
    const getBody: any = await getRes.json();
    expect(getBody.count).toBe(500);
    expect(getBody.errors).toHaveLength(500);
    const storedIds = new Set(
      getBody.errors.map((entry: { id: string }) => Number(entry.id.replace('err-', '')))
    );
    expect(storedIds.size).toBe(500);

    for (let removedId = 1; removedId <= 10; removedId += 1) {
      expect(storedIds.has(removedId)).toBe(false);
    }

    for (let retainedId = 11; retainedId <= 510; retainedId += 1) {
      expect(storedIds.has(retainedId)).toBe(true);
    }
  });
});
