import type { MeetingAnalysis, TranscriptSegment } from '../shared/types';
import { analyzeSpeakingStyle } from './speakerAnalysis';
import { API_BASE_URL } from '../services/config';
import {
  buildMeetingFeedbackFallback,
  buildMeetingFeedbackSchemaExample,
  normalizeMeetingFeedback,
} from '../shared/meetingFeedback';
import { normalizeTasks, type TaskInput } from './taskNormalizer';
import {
  validateAnalysisResponse,
  parseAiResponse,
  safeParseAiResponse,
  validateAndNormalizeRisks,
  normalizeSourceLinkedAnalysis,
  type AiAnalysisResponse,
} from './aiResponseValidator';
import { buildFallbackRichFields } from './fallbackAnalysis';

const ALLOW_BROWSER_AI_KEYS = import.meta.env.VITE_ALLOW_BROWSER_AI_KEYS === 'true';
const API_KEY = ALLOW_BROWSER_AI_KEYS ? import.meta.env.VITE_ANTHROPIC_API_KEY : '';
const MODEL = import.meta.env.VITE_ANTHROPIC_MODEL || 'claude-3-5-haiku-latest';

// Import lazily to avoid circular deps — apiRequest reads from localStorage for the session token
let _apiRequest: null | typeof import('../services/httpClient').apiRequest = null;

async function getApiRequest() {
  if (!_apiRequest) {
    const mod = await import('../services/httpClient');
    _apiRequest = mod.apiRequest;
  }
  return _apiRequest;
}

function safeArray<T>(value: T | T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function transcriptText(
  segments: TranscriptSegment[],
  speakerNames: Record<string, string>
): string {
  return safeArray(segments)
    .map((segment) => {
      const speakerId = String(segment.speakerId);
      const speaker = speakerNames?.[speakerId] || 'Speaker ' + (Number(speakerId) + 1);
      return '[' + Math.round(segment.timestamp) + 's] ' + speaker + ': ' + segment.text;
    })
    .join('\n');
}

function findRelevantSegments(segments: TranscriptSegment[], term: string): TranscriptSegment[] {
  const normalizedTerm = term.toLowerCase();
  const keywords = normalizedTerm.split(/\s+/).filter((item) => item.length > 2);

  return safeArray(segments).filter((segment) => {
    const haystack = String(segment.text || '').toLowerCase();
    return keywords.some((keyword) => haystack.includes(keyword));
  });
}

function dedupeList(items: unknown[]): string[] {
  return [
    ...new Set(
      safeArray(items)
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    ),
  ];
}

function buildFallbackAnalysis({
  meeting,
  segments,
  speakerNames,
  diarization,
}: {
  meeting: any;
  segments: TranscriptSegment[];
  speakerNames: Record<string, string>;
  diarization: any;
}): MeetingAnalysis {
  const transcript = safeArray(segments);
  const speakerStats = analyzeSpeakingStyle(transcript, speakerNames);
  const importantPhrases = transcript
    .map((segment) => segment.text)
    .join(' ')
    .split(/[.!?]/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 24);

  const summarySource = importantPhrases.slice(0, 2).join('. ');
  const summary =
    summarySource ||
    'Nagranie jest zapisane, ale potrzeba wiecej tresci, aby przygotowac pelne podsumowanie.';

  const decisions = dedupeList(
    transcript
      .filter((segment) => /decyz|ustal|termin|budzet|plan|wybieramy|zatwierdz/i.test(segment.text))
      .map((segment) => segment.text)
  ).slice(0, 4);

  const actionItems = dedupeList(
    transcript
      .filter((segment) =>
        /trzeba|nalezy|zrob|przygot|wyslij|sprawdz|umow|follow up|next step/i.test(segment.text)
      )
      .map((segment) => {
        const speakerId = String(segment.speakerId);
        const speaker = speakerNames?.[speakerId] || 'Speaker ' + (Number(speakerId) + 1);
        return speaker + ': ' + segment.text;
      })
  ).slice(0, 5);

  const tasks = normalizeTasks(actionItems as TaskInput[], speakerNames);

  const answersToNeeds = safeArray(meeting?.needs).map((need) => {
    const matches = findRelevantSegments(transcript, need).slice(0, 2);
    return {
      need,
      answer: matches.length
        ? matches.map((segment) => segment.text).join(' ')
        : 'Nie znalazlem jednoznacznej odpowiedzi w transkrypcji. Warto sprawdzic recznie.',
    };
  });

  const rich = buildFallbackRichFields({ transcript, speakerNames });
  const followUps = dedupeList(
    safeArray(meeting?.desiredOutputs).map((item) => `Zweryfikuj po spotkaniu: ${item}`)
  ).slice(0, 4);

  const feedback = buildMeetingFeedbackFallback({
    summary,
    decisions,
    actionItems,
    tasks,
    followUps,
    answersToNeeds,
    risks: rich.risks,
    blockers: rich.blockers,
    participantInsights: rich.participantInsights,
    tensions: rich.tensions,
    keyQuotes: rich.keyQuotes,
    speakerStats,
    transcriptLength: transcript.length,
    meetingTitle: meeting?.title,
  });

  return {
    mode: API_KEY ? 'fallback-after-api-error' : 'local-fallback',
    analysisSource: 'fallback',
    fallbackReason: API_KEY ? 'provider-error' : 'no-key',
    generatedBy: 'browser',
    speakerLabels: speakerNames,
    speakerCount:
      diarization?.speakerCount || new Set(transcript.map((segment) => segment.speakerId)).size,
    summary,
    decisions,
    actionItems,
    tasks,
    followUps,
    answersToNeeds,
    ...rich,
    feedback,
  };
}

function buildFallbackPsychProfile({ personName, allSegments }) {
  const texts = allSegments.map((s) => String(s.text || ''));
  const joined = texts.join(' ').toLowerCase();
  const total = allSegments.length || 1;

  const assertive = (joined.match(/musimy|zdecydowal|powinniśmy|trzeba|zrobimy|decyduj/g) || [])
    .length;
  const questions = texts.filter((t) => t.includes('?')).length;
  const emotion = (joined.match(/czuj|rozum|wspol|razem|relacj|zaufan|ważne dla|zależy mi/g) || [])
    .length;
  const dataW = (joined.match(/dane|liczby|procent|wyniki|statystyk|analiz|raport|badani/g) || [])
    .length;
  const longSent = texts.filter((t) => t.split(' ').length > 14).length;

  const D = Math.min(95, Math.round(35 + assertive * 7 + (total > 10 ? 5 : 0)));
  const I = Math.min(95, Math.round(30 + questions * 3 + emotion * 4));
  const S = Math.min(95, Math.round(45 + emotion * 5));
  const C = Math.min(95, Math.round(35 + dataW * 6 + longSent * 2));

  return {
    mode: 'local-fallback',
    disc: { D, I, S, C },
    discStyle: 'Profil heurystyczny',
    discDescription:
      'Profil wygenerowany lokalnie na podstawie sygnałów językowych. Skonfiguruj REACT_APP_ANTHROPIC_API_KEY, aby uzyskać głębszą analizę.',
    values: [],
    communicationStyle:
      C > 60 ? 'analytical' : I > 60 ? 'expressive' : S > 60 ? 'diplomatic' : 'direct',
    decisionStyle:
      C > 60 ? 'data-driven' : D > 60 ? 'authoritative' : S > 60 ? 'consensual' : 'intuitive',
    conflictStyle: S > 60 ? 'collaborative' : D > 60 ? 'confrontational' : 'compromising',
    listeningStyle: S > 60 ? 'active' : C > 60 ? 'selective' : 'task-focused',
    stressResponse: 'Za mało danych do oceny zachowania pod presją.',
    workingWithTips: ['Skonfiguruj Anthropic API Key, aby uzyskać spersonalizowane wskazówki.'],
    communicationDos: [],
    communicationDonts: [],
    redFlags: [],
    coachingNote: '',
    meetingsAnalyzed: 0,
    generatedAt: new Date().toISOString(),
  };
}

export async function analyzePersonProfile({ personName, meetings, allSegments }) {
  const fallback = buildFallbackPsychProfile({ personName, allSegments });

  if (allSegments.length < 5) {
    return { ...fallback, meetingsAnalyzed: meetings.length };
  }

  // Prefer server-side proxy when available (keeps API key out of browser)
  if (API_BASE_URL) {
    try {
      const apiRequest = await getApiRequest();
      const result = await apiRequest('/ai/person-profile', {
        method: 'POST',
        body: { personName, meetings, allSegments },
      });
      if (result && result.mode === 'anthropic') {
        const clamp100 = (v) => Math.min(100, Math.max(0, Number(v) || 50));
        return {
          ...result,
          disc: {
            D: clamp100(result.disc?.D),
            I: clamp100(result.disc?.I),
            S: clamp100(result.disc?.S),
            C: clamp100(result.disc?.C),
          },
          values: safeArray(result.values).slice(0, 5),
          workingWithTips: dedupeList(result.workingWithTips).slice(0, 4),
          communicationDos: dedupeList(result.communicationDos).slice(0, 3),
          communicationDonts: dedupeList(result.communicationDonts).slice(0, 3),
          redFlags: dedupeList(result.redFlags).slice(0, 2),
          meetingsAnalyzed: meetings.length,
        };
      }
    } catch (error) {
      console.error('Server person-profile failed, using local fallback.', error);
    }
    return { ...fallback, meetingsAnalyzed: meetings.length };
  }

  // Local demo mode: call Anthropic directly only when explicitly enabled.
  if (!API_KEY) {
    return { ...fallback, meetingsAnalyzed: meetings.length };
  }

  const lines = allSegments
    .slice(0, 100)
    .map((s) => `[${s.meetingTitle || 'Spotkanie'}] ${s.text}`)
    .join('\n');

  const prompt = [
    `You are an expert business psychologist. Analyze the communication patterns of "${personName}".`,
    `Base your analysis ONLY on their actual statements below from ${meetings.length} meeting(s).`,
    `Respond in Polish for all text fields. Return valid JSON only — no prose outside the JSON.`,
    ``,
    `Statements by ${personName}:`,
    lines,
    ``,
    `Return exactly this JSON shape (all fields required):`,
    `{"disc":{"D":65,"I":45,"S":70,"C":55},"discStyle":"SC — stabilny i sumienny","discDescription":"2-zdaniowy opis dominującego stylu.","values":[{"value":"bezpieczeństwo","icon":"🛡️","quote":"cytat z wypowiedzi"}],"communicationStyle":"analytical","decisionStyle":"data-driven","conflictStyle":"collaborative","listeningStyle":"active","stressResponse":"Jak reaguje pod presją.","workingWithTips":["Wskazówka 1","Wskazówka 2","Wskazówka 3"],"communicationDos":["Co robić"],"communicationDonts":["Czego unikać"],"redFlags":["Ewentualny wzorzec"],"coachingNote":"Jedna obserwacja."}`,
  ].join('\n');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`Anthropic request failed: ${response.status}`);

    const payload = await response.json();
    const parsed = parseAiResponse(payload.content?.[0]?.text || '') as any;

    const clamp100 = (v: number | string | null | undefined) =>
      Math.min(100, Math.max(0, Number(v) || 50));

    return {
      mode: 'anthropic',
      disc: {
        D: clamp100(parsed.disc?.D),
        I: clamp100(parsed.disc?.I),
        S: clamp100(parsed.disc?.S),
        C: clamp100(parsed.disc?.C),
      },
      discStyle: parsed.discStyle || '',
      discDescription: parsed.discDescription || '',
      values: safeArray(parsed.values).slice(0, 5),
      communicationStyle: parsed.communicationStyle || 'direct',
      decisionStyle: parsed.decisionStyle || 'intuitive',
      conflictStyle: parsed.conflictStyle || 'collaborative',
      listeningStyle: parsed.listeningStyle || 'active',
      stressResponse: parsed.stressResponse || '',
      workingWithTips: dedupeList(parsed.workingWithTips || []).slice(0, 4),
      communicationDos: dedupeList(parsed.communicationDos || []).slice(0, 3),
      communicationDonts: dedupeList(parsed.communicationDonts || []).slice(0, 3),
      redFlags: dedupeList(parsed.redFlags || []).slice(0, 2),
      coachingNote: parsed.coachingNote || '',
      meetingsAnalyzed: meetings.length,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Person profile analysis failed, falling back to local.', error);
    return { ...fallback, mode: 'fallback-after-api-error', meetingsAnalyzed: meetings.length };
  }
}

async function analyzeMeetingViaServer({
  meeting,
  segments,
  speakerNames,
}: {
  meeting: any;
  segments: TranscriptSegment[];
  speakerNames: Record<string, string>;
}): Promise<AiAnalysisResponse> {
  const apiRequest = await getApiRequest();
  const workspaceId = String(
    meeting?.workspaceId || meeting?.workspace_id || meeting?.workspace?.id || ''
  ).trim();
  return apiRequest('/media/analyze', {
    method: 'POST',
    body: { workspaceId, meeting, segments, speakerNames },
  });
}

export async function analyzeMeeting({
  meeting,
  segments,
  speakerNames,
  diarization,
}: {
  meeting: any;
  segments: TranscriptSegment[];
  speakerNames: Record<string, string>;
  diarization: any;
}): Promise<MeetingAnalysis> {
  const fallback = buildFallbackAnalysis({ meeting, segments, speakerNames, diarization });

  if (!segments.length) {
    return fallback;
  }

  // Try server-side analysis first
  if (API_BASE_URL) {
    try {
      const result = await analyzeMeetingViaServer({ meeting, segments, speakerNames });
      if (result && result.summary) {
        return buildEnrichedAnalysis(result, fallback, segments, speakerNames, meeting);
      }
      if (result?.analysisSource === 'fallback' || result?.fallbackReason || result?.mode) {
        return {
          ...fallback,
          mode: result.mode || fallback.mode,
          analysisSource: result.analysisSource || 'fallback',
          fallbackReason: result.fallbackReason || fallback.fallbackReason || 'provider-error',
          generatedBy: result.generatedBy || 'server',
        };
      }
    } catch (error) {
      console.error('Server meeting analysis failed, falling back.', error);
      return {
        ...fallback,
        mode: 'fallback-after-api-error',
        analysisSource: 'fallback',
        fallbackReason: 'provider-error',
      };
    }
    return fallback;
  }

  // Try direct Anthropic API only for explicit local demo builds.
  if (!API_KEY) {
    return fallback;
  }

  return analyzeMeetingViaAnthropic({
    meeting,
    segments,
    speakerNames,
    fallback,
  });
}

/**
 * Builds enriched analysis from server response.
 */
function buildEnrichedAnalysis(
  result: AiAnalysisResponse,
  fallback: MeetingAnalysis,
  segments: TranscriptSegment[],
  speakerNames: Record<string, string>,
  meeting?: any
): MeetingAnalysis {
  const resultWithEvidence = normalizeSourceLinkedAnalysis(
    result as Record<string, unknown>,
    segments
  ) as AiAnalysisResponse;
  const speakerStats = analyzeSpeakingStyle(segments, speakerNames);
  const richFallback = buildFallbackRichFields({ transcript: segments, speakerNames });
  const tasks = normalizeTasks(
    safeArray(resultWithEvidence.tasks as TaskInput[]),
    resultWithEvidence.speakerLabels || speakerNames
  );

  return {
    ...resultWithEvidence,
    tasks: tasks.length ? tasks : fallback.tasks,
    feedback: normalizeMeetingFeedback(resultWithEvidence.feedback, {
      summary: resultWithEvidence.summary || fallback.summary,
      decisions: safeArray(resultWithEvidence.decisions).length
        ? (resultWithEvidence.decisions as string[])
        : fallback.decisions,
      actionItems: safeArray(resultWithEvidence.actionItems).length
        ? (resultWithEvidence.actionItems as string[])
        : fallback.actionItems,
      tasks: tasks.length ? tasks : fallback.tasks,
      followUps: safeArray(resultWithEvidence.followUps).length
        ? resultWithEvidence.followUps
        : fallback.followUps,
      answersToNeeds: safeArray(resultWithEvidence.answersToNeeds).length
        ? resultWithEvidence.answersToNeeds
        : fallback.answersToNeeds,
      risks: safeArray(resultWithEvidence.risks).length
        ? (resultWithEvidence.risks as any)
        : richFallback.risks,
      blockers: safeArray(resultWithEvidence.blockers).length
        ? resultWithEvidence.blockers
        : richFallback.blockers,
      participantInsights: safeArray(resultWithEvidence.participantInsights).length
        ? resultWithEvidence.participantInsights
        : richFallback.participantInsights,
      tensions: safeArray(resultWithEvidence.tensions).length
        ? resultWithEvidence.tensions
        : richFallback.tensions,
      keyQuotes: safeArray(resultWithEvidence.keyQuotes).length
        ? resultWithEvidence.keyQuotes
        : richFallback.keyQuotes,
      speakerStats,
      transcriptLength: segments.length,
      meetingTitle: meeting?.title,
    }),
  } as MeetingAnalysis;
}

/**
 * Analyzes meeting via direct Anthropic API call.
 */
async function analyzeMeetingViaAnthropic({
  meeting,
  segments,
  speakerNames,
  fallback,
}: {
  meeting: any;
  segments: TranscriptSegment[];
  speakerNames: Record<string, string>;
  fallback: MeetingAnalysis;
}): Promise<MeetingAnalysis> {
  const prompt = buildAnthropicPrompt(meeting, segments, speakerNames);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic request failed with status ${response.status}.`);
    }

    const payload = await response.json();
    const content = payload.content?.[0]?.text || '';
    const parsed = safeParseAiResponse(content);

    if (!parsed || !validateAnalysisResponse(parsed)) {
      console.warn('Invalid AI response, using fallback');
      return {
        ...fallback,
        mode: 'fallback-after-api-error',
        analysisSource: 'fallback',
        fallbackReason: 'invalid-model-output',
      };
    }

    return buildAnthropicAnalysis(parsed, fallback, segments, speakerNames, meeting);
  } catch (error) {
    console.error('AI meeting analysis failed, falling back to local summary.', error);
    return {
      ...fallback,
      mode: 'fallback-after-api-error',
      analysisSource: 'fallback',
      fallbackReason: 'provider-error',
    };
  }
}

/**
 * Builds the Anthropic API prompt.
 */
function buildAnthropicPrompt(
  meeting: any,
  segments: TranscriptSegment[],
  speakerNames: Record<string, string>
): string {
  return [
    'You are a meticulous Polish meeting analyst.',
    'Return valid JSON only — no prose outside the JSON object.',
    'Your job:',
    "1. Replace generic labels (like 'Speaker 1') with ACTUAL names used during the meeting (e.g. if someone says 'Hi Adam', rename them to 'Adam'). Use these exact names for ANY task assignment ('owner' property).",
    "2. Estimate their DISC personality traits (0-100) based on communication style, inside their 'participantInsights.personality'.",
    '3. Summarize the meeting in Polish. Write a DETAILED, thorough summary (minimum 5-8 sentences) that covers: key discussion topics in detail, main arguments and counter-arguments presented, conclusions reached, and any important context. Do NOT write a brief one-liner — the summary should read like a proper meeting report paragraph.',
    '4. Extract decisions, action items, tasks, follow-ups, answers to needs.',
    '5. Classify the meeting and extract rich intelligence fields.',
    '6. Add a developmental feedback block for the whole meeting only. Do not score individual participants.',
    '',
    `Meeting title: ${meeting.title}`,
    `Context: ${meeting.context || 'None.'}`,
    `Needs: ${safeArray(meeting.needs).join(' | ') || 'None.'}`,
    `Desired outputs: ${safeArray(meeting.desiredOutputs).join(' | ') || 'None.'}`,
    '',
    'Return JSON in this exact shape (all Polish text fields in Polish):',
    JSON.stringify({
      speakerCount: 2,
      speakerLabels: { 0: 'Adam', 1: 'Marcin' },
      summary: '...',
      decisions: ['...'],
      actionItems: ['...'],
      tasks: [{ title: '...', owner: 'Adam', sourceQuote: '...', priority: 'medium', tags: [] }],
      followUps: ['...'],
      answersToNeeds: [{ need: '...', answer: '...' }],
      suggestedTags: ['budzet', 'roadmap'],
      meetingType: 'planning',
      energyLevel: 'medium',
      risks: [{ risk: '...', severity: 'high' as const }],
      blockers: ['...'],
      participantInsights: [
        {
          speaker: 'Adam',
          mainTopic: '...',
          stance: 'proactive',
          talkRatio: 0.6,
          personality: { D: 70, I: 50, S: 40, C: 80 },
          needs: ['...'],
          concerns: ['...'],
          sentimentScore: 85,
        },
      ],
      tensions: [{ topic: '...', between: ['A', 'B'], resolved: false }],
      keyQuotes: [{ quote: '...', speaker: 'Host', why: '...' }],
      suggestedAgenda: ['...'],
      feedback: buildMeetingFeedbackSchemaExample(),
    }),
    '',
    transcriptText(segments, speakerNames),
  ].join('\n');
}

/**
 * Builds analysis result from Anthropic response.
 */
function buildAnthropicAnalysis(
  parsed: AiAnalysisResponse,
  fallback: MeetingAnalysis,
  segments: TranscriptSegment[],
  speakerNames: Record<string, string>,
  meeting?: any
): MeetingAnalysis {
  const richFallback = buildFallbackRichFields({ transcript: segments, speakerNames });
  const speakerStats = analyzeSpeakingStyle(segments, speakerNames);
  const parsedWithEvidence = normalizeSourceLinkedAnalysis(
    parsed as Record<string, unknown>,
    segments
  ) as AiAnalysisResponse;

  const normalizedRisks = validateAndNormalizeRisks(parsedWithEvidence.risks);

  const tasks = normalizeTasks(
    safeArray(parsedWithEvidence.tasks as TaskInput[]),
    parsedWithEvidence.speakerLabels || speakerNames
  );

  const feedback = normalizeMeetingFeedback(parsedWithEvidence.feedback, {
    summary: parsedWithEvidence.summary || fallback.summary,
    decisions: dedupeList(parsedWithEvidence.decisions || []).slice(0, 5),
    actionItems: dedupeList(parsedWithEvidence.actionItems || []).slice(0, 6),
    tasks,
    followUps: dedupeList(parsedWithEvidence.followUps || []).slice(0, 5),
    answersToNeeds: safeArray(parsedWithEvidence.answersToNeeds).length
      ? parsedWithEvidence.answersToNeeds
      : (fallback.answersToNeeds ?? []),
    risks: normalizedRisks,
    blockers: dedupeList(parsedWithEvidence.blockers || []).slice(0, 3),
    participantInsights: safeArray(parsedWithEvidence.participantInsights).length
      ? parsedWithEvidence.participantInsights
      : (richFallback.participantInsights ?? []),
    tensions: safeArray(parsedWithEvidence.tensions).slice(0, 3),
    keyQuotes: safeArray(parsedWithEvidence.keyQuotes).slice(0, 4),
    speakerStats,
    transcriptLength: segments.length,
    meetingTitle: meeting?.title,
  });

  return {
    mode: 'anthropic',
    analysisSource: 'provider',
    generatedBy: 'anthropic',
    speakerLabels: parsedWithEvidence.speakerLabels || speakerNames,
    speakerCount: parsedWithEvidence.speakerCount || fallback.speakerCount,
    summary: parsedWithEvidence.summary || fallback.summary,
    decisions: dedupeList(parsedWithEvidence.decisions || []).slice(0, 5),
    actionItems: dedupeList(parsedWithEvidence.actionItems || []).slice(0, 6),
    tasks,
    followUps: dedupeList(parsedWithEvidence.followUps || []).slice(0, 5),
    answersToNeeds: safeArray(parsedWithEvidence.answersToNeeds).length
      ? safeArray(parsedWithEvidence.answersToNeeds)
      : (fallback.answersToNeeds ?? []),
    suggestedTags: dedupeList(parsedWithEvidence.suggestedTags || [])
      .slice(0, 6)
      .map((t) => String(t).toLowerCase().trim()),
    meetingType: parsedWithEvidence.meetingType || 'other',
    energyLevel: parsedWithEvidence.energyLevel || 'medium',
    risks: normalizedRisks,
    blockers: dedupeList(parsedWithEvidence.blockers || []).slice(0, 3),
    participantInsights: safeArray(parsedWithEvidence.participantInsights).length
      ? safeArray(parsedWithEvidence.participantInsights)
      : richFallback.participantInsights,
    tensions: safeArray(parsedWithEvidence.tensions).slice(0, 3),
    keyQuotes: safeArray(parsedWithEvidence.keyQuotes).slice(0, 4),
    suggestedAgenda: dedupeList((parsedWithEvidence.suggestedAgenda as string[]) || []).slice(0, 5),
    sourceEvidence: parsedWithEvidence.sourceEvidence,
    unsupportedClaims: parsedWithEvidence.unsupportedClaims,
    feedback,
  };
}
