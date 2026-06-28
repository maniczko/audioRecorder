import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

const openapiPath = path.resolve(__dirname, '../../../openapi.yaml');
const openapiSpec = YAML.parse(fs.readFileSync(openapiPath, 'utf-8'));

function operationFor(pathName: string, method: string) {
  return openapiSpec.paths[pathName][method];
}

function expectIdempotencyHeader(pathName: string, method: string) {
  const operation = operationFor(pathName, method);
  expect(operation.parameters).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        in: 'header',
        name: 'Idempotency-Key',
      }),
    ])
  );
}

function expectIdempotencyResponseShape(pathName: string, method: string, statusCode: string) {
  const responseText = JSON.stringify(operationFor(pathName, method).responses[statusCode]);
  expect(responseText).toContain('idempotent');
  expect(responseText).toContain('idempotencyScope');
}

describe('Media idempotency OpenAPI contract', () => {
  it.each([
    ['/media/recordings/{recordingId}/audio', 'put', '200'],
    ['/media/recordings/{recordingId}/audio/chunk', 'put', '200'],
    ['/media/recordings/{recordingId}/audio/finalize', 'post', '200'],
    ['/media/recordings/{recordingId}/transcribe', 'post', '202'],
    ['/media/recordings/{recordingId}/retry-transcribe', 'post', '202'],
  ])(
    '%s %s documents Idempotency-Key and idempotency response fields',
    (pathName, method, status) => {
      expectIdempotencyHeader(pathName, method);
      expectIdempotencyResponseShape(pathName, method, status);
    }
  );

  it('documents explicit force requirement for completed retry-transcribe', () => {
    const retryTranscribe = operationFor(
      '/media/recordings/{recordingId}/retry-transcribe',
      'post'
    );

    expect(JSON.stringify(retryTranscribe.requestBody)).toContain('force');
    expect(JSON.stringify(retryTranscribe.responses['409'])).toContain('already completed');
  });
});
