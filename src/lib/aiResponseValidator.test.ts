import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  validateAnalysisResponse,
  validateParticipantInsights,
  validateAndNormalizeRisks,
  parseAiResponse,
  safeParseAiResponse,
} from './aiResponseValidator';

describe('aiResponseValidator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- validateAnalysisResponse ---
  describe('validateAnalysisResponse', () => {
    it('returns false for null', () => {
      expect(validateAnalysisResponse(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(validateAnalysisResponse(undefined)).toBe(false);
    });

    it('returns false for a string', () => {
      expect(validateAnalysisResponse('hello')).toBe(false);
    });

    it('returns false for a number', () => {
      expect(validateAnalysisResponse(42)).toBe(false);
    });

    it('returns false when summary is missing', () => {
      expect(validateAnalysisResponse({ decisions: ['ok'] })).toBe(false);
    });

    it('returns false when summary is empty string', () => {
      expect(validateAnalysisResponse({ summary: '' })).toBe(false);
    });

    it('returns false when summary is whitespace only', () => {
      expect(validateAnalysisResponse({ summary: '   ' })).toBe(false);
    });

    it('returns false when summary is a number', () => {
      expect(validateAnalysisResponse({ summary: 123 })).toBe(false);
    });

    it('returns true for valid object with non-empty summary', () => {
      expect(validateAnalysisResponse({ summary: 'Meeting went well' })).toBe(true);
    });

    it('returns true with extra fields', () => {
      expect(
        validateAnalysisResponse({
          summary: 'OK',
          decisions: ['decide'],
          unknownField: true,
        })
      ).toBe(true);
    });
  });

  // --- validateParticipantInsights ---
  describe('validateParticipantInsights', () => {
    it('returns false for null', () => {
      expect(validateParticipantInsights(null)).toBe(false);
    });

    it('returns false for a string', () => {
      expect(validateParticipantInsights('not an array')).toBe(false);
    });

    it('returns true for empty array', () => {
      expect(validateParticipantInsights([])).toBe(true);
    });

    it('returns false if item missing speaker field', () => {
      expect(validateParticipantInsights([{ mainTopic: 'budget' }])).toBe(false);
    });

    it('returns false if speaker is not a string', () => {
      expect(validateParticipantInsights([{ speaker: 42 }])).toBe(false);
    });

    it('returns true for valid insights', () => {
      const insights = [
        { speaker: 'Anna', mainTopic: 'roadmap', talkRatio: 0.4 },
        { speaker: 'Jan', stance: 'opposed' },
      ];
      expect(validateParticipantInsights(insights)).toBe(true);
    });

    it('returns false if any item is null', () => {
      expect(validateParticipantInsights([null, { speaker: 'A' }])).toBe(false);
    });
  });

  // --- validateAndNormalizeRisks ---
  describe('validateAndNormalizeRisks', () => {
    it('returns empty array for non-array input', () => {
      expect(validateAndNormalizeRisks('not array')).toEqual([]);
      expect(validateAndNormalizeRisks(null)).toEqual([]);
      expect(validateAndNormalizeRisks(undefined)).toEqual([]);
    });

    it('returns empty array for empty array', () => {
      expect(validateAndNormalizeRisks([])).toEqual([]);
    });

    it('filters out items without risk field', () => {
      const result = validateAndNormalizeRisks([
        { severity: 'high' },
        { risk: 'Budget overrun', severity: 'high' },
      ]);
      expect(result).toEqual([{ risk: 'Budget overrun', severity: 'high' }]);
    });

    it('filters out items where risk is not a string', () => {
      expect(validateAndNormalizeRisks([{ risk: 123, severity: 'low' }])).toEqual([]);
    });

    it('normalizes unknown severity to medium', () => {
      const result = validateAndNormalizeRisks([{ risk: 'Delay', severity: 'critical' }]);
      expect(result).toEqual([{ risk: 'Delay', severity: 'medium' }]);
    });

    it('preserves valid severities', () => {
      const input = [
        { risk: 'A', severity: 'high' },
        { risk: 'B', severity: 'medium' },
        { risk: 'C', severity: 'low' },
      ];
      const result = validateAndNormalizeRisks(input);
      expect(result).toEqual([
        { risk: 'A', severity: 'high' },
        { risk: 'B', severity: 'medium' },
        { risk: 'C', severity: 'low' },
      ]);
    });

    it('filters out null items in array', () => {
      const result = validateAndNormalizeRisks([null, { risk: 'X', severity: 'low' }]);
      expect(result).toEqual([{ risk: 'X', severity: 'low' }]);
    });
  });

  // --- parseAiResponse ---
  describe('parseAiResponse', () => {
    it('extracts JSON from response text', () => {
      const raw = 'Here is the analysis: {"summary": "Good meeting"} end.';
      const result = parseAiResponse(raw);
      expect(result).toEqual({ summary: 'Good meeting' });
    });

    it('throws when no JSON object found', () => {
      expect(() => parseAiResponse('no json here')).toThrow('Brak obiektu JSON');
    });

    it('throws for empty string', () => {
      expect(() => parseAiResponse('')).toThrow('Brak obiektu JSON');
    });

    it('handles multiline JSON', () => {
      const raw = `Response:\n{\n  "summary": "All good",\n  "decisions": ["Ship it"]\n}`;
      const result = parseAiResponse(raw);
      expect(result.summary).toBe('All good');
      expect(result.decisions).toEqual(['Ship it']);
    });

    it('throws for invalid JSON within braces', () => {
      expect(() => parseAiResponse('{not valid json}')).toThrow();
    });

    it('handles JSON with markdown code fences', () => {
      const raw = '```json\n{"summary": "OK"}\n```';
      const result = parseAiResponse(raw);
      expect(result.summary).toBe('OK');
    });
  });

  // --- safeParseAiResponse ---
  describe('safeParseAiResponse', () => {
    it('returns null for null input', () => {
      expect(safeParseAiResponse(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(safeParseAiResponse(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(safeParseAiResponse('')).toBeNull();
    });

    it('returns parsed object on success', () => {
      const result = safeParseAiResponse('{"summary": "Great"}');
      expect(result).toEqual({ summary: 'Great' });
    });

    it('returns null and logs error on parse failure', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = safeParseAiResponse('no json');
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to parse AI response:', expect.any(Error));
    });
  });
});
