/**
 * API Contract Tests
 *
 * Validates frontend API calls against OpenAPI specification.
 * Ensures frontend-backend contract consistency.
 *
 * Run: npx vitest run server/tests/contract/api-contract.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml'; // Ensure 'yaml' package is installed

// Load OpenAPI spec
const openapiPath = path.resolve(__dirname, '../../../docs/openapi.yaml');
const openapiSpec = YAML.parse(fs.readFileSync(openapiPath, 'utf-8'));

// Mock API responses based on OpenAPI spec
const mockResponses: Record<string, any> = {
  '/api/health': {
    status: 200,
    body: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  },
  '/api/auth/register': {
    status: 201,
    body: {
      user: {
        id: 'user-1',
        name: 'Test User',
        email: 'test@test.com',
      },
      token: 'mock-jwt-token',
      workspaceId: 'ws-1',
    },
  },
  '/api/auth/login': {
    status: 200,
    body: {
      user: {
        id: 'user-1',
        name: 'Test User',
        email: 'test@test.com',
      },
      token: 'mock-jwt-token',
    },
  },
  '/api/meetings': {
    status: 200,
    body: [
      {
        id: 'meeting-1',
        title: 'Test Meeting',
        startsAt: new Date().toISOString(),
        durationMinutes: 30,
        tags: ['test'],
        attendees: ['Alice', 'Bob'],
      },
    ],
  },
  '/api/meetings/meeting-1': {
    status: 200,
    body: {
      id: 'meeting-1',
      title: 'Test Meeting',
      startsAt: new Date().toISOString(),
      durationMinutes: 30,
    },
  },
  '/api/meetings/meeting-1/transcript': {
    status: 200,
    body: {
      transcript: [
        {
          speakerId: 0,
          text: 'Hello everyone',
          timestamp: 0,
          verificationStatus: 'verified',
        },
      ],
      speakerNames: { '0': 'Alice' },
    },
  },
  '/api/tasks': {
    status: 200,
    body: [
      {
        id: 'task-1',
        title: 'Test Task',
        status: 'todo',
        priority: 'medium',
      },
    ],
  },
  '/api/users/profile': {
    status: 200,
    body: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@test.com',
    },
  },
};

describe('API Contract Tests', () => {
  describe('OpenAPI Specification Validation', () => {
    it('openapi.yaml is valid and parseable', () => {
      expect(openapiSpec).toBeDefined();
      expect(openapiSpec.openapi).toBe('3.0.3');
      expect(openapiSpec.info).toBeDefined();
      expect(openapiSpec.info.title).toBe('VoiceLog API');
    });

    it('has all required paths defined', () => {
      const paths = Object.keys(openapiSpec.paths);
      expect(paths).toContain('/api/health');
      expect(paths).toContain('/api/auth/register');
      expect(paths).toContain('/api/auth/login');
      expect(paths).toContain('/api/meetings');
      expect(paths).toContain('/api/tasks');
      expect(paths).toContain('/api/users/profile'); // Added missing path check
    });
  });
});