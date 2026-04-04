import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendJson, sendNoContent, sendText } from '../lib/serverUtils.ts';

function createMockResponse() {
  const response = new EventEmitter() as any;
  response.writeHead = vi.fn().mockReturnThis();
  response.end = vi.fn().mockReturnThis();
  return response;
}

describe('sendJson, sendText, sendNoContent', () => {
  let mockResponse: ReturnType<typeof createMockResponse>;

  beforeEach(() => {
    mockResponse = createMockResponse();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendJson', () => {
    it('writes correct headers and JSON payload for 200 response', () => {
      sendJson(mockResponse, 200, { message: 'ok' }, 'http://localhost:3000', '*');

      expect(mockResponse.writeHead).toHaveBeenCalledTimes(1);
      expect(mockResponse.writeHead).toHaveBeenCalledWith(
        200,
        expect.objectContaining({
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': 'http://localhost:3000',
          'X-Content-Type-Options': 'nosniff',
        })
      );
      expect(mockResponse.end).toHaveBeenCalledTimes(1);
      expect(mockResponse.end).toHaveBeenCalledWith('{"message":"ok"}');
    });

    it('writes correct headers and JSON payload for error response', () => {
      sendJson(
        mockResponse,
        400,
        { error: 'Bad request' },
        'https://prod.example.test',
        'https://prod.example.test'
      );

      expect(mockResponse.writeHead).toHaveBeenCalledWith(
        400,
        expect.objectContaining({
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': 'https://prod.example.test',
        })
      );
      expect(mockResponse.end).toHaveBeenCalledWith('{"error":"Bad request"}');
    });

    it('applies CORS headers with multiple allowed origins', () => {
      sendJson(
        mockResponse,
        201,
        { id: 1 },
        'https://stage.example.test',
        'https://prod.example.test,https://stage.example.test'
      );

      expect(mockResponse.writeHead).toHaveBeenCalledWith(
        201,
        expect.objectContaining({
          'Access-Control-Allow-Origin': 'https://stage.example.test',
          'Content-Type': 'application/json; charset=utf-8',
        })
      );
    });
  });

  describe('sendText', () => {
    it('writes correct headers and plain text body', () => {
      sendText(mockResponse, 200, 'Hello World', 'http://localhost:3000', '*');

      expect(mockResponse.writeHead).toHaveBeenCalledTimes(1);
      expect(mockResponse.writeHead).toHaveBeenCalledWith(
        200,
        expect.objectContaining({
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': 'http://localhost:3000',
          'X-Content-Type-Options': 'nosniff',
        })
      );
      expect(mockResponse.end).toHaveBeenCalledTimes(1);
      expect(mockResponse.end).toHaveBeenCalledWith('Hello World');
    });

    it('handles empty string body', () => {
      sendText(mockResponse, 200, '', 'http://localhost:3000', '*');

      expect(mockResponse.writeHead).toHaveBeenCalledWith(
        200,
        expect.objectContaining({
          'Content-Type': 'text/plain; charset=utf-8',
        })
      );
      expect(mockResponse.end).toHaveBeenCalledWith('');
    });

    it('handles error status code with text body', () => {
      sendText(mockResponse, 500, 'Internal Server Error', 'http://localhost:3000', '*');

      expect(mockResponse.writeHead).toHaveBeenCalledWith(
        500,
        expect.objectContaining({
          'Content-Type': 'text/plain; charset=utf-8',
        })
      );
      expect(mockResponse.end).toHaveBeenCalledWith('Internal Server Error');
    });
  });

  describe('sendNoContent', () => {
    it('writes 204 status with CORS and security headers and no body', () => {
      sendNoContent(mockResponse, 'http://localhost:3000', '*');

      expect(mockResponse.writeHead).toHaveBeenCalledTimes(1);
      expect(mockResponse.writeHead).toHaveBeenCalledWith(
        204,
        expect.objectContaining({
          'Access-Control-Allow-Origin': 'http://localhost:3000',
          Vary: 'Origin',
          'Content-Security-Policy': "default-src 'none'",
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
        })
      );
      expect(mockResponse.end).toHaveBeenCalledTimes(1);
      expect(mockResponse.end).toHaveBeenCalledWith();
    });

    it('writes 204 with fallback origin for disallowed origin', () => {
      sendNoContent(mockResponse, 'https://evil.example.test', 'https://prod.example.test');

      expect(mockResponse.writeHead).toHaveBeenCalledWith(
        204,
        expect.objectContaining({
          'Access-Control-Allow-Origin': 'https://prod.example.test',
        })
      );
      expect(mockResponse.end).toHaveBeenCalled();
    });
  });
});
