import type { MeetingRisk, MeetingParticipantInsight } from '../shared/types';

export interface AiAnalysisResponse {
  summary?: string;
  decisions?: string[];
  actionItems?: string[];
  tasks?: Array<{ title: string; owner?: string; priority?: string }>;
  followUps?: string[];
  answersToNeeds?: Array<{ need: string; answer: string }>;
  risks?: Array<{ risk: string; severity: string }>;
  blockers?: string[];
  participantInsights?: MeetingParticipantInsight[];
  tensions?: Array<{ topic?: string; between?: string[]; resolved?: boolean }>;
  keyQuotes?: Array<{ quote: string; speaker?: string; why?: string }>;
  suggestedTags?: string[];
  meetingType?: string;
  energyLevel?: string;
  speakerCount?: number;
  speakerLabels?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Validates that the AI response has the minimum required structure.
 */
export function validateAnalysisResponse(
  data: unknown
): data is Partial<AiAnalysisResponse> & { summary: string } {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Required field: summary
  if (typeof obj.summary !== 'string' || !obj.summary.trim()) {
    return false;
  }

  return true;
}

/**
 * Validates participant insights structure.
 */
export function validateParticipantInsights(
  insights: unknown
): insights is MeetingParticipantInsight[] {
  if (!Array.isArray(insights)) {
    return false;
  }

  return insights.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      'speaker' in item &&
      typeof (item as Record<string, unknown>).speaker === 'string'
  );
}

/**
 * Validates risks structure and normalizes severity.
 */
export function validateAndNormalizeRisks(risks: unknown): MeetingRisk[] {
  if (!Array.isArray(risks)) {
    return [];
  }

  return risks
    .filter(
      (item): item is { risk: string; severity: string } =>
        typeof item === 'object' &&
        item !== null &&
        'risk' in item &&
        typeof (item as Record<string, unknown>).risk === 'string'
    )
    .map((item) => ({
      risk: item.risk,
      severity: (['high', 'medium', 'low'].includes(item.severity) ? item.severity : 'medium') as
        | 'high'
        | 'medium'
        | 'low',
    }));
}

/**
 * Parses AI response text and extracts JSON.
 */
export function parseAiResponse(rawText: string): AiAnalysisResponse {
  const match = String(rawText || '').match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('Brak obiektu JSON w odpowiedzi modelu.');
  }

  return JSON.parse(match[0]) as AiAnalysisResponse;
}

/**
 * Safely parses AI response with error handling.
 */
export function safeParseAiResponse(rawText: string | null | undefined): AiAnalysisResponse | null {
  if (!rawText) {
    return null;
  }

  try {
    return parseAiResponse(rawText);
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    return null;
  }
}
