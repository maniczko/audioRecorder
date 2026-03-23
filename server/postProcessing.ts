/**
 * postProcessing.ts
 *
 * Post-transcription pipeline: LLM correction, meeting analysis (GPT-4o-mini),
 * text embeddings, voice coaching (GPT-4o audio), acoustic feature extraction,
 * and audio normalization.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { spawn, exec } from "node:child_process";
import { config } from "./config.ts";
import { logger } from "./logger.ts";
import { matchSpeakerToProfile } from "./speakerEmbedder.ts";
import { buildMeetingFeedbackSchemaExample } from "../src/shared/meetingFeedback.ts";
import { clean } from "./audioPipeline.utils.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execPromise = promisify(exec);

// ── Config ────────────────────────────────────────────────────────────────────
const OPENAI_API_KEY = config.VOICELOG_OPENAI_API_KEY || config.OPENAI_API_KEY || "";
const OPENAI_BASE_URL = config.VOICELOG_OPENAI_BASE_URL;
const FFMPEG_BINARY = config.FFMPEG_BINARY;
const PYTHON_BINARY = config.PYTHON_BINARY;
const ACOUSTIC_FEATURES_SCRIPT = path.join(__dirname, "acoustic_features.py");
const TRANSCRIPT_CORRECTION = config.TRANSCRIPT_CORRECTION;

// ── LLM transcript correction ─────────────────────────────────────────────────

export async function correctTranscriptWithLLM(segments: any[], options: any = {}) {
  if (!TRANSCRIPT_CORRECTION && !options.transcriptCorrection) return segments;
  if (!OPENAI_API_KEY) return segments;
  const payload = segments.map((s) => ({ id: s.id, text: s.text }));
  const inputLen = payload.reduce((sum, s) => sum + (s.text?.length || 0), 0);
  const abortSignal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(60000)])
    : undefined;
  try {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: abortSignal,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: Math.min(4000, inputLen * 2 + 200),
        messages: [
          {
            role: "user",
            content: `Popraw interpunkcję i pisownię w poniższych segmentach transkrypcji. Zachowaj dokładne słowa i znaczenie. Zwróć wyłącznie tablicę JSON z polami id i text.\n\n${JSON.stringify(payload)}`,
          },
        ],
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    const corrected = JSON.parse(json.choices[0].message.content);
    const map = new Map(corrected.map((s: any) => [s.id, s.text]));
    return segments.map((s) => ({ ...s, text: map.has(s.id) ? map.get(s.id) : s.text }));
  } catch (err: any) {
    if (!options.signal?.aborted)
      console.warn(
        "[postProcessing] LLM correction failed, using original segments.",
        err.message
      );
    return segments;
  }
}

// ── Meeting analysis ──────────────────────────────────────────────────────────

/**
 * Analyze a meeting transcript using GPT-4o-mini and return structured JSON.
 */
export async function analyzeMeetingWithOpenAI({ meeting, segments, speakerNames }: any) {
  if (!OPENAI_API_KEY || !segments.length) return null;

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const transcriptText = segments
    .map((seg: any) => {
      const speaker =
        speakerNames?.[String(seg.speakerId)] || `Speaker ${(seg.speakerId || 0) + 1}`;
      return `[${fmt(seg.timestamp ?? 0)}] ${speaker}: ${seg.text}`;
    })
    .join("\n");

  const schema = JSON.stringify({
    speakerCount: 2,
    speakerLabels: { 0: "Adam", 1: "Marcin" },
    summary: "...",
    decisions: ["..."],
    actionItems: ["..."],
    tasks: [
      {
        title: "...",
        owner: "...",
        sourceQuote: "...",
        priority: "medium",
        tags: [],
      },
    ],
    followUps: ["..."],
    answersToNeeds: [{ need: "...", answer: "..." }],
    suggestedTags: ["tag1"],
    meetingType: "planning",
    energyLevel: "medium",
    risks: [{ risk: "...", severity: "high" }],
    blockers: ["..."],
    participantInsights: [
      {
        speaker: "Adam",
        mainTopic: "...",
        stance: "proactive",
        talkRatio: 0.6,
        personality: { D: 70, I: 50, S: 40, C: 80 },
        needs: ["..."],
        concerns: ["..."],
        sentimentScore: 85,
        discStyle: "DC — dominujący analityk",
        discDescription:
          "Adam koncentruje się na wynikach i analizie, działając szybko i metodycznie.",
        communicationStyle: "analytical",
        decisionStyle: "data-driven",
        stressResponse: "Staje się bardziej dyrektywny i zamknięty na inne opinie.",
        workingWithTips: [
          "Przedstawiaj fakty i dane",
          "Dawaj czas na analizę",
          "Unikaj emocjonalnych argumentów",
        ],
        meetingRole: "ekspert",
        keyMoment: "...",
      },
    ],
    tensions: [{ topic: "...", between: ["A", "B"], resolved: false }],
    keyQuotes: [{ quote: "...", speaker: "Adam", why: "..." }],
    suggestedAgenda: ["..."],
    feedback: buildMeetingFeedbackSchemaExample(),
  });

  const prompt = [
    "Jesteś analitykiem spotkań biznesowych. Analizuj transkrypt i zwróć JSON.",
    "Return valid JSON only — no prose outside the JSON object.",
    "BARDZO WAŻNE: Twoim krytycznym zadaniem jest przypisywanie zadań (Action Items / Tasks) konkretnym mówcom. Właściwość 'owner' w tablicy 'tasks' MUSI zawierać dokładne imię (speakerLabels) osoby, która podjęła się zadania w transkryptach, zamiast ogólników.",
    "ZADANIE A: Zidentyfikuj i uzupełnij prawdziwe imiona we właściwości 'speakerLabels' (np. gdy ktoś mówi 'Cześć Adam', zamień 'Speaker 1' na 'Adam') i używaj tylko tych konkretnych imion wokół całego pliku (szczególnie klucza 'owner' przy zadaniach).",
    "ZADANIE B: Dla każdej rozpoznanej osoby w sekcji 'participantInsights' wypełnij obiekt 'personality' oszacowując od 0 do 100 psychologię DISC.",
    "ZADANIE C: Dla każdej osoby oszacuj jej 'sentimentScore' od 1 (niedostępny/zły/wycofany/zimny) do 100 (gorący/entuzjastyczny/bardzo zaangażowany w relację).",
    "ZADANIE D: Dla każdej osoby wypełnij: discStyle (krótka etykieta stylu DISC po polsku, np. 'DC — dominujący analityk'), discDescription (1-2 zdania opisujące dominujący styl), communicationStyle (analytical/expressive/diplomatic/direct), decisionStyle (data-driven/intuitive/consensual/authoritative), stressResponse (jak zachowuje się pod presją, po polsku), workingWithTips (tablica 2-3 praktycznych wskazówek po polsku), meetingRole (lider/ekspert/mediator/sceptyk/wykonawca) oraz keyMoment (dosłowny cytat najważniejszej wypowiedzi tej osoby z transkryptu).",
    "",
    `Tytuł spotkania: ${meeting?.title || "Nieznany"}`,
    `Kontekst: ${meeting?.context || "Brak"}`,
    `Potrzeby: ${Array.isArray(meeting?.needs) ? meeting.needs.join(" | ") : meeting?.needs || "Brak"}`,
    "",
    "Zwróć JSON w tym formacie (wszystkie pola w języku polskim):",
    schema,
    "",
    "Transkrypt:",
    transcriptText,
  ].join("\n");

  const startAnalyze = performance.now();
  const reqId = meeting?.requestId || "internal-analysis";

  try {
    const resp = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4000,
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) throw new Error(`OpenAI analyze HTTP ${resp.status}`);
    const json = await resp.json();
    const content = json.choices?.[0]?.message?.content || "{}";

    logger.info(`[Metrics] LLM Meeting Analysis Complete`, {
      requestId: reqId,
      durationMs: (performance.now() - startAnalyze).toFixed(2),
      transcriptLength: transcriptText.length,
    });

    return JSON.parse(content);
  } catch (err: any) {
    console.warn("[postProcessing] analyzeMeetingWithOpenAI failed:", err.message);
    return null;
  }
}

// ── Text embeddings ───────────────────────────────────────────────────────────

export async function embedTextChunks(texts: string[]) {
  if (!OPENAI_API_KEY || !texts.length) return [];
  try {
    const res = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: texts,
      }),
    });
    if (!res.ok) throw new Error("Embeddings API error");
    const json = await res.json();
    return json.data.map((d: any) => d.embedding);
  } catch (err) {
    console.error("embedTextChunks failed:", err);
    return [];
  }
}

// ── Speaker audio clip extraction ─────────────────────────────────────────────

export async function extractSpeakerAudioClip(
  asset: any,
  speakerId: string | number,
  segments: any[],
  options: any = {}
) {
  const validSegs = segments
    .filter((s: any) => {
      if (String(s.speakerId) !== String(speakerId)) return false;
      const t = Number(s.timestamp ?? s.start ?? NaN);
      const e = Number(s.endTimestamp ?? s.end ?? NaN);
      return Number.isFinite(t) && Number.isFinite(e) && e > t && t >= 0;
    })
    .slice(0, 15);

  if (!validSegs.length) throw new Error("Brak segmentów z poprawnymi znacznikami czasu.");

  const clipPath = path.join(
    path.dirname(asset.file_path),
    `speaker_${asset.id}_${String(speakerId).replace(/[^a-zA-Z0-9_-]/g, "")}_${crypto.randomUUID().slice(0, 8)}.wav`
  );

  const selectFilter = validSegs
    .map(
      (s: any) =>
        `between(t,${Number(s.timestamp ?? s.start).toFixed(3)},${Number(s.endTimestamp ?? s.end).toFixed(3)})`
    )
    .join("+");

  await execPromise(
    `"${FFMPEG_BINARY}" -y -i "${asset.file_path}" -af "aselect='${selectFilter}',asetpts=N/SR/TB" -t 60 -ar 16000 -ac 1 "${clipPath}"`,
    { timeout: 30000, signal: options.signal }
  );

  return clipPath;
}

// ── Voice coaching ────────────────────────────────────────────────────────────

export async function generateVoiceCoaching(
  asset: any,
  speakerId: any,
  segments: any[],
  options: any = {}
) {
  if (!OPENAI_API_KEY) throw new Error("Brak klucza OpenAI API.");

  const clipPath = await extractSpeakerAudioClip(asset, speakerId, segments, options);

  try {
    const audioBase64 = fs.readFileSync(clipPath).toString("base64");

    const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-audio-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "input_audio",
                input_audio: { data: audioBase64, format: "wav" },
              },
              {
                type: "text",
                text: [
                  "Przeanalizuj mowę tej osoby dokładnie — bazując wyłącznie na dźwięku, nie na tekście.",
                  "Oceń poniższe aspekty i daj konkretne, praktyczne wskazówki do poprawy:",
                  "1. Ton głosu i emocje (pewność siebie, energia, monotonia, zaangażowanie).",
                  "2. Tempo mówienia i rytm (za szybko, za wolno, dobre zmiany tempa).",
                  "3. Wymowa polskich głosek (sz/cz/rz, miękkie spółgłoski, akcent wyrazowy).",
                  "4. Pauzy — czy naturalne i budują napięcie, czy wynikają z niepewności.",
                  "5. Wypełniacze głosowe (ee, yyy, yyy, znaczy) — częstotliwość i jak je redukować.",
                  "6. Dykcja i wyrazistość — czy słowa są wyraźne i zrozumiałe.",
                  "Odpowiedź po polsku, ok. 200–300 słów. Zacznij bezpośrednio od oceny.",
                ].join(" "),
              },
            ],
          },
        ],
        max_tokens: 700,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`OpenAI API ${res.status}: ${errText.slice(0, 120)}`);
    }

    const json = await res.json();
    const coaching = String(json.choices?.[0]?.message?.content || "").trim();
    if (!coaching) throw new Error("Pusta odpowiedź z modelu audio.");
    return coaching;
  } finally {
    try {
      fs.unlinkSync(clipPath);
    } catch (_) {}
  }
}

// ── Acoustic feature extraction ───────────────────────────────────────────────

export async function analyzeAcousticFeatures(filePath: string, options: any = {}) {
  if (!fs.existsSync(filePath)) {
    throw new Error("Plik audio nie istnieje.");
  }
  if (!fs.existsSync(ACOUSTIC_FEATURES_SCRIPT)) {
    throw new Error("Brak skryptu acoustic_features.py.");
  }

  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_BINARY, [ACOUSTIC_FEATURES_SCRIPT, filePath], {
      signal: options.signal,
      timeout: 120000,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (data) => {
      stdout += data;
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (data) => {
      stderr += data;
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            stderr.trim() || `acoustic_features.py exited with status ${code}`
          )
        );
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim() || "{}");
        if (parsed?.error) {
          reject(new Error(String(parsed.error)));
          return;
        }
        resolve(parsed);
      } catch (error: any) {
        reject(
          new Error(
            `Nie udalo sie sparsowac metryk akustycznych: ${error.message}`
          )
        );
      }
    });
  });
}

// ── Audio normalization ───────────────────────────────────────────────────────

export async function normalizeRecording(filePath: string, options: any = {}) {
  const tmpPath = `${filePath}.norm.tmp`;
  try {
    await execPromise(
      `"${FFMPEG_BINARY}" -y -i "${filePath}" -af "highpass=f=80,afftdn,loudnorm=I=-16:TP=-1.5:LRA=11" "${tmpPath}"`,
      { timeout: 120000, signal: options.signal }
    );
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try {
      fs.unlinkSync(tmpPath);
    } catch (_) {}
    throw err;
  }
}

// Re-export for use by pipeline.ts
export { matchSpeakerToProfile };
