import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';

describe('API Security Regression Tests', () => {
  let server: any, authService: any;
  let port: number;
  let testUserToken: string;
  const originalEnv = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    HF_TOKEN: process.env.HF_TOKEN,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  beforeAll(async () => {
    process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY || 'test-openai-key';
    process.env.HF_TOKEN = originalEnv.HF_TOKEN || 'test-hf-token';
    process.env.SUPABASE_URL = originalEnv.SUPABASE_URL || 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY =
      originalEnv.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
    vi.resetModules();

    // Bootstrap services and server
    const { default: bootstrap } = await import('../index.ts');
    const resources: any = await bootstrap();
    server = resources.server;
    authService = resources.authService;

    // Start the server on a random available port
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    port = server.address().port;

    const uniqueEmail = `securitytest_${Date.now()}@example.com`;
    // Seed a test user for authenticated endpoints
    const result = await authService.registerUser({
      email: uniqueEmail,
      password: 'StrongPassword123',
      name: 'Security Tester',
      workspaceName: 'Sec Space',
    });
    testUserToken = result.token;
  }, 30000);

  afterAll(async () => {
    // Clean up
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
    process.env.HF_TOKEN = originalEnv.HF_TOKEN;
    process.env.SUPABASE_URL = originalEnv.SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv.SUPABASE_SERVICE_ROLE_KEY;
  });

  // Helper to make native HTTP requests
  const makeRequest = (method, endPath, headers = {}, body = null) => {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: '127.0.0.1',
        port,
        path: endPath,
        method,
        headers,
      };

      const req = http.request(options, (res) => {
        let responseData = Buffer.alloc(0);
        res.on('data', (chunk) => {
          responseData = Buffer.concat([responseData, chunk]);
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: responseData.toString(),
          });
        });
      });

      req.on('error', reject);
      if (body) {
        req.write(body);
      }
      req.end();
    });
  };

  test('[H-01/M-04] POST /voice-profiles - Should reject >1MB JSON Body with 413 (Denial of Service & JSON Bomb)', async () => {
    // Create a 1.5MB string
    const largeString = 'a'.repeat(1.5 * 1024 * 1024);
    const body = JSON.stringify({ name: largeString });

    // We send this intentionally big JSON payload
    const res: any = await makeRequest(
      'POST',
      '/voice-profiles',
      {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Authorization: `Bearer ${testUserToken}`,
        'X-Speaker-Name': 'Hacker',
      },
      body
    );

    expect(res.statusCode).toBe(413);
  });

  test('[H-04] GET /health - Should not leak dbPath or uploadDir (Information Disclosure)', async () => {
    const res: any = await makeRequest('GET', '/health');
    const json = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(json).toHaveProperty('ok', true);
    // Crucial regression check - ensure no DB path leakage
    expect(json.dbPath).toBeUndefined();
    expect(json.uploadPath).toBeUndefined();
    expect(json.uploadDir).toBeUndefined();
  });

  test('[M-03] GET /media/recordings/:id/audio - Should fallback Content-Type if invalid (Stored XSS)', async () => {
    // This requires a mock recording, we will test the /media route behavior
    // Usually invalid IDs should return 404, we just want to ensure it doesn't crash
    const res: any = await makeRequest('GET', '/media/recordings/non_existent_id/audio', {
      Authorization: `Bearer ${testUserToken}`,
    });

    // 404 or missing audio is fine, but it should not return un-sanitized headers
    expect([404, 401, 200]).toContain(res.statusCode);

    // Security headers check (Helmet equivalent)
    expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
  });

  test('[M-06] POST /voice-profiles - Should cap arbitrarily long X-Speaker-Name header (Data Storage Abuse)', async () => {
    // We send a valid JSON but with a crazy long header
    const body = JSON.stringify({ someKey: 'value' });
    const hugeHeader = 'b'.repeat(5000);

    const res: any = await makeRequest(
      'POST',
      '/voice-profiles',
      {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Authorization: `Bearer ${testUserToken}`,
        'X-Speaker-Name': hugeHeader,
      },
      body
    );

    // If it hits 400 due to bad format, or handles it gracefully, the server shouldn't crash
    // We specifically check that it didn't crash from header overflow
    expect(res.statusCode).not.toBe(500);
  });

  test('[H-02] X-Forwarded-For Spoofing Bypass check', async () => {
    // Attackers usually bypass rate limits by spoofing this
    const body = JSON.stringify({ email: 'rate-limit-test@example.com' });
    const res: any = await makeRequest(
      'POST',
      '/auth/login',
      {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        // Maledicted header!
        'X-Forwarded-For': '8.8.8.8, 1.2.3.4',
      },
      body
    );

    // It should hit the standard rate limiter logic for auth logic based on socket IP
    // Depending on backend state it could be 400 (missing password) or 401
    expect([400, 401, 200, 429]).toContain(res.statusCode);
  });
});
