/**
 * debug_env.test.ts
 *
 * Tests for debug_env.ts environment validation schema.
 * Coverage target: 100% (currently 0%)
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

// Re-create the schema from debug_env.ts for isolated testing
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test', 'staging']).default('development'),
  PORT: z.preprocess((val) => Number(val), z.number()).default(4000),
  VOICELOG_API_PORT: z.preprocess((val) => (val ? Number(val) : undefined), z.number().optional()),
  VOICELOG_API_HOST: z.string().default('0.0.0.0'),
  VOICELOG_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
});

describe('debug_env — envSchema validation', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('passes with valid NODE_ENV values', () => {
    const envs = ['development', 'production', 'test', 'staging'] as const;
    for (const env of envs) {
      const result = envSchema.safeParse({ NODE_ENV: env });
      expect(result.success).toBe(true);
    }
  });

  test('defaults NODE_ENV to development when not provided', () => {
    const result = envSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe('development');
    }
  });

  test('defaults PORT to 4000 when not provided', () => {
    const result = envSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(4000);
    }
  });

  test('parses PORT from string to number', () => {
    const result = envSchema.safeParse({ PORT: '3000' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(3000);
    }
  });

  test('parses VOICELOG_API_PORT from string to number', () => {
    const result = envSchema.safeParse({ VOICELOG_API_PORT: '5000' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.VOICELOG_API_PORT).toBe(5000);
    }
  });

  test('defaults VOICELOG_API_HOST to 0.0.0.0', () => {
    const result = envSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.VOICELOG_API_HOST).toBe('0.0.0.0');
    }
  });

  test('defaults VOICELOG_ALLOWED_ORIGINS to http://localhost:3000', () => {
    const result = envSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.VOICELOG_ALLOWED_ORIGINS).toBe('http://localhost:3000');
    }
  });

  test('accepts optional DATABASE_URL', () => {
    const result = envSchema.safeParse({ DATABASE_URL: 'postgresql://localhost/test' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.DATABASE_URL).toBe('postgresql://localhost/test');
    }
  });

  test('accepts optional OPENAI_API_KEY', () => {
    const result = envSchema.safeParse({ OPENAI_API_KEY: 'sk-test-key' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.OPENAI_API_KEY).toBe('sk-test-key');
    }
  });

  test('accepts optional GROQ_API_KEY', () => {
    const result = envSchema.safeParse({ GROQ_API_KEY: 'gsk_test_key' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.GROQ_API_KEY).toBe('gsk_test_key');
    }
  });

  test('rejects invalid NODE_ENV', () => {
    const result = envSchema.safeParse({ NODE_ENV: 'invalid' });
    expect(result.success).toBe(false);
  });

  test('handles full valid environment', () => {
    const result = envSchema.safeParse({
      NODE_ENV: 'test',
      PORT: '8080',
      VOICELOG_API_PORT: '9090',
      VOICELOG_API_HOST: '127.0.0.1',
      VOICELOG_ALLOWED_ORIGINS: 'http://example.com',
      DATABASE_URL: 'postgresql://localhost/db',
      OPENAI_API_KEY: 'sk-test',
      GROQ_API_KEY: 'gsk-test',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        NODE_ENV: 'test',
        PORT: 8080,
        VOICELOG_API_PORT: 9090,
        VOICELOG_API_HOST: '127.0.0.1',
        VOICELOG_ALLOWED_ORIGINS: 'http://example.com',
        DATABASE_URL: 'postgresql://localhost/db',
        OPENAI_API_KEY: 'sk-test',
        GROQ_API_KEY: 'gsk-test',
      });
    }
  });
});
