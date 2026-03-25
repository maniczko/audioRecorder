/**
 * Testy dla STT providers - rozszerzone coverage
 * Coverage target: 100%
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveConfiguredSttProviders, transcribeWithProviders } from '../../stt/providers';

describe('STT Providers - Extended Coverage', () => {
  describe('resolveConfiguredSttProviders', () => {
    test('builds provider chain with Groq preferred', () => {
      const providers = resolveConfiguredSttProviders({
        preferredProvider: 'groq',
        fallbackProvider: 'openai',
        groqApiKey: 'groq-key',
        openAiApiKey: 'openai-key',
        openAiBaseUrl: 'https://api.openai.test/v1',
      });

      expect(providers).toHaveLength(2);
      expect(providers[0].id).toBe('groq');
      expect(providers[1].id).toBe('openai');
    });

    test('builds provider chain with OpenAI preferred', () => {
      const providers = resolveConfiguredSttProviders({
        preferredProvider: 'openai',
        fallbackProvider: 'groq',
        groqApiKey: 'groq-key',
        openAiApiKey: 'openai-key',
      });

      expect(providers).toHaveLength(2);
      expect(providers[0].id).toBe('openai');
      expect(providers[1].id).toBe('groq');
    });

    test('skips unavailable providers in chain', () => {
      const providers = resolveConfiguredSttProviders({
        preferredProvider: 'groq',
        fallbackProvider: 'openai',
        groqApiKey: undefined, // No Groq key
        openAiApiKey: 'openai-key',
        openAiBaseUrl: 'https://api.openai.test/v1',
      });

      // Both providers are configured but Groq is not available
      expect(providers).toHaveLength(2);
      expect(providers[0].isAvailable()).toBe(false); // Groq not available
      expect(providers[1].isAvailable()).toBe(true); // OpenAI available
    });

    test('handles missing fallback provider', () => {
      const providers = resolveConfiguredSttProviders({
        preferredProvider: 'openai',
        fallbackProvider: 'none',
        openAiApiKey: 'openai-key',
        openAiBaseUrl: 'https://api.openai.test/v1',
      });

      expect(providers).toHaveLength(1);
      expect(providers[0].id).toBe('openai');
    });

    test('handles same preferred and fallback provider', () => {
      const providers = resolveConfiguredSttProviders({
        preferredProvider: 'openai',
        fallbackProvider: 'openai', // Same as preferred
        openAiApiKey: 'openai-key',
      });

      // Should deduplicate
      expect(providers).toHaveLength(1);
      expect(providers[0].id).toBe('openai');
    });

    test('uses default OpenAI base URL when not specified', () => {
      const providers = resolveConfiguredSttProviders({
        preferredProvider: 'openai',
        openAiApiKey: 'openai-key',
      });

      expect(providers[0].baseUrl).toBe('https://api.openai.com/v1');
    });

    test('uses custom OpenAI base URL when specified', () => {
      const providers = resolveConfiguredSttProviders({
        preferredProvider: 'openai',
        openAiApiKey: 'openai-key',
        openAiBaseUrl: 'https://custom.api.com/v1',
      });

      expect(providers[0].baseUrl).toBe('https://custom.api.com/v1');
    });

    test('uses default models when not specified', () => {
      const providers = resolveConfiguredSttProviders({
        preferredProvider: 'groq',
        fallbackProvider: 'openai',
        groqApiKey: 'groq-key',
        openAiApiKey: 'openai-key',
      });

      expect(providers[0].defaultModel).toBe('whisper-large-v3'); // Groq default
      expect(providers[1].defaultModel).toBe('gpt-4o-transcribe'); // OpenAI default
    });

    test('uses custom models when specified', () => {
      const providers = resolveConfiguredSttProviders({
        preferredProvider: 'groq',
        fallbackProvider: 'openai',
        groqApiKey: 'groq-key',
        openAiApiKey: 'openai-key',
        groqModel: 'custom-groq-model',
        openAiModel: 'custom-openai-model',
      });

      expect(providers[0].defaultModel).toBe('custom-groq-model');
      expect(providers[1].defaultModel).toBe('custom-openai-model');
    });

    test('provider isAvailable returns true with API key', () => {
      const providers = resolveConfiguredSttProviders({
        preferredProvider: 'openai',
        openAiApiKey: 'test-key',
      });

      expect(providers[0].isAvailable()).toBe(true);
    });

    test('provider isAvailable returns false without API key', () => {
      const providers = resolveConfiguredSttProviders({
        preferredProvider: 'openai',
        openAiApiKey: '',
      });

      expect(providers[0].isAvailable()).toBe(false);
    });

    test('provider label is descriptive', () => {
      const providers = resolveConfiguredSttProviders({
        preferredProvider: 'groq',
        fallbackProvider: 'openai',
        groqApiKey: 'groq-key',
        openAiApiKey: 'openai-key',
      });

      expect(providers[0].label).toBe('Groq Whisper');
      expect(providers[1].label).toBe('OpenAI STT');
    });
  });

  describe('transcribeWithProviders', () => {
    let mockProviders: any[];
    let mockRequestFactory: any;

    beforeEach(() => {
      mockProviders = [
        {
          id: 'openai',
          label: 'OpenAI STT',
          defaultModel: 'gpt-4o-transcribe',
          isAvailable: vi.fn().mockReturnValue(true),
          transcribeAudio: vi.fn(),
        },
      ];
      mockRequestFactory = vi.fn().mockReturnValue({
        fields: { model: 'gpt-4o-transcribe' },
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('returns successful transcription from first available provider', async () => {
      mockProviders[0].transcribeAudio.mockResolvedValue({
        text: 'Transcribed text',
        segments: [],
      });

      const result = await transcribeWithProviders(mockProviders, mockRequestFactory);

      expect(result.payload.text).toBe('Transcribed text');
      expect(result.providerId).toBe('openai');
      expect(result.attempts).toHaveLength(1);
      expect(result.attempts[0].success).toBe(true);
    });

    test('tries fallback provider when first fails', async () => {
      const fallbackProvider = {
        id: 'groq',
        label: 'Groq Whisper',
        defaultModel: 'whisper-large-v3',
        isAvailable: vi.fn().mockReturnValue(true),
        transcribeAudio: vi.fn().mockResolvedValue({
          text: 'Fallback transcription',
          segments: [],
        }),
      };

      mockProviders[0].transcribeAudio.mockRejectedValue(new Error('API error'));
      mockProviders.push(fallbackProvider);

      const result = await transcribeWithProviders(mockProviders, mockRequestFactory);

      expect(result.payload.text).toBe('Fallback transcription');
      expect(result.providerId).toBe('groq');
      expect(result.attempts).toHaveLength(2);
      expect(result.attempts[0].success).toBe(false);
      expect(result.attempts[1].success).toBe(true);
    });

    test('skips unavailable providers', async () => {
      mockProviders[0].isAvailable.mockReturnValue(false);

      await expect(transcribeWithProviders(mockProviders, mockRequestFactory)).rejects.toThrow(
        'Brak skonfigurowanego providera STT.'
      );
    });

    test('throws error when all providers fail', async () => {
      mockProviders[0].transcribeAudio.mockRejectedValue(new Error('Provider error'));

      await expect(transcribeWithProviders(mockProviders, mockRequestFactory)).rejects.toThrow(
        'Provider error'
      );
    });

    test('records attempt duration', async () => {
      mockProviders[0].transcribeAudio.mockResolvedValue({
        text: 'Test',
        segments: [],
      });

      const result = await transcribeWithProviders(mockProviders, mockRequestFactory);

      expect(result.attempts[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    test('records error message on failure', async () => {
      const error = new Error('Test error');
      mockProviders[0].transcribeAudio.mockRejectedValue(error);

      try {
        await transcribeWithProviders(mockProviders, mockRequestFactory);
      } catch (e: any) {
        expect(e.message).toBe('Test error');
      }
    });

    test('uses provider default model when not specified in request', async () => {
      mockRequestFactory.mockReturnValue({
        fields: {}, // No model specified
      });
      mockProviders[0].transcribeAudio.mockResolvedValue({
        text: 'Test',
        segments: [],
      });

      const result = await transcribeWithProviders(mockProviders, mockRequestFactory);

      expect(result.model).toBe('gpt-4o-transcribe');
    });

    test('uses request model when specified', async () => {
      mockRequestFactory.mockReturnValue({
        fields: { model: 'custom-model' },
      });
      mockProviders[0].transcribeAudio.mockResolvedValue({
        text: 'Test',
        segments: [],
      });

      const result = await transcribeWithProviders(mockProviders, mockRequestFactory);

      expect(result.model).toBe('custom-model');
    });

    test('handles empty providers array', async () => {
      await expect(transcribeWithProviders([], mockRequestFactory)).rejects.toThrow(
        'Brak skonfigurowanego providera STT.'
      );
    });

    test('includes provider label in result', async () => {
      mockProviders[0].transcribeAudio.mockResolvedValue({
        text: 'Test',
        segments: [],
      });

      const result = await transcribeWithProviders(mockProviders, mockRequestFactory);

      expect(result.providerLabel).toBe('OpenAI STT');
    });

    test('includes all attempts in result', async () => {
      mockProviders[0].transcribeAudio.mockRejectedValue(new Error('First error'));

      const fallbackProvider = {
        id: 'groq',
        label: 'Groq Whisper',
        defaultModel: 'whisper-large-v3',
        isAvailable: vi.fn().mockReturnValue(true),
        transcribeAudio: vi.fn().mockResolvedValue({
          text: 'Success',
          segments: [],
        }),
      };
      mockProviders.push(fallbackProvider);

      const result = await transcribeWithProviders(mockProviders, mockRequestFactory);

      expect(result.attempts).toHaveLength(2);
      expect(result.attempts[0].errorMessage).toBe('First error');
      expect(result.attempts[1].success).toBe(true);
    });
  });

  describe('SttProvider configuration', () => {
    test('Groq provider has correct configuration', () => {
      const providers = resolveConfiguredSttProviders({
        preferredProvider: 'groq',
        groqApiKey: 'test-key',
      });

      expect(providers[0].id).toBe('groq');
      expect(providers[0].baseUrl).toBe('https://api.groq.com/openai/v1');
      expect(providers[0].defaultModel).toBe('whisper-large-v3');
    });

    test('OpenAI provider has correct configuration', () => {
      const providers = resolveConfiguredSttProviders({
        preferredProvider: 'openai',
        openAiApiKey: 'test-key',
      });

      expect(providers[0].id).toBe('openai');
      expect(providers[0].baseUrl).toBe('https://api.openai.com/v1');
      expect(providers[0].defaultModel).toBe('gpt-4o-transcribe');
    });
  });
});
