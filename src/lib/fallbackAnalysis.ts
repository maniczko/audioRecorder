import type {
  MeetingRisk,
  MeetingParticipantInsight,
  MeetingQuote,
  TranscriptSegment,
} from '../shared/types';

const STOPWORDS = new Set([
  'jest',
  'są',
  'nie',
  'się',
  'jak',
  'ale',
  'czy',
  'tak',
  'też',
  'już',
  'do',
  'po',
  'od',
  'ze',
  'to',
  'ten',
  'tam',
  'tu',
  'co',
  'my',
  'ty',
  'go',
  'jej',
  'jego',
  'ich',
  'dla',
  'pan',
  'pani',
  'tego',
  'przez',
  'przy',
  'oraz',
  'więc',
  'który',
  'która',
  'które',
  'tej',
  'temu',
  'kiedy',
  'gdzie',
  'mamy',
  'musi',
  'może',
  'tylko',
  'sobie',
]);

export interface FallbackRichFields {
  suggestedTags: string[];
  risks: MeetingRisk[];
  blockers: string[];
  participantInsights: MeetingParticipantInsight[];
  keyQuotes: MeetingQuote[];
  tensions: Array<{ topic?: string; between?: string[]; resolved?: boolean }>;
  suggestedAgenda: string[];
  meetingType: string;
  energyLevel: string;
}

interface WordFreqCache {
  transcriptKey: string;
  wordFreq: Record<string, number>;
}

let wordFreqCache: WordFreqCache | null = null;

/**
 * Builds rich fallback fields from transcript analysis.
 * Uses caching to improve performance for repeated calls.
 */
export function buildFallbackRichFields({
  transcript,
  speakerNames,
}: {
  transcript: TranscriptSegment[];
  speakerNames: Record<string, string>;
}): FallbackRichFields {
  const stopwords = STOPWORDS;

  // Compute word frequency with caching
  const transcriptKey = transcript.map((s) => s.text || '').join('|');
  let wordFreq: Record<string, number>;

  if (wordFreqCache && wordFreqCache.transcriptKey === transcriptKey) {
    wordFreq = wordFreqCache.wordFreq;
  } else {
    wordFreq = {};
    transcript.forEach((seg) => {
      String(seg.text || '')
        .toLowerCase()
        .split(/\s+/)
        .forEach((w) => {
          const c = w.replace(/[^a-ząćęłńóśźż]/g, '');
          if (c.length >= 5 && !stopwords.has(c)) {
            wordFreq[c] = (wordFreq[c] || 0) + 1;
          }
        });
    });
    wordFreqCache = { transcriptKey, wordFreq };
  }

  const suggestedTags = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);

  const risks = extractRisks(transcript);
  const blockers = extractBlockers(transcript);
  const participantInsights = buildParticipantInsights(transcript, speakerNames);
  const keyQuotes = extractKeyQuotes(transcript, speakerNames);

  return {
    suggestedTags,
    risks,
    blockers,
    participantInsights,
    keyQuotes,
    tensions: [],
    suggestedAgenda: [],
    meetingType: 'other',
    energyLevel: 'medium',
  };
}

/**
 * Extracts risk-related segments from transcript.
 */
function extractRisks(transcript: TranscriptSegment[]): MeetingRisk[] {
  const riskPattern = /ryzyko|problem|obawa|trudne|zagrożen|blokuje|nie uda|martwi|niepewn/i;

  const riskTexts = transcript.filter((s) => riskPattern.test(s.text)).map((s) => s.text);

  const uniqueRisks = [...new Set(riskTexts.map((r) => r.trim()).filter(Boolean))];

  return uniqueRisks.slice(0, 4).map((risk) => ({ risk, severity: 'medium' as const }));
}

/**
 * Extracts blocker-related segments from transcript.
 */
function extractBlockers(transcript: TranscriptSegment[]): string[] {
  const blockerPattern = /blokuje|czekamy|zależy od|nie możemy bez|brakuje|nie mamy/i;

  const blockerTexts = transcript.filter((s) => blockerPattern.test(s.text)).map((s) => s.text);

  const uniqueBlockers = [...new Set(blockerTexts.map((b) => b.trim()).filter(Boolean))];

  return uniqueBlockers.slice(0, 3);
}

/**
 * Builds participant insights based on speaking patterns.
 */
function buildParticipantInsights(
  transcript: TranscriptSegment[],
  speakerNames: Record<string, string>
): MeetingParticipantInsight[] {
  const totalSegs = transcript.length || 1;
  const speakerCounts: Record<string, { count: number; q: number }> = {};

  transcript.forEach((seg) => {
    const id = String(seg.speakerId);
    if (!speakerCounts[id]) {
      speakerCounts[id] = { count: 0, q: 0 };
    }
    speakerCounts[id].count++;
    if (seg.text.includes('?')) {
      speakerCounts[id].q++;
    }
  });

  return Object.entries(speakerCounts).map(([id, d]) => ({
    speaker: speakerNames?.[id] || `Speaker ${Number(id) + 1}`,
    mainTopic: '',
    stance: (d.q > d.count * 0.3 ? 'reactive' : 'proactive') as 'reactive' | 'proactive',
    talkRatio: Math.round((d.count / totalSegs) * 100) / 100,
  }));
}

/**
 * Extracts key quotes from transcript.
 */
function extractKeyQuotes(
  transcript: TranscriptSegment[],
  speakerNames: Record<string, string>
): MeetingQuote[] {
  return transcript
    .filter((s) => s.text.length > 45)
    .sort((a, b) => b.text.length - a.text.length)
    .slice(0, 2)
    .map((s) => {
      const speakerId = String(s.speakerId);
      return {
        quote: s.text,
        speaker: speakerNames?.[speakerId] || `Speaker ${Number(speakerId) + 1}`,
        why: 'Znacząca wypowiedź.',
      };
    });
}

/**
 * Clears the word frequency cache.
 * Call this when transcript changes significantly.
 */
export function clearFallbackCache(): void {
  wordFreqCache = null;
}
