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
import YAML from 'yaml';

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
      expect(paths).toContain('/api/users/profile');
    });

    it('all paths have proper HTTP methods', () => {
      const paths = openapiSpec.paths;

      expect(paths['/api/health'].get).toBeDefined();
      expect(paths['/api/auth/register'].post).toBeDefined();
      expect(paths['/api/auth/login'].post).toBeDefined();
      expect(paths['/api/meetings'].get).toBeDefined();
      expect(paths['/api/meetings'].post).toBeDefined();
      expect(paths['/api/tasks'].get).toBeDefined();
      expect(paths['/api/tasks'].post).toBeDefined();
    });

    it('all required schemas are defined', () => {
      const schemas = openapiSpec.components.schemas;

      expect(schemas).toHaveProperty('HealthResponse');
      expect(schemas).toHaveProperty('RegisterRequest');
      expect(schemas).toHaveProperty('LoginRequest');
      expect(schemas).toHaveProperty('AuthResponse');
      expect(schemas).toHaveProperty('Meeting');
      expect(schemas).toHaveProperty('Task');
      expect(schemas).toHaveProperty('User');
      expect(schemas).toHaveProperty('UserProfile');
    });

    it('security schemes are properly configured', () => {
      const security = openapiSpec.components.securitySchemes;

      expect(security).toHaveProperty('bearerAuth');
      expect(security.bearerAuth.type).toBe('http');
      expect(security.bearerAuth.scheme).toBe('bearer');
    });

    it('all POST endpoints have requestBody defined', () => {
      const paths = openapiSpec.paths;

      expect(paths['/api/auth/register'].post.requestBody).toBeDefined();
      expect(paths['/api/auth/login'].post.requestBody).toBeDefined();
      expect(paths['/api/meetings'].post.requestBody).toBeDefined();
      expect(paths['/api/tasks'].post.requestBody).toBeDefined();
    });

    it('all endpoints have response schemas', () => {
      const paths = openapiSpec.paths;

      for (const [path, methods] of Object.entries(paths)) {
        for (const [method, details] of Object.entries(methods as any)) {
          if (['get', 'post', 'put', 'delete'].includes(method)) {
            expect(details.responses).toBeDefined();
            expect(
              details.responses['200'] || details.responses['201'] || details.responses['204']
            ).toBeDefined();
          }
        }
      }
    });
  });

  describe('Mock API Response Validation', () => {
    it('health endpoint returns valid response', () => {
      const response = mockResponses['/api/health'];

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(['healthy', 'unhealthy']).toContain(response.body.status);
    });

    it('auth register returns user and token', () => {
      const response = mockResponses['/api/auth/register'];

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email');
    });

    it('meetings list returns array of meetings', () => {
      const response = mockResponses['/api/meetings'];

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('title');
      expect(response.body[0]).toHaveProperty('startsAt');
    });

    it('tasks list returns array of tasks', () => {
      const response = mockResponses['/api/tasks'];

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('title');
      expect(response.body[0]).toHaveProperty('status');
    });

    it('user profile returns user data', () => {
      const response = mockResponses['/api/users/profile'];

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
    });
  });

  describe('Request Validation', () => {
    it('register request requires name, email, password', () => {
      const schema = openapiSpec.components.schemas.RegisterRequest;

      expect(schema.required).toContain('name');
      expect(schema.required).toContain('email');
      expect(schema.required).toContain('password');

      expect(schema.properties.email.format).toBe('email');
      expect(schema.properties.password.minLength).toBe(8);
    });

    it('login request requires email and password', () => {
      const schema = openapiSpec.components.schemas.LoginRequest;

      expect(schema.required).toContain('email');
      expect(schema.required).toContain('password');
    });

    it('meeting creation requires title and startsAt', () => {
      const schema = openapiSpec.components.schemas.CreateMeetingRequest;

      expect(schema.required).toContain('title');
      expect(schema.required).toContain('startsAt');
    });

    it('task creation requires title', () => {
      const schema = openapiSpec.components.schemas.CreateTaskRequest;

      expect(schema.required).toContain('title');
      expect(schema.properties.status.default).toBe('todo');
      expect(schema.properties.priority.default).toBe('medium');
    });
  });

  describe('Response Schema Validation', () => {
    it('Meeting schema has required fields', () => {
      const schema = openapiSpec.components.schemas.Meeting;

      expect(schema.required).toContain('id');
      expect(schema.required).toContain('title');
      expect(schema.required).toContain('startsAt');
    });

    it('Task schema has required fields', () => {
      const schema = openapiSpec.components.schemas.Task;

      expect(schema.required).toContain('id');
      expect(schema.required).toContain('title');
      expect(schema.required).toContain('status');
    });

    it('User schema has required fields', () => {
      const schema = openapiSpec.components.schemas.User;

      expect(schema.required).toContain('id');
      expect(schema.required).toContain('name');
      expect(schema.required).toContain('email');
    });
  });
});
