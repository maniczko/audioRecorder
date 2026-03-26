import type { MeetingAnalysis } from '../shared/types';
import { analyzeSpeakingStyle } from './speakerAnalysis';
import { API_BASE_URL } from '../services/config';
import {
  buildMeetingFeedbackFallback,
  buildMeetingFeedbackSchemaExample,
  normalizeMeetingFeedback,
} from '../shared/meetingFeedback';

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
const MODEL = import.meta.env.VITE_ANTHROPIC_MODEL || 'claude-3-5-haiku-latest';

// Import lazily to avoid circular deps — apiRequest reads from localStorage for the session token
let _apiRequest = null;
async function getApiRequest() {
  if (!_apiRequest) {
    const mod = await import('../services/httpClient');
    _apiRequest = mod.apiRequest;
  }
  return _apiRequest;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function transcriptText(segments, speakerNames) {
  return safeArray(segments)
    .map((segment) => {
      const speaker =
        speakerNames?.[String(segment.speakerId)] || `Speaker ${segment.speakerId + 1}`;
      return `[${Math.round(segment.timestamp)}s] ${speaker}: ${segment.text}`;
    })
    .join('\n');
}

function findRelevantSegments(segments, term) {
  const normalizedTerm = String(term || '').toLowerCase();
  const keywords = normalizedTerm.split(/\s+/).filter((item) => item.length > 2);

  return safeArray(segments).filter((segment) => {
    const haystack = String(segment.text || '').toLowerCase();
    return keywords.some((keyword) => haystack.includes(keyword));
  });
}

function dedupeList(items) {
  return [
    ...new Set(
      safeArray(items)
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    ),
  ];
}

function normalizeTask(task, index, speakerNames) {
  if (!task) {
    return null;
  }

  if (typeof task === 'string') {
    const match = task.match(/^([^:]{2,40}):\s*(.+)$/);
    return {
      id: `task_${index}`,
      title: match ? match[2].trim() : task.trim(),
      owner: match ? match[1].trim() : 'Nieprzypisane',
      sourceQuote: task.trim(),
      priority: /pilne|asap|natychmiast|krytyczne/i.test(task) ? 'high' : 'medium',
      tags: [],
    };
  }

  const title = String(task.title || task.text || '').trim();
  if (!title) {
    return null;
  }

  const owner = String(task.owner || task.assignee || '').trim();
  return {
    id: task.id || `task_${index}`,
    title,
    owner: owner || speakerNames?.[String(task.speakerId)] || 'Nieprzypisane',
    sourceQuote: String(task.sourceQuote || task.quote || title).trim(),
    priority: String(task.priority || '').trim() || 'medium',
    tags: Array.isArray(task.tags) ? task.tags : [],
  };
}

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
  'na',
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
  'czy',
  'oraz',
  'więc',
  'który',
  'która',
  'które',
  'tego',
  'tej',
  'temu',
  'które',
  'kiedy',
  'gdzie',
  'mamy',
  'musi',
  'może',
  'tylko',
  'sobie',
  'tego',
  'tego',
]);

function buildFallbackRichFields({ transcript, speakerNames }) {
  const stopwords = STOPWORDS;
  const wordFreq = {};
  transcript.forEach((seg) => {
    String(seg.text || '')
      .toLowerCase()
      .split(/\s+/)
      .forEach((w) => {
        const c = w.replace(/[^a-ząćęłńóśźż]/g, '');
        if (c.length >= 5 && !stopwords.has(c)) wordFreq[c] = (wordFreq[c] || 0) + 1;
      });
  });
  const suggestedTags = Object.entries(wordFreq)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 5)
    .map(([w]) => w);

  const risks = dedupeList(
    transcript
      .filter((s) =>
        /ryzyko|problem|obawa|trudne|zagrożen|blokuje|nie uda|martwi|niepewn/i.test(s.text)
      )
      .map((s) => s.text)
  )
    .slice(0, 4)
    .map((risk) => ({ risk, severity: 'medium' }));

  const blockers = dedupeList(
    transcript
      .filter((s) => /blokuje|czekamy|zależy od|nie możemy bez|brakuje|nie mamy/i.test(s.text))
      .map((s) => s.text)
  ).slice(0, 3);

  const totalSegs = transcript.length || 1;
  const speakerCounts: Record<string, { count: number; q: number }> = {};
  transcript.forEach((seg) => {
    const id = String(seg.speakerId);
    if (!speakerCounts[id]) speakerCounts[id] = { count: 0, q: 0 };
    speakerCounts[id].count++;
    if (seg.text.includes('?')) speakerCounts[id].q++;
  });
  const participantInsights = Object.entries(speakerCounts).map(([id, d]) => ({
    speaker: speakerNames?.[id] || `Speaker ${Number(id) + 1}`,
    mainTopic: '',
    stance: d.q > d.count * 0.3 ? 'reactive' : 'proactive' as 'reactive' | 'proactive',
    talkRatio: Math.round((d.count / totalSegs) * 100) / 100,
  }));

  const keyQuotes = transcript
    .filter((s) => s.text.length > 45)
    .sort((a, b) => b.text.length - a.text.length)
    .slice(0, 2)
    .map((s) => ({
      quote: s.text,
      speaker: speakerNames?.[String(s.speakerId)] || `Speaker ${s.speakerId + 1}`,
      why: 'Znacząca wypowiedź.',
    }));

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

function buildFallbackAnalysis({ meeting, segments, speakerNames, diarization }): MeetingAnalysis {
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
        const speaker =
          speakerNames?.[String(segment.speakerId)] || `Speaker ${segment.speakerId + 1}`;
        return `${speaker}: ${segment.text}`;
      })
  ).slice(0, 5);
  const tasks = actionItems
    .map((item, index) => normalizeTask(item, index, speakerNames))
    .filter(Boolean);

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
    tasks: tasks as any,
    followUps,
    answersToNeeds,
    risks: rich.risks as any,
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
    speakerLabels: speakerNames,
    speakerCount:
      diarization?.speakerCount || new Set(transcript.map((segment) => segment.speakerId)).size,
    summary,
    decisions,
    actionItems,
    tasks: tasks as any,
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
      console.error('Server person-profile failed, trying direct fallback.', error);
    }
    return { ...fallback, meetingsAnalyzed: meetings.length };
  }

  // Local demo mode: call Anthropic directly if key is available in env
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
    const parsed = parseAiResponse(payload.content?.[0]?.text || '');

    const clamp100 = (v) => Math.min(100, Math.max(0, Number(v) || 50));

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
      workingWithTips: dedupeList(parsed.workingWithTips).slice(0, 4),
      communicationDos: dedupeList(parsed.communicationDos).slice(0, 3),
      communicationDonts: dedupeList(parsed.communicationDonts).slice(0, 3),
      redFlags: dedupeList(parsed.redFlags).slice(0, 2),
      coachingNote: parsed.coachingNote || '',
      meetingsAnalyzed: meetings.length,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Person profile analysis failed, falling back to local.', error);
    return { ...fallback, mode: 'fallback-after-api-error', meetingsAnalyzed: meetings.length };
  }
}

function parseAiResponse(rawText) {
  const match = String(rawText || '').match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('Brak obiektu JSON w odpowiedzi modelu.');
  }

  return JSON.parse(match[0]);
}

async function analyzeMeetingViaServer({ meeting, segments, speakerNames }) {
  const apiRequest = await getApiRequest();
  return apiRequest('/media/analyze', {
    method: 'POST',
    body: { meeting, segments, speakerNames },
  });
}

export async function analyzeMeeting({
  meeting,
  segments,
  speakerNames,
  diarization,
}): Promise<MeetingAnalysis> {
  const fallback = buildFallbackAnalysis({ meeting, segments, speakerNames, diarization });

  if (!segments.length) {
    return fallback;
  }

  if (API_BASE_URL) {
    try {
      const result = await analyzeMeetingViaServer({ meeting, segments, speakerNames });
      if (result && result.summary) {
        const speakerStats = analyzeSpeakingStyle(segments, speakerNames);
        const richFallback = buildFallbackRichFields({ transcript: segments, speakerNames });
        return {
          ...result,
          feedback: normalizeMeetingFeedback(result.feedback, {
            summary: result.summary || fallback.summary,
            decisions: safeArray(result.decisions).length ? result.decisions : fallback.decisions,
            actionItems: safeArray(result.actionItems).length
              ? result.actionItems
              : fallback.actionItems,
            tasks: safeArray(result.tasks).length ? result.tasks : fallback.tasks,
            followUps: safeArray(result.followUps).length ? result.followUps : fallback.followUps,
            answersToNeeds: safeArray(result.answersToNeeds).length
              ? result.answersToNeeds
              : fallback.answersToNeeds,
            risks: safeArray(result.risks).length ? result.risks : richFallback.risks,
            blockers: safeArray(result.blockers).length ? result.blockers : richFallback.blockers,
            participantInsights: safeArray(result.participantInsights).length
              ? result.participantInsights
              : richFallback.participantInsights,
            tensions: safeArray(result.tensions).length ? result.tensions : richFallback.tensions,
            keyQuotes: safeArray(result.keyQuotes).length
              ? result.keyQuotes
              : richFallback.keyQuotes,
            speakerStats,
            transcriptLength: segments.length,
            meetingTitle: meeting?.title,
          }),
        };
      }
    } catch (error) {
      console.error('Server meeting analysis failed, falling back.', error);
    }
    return fallback;
  }

  if (!API_KEY) {
    return fallback;
  }

  const prompt = [
    'You are a meticulous Polish meeting analyst.',
    'Return valid JSON only — no prose outside the JSON object.',
    'Your job:',
    "1. Replace generic labels (like 'Speaker 1') with ACTUAL names used during the meeting (e.g. if someone says 'Hi Adam', rename them to 'Adam'). Use these exact names for ANY task assignment ('owner' property).",
    "2. Estimate their DISC personality traits (0-100) based on communication style, inside their 'participantInsights.personality'.",
    '3. Summarize the meeting in Polish.',
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
      risks: [{ risk: '...', severity: 'high' }],
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
    const parsed = parseAiResponse(content);

    const richFallback = buildFallbackRichFields({ transcript: segments, speakerNames });
    const speakerStats = analyzeSpeakingStyle(segments, speakerNames);
    const feedback = normalizeMeetingFeedback(parsed.feedback, {
      summary: parsed.summary || fallback.summary,
      decisions: dedupeList(parsed.decisions).slice(0, 5),
      actionItems: dedupeList(parsed.actionItems).slice(0, 6),
      tasks: safeArray(parsed.tasks).map((task: any, index) => normalizeTask(task, index, parsed.speakerLabels || speakerNames)).filter(Boolean) as any,
      followUps: dedupeList(parsed.followUps).slice(0, 5),
      answersToNeeds: safeArray(parsed.answersToNeeds).length ? parsed.answersToNeeds : fallback.answersToNeeds,
      risks: safeArray(parsed.risks).slice(0, 4) as any,
      blockers: dedupeList(parsed.blockers).slice(0, 3),
      participantInsights: safeArray(parsed.participantInsights).length ? parsed.participantInsights : richFallback.participantInsights,
      tensions: safeArray(parsed.tensions).slice(0, 3),
      keyQuotes: safeArray(parsed.keyQuotes).slice(0, 4),
      speakerStats,
      transcriptLength: segments.length,
      meetingTitle: meeting?.title,
    });

    return {
      mode: 'anthropic',
      speakerLabels: parsed.speakerLabels || speakerNames,
      speakerCount: parsed.speakerCount || fallback.speakerCount,
      summary: parsed.summary || fallback.summary,
      decisions: dedupeList(parsed.decisions).slice(0, 5),
      actionItems: dedupeList(parsed.actionItems).slice(0, 6),
      tasks: safeArray(parsed.tasks)
        .map((task, index) => normalizeTask(task, index, parsed.speakerLabels || speakerNames))
        .filter(Boolean),
      followUps: dedupeList(parsed.followUps).slice(0, 5),
      answersToNeeds: safeArray(parsed.answersToNeeds).length
        ? parsed.answersToNeeds
        : fallback.answersToNeeds,
      suggestedTags: dedupeList(parsed.suggestedTags)
        .slice(0, 6)
        .map((t) => String(t).toLowerCase().trim()),
      meetingType: parsed.meetingType || 'other',
      energyLevel: parsed.energyLevel || 'medium',
      risks: safeArray(parsed.risks).slice(0, 4),
      blockers: dedupeList(parsed.blockers).slice(0, 3),
      participantInsights: safeArray(parsed.participantInsights).length
        ? parsed.participantInsights
        : richFallback.participantInsights,
      tensions: safeArray(parsed.tensions).slice(0, 3),
      keyQuotes: safeArray(parsed.keyQuotes).slice(0, 4),
      suggestedAgenda: dedupeList(parsed.suggestedAgenda).slice(0, 5),
      feedback,
    };
  } catch (error) {
    console.error('AI meeting analysis failed, falling back to local summary.', error);
    return fallback;
  }
}
