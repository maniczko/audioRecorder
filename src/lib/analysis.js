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
