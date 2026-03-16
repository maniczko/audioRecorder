const API_KEY = process.env.REACT_APP_ANTHROPIC_API_KEY;
const MODEL = process.env.REACT_APP_ANTHROPIC_MODEL || "claude-3-5-haiku-latest";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function transcriptText(segments, speakerNames) {
  return safeArray(segments)
    .map((segment) => {
      const speaker = speakerNames?.[String(segment.speakerId)] || `Speaker ${segment.speakerId + 1}`;
      return `[${Math.round(segment.timestamp)}s] ${speaker}: ${segment.text}`;
    })
    .join("\n");
}

function findRelevantSegments(segments, term) {
  const normalizedTerm = String(term || "").toLowerCase();
  const keywords = normalizedTerm.split(/\s+/).filter((item) => item.length > 2);

  return safeArray(segments).filter((segment) => {
    const haystack = String(segment.text || "").toLowerCase();
    return keywords.some((keyword) => haystack.includes(keyword));
  });
}

function dedupeList(items) {
  return [...new Set(safeArray(items).map((item) => String(item || "").trim()).filter(Boolean))];
}

function normalizeTask(task, index, speakerNames) {
  if (!task) {
    return null;
  }

  if (typeof task === "string") {
    const match = task.match(/^([^:]{2,40}):\s*(.+)$/);
    return {
      id: `task_${index}`,
      title: match ? match[2].trim() : task.trim(),
      owner: match ? match[1].trim() : "Nieprzypisane",
      sourceQuote: task.trim(),
      priority: /pilne|asap|natychmiast|krytyczne/i.test(task) ? "high" : "medium",
      tags: [],
    };
  }

  const title = String(task.title || task.text || "").trim();
  if (!title) {
    return null;
  }

  const owner = String(task.owner || task.assignee || "").trim();
  return {
    id: task.id || `task_${index}`,
    title,
    owner:
      owner ||
      speakerNames?.[String(task.speakerId)] ||
      "Nieprzypisane",
    sourceQuote: String(task.sourceQuote || task.quote || title).trim(),
    priority: String(task.priority || "").trim() || "medium",
    tags: Array.isArray(task.tags) ? task.tags : [],
  };
}

function buildFallbackAnalysis({ meeting, segments, speakerNames, diarization }) {
  const transcript = safeArray(segments);
  const importantPhrases = transcript
    .map((segment) => segment.text)
    .join(" ")
    .split(/[.!?]/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 24);

  const summarySource = importantPhrases.slice(0, 2).join(". ");
  const summary =
    summarySource ||
    "Nagranie jest zapisane, ale potrzeba wiecej tresci, aby przygotowac pelne podsumowanie.";

  const decisions = dedupeList(
    transcript
      .filter((segment) => /decyz|ustal|termin|budzet|plan|wybieramy|zatwierdz/i.test(segment.text))
      .map((segment) => segment.text)
  ).slice(0, 4);

  const actionItems = dedupeList(
    transcript
      .filter((segment) => /trzeba|nalezy|zrob|przygot|wyslij|sprawdz|umow|follow up|next step/i.test(segment.text))
      .map((segment) => {
        const speaker = speakerNames?.[String(segment.speakerId)] || `Speaker ${segment.speakerId + 1}`;
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
        ? matches.map((segment) => segment.text).join(" ")
        : "Nie znalazlem jednoznacznej odpowiedzi w transkrypcji. Warto sprawdzic recznie.",
    };
  });

  return {
    mode: API_KEY ? "fallback-after-api-error" : "local-fallback",
    speakerLabels: speakerNames,
    speakerCount: diarization?.speakerCount || new Set(transcript.map((segment) => segment.speakerId)).size,
    summary,
    decisions,
    actionItems,
    tasks,
    followUps: dedupeList(
      safeArray(meeting?.desiredOutputs).map(
        (item) => `Zweryfikuj po spotkaniu: ${item}`
      )
    ).slice(0, 4),
    answersToNeeds,
  };
}

function buildFallbackPsychProfile({ personName, allSegments }) {
  const texts = allSegments.map((s) => String(s.text || ""));
  const joined = texts.join(" ").toLowerCase();
  const total = allSegments.length || 1;

  const assertive = (joined.match(/musimy|zdecydowal|powinniśmy|trzeba|zrobimy|decyduj/g) || []).length;
  const questions = texts.filter((t) => t.includes("?")).length;
  const emotion = (joined.match(/czuj|rozum|wspol|razem|relacj|zaufan|ważne dla|zależy mi/g) || []).length;
  const dataW = (joined.match(/dane|liczby|procent|wyniki|statystyk|analiz|raport|badani/g) || []).length;
  const longSent = texts.filter((t) => t.split(" ").length > 14).length;

  const D = Math.min(95, Math.round(35 + assertive * 7 + (total > 10 ? 5 : 0)));
  const I = Math.min(95, Math.round(30 + questions * 3 + emotion * 4));
  const S = Math.min(95, Math.round(45 + emotion * 5));
  const C = Math.min(95, Math.round(35 + dataW * 6 + longSent * 2));

  return {
    mode: "local-fallback",
    disc: { D, I, S, C },
    discStyle: "Profil heurystyczny",
    discDescription:
      "Profil wygenerowany lokalnie na podstawie sygnałów językowych. Skonfiguruj REACT_APP_ANTHROPIC_API_KEY, aby uzyskać głębszą analizę.",
    values: [],
    communicationStyle: C > 60 ? "analytical" : I > 60 ? "expressive" : S > 60 ? "diplomatic" : "direct",
    decisionStyle: C > 60 ? "data-driven" : D > 60 ? "authoritative" : S > 60 ? "consensual" : "intuitive",
    conflictStyle: S > 60 ? "collaborative" : D > 60 ? "confrontational" : "compromising",
    listeningStyle: S > 60 ? "active" : C > 60 ? "selective" : "task-focused",
    stressResponse: "Za mało danych do oceny zachowania pod presją.",
    workingWithTips: ["Skonfiguruj Anthropic API Key, aby uzyskać spersonalizowane wskazówki."],
    communicationDos: [],
    communicationDonts: [],
    redFlags: [],
    coachingNote: "",
    meetingsAnalyzed: 0,
    generatedAt: new Date().toISOString(),
  };
}

export async function analyzePersonProfile({ personName, meetings, allSegments }) {
  const fallback = buildFallbackPsychProfile({ personName, allSegments });

  if (!API_KEY || allSegments.length < 5) {
    return { ...fallback, meetingsAnalyzed: meetings.length };
  }

  const lines = allSegments
    .slice(0, 100)
    .map((s) => `[${s.meetingTitle || "Spotkanie"}] ${s.text}`)
    .join("\n");

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
  ].join("\n");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1800,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`Anthropic request failed: ${response.status}`);

    const payload = await response.json();
    const parsed = parseAiResponse(payload.content?.[0]?.text || "");

    const clamp100 = (v) => Math.min(100, Math.max(0, Number(v) || 50));

    return {
      mode: "anthropic",
      disc: {
        D: clamp100(parsed.disc?.D),
        I: clamp100(parsed.disc?.I),
        S: clamp100(parsed.disc?.S),
        C: clamp100(parsed.disc?.C),
      },
      discStyle: parsed.discStyle || "",
      discDescription: parsed.discDescription || "",
      values: safeArray(parsed.values).slice(0, 5),
      communicationStyle: parsed.communicationStyle || "direct",
      decisionStyle: parsed.decisionStyle || "intuitive",
      conflictStyle: parsed.conflictStyle || "collaborative",
      listeningStyle: parsed.listeningStyle || "active",
      stressResponse: parsed.stressResponse || "",
      workingWithTips: dedupeList(parsed.workingWithTips).slice(0, 4),
      communicationDos: dedupeList(parsed.communicationDos).slice(0, 3),
      communicationDonts: dedupeList(parsed.communicationDonts).slice(0, 3),
      redFlags: dedupeList(parsed.redFlags).slice(0, 2),
      coachingNote: parsed.coachingNote || "",
      meetingsAnalyzed: meetings.length,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Person profile analysis failed, falling back to local.", error);
    return { ...fallback, mode: "fallback-after-api-error", meetingsAnalyzed: meetings.length };
  }
}

function parseAiResponse(rawText) {
  const match = String(rawText || "").match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Brak obiektu JSON w odpowiedzi modelu.");
  }

  return JSON.parse(match[0]);
}

export async function analyzeMeeting({ meeting, segments, speakerNames, diarization }) {
  const fallback = buildFallbackAnalysis({ meeting, segments, speakerNames, diarization });

  if (!API_KEY || !segments.length) {
    return fallback;
  }

  const prompt = [
    "You are a meticulous Polish meeting analyst.",
    "Return valid JSON only.",
    "Your job:",
    "1. Rename the speakers into useful business roles when possible.",
    "2. Summarize the meeting in Polish.",
    "3. Extract decisions, action items, follow ups.",
    "4. Answer the user's explicit meeting needs.",
    "",
    `Meeting title: ${meeting.title}`,
    `Meeting context: ${meeting.context || "No extra context provided."}`,
    `Meeting needs: ${safeArray(meeting.needs).join(" | ") || "No needs specified."}`,
    `Desired outputs: ${safeArray(meeting.desiredOutputs).join(" | ") || "No desired outputs specified."}`,
    "",
    "Return JSON in this shape:",
    '{"speakerCount":2,"speakerLabels":{"0":"Host","1":"Client"},"summary":"...","decisions":["..."],"actionItems":["..."],"tasks":[{"title":"...","owner":"...","sourceQuote":"...","priority":"medium","tags":["..."]}],"followUps":["..."],"answersToNeeds":[{"need":"...","answer":"..."}]}',
    "",
    transcriptText(segments, speakerNames),
  ].join("\n");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1400,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic request failed with status ${response.status}.`);
    }

    const payload = await response.json();
    const content = payload.content?.[0]?.text || "";
    const parsed = parseAiResponse(content);

    return {
      mode: "anthropic",
      speakerLabels: parsed.speakerLabels || speakerNames,
      speakerCount: parsed.speakerCount || fallback.speakerCount,
      summary: parsed.summary || fallback.summary,
      decisions: dedupeList(parsed.decisions).slice(0, 5),
      actionItems: dedupeList(parsed.actionItems).slice(0, 6),
      tasks: safeArray(parsed.tasks)
        .map((task, index) => normalizeTask(task, index, parsed.speakerLabels || speakerNames))
        .filter(Boolean),
      followUps: dedupeList(parsed.followUps).slice(0, 5),
      answersToNeeds: safeArray(parsed.answersToNeeds).length ? parsed.answersToNeeds : fallback.answersToNeeds,
    };
  } catch (error) {
    console.error("AI meeting analysis failed, falling back to local summary.", error);
    return fallback;
  }
}
