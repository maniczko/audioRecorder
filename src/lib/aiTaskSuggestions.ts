const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Import lazily to avoid circular deps
let _apiRequest: ((path: string, opts?: any) => Promise<any>) | null = null;
async function getApiRequest() {
  if (!_apiRequest) {
    const mod = await import("../services/httpClient");
    _apiRequest = mod.apiRequest;
  }
  return _apiRequest;
}

export async function suggestTasksFromTranscript(transcript, people = []) {
  // Prefer server-side proxy (keeps API key out of browser bundle)
  if (API_BASE_URL) {
    try {
      const apiRequest = await getApiRequest();
      const result = await apiRequest("/ai/suggest-tasks", {
        method: "POST",
        body: { transcript, people },
      });
      return Array.isArray(result?.tasks) ? result.tasks : [];
    } catch (err) {
      console.error("Server suggest-tasks failed:", err);
      return [];
    }
  }

  // Local demo mode fallback: call Anthropic directly if env key is present
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    return [];
  }

  const transcriptText = (Array.isArray(transcript) ? transcript : [])
    .map(
      (segment) =>
        `[${segment.speakerName || `Speaker ${Number(segment.speakerId || 0) + 1}`}]: ${segment.text || ""}`
    )
    .join("\n");

  if (!transcriptText.trim()) {
    return [];
  }

  const peopleList = (Array.isArray(people) ? people : [])
    .map((p) => p.name || p.email || "")
    .filter(Boolean)
    .join(", ");

  const systemPrompt =
    "Jestes asystentem spotkaniowym. Analizujesz transkrypcje spotkan i wyodrebniasz z nich konkretne zadania do wykonania. Odpowiadasz WYLACZNIE prawidlowym JSONem bez zadnego dodatkowego tekstu, bez markdown, bez komentarzy.";

  const userPrompt = `${peopleList ? `Uczestnicy spotkania: ${peopleList}\n\n` : ""}Transkrypcja:\n${transcriptText}\n\nWygeneruj JSON z lista zadan ktore jasno wynikaja z tej transkrypcji (decyzje, zobowiazania, follow-upy). Format:\n{\n  "tasks": [\n    {\n      "title": "krotki tytul zadania (max 80 znakow)",\n      "description": "szczegolowy opis co trzeba zrobic",\n      "owner": "imie osoby z transkryptu lub null jezeli nie wspomniano",\n      "dueDate": "YYYY-MM-DD lub null jezeli brak terminu",\n      "priority": "high|medium|low",\n      "tags": ["tag1", "tag2"]\n    }\n  ]\n}\n\nZasady:\n- Tylko zadania ktore jasno wynikaja z transkrypcji\n- Priorytet high = pilne/wazne sygnaly jezykowe\n- Maksymalnie 10 zadan\n- Odpowiedz WYLACZNIE JSONem`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Anthropic API error ${response.status}: ${errorBody.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = (data.content || []).find((block) => block.type === "text")?.text || "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Brak JSON w odpowiedzi");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return Array.isArray(parsed.tasks) ? parsed.tasks : [];
  } catch (error) {
    console.error("Blad parsowania odpowiedzi AI:", error, text);
    return [];
  }
}
