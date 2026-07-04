import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface OpenApiOperation {
  requestBody?: {
    content: Record<string, { schema?: unknown }>;
  };
  responses?: Record<
    string,
    {
      content: Record<string, { schema?: unknown }>;
    }
  >;
}

interface OpenApiSpec {
  paths: Record<string, { post?: OpenApiOperation }>;
}

const spec = parse(readFileSync('openapi.yaml', 'utf8')) as OpenApiSpec;

const validatedPostPaths = [
  '/media/recordings/{recordingId}/audio/finalize',
  '/media/recordings/{recordingId}/transcribe',
  '/media/recordings/{recordingId}/retry-transcribe',
  '/media/recordings/{recordingId}/voice-coaching',
  '/media/recordings/{recordingId}/voice-profiles/from-speaker',
  '/media/analyze',
  '/transcribe/live',
  '/ai/person-profile',
  '/ai/suggest-tasks',
  '/ai/search',
];

describe('OpenAPI request validation contracts', () => {
  it('documents 422 validation errors for validated media and AI endpoints', () => {
    for (const path of validatedPostPaths) {
      expect(spec.paths[path]?.post?.responses?.['422'], path).toBeTruthy();
      expect(spec.paths[path].post.responses['422'].content['application/json'].schema).toEqual({
        $ref: '#/components/schemas/ValidationError',
      });
    }
  });

  it('documents request bodies for JSON validated endpoints', () => {
    for (const path of validatedPostPaths.filter((entry) => entry !== '/transcribe/live')) {
      expect(spec.paths[path]?.post?.requestBody, path).toBeTruthy();
      expect(spec.paths[path].post.requestBody.content['application/json'].schema).toBeTruthy();
    }
  });
});
