import type {
  MeetingFeedback,
  MeetingFeedbackCategoryScore,
  MeetingNeedAnswer,
  MeetingParticipantInsight,
  MeetingQuote,
  MeetingRisk,
  MeetingTask,
  MeetingTension,
} from "./types";

export type MeetingFeedbackSpeakerStat = {
  speakerId?: string | number;
  speakerName?: string;
  wpm?: number;
  fillerRate?: number;
  speakingSeconds?: number;
  turnCount?: number;
  avgTurnSeconds?: number;
  totalWords?: number;
};

export type MeetingFeedbackContext = {
  summary?: string;
  decisions?: string[];
  actionItems?: string[];
  tasks?: MeetingTask[];
  followUps?: string[];
  answersToNeeds?: MeetingNeedAnswer[];
  risks?: MeetingRisk[];
  blockers?: string[];
  participantInsights?: MeetingParticipantInsight[];
  tensions?: MeetingTension[];
  keyQuotes?: MeetingQuote[];
  speakerStats?: MeetingFeedbackSpeakerStat[];
  transcriptLength?: number;
  meetingTitle?: string;
};

export const MEETING_FEEDBACK_CATEGORIES = [
  { key: "facilitation", label: "Prowadzenie spotkania" },
  { key: "expertise", label: "Wiedza merytoryczna" },
  { key: "clarity", label: "Jasność wypowiedzi" },
  { key: "structure", label: "Struktura i organizacja" },
  { key: "listening", label: "Słuchanie i reagowanie" },
  { key: "closing", label: "Domykanie ustaleń" },
  { key: "pace", label: "Tempo i zarządzanie czasem" },
  { key: "collaboration", label: "Współpraca i atmosfera" },
] as const;

type FeedbackCategoryKey = (typeof MEETING_FEEDBACK_CATEGORIES)[number]["key"];

function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function clampScore(value: unknown, fallback = 7): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(10, Math.round(parsed)));
}

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function uniqueTexts(values: unknown[], fallback: string[] = [], limit = 3): string[] {
  const seen = new Set<string>();
  const items = [...safeArray(values), ...fallback]
    .map((item) => cleanText(item))
    .filter(Boolean);

  const result: string[] = [];
  for (const item of items) {
    const normalized = item.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getTranscriptSignals(context: MeetingFeedbackContext) {
  const decisions = safeArray(context.decisions);
  const actionItems = safeArray(context.actionItems);
  const tasks = safeArray(context.tasks);
  const followUps = safeArray(context.followUps);
  const risks = safeArray(context.risks);
  const blockers = safeArray(context.blockers);
  const participantInsights = safeArray(context.participantInsights);
  const tensions = safeArray(context.tensions);
  const keyQuotes = safeArray(context.keyQuotes);
  const speakerStats = safeArray(context.speakerStats);

  const speakerTalkRatios = participantInsights
    .map((item) => Number(item.talkRatio ?? 0))
    .filter((item) => Number.isFinite(item) && item > 0);
  const dominantTalkRatio = speakerTalkRatios.length ? Math.max(...speakerTalkRatios) : 0;

  const avgFillerRate = speakerStats.length
    ? avg(speakerStats.map((stat) => Number(stat.fillerRate ?? 0)).filter((value) => Number.isFinite(value)))
    : 0;
  const avgWpm = speakerStats.length
    ? avg(speakerStats.map((stat) => Number(stat.wpm ?? 0)).filter((value) => Number.isFinite(value)))
    : 0;

  const transcriptLength = Number(context.transcriptLength || 0);
  const actionCount = actionItems.length + tasks.length + followUps.length;
  const signalCount = decisions.length + actionCount + participantInsights.length + risks.length + blockers.length + tensions.length + keyQuotes.length;
  const hasEnoughData = transcriptLength >= 6 || signalCount >= 4;

  return {
    decisions,
    actionItems,
    tasks,
    followUps,
    risks,
    blockers,
    participantInsights,
    tensions,
    keyQuotes,
    speakerStats,
    dominantTalkRatio,
    avgFillerRate,
    avgWpm,
    transcriptLength,
    actionCount,
    signalCount,
    hasEnoughData,
  };
}

function makeCategoryScores(context: MeetingFeedbackContext): MeetingFeedbackCategoryScore[] {
  const signals = getTranscriptSignals(context);
  const {
    decisions,
    actionCount,
    risks,
    blockers,
    participantInsights,
    tensions,
    speakerStats,
    dominantTalkRatio,
    avgFillerRate,
    avgWpm,
    hasEnoughData,
  } = signals;

  const meetingDepth = decisions.length + actionCount + risks.length + participantInsights.length;
  const balanceBonus = dominantTalkRatio > 0 && dominantTalkRatio < 0.72 ? 1 : dominantTalkRatio >= 0.86 ? -1 : 0;
  const qualityBonus = hasEnoughData ? 0.5 : -1;

  const categoryScores: Record<FeedbackCategoryKey, number> = {
    facilitation:
      7 +
      (decisions.length > 0 ? 1 : -0.5) +
      (actionCount > 0 ? 1 : -1) +
      (tensions.length > 0 ? -0.5 : 0.5) +
      qualityBonus,
    expertise:
      7 +
      (meetingDepth >= 4 ? 1 : 0) +
      (signals.keyQuotes.length > 0 ? 0.5 : 0) +
      (signals.risks.length > 0 ? 0.5 : 0) +
      (hasEnoughData ? 0.5 : -1),
    clarity:
      7 +
      (avgFillerRate <= 5 ? 1 : avgFillerRate <= 10 ? 0.5 : avgFillerRate <= 16 ? -0.2 : -1) +
      (avgWpm >= 95 && avgWpm <= 175 ? 0.5 : avgWpm > 190 ? -0.8 : -0.2),
    structure:
      7 +
      (decisions.length > 0 ? 1 : 0) +
      (signals.followUps.length > 0 ? 0.8 : -0.2) +
      (actionCount > 1 ? 0.8 : actionCount === 1 ? 0.4 : -1) +
      (blockers.length > 0 ? -0.3 : 0.3),
    listening:
      7 +
      (participantInsights.length > 1 ? 0.5 : -0.5) +
      (tensions.length === 0 ? 0.5 : -0.5) +
      (dominantTalkRatio > 0 && dominantTalkRatio < 0.7 ? 1 : dominantTalkRatio >= 0.85 ? -1 : 0.2),
    closing:
      7 +
      (actionCount >= 3 ? 1.5 : actionCount === 2 ? 1 : actionCount === 1 ? 0.5 : -1) +
      (signals.followUps.length > 0 ? 0.5 : 0) +
      (blockers.length === 0 ? 0.5 : -0.5),
    pace:
      7 +
      (avgWpm >= 100 && avgWpm <= 170 ? 1 : avgWpm > 190 ? -1 : -0.2) +
      (speakerStats.length > 0 ? (signals.speakerStats.some((stat) => Number(stat.avgTurnSeconds || 0) > 90) ? -0.4 : 0.3) : 0),
    collaboration:
      7 +
      (participantInsights.length > 1 ? 0.5 : -0.5) +
      (tensions.length === 0 ? 0.8 : -0.8) +
      balanceBonus +
      (blockers.length > 0 ? -0.3 : 0.3),
  };

  return MEETING_FEEDBACK_CATEGORIES.map((category) => {
    const score = clampScore(categoryScores[category.key], 7);
    return {
      key: category.key,
      label: category.label,
      score,
      observation: buildCategoryObservation(category.key, score, signals),
      improvementTip: buildCategoryTip(category.key, score, signals),
    };
  });
}

function buildCategoryObservation(categoryKey: FeedbackCategoryKey, score: number, signals: ReturnType<typeof getTranscriptSignals>): string {
  const { decisions, actionCount, participantInsights, tensions, dominantTalkRatio, avgFillerRate, avgWpm, hasEnoughData } = signals;
  const lowDataNote = hasEnoughData ? "" : " Dane są ograniczone, więc ocena ma charakter orientacyjny.";

  switch (categoryKey) {
    case "facilitation":
      return score >= 8
        ? `Spotkanie było prowadzone konkretnie i miało wyraźny kierunek.${lowDataNote}`
        : `Prowadzenie wymaga większej kontroli nad tempem i kończeniem wątków.${lowDataNote}`;
    case "expertise":
      return score >= 8
        ? `Widać dobrą orientację w temacie i sensowne odniesienia do faktów.${lowDataNote}`
        : `Wypowiedzi są bardziej ogólne niż eksperckie, więc warto mocniej podpierać się faktami lub przykładami.${lowDataNote}`;
    case "clarity":
      if (avgFillerRate >= 15 || avgWpm > 190) {
        return `Przekaz jest zrozumiały, ale tempo lub liczba wypełniaczy osłabia odbiór.${lowDataNote}`;
      }
      if (avgFillerRate <= 5 && avgWpm >= 95 && avgWpm <= 175) {
        return `Wypowiedzi brzmią klarownie i łatwo je śledzić.${lowDataNote}`;
      }
      return `Jasność wypowiedzi jest poprawna, ale przydałoby się więcej zwięzłych podsumowań.${lowDataNote}`;
    case "structure":
      return actionCount > 0 || decisions.length > 0
        ? `Pojawiają się konkretne ustalenia, ale nie wszystkie wątki są domknięte w jednej strukturze.${lowDataNote}`
        : `Brakuje wyraźnej struktury: cel, decyzja, owner i termin nie są zawsze ustawiane.${lowDataNote}`;
    case "listening":
      return participantInsights.length > 1 && tensions.length === 0
        ? `Jest przestrzeń na różne głosy, ale warto częściej zatrzymywać się i parafrazować odpowiedzi.${lowDataNote}`
        : `Warto mocniej pokazywać, że słuchasz: dopytywać, podsumowywać i sprawdzać, czy dobrze rozumiesz.${lowDataNote}`;
    case "closing":
      return actionCount > 0
        ? `Są sygnały domykania tematów, ale część ustaleń można przekształcać szybciej w konkretne zadania.${lowDataNote}`
        : `Tematy są omawiane, ale nie widać jeszcze mocnego domknięcia decyzji i właścicieli.${lowDataNote}`;
    case "pace":
      return avgWpm >= 100 && avgWpm <= 170
        ? `Tempo zwykle jest w dobrym zakresie, choć w kluczowych momentach warto robić krótkie pauzy.${lowDataNote}`
        : `Tempo wymaga dopracowania: albo warto zwolnić, albo bardziej pilnować dynamiki rozmowy.${lowDataNote}`;
    case "collaboration":
      return dominantTalkRatio > 0 && dominantTalkRatio < 0.72 && tensions.length === 0
        ? `Widać dobrą współpracę i równy udział stron w rozmowie.${lowDataNote}`
        : `Atmosfera może być bardziej partnerska, jeśli częściej oddasz przestrzeń na reakcję i doprecyzowanie.${lowDataNote}`;
    default:
      return `Brak dodatkowych obserwacji.${lowDataNote}`;
  }
}

function buildCategoryTip(categoryKey: FeedbackCategoryKey, score: number, signals: ReturnType<typeof getTranscriptSignals>): string {
  const { decisions, actionCount, participantInsights, blockers, dominantTalkRatio, avgFillerRate, avgWpm } = signals;

  switch (categoryKey) {
    case "facilitation":
      return score >= 8
        ? "Na końcu każdego wątku zamykaj decyzję jednym zdaniem: co ustalono i kto to prowadzi."
        : "Na początku spotkania ustaw cel, a potem pilnuj, żeby każdy temat kończył się decyzją lub kolejnym krokiem.";
    case "expertise":
      return score >= 8
        ? "Mów z perspektywy faktów i przykładów, ale dopilnuj, żeby wnioski były proste do zapisania."
        : "Przygotuj 2-3 liczby, przykłady lub argumenty, które chcesz świadomie wnieść do rozmowy.";
    case "clarity":
      if (avgFillerRate >= 15 || avgWpm > 190) {
        return "Skracaj wstępy i rób pauzę po ważnym zdaniu, zamiast wypełniać ciszę słowami.";
      }
      return "Mów krótszymi blokami i po każdej istotnej myśli zrób 2-3 sekundy przerwy.";
    case "structure":
      return actionCount > 0 || decisions.length > 0
        ? "Przy każdym ustaleniu dopisz: owner, termin i następny krok."
        : "Ułóż rozmowę w prosty schemat: problem, opcje, decyzja, zadanie.";
    case "listening":
      return participantInsights.length > 1
        ? "Po odpowiedzi drugiej strony dodaj krótkie podsumowanie, zanim przejdziesz dalej."
        : "Zostaw więcej miejsca na odpowiedzi i zadawaj jedno pytanie doprecyzowujące zamiast kilku naraz.";
    case "closing":
      return blockers.length > 0
        ? "Jeśli coś blokuje decyzję, nazwij blokadę wprost i od razu przypisz kolejny ruch."
        : "Na końcu spotkania zrób 30-sekundowe domknięcie: decyzje, zadania, terminy.";
    case "pace":
      return avgWpm >= 100 && avgWpm <= 170
        ? "W trudniejszych fragmentach zwolnij, żeby drugi uczestnik miał czas na reakcję."
        : "Pilnuj rytmu: wolniej w decyzjach, szybciej przy wstępach i dygresjach.";
    case "collaboration":
      return dominantTalkRatio > 0.8
        ? "Celowo oddawaj głos pytaniem typu: „co o tym myślisz?” albo „co byś dodał?”."
        : "Buduj bardziej partnerską rozmowę, podsumowując wspólny wniosek zanim przejdziesz dalej.";
    default:
      return "W następnym spotkaniu spróbuj mówić bardziej konkretnie i domykać każdy wątek decyzją.";
  }
}

function buildStrengths(context: MeetingFeedbackContext, signals: ReturnType<typeof getTranscriptSignals>): string[] {
  const strengths: string[] = [];
  if (signals.decisions.length > 0) {
    strengths.push("Spotkanie prowadziło do konkretnych decyzji, a nie tylko do wymiany opinii.");
  }
  if (signals.actionCount > 1) {
    strengths.push("Pojawiło się kilka użytecznych ustaleń, które można od razu zamienić w działania.");
  }
  if (signals.participantInsights.length > 1) {
    strengths.push("W rozmowie było miejsce na więcej niż jedną perspektywę.");
  }
  if (signals.avgFillerRate <= 8 && signals.avgWpm > 0) {
    strengths.push("Przekaz brzmiał względnie klarownie i bez nadmiernego przeciągania wypowiedzi.");
  }
  if (!signals.tensions.length && signals.participantInsights.length > 0) {
    strengths.push("Atmosfera rozmowy była raczej spokojna i współpracująca.");
  }
  if (!strengths.length && cleanText(context.summary)) {
    strengths.push("Był wyraźny temat rozmowy i dało się uchwycić jej główny sens.");
  }
  return uniqueTexts(strengths, [], 3);
}

function buildImprovementAreas(context: MeetingFeedbackContext, signals: ReturnType<typeof getTranscriptSignals>): string[] {
  const improvementAreas: string[] = [];
  if (signals.actionCount === 0) {
    improvementAreas.push("Warto mocniej kończyć każdy temat konkretną decyzją albo zadaniem.");
  }
  if (signals.blockers.length > 0 || signals.tensions.length > 0) {
    improvementAreas.push("Trzeba szybciej nazywać blokady i domykać je właścicielem oraz terminem.");
  }
  if (signals.avgFillerRate > 10 || signals.avgWpm > 190) {
    improvementAreas.push("Tempo i sposób wypowiadania się można jeszcze uprościć, żeby przekaz był bardziej czytelny.");
  }
  if ((signals.participantInsights.length <= 1 || signals.dominantTalkRatio >= 0.85) && signals.participantInsights.length > 0) {
    improvementAreas.push("Warto częściej oddawać głos i sprawdzać reakcję drugiej strony.");
  }
  if (!signals.decisions.length && cleanText(context.summary)) {
    improvementAreas.push("Na końcu rozmowy powinno padać krótkie podsumowanie: co ustalono, co dalej i kto to prowadzi.");
  }
  return uniqueTexts(improvementAreas, [], 3);
}

function buildPerceptionNotes(signals: ReturnType<typeof getTranscriptSignals>): string[] {
  const notes: string[] = [];
  if (signals.avgFillerRate > 10 || signals.avgWpm > 190) {
    notes.push("Możesz być odbierany jako ktoś, kto mówi szybko i czasem zostawia za mało przestrzeni na odpowiedź.");
  } else {
    notes.push("Możesz być odbierany jako osoba konkretna i rzeczowa.");
  }

  if (signals.actionCount > 0 || signals.decisions.length > 0) {
    notes.push("Dajesz wrażenie osoby nastawionej na domykanie spraw i szukanie praktycznego efektu.");
  } else {
    notes.push("Możesz brzmieć bardziej jak ktoś, kto analizuje temat niż go domyka.");
  }

  if (signals.tensions.length > 0) {
    notes.push("Przy sporach warto bardziej pokazywać, że słuchasz i doprecyzowujesz stanowiska.");
  } else if (signals.participantInsights.length > 1) {
    notes.push("Możesz być odbierany jako partner do rozmowy, jeśli częściej podsumowujesz cudze wypowiedzi.");
  }

  return uniqueTexts(notes, [], 3);
}

function buildCommunicationTips(signals: ReturnType<typeof getTranscriptSignals>): string[] {
  const tips: string[] = [
    "Na początku spotkania powiedz jednym zdaniem, jaki efekt ma dać rozmowa.",
    "Po każdym ważnym ustaleniu dopowiadaj: właściciel, termin, następny krok.",
  ];

  if (signals.avgFillerRate > 10 || signals.avgWpm > 190) {
    tips.push("Skracaj wstępy i rób pauzę po kluczowej myśli, zamiast dopowiadać kolejne zdania.");
  } else {
    tips.push("Przed przejściem do następnego tematu zamknij poprzedni jednym zdaniem podsumowania.");
  }

  if (signals.participantInsights.length > 1) {
    tips.push("Zostaw więcej miejsca na reakcję: pytanie, cisza, odpowiedź, dopiero potem kolejny krok.");
  } else {
    tips.push("Zamiast rozwijać wątek od razu, dopytaj o jeden konkretny punkt i podsumuj go na głos.");
  }

  return uniqueTexts(tips, [], 3);
}

function buildNextSteps(context: MeetingFeedbackContext, signals: ReturnType<typeof getTranscriptSignals>): string[] {
  const nextSteps: string[] = [];
  if (signals.decisions.length > 0) {
    nextSteps.push("Spisz decyzje w formacie: co, kto, do kiedy.");
  }
  if (signals.actionCount > 0) {
    nextSteps.push("Przed kolejnym spotkaniem sprawdź status otwartych zadań i blokad.");
  }
  if (signals.avgFillerRate > 10 || signals.avgWpm > 190) {
    nextSteps.push("Przećwicz krótsze odpowiedzi i wolniejsze domykanie najważniejszych punktów.");
  } else {
    nextSteps.push("Na następnym spotkaniu użyj krótkiego podsumowania po każdym bloku tematycznym.");
  }
  if (!signals.decisions.length) {
    nextSteps.push("Na koniec rozmowy zrób 20-sekundowy recapping: decyzje, właściciele, terminy.");
  } else if (cleanText(context.meetingTitle)) {
    nextSteps.push(`Przygotuj krótką agendę do spotkania "${context.meetingTitle}" z jednym jasnym celem.`);
  }
  return uniqueTexts(nextSteps, [], 3);
}

function buildWhatWentWell(context: MeetingFeedbackContext, signals: ReturnType<typeof getTranscriptSignals>): string[] {
  const items: string[] = [];
  if (signals.decisions.length > 0) items.push("Rozmowa prowadziła do konkretnych ustaleń.");
  if (signals.actionCount > 1) items.push("Wynik spotkania można łatwo przełożyć na zadania.");
  if (signals.participantInsights.length > 1) items.push("W spotkaniu było miejsce na kilka perspektyw.");
  if (!signals.tensions.length) items.push("Atmosfera była raczej spokojna i współpracująca.");
  if (!items.length && cleanText(context.summary)) items.push("Dało się uchwycić główny temat rozmowy.");
  return uniqueTexts(items, [], 3);
}

function buildWhatCouldBeBetter(context: MeetingFeedbackContext, signals: ReturnType<typeof getTranscriptSignals>): string[] {
  const items: string[] = [];
  if (signals.actionCount === 0) items.push("Brakuje mocniejszego przejścia od rozmowy do konkretnego działania.");
  if (signals.avgFillerRate > 10 || signals.avgWpm > 190) items.push("Wypowiedzi można skrócić i uprościć, żeby były bardziej czytelne.");
  if (signals.dominantTalkRatio >= 0.85) items.push("Warto częściej oddawać głos drugiej stronie.");
  if (signals.tensions.length > 0 || signals.blockers.length > 0) items.push("Trzeba szybciej domykać sporne lub blokujące wątki.");
  if (!signals.decisions.length) items.push("Na końcu rozmowy powinno paść krótkie podsumowanie decyzji i właścicieli.");
  if (!items.length && cleanText(context.summary)) items.push("Można jeszcze bardziej wyostrzyć cel spotkania i kończyć każdy temat decyzją.");
  return uniqueTexts(items, [], 3);
}

export function buildMeetingFeedbackFallback(context: MeetingFeedbackContext): MeetingFeedback {
  const signals = getTranscriptSignals(context);
  const categoryScores = makeCategoryScores(context);
  const overallScore = clampScore(
    Math.round(avg(categoryScores.map((item) => item.score)) + (signals.hasEnoughData ? 0 : -1)),
    7
  );
  const sparseContext = !signals.hasEnoughData || signals.transcriptLength < 4;

  const strengths = buildStrengths(context, signals);
  const improvementAreas = buildImprovementAreas(context, signals);
  const perceptionNotes = buildPerceptionNotes(signals);
  const communicationTips = buildCommunicationTips(signals);
  const nextSteps = buildNextSteps(context, signals);
  const whatWentWell = buildWhatWentWell(context, signals);
  const whatCouldBeBetter = buildWhatCouldBeBetter(context, signals);

  const bestCategory = [...categoryScores].sort((a, b) => b.score - a.score)[0];
  const worstCategory = [...categoryScores].sort((a, b) => a.score - b.score)[0];
  const summary = sparseContext
    ? "Za mało danych, żeby ocenić dokładniej. Na podstawie dostępnych sygnałów widać jednak obszary do poprawy i kilka praktycznych wskazówek."
    : `${bestCategory?.label || "Spotkanie"} wypadło najlepiej, a największy potencjał poprawy widać w obszarze ${worstCategory?.label?.toLowerCase() || "prowadzenia rozmowy"}.`;

  return {
    overallScore,
    summary,
    strengths: strengths.length ? strengths : ["Spotkanie dostarczyło wystarczająco sygnałów, żeby wyciągnąć praktyczne wnioski."],
    improvementAreas: improvementAreas.length ? improvementAreas : ["Warto jeszcze mocniej dopracować prowadzenie i domykanie rozmowy."],
    perceptionNotes,
    communicationTips,
    nextSteps,
    whatWentWell: whatWentWell.length ? whatWentWell : strengths,
    whatCouldBeBetter: whatCouldBeBetter.length ? whatCouldBeBetter : improvementAreas,
    categoryScores,
  };
}

export function normalizeMeetingFeedback(rawFeedback: unknown, context: MeetingFeedbackContext): MeetingFeedback {
  const fallback = buildMeetingFeedbackFallback(context);

  if (!rawFeedback || typeof rawFeedback !== "object") {
    return fallback;
  }

  const raw = rawFeedback as Partial<MeetingFeedback> & { categoryScores?: Partial<MeetingFeedbackCategoryScore>[] };
  const categoryMap = new Map<string, Partial<MeetingFeedbackCategoryScore>>();
  safeArray(raw.categoryScores).forEach((item) => {
    const key = cleanText(item?.key).toLowerCase();
    const label = cleanText(item?.label).toLowerCase();
    if (key) categoryMap.set(key, item);
    if (label) categoryMap.set(label, item);
  });

  const categoryScores = MEETING_FEEDBACK_CATEGORIES.map((category, index) => {
    const rawItem = categoryMap.get(category.key) || categoryMap.get(category.label.toLowerCase());
    const fallbackItem = fallback.categoryScores[index];
    return {
      key: category.key,
      label: category.label,
      score: clampScore(rawItem?.score ?? fallbackItem.score, fallbackItem.score),
      observation: cleanText(rawItem?.observation) || fallbackItem.observation,
      improvementTip: cleanText(rawItem?.improvementTip) || fallbackItem.improvementTip,
    };
  });

  return {
    overallScore: clampScore(raw.overallScore ?? fallback.overallScore, fallback.overallScore),
    summary: cleanText(raw.summary) || fallback.summary,
    strengths: uniqueTexts(raw.strengths || [], fallback.strengths, 3),
    improvementAreas: uniqueTexts(raw.improvementAreas || [], fallback.improvementAreas, 3),
    perceptionNotes: uniqueTexts(raw.perceptionNotes || [], fallback.perceptionNotes, 3),
    communicationTips: uniqueTexts(raw.communicationTips || [], fallback.communicationTips, 3),
    nextSteps: uniqueTexts(raw.nextSteps || [], fallback.nextSteps, 3),
    whatWentWell: uniqueTexts(raw.whatWentWell || [], fallback.whatWentWell, 3),
    whatCouldBeBetter: uniqueTexts(raw.whatCouldBeBetter || [], fallback.whatCouldBeBetter, 3),
    categoryScores,
  };
}

export function buildMeetingFeedbackSchemaExample(): MeetingFeedback {
  return {
    overallScore: 8,
    summary: "Krótki, rozwojowy komentarz o całym spotkaniu.",
    strengths: ["Mocna strona 1", "Mocna strona 2", "Mocna strona 3"],
    improvementAreas: ["Obszar do poprawy 1", "Obszar do poprawy 2", "Obszar do poprawy 3"],
    perceptionNotes: ["Jak możesz być odbierany 1", "Jak możesz być odbierany 2", "Jak możesz być odbierany 3"],
    communicationTips: ["Wskazówka 1", "Wskazówka 2", "Wskazówka 3"],
    nextSteps: ["Krok 1", "Krok 2", "Krok 3"],
    whatWentWell: ["Co poszło dobrze 1", "Co poszło dobrze 2", "Co poszło dobrze 3"],
    whatCouldBeBetter: ["Co można poprawić 1", "Co można poprawić 2", "Co można poprawić 3"],
    categoryScores: MEETING_FEEDBACK_CATEGORIES.map((category) => ({
      key: category.key,
      label: category.label,
      score: 8,
      observation: "Krótka obserwacja dla tej kategorii.",
      improvementTip: "Jedna praktyczna wskazówka na następne spotkanie.",
    })),
  };
}
