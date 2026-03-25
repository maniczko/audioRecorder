/**
 * diarization.ts
 *
 * Speaker diarization: pyannote.audio (Python subprocess), Silero VAD,
 * GPT-4o-mini text-based diarization, word-level speaker splitting,
 * and per-speaker loudness normalization.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { spawn, exec } from 'node:child_process';
import { config } from './config.ts';
import { clean, tokenize, normalizeSpeakerLabel } from './audioPipeline.utils.ts';
import { getUploadDir } from './transcription.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execPromise = promisify(exec);

// ── Config ────────────────────────────────────────────────────────────────────
const OPENAI_API_KEY = config.VOICELOG_OPENAI_API_KEY || config.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = config.VOICELOG_OPENAI_BASE_URL;
const HF_TOKEN = config.HF_TOKEN || config.HUGGINGFACE_TOKEN || '';
const PYTHON_BINARY = config.PYTHON_BINARY;
const FFMPEG_BINARY = config.FFMPEG_BINARY;
const DIARIZE_SCRIPT = path.join(__dirname, 'diarize.py');
export const VOICELOG_DIARIZER = config.VOICELOG_DIARIZER || 'auto';
export const HF_TOKEN_SET = Boolean(HF_TOKEN);
const DEBUG = process.env.VOICELOG_DEBUG === 'true';

// ── Pyannote diarization cache ────────────────────────────────────────────────

const PYANNOTE_CACHE_VERSION = 'v1';
const PYANNOTE_MODEL_VERSION = 'pyannote/speaker-diarization-3.1';

function getPyannoteCacheDir() {
  return path.join(getUploadDir(), '.cache', 'pyannote');
}

function buildPyannoteCacheKey(audioPath: string) {
  const stats = fs.statSync(audioPath);
  const parts = [
    PYANNOTE_CACHE_VERSION,
    PYANNOTE_MODEL_VERSION,
    clean(audioPath),
    String(stats.mtimeMs),
    String(stats.size),
  ];
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

function getPyannoteCachePath(cacheKey: string) {
  return path.join(getPyannoteCacheDir(), `${cacheKey}.json`);
}

function loadPyannoteFromCache(cacheKey: string) {
  const cachePath = getPyannoteCachePath(cacheKey);
  if (!fs.existsSync(cachePath)) return null;
  try {
    const data = fs.readFileSync(cachePath, 'utf8');
    const parsed = JSON.parse(data);
    console.log(`[diarization] Loaded pyannote result from cache: ${cacheKey.slice(0, 12)}`);
    return parsed;
  } catch (e: any) {
    console.warn('[diarization] Pyannote cache read failed:', e.message);
    return null;
  }
}

function savePyannoteToCache(cacheKey: string, result: any[]) {
  try {
    const cacheDir = getPyannoteCacheDir();
    fs.mkdirSync(cacheDir, { recursive: true });
    const cachePath = getPyannoteCachePath(cacheKey);
    fs.writeFileSync(cachePath, JSON.stringify(result, null, 2));
    console.log(`[diarization] Saved pyannote result to cache: ${cacheKey.slice(0, 12)}`);
  } catch (e: any) {
    console.warn('[diarization] Pyannote cache write failed:', e.message);
  }
}

// ── Pyannote diarization ──────────────────────────────────────────────────────

/**
 * Runs pyannote.audio speaker diarization via Python subprocess.
 * Returns [{speaker, start, end}] or null if unavailable/failed.
 */
export async function runPyannoteDiarization(audioPath: string, signal: any) {
  if (!HF_TOKEN) return null;
  if (!fs.existsSync(DIARIZE_SCRIPT)) {
    console.warn('[diarization] diarize.py not found, skipping pyannote.');
    return null;
  }
  if (!fs.existsSync(audioPath)) {
    console.warn('[diarization] Audio file not found:', audioPath);
    return null;
  }

  // Check cache first
  const cacheKey = buildPyannoteCacheKey(audioPath);
  const cached = loadPyannoteFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  console.log(
    '[diarization] Running pyannote diarization (may download ~1GB model on first run)...'
  );

  return new Promise((resolve) => {
    const child = spawn(PYTHON_BINARY, [DIARIZE_SCRIPT, audioPath, HF_TOKEN], {
      signal,
      timeout: 600000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (data) => {
      stdout += data;
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (data) => {
      stderr += data;
    });

    child.on('error', (error: any) => {
      console.warn('[diarization] pyannote spawn error:', error.message);
      resolve(null);
    });

    child.on('close', (code) => {
      if (code !== 0 && (!signal || !signal.aborted)) {
        console.warn('[diarization] pyannote exited with status', code, stderr.slice(0, 400));
        resolve(null);
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed?.error) {
          console.warn('[diarization] pyannote returned error:', parsed.error);
          resolve(null);
          return;
        }
        if (!Array.isArray(parsed) || !parsed.length) return resolve(null);
        const speakers = [...new Set(parsed.map((s) => s.speaker))];
        console.log(
          `[diarization] pyannote: ${parsed.length} segments, ${speakers.length} speakers: ${speakers.join(', ')}`
        );
        // Save to cache
        savePyannoteToCache(cacheKey, parsed);
        resolve(parsed);
      } catch (e: any) {
        console.warn('[diarization] pyannote JSON parse failed:', e.message, stdout.slice(0, 200));
        resolve(null);
      }
    });
  });
}

// ── Pyannote / Whisper merging ────────────────────────────────────────────────

/**
 * Merges pyannote speaker assignments [{speaker, start, end}] with Whisper text segments.
 * For each Whisper segment, assigns the pyannote speaker with the greatest time overlap.
 */
export function mergeWithPyannote(pyannoteSegments: any[], whisperSegments: any[]) {
  const speakerOrder = new Map();
  const speakerNames: Record<string, string> = {};

  const segments = whisperSegments
    .map((wseg) => {
      const wStart = Number(wseg.start ?? 0);
      const wEnd = Number(wseg.end ?? wStart);
      const text = clean(wseg.text || wseg.transcript || '');
      if (!text) return null;

      let bestSpeaker: string | null = null;
      let bestOverlap = 0;
      for (const pseg of pyannoteSegments) {
        const overlap = Math.max(0, Math.min(wEnd, pseg.end) - Math.max(wStart, pseg.start));
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestSpeaker = pseg.speaker;
        }
      }
      const rawSpeakerLabel = bestSpeaker || 'speaker_unknown';

      if (!speakerOrder.has(rawSpeakerLabel)) {
        const nextId = speakerOrder.size;
        speakerOrder.set(rawSpeakerLabel, nextId);
        speakerNames[String(nextId)] = normalizeSpeakerLabel(rawSpeakerLabel, nextId);
      }

      const speakerId = speakerOrder.get(rawSpeakerLabel);
      const estimatedDuration = Math.max(1.5, tokenize(text).length * 0.42);
      const endTimestamp = wEnd > wStart ? wEnd : wStart + estimatedDuration;

      return {
        id: `seg_${crypto.randomUUID().replace(/-/g, '')}`,
        text,
        timestamp: wStart,
        endTimestamp,
        speakerId,
        rawSpeakerLabel,
      };
    })
    .filter(Boolean);

  return {
    segments,
    speakerNames,
    speakerCount: Object.keys(speakerNames).length,
    text: segments.map((s) => s!.text).join(' '),
  };
}

/**
 * Finds the pyannote speaker for a given timestamp.
 */
export function findPyannoteSpeakerAt(timestamp: number, pyannoteSegments: any[]): string {
  for (const pseg of pyannoteSegments) {
    if (timestamp >= pseg.start && timestamp < pseg.end) return pseg.speaker;
  }
  let nearest: string | null = null;
  let nearestDist = Infinity;
  for (const pseg of pyannoteSegments) {
    const dist = Math.min(Math.abs(timestamp - pseg.start), Math.abs(timestamp - pseg.end));
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = pseg.speaker;
    }
  }
  return nearest || 'speaker_unknown';
}

/**
 * Word-level pyannote diarization: each word is assigned to a pyannote speaker,
 * and Whisper segments are split at speaker boundaries.
 * Returns null if no word timestamps are available.
 */
export function splitSegmentsByWordSpeaker(whisperRawSegments: any[], pyannoteSegments: any[]) {
  const hasWords = whisperRawSegments.some(
    (seg) => Array.isArray(seg.words) && seg.words.length > 0
  );
  if (!hasWords) return null;

  const speakerOrder = new Map<string, number>();
  const speakerNames: Record<string, string> = {};
  const resultSegments: any[] = [];

  function getSpeakerId(rawLabel: string): number {
    if (!speakerOrder.has(rawLabel)) {
      const nextId = speakerOrder.size;
      speakerOrder.set(rawLabel, nextId);
      speakerNames[String(nextId)] = normalizeSpeakerLabel(rawLabel, nextId);
    }
    return speakerOrder.get(rawLabel)!;
  }

  for (const wseg of whisperRawSegments) {
    const segText = clean(wseg.text || '');
    if (!segText) continue;
    const words: any[] = Array.isArray(wseg.words) ? wseg.words : [];

    if (!words.length) {
      const midpoint = (Number(wseg.start ?? 0) + Number(wseg.end ?? 0)) / 2;
      const rawLabel = findPyannoteSpeakerAt(midpoint, pyannoteSegments);
      resultSegments.push({
        id: `seg_${crypto.randomUUID().replace(/-/g, '')}`,
        text: segText,
        timestamp: Number(wseg.start ?? 0),
        endTimestamp: Number(wseg.end ?? wseg.start ?? 0),
        speakerId: getSpeakerId(rawLabel),
        rawSpeakerLabel: rawLabel,
      });
      continue;
    }

    let groupWords: any[] = [];
    let groupSpeaker: string | null = null;

    const flushGroup = () => {
      if (!groupWords.length || !groupSpeaker) return;
      const gText = groupWords
        .map((w) => w.word || '')
        .join('')
        .trim();
      if (!gText) return;
      const gStart = Number(groupWords[0].start ?? 0);
      const gEnd = Number(groupWords[groupWords.length - 1].end ?? gStart);
      resultSegments.push({
        id: `seg_${crypto.randomUUID().replace(/-/g, '')}`,
        text: gText,
        timestamp: gStart,
        endTimestamp:
          gEnd > gStart ? gEnd : gStart + Math.max(0.5, gText.split(/\s+/).length * 0.3),
        speakerId: getSpeakerId(groupSpeaker),
        rawSpeakerLabel: groupSpeaker,
        words: groupWords.map((w) => ({
          word: w.word || '',
          start: Number(w.start ?? 0),
          end: Number(w.end ?? 0),
        })),
      });
    };

    for (const word of words) {
      const wordStart = Number(word.start ?? 0);
      const speaker = findPyannoteSpeakerAt(wordStart, pyannoteSegments);
      if (speaker !== groupSpeaker && groupWords.length > 0) {
        flushGroup();
        groupWords = [];
      }
      groupSpeaker = speaker;
      groupWords.push(word);
    }
    flushGroup();
  }

  if (!resultSegments.length) return null;

  return {
    segments: resultSegments,
    speakerNames,
    speakerCount: Object.keys(speakerNames).length,
    text: resultSegments.map((s) => s.text).join(' '),
  };
}

// ── GPT-4o-mini transcript diarization ────────────────────────────────────────

/**
 * GPT-4o-mini based speaker diarization derived from transcript text.
 */
export async function diarizeFromTranscript(
  segments: any[],
  options: { participants?: string[] } = {}
): Promise<{
  segments: any[];
  speakerNames: Record<string, string>;
  speakerCount: number;
  text: string;
} | null> {
  if (!OPENAI_API_KEY || !segments.length) return null;

  const CHUNK_SIZE = 180;
  const chunk = segments.slice(0, CHUNK_SIZE);

  const fmt = (s: number): string => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const lines = chunk
    .map((seg, i) => {
      const prev = chunk[i - 1];
      const silenceGap =
        prev != null
          ? Math.max(0, Number((seg.start ?? 0) - (prev.end ?? prev.start ?? 0))).toFixed(1)
          : null;
      const gapStr = silenceGap !== null ? ` [cisza ${silenceGap}s]` : '';
      return `[${i}]${gapStr} ${fmt(seg.start ?? 0)}: "${(seg.text || '')
        .replace(/"/g, "'")
        .slice(0, 240)}"`;
    })
    .join('\n');

  const systemPrompt =
    'You are a speaker diarization engine. Your ONLY job is to assign a speaker label (A, B, C…) ' +
    'to each segment of a transcript from a multi-speaker recording. ' +
    'You MUST produce output for every segment — no skipping. ' +
    'Return ONLY valid JSON, no explanation.';

  const knownParticipants = (options.participants || []).filter(Boolean);
  const participantHint =
    knownParticipants.length >= 2
      ? `\nZnani uczestnicy spotkania: ${knownParticipants.slice(0, 8).join(', ')}.\nLitery A, B, C… odpowiadają kolejnym mówcom w kolejności ich pierwszego wystąpienia. Spróbuj przypisać tyle różnych liter ile jest znanych uczestników.\n`
      : '';

  const userPrompt = [
    'Nagranie rozmowy między WIELOMA osobami (co najmniej 2). To NIE jest monolog.',
    'Każda zmiana osoby mówiącej musi być oznaczona inną literą (A, B, C…).',
    participantHint,
    'SILNE SYGNAŁY ZMIANY MÓWCY:',
    '• [cisza ≥ 0.5s] przed segmentem → prawie zawsze zmiana mówcy',
    '• [cisza ≥ 2s] → na pewno zmiana mówcy — ZAWSZE przypisz inną literę',
    "• Krótka odpowiedź ('tak', 'mhm', 'dobra', 'jasne', ≤5 słów) po dłuższej wypowiedzi → inna osoba",
    '• Pytanie → odpowiedź → inna osoba dla odpowiedzi',
    "• 'Ja…' po długim segmencie innej treści → zmiana",
    '',
    'NIGDY nie przypisuj wszystkim segmentom tej samej litery jeśli są przerwy.',
    'Minimum 2 różnych mówców musi być użytych, chyba że transkrypt jest krótszy niż 3 segmenty.',
    '',
    'Transkrypt ([numer] [cisza przed] czas: "tekst"):',
    lines,
    '',
    `Przypisz mówców dla ${chunk.length} segmentów.`,
    'Format: {"segments": [{"i": 0, "s": "A"}, {"i": 1, "s": "B"}, ...]}',
    'Każdy indeks od 0 do ' + (chunk.length - 1) + ' musi być obecny.',
  ].join('\n');

  try {
    const resp = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: Math.min(4096, chunk.length * 14 + 60),
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });

    if (!resp.ok) throw new Error(`OpenAI chat completions HTTP ${resp.status}`);

    const json = await resp.json();
    const content = json.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    const assignments = Array.isArray(parsed?.segments) ? parsed.segments : [];

    if (!assignments.length) {
      if (DEBUG)
        console.warn('[diarization] Transcript diarization: GPT returned empty assignments.');
      return null;
    }

    const indexToSpeaker = new Map(
      assignments.map((a) => [
        Number(a.i),
        String(a.s || 'A')
          .toUpperCase()
          .slice(0, 1),
      ])
    );
    const lastKnown = indexToSpeaker.get(chunk.length - 1) || 'A';

    const speakerOrder = new Map<string, number>();
    const speakerNames: Record<string, string> = {};

    const resultSegments = segments
      .map((wseg, i) => {
        const text = clean(wseg.text || '');
        if (!text) return null;

        const rawLabel = indexToSpeaker.has(i) ? indexToSpeaker.get(i)! : lastKnown;

        if (!speakerOrder.has(rawLabel)) {
          const nextId = speakerOrder.size;
          speakerOrder.set(rawLabel, nextId);
          speakerNames[String(nextId)] = `Speaker ${nextId + 1}`;
        }

        const speakerId = speakerOrder.get(rawLabel)!;
        const start = Number(wseg.start ?? 0);
        const end = Number(wseg.end ?? start);
        const estimatedDuration = Math.max(1.5, tokenize(text).length * 0.42);
        const endTimestamp = end > start ? end : start + estimatedDuration;

        return {
          id: `seg_${crypto.randomUUID().replace(/-/g, '')}`,
          text,
          timestamp: start,
          endTimestamp,
          speakerId,
          rawSpeakerLabel: rawLabel,
        };
      })
      .filter(Boolean);

    if (DEBUG) {
      const dist = resultSegments.reduce((acc: any, s: any) => {
        const k = `${s.speakerId}(${s.rawSpeakerLabel})`;
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
      console.log(
        `[diarization] Transcript-diarize result: ${resultSegments.length} segs, dist: ${JSON.stringify(dist)}`
      );
    }

    return {
      segments: resultSegments,
      speakerNames,
      speakerCount: Object.keys(speakerNames).length,
      text: resultSegments.map((s: any) => s!.text).join(' '),
    };
  } catch (err: any) {
    if (DEBUG) console.warn('[diarization] diarizeFromTranscript failed:', err.message);
    return null;
  }
}

// ── Per-speaker loudness normalization ────────────────────────────────────────

/**
 * Applies per-speaker loudness normalization to an audio file.
 * Measures average loudness per speaker via ffmpeg volumedetect,
 * then applies per-speaker gain corrections. Only applied when speakerCount > 1.
 */
export async function applyPerSpeakerNorm(
  inputPath: string,
  pyannoteSegs: any[]
): Promise<string | null> {
  if (!pyannoteSegs || pyannoteSegs.length === 0) return null;

  const bySpeaker: Record<string, { start: number; end: number }[]> = {};
  for (const seg of pyannoteSegs) {
    if (!bySpeaker[seg.speaker]) bySpeaker[seg.speaker] = [];
    bySpeaker[seg.speaker].push({ start: seg.start, end: seg.end });
  }
  const speakers = Object.keys(bySpeaker);
  if (speakers.length <= 1) return null;

  const speakerGainDb: Record<string, number> = {};
  for (const speaker of speakers) {
    const segs = bySpeaker[speaker];
    const selectExpr = segs
      .map((s) => `between(t,${s.start.toFixed(3)},${s.end.toFixed(3)})`)
      .join('+');
    try {
      const { stderr } = await execPromise(
        `"${FFMPEG_BINARY}" -y -i "${inputPath}" -af "aselect='${selectExpr}',asetpts=N/SR/TB,volumedetect" -f null -`,
        { timeout: 60000 }
      );
      const match = String(stderr || '').match(/mean_volume:\s*([-\d.]+)\s*dB/i);
      if (match) {
        const meanDb = parseFloat(match[1]);
        const gainDb = -16.0 - meanDb;
        speakerGainDb[speaker] = Math.max(-12, Math.min(24, gainDb));
        if (DEBUG)
          console.log(
            `[diarization] PerSpeakerNorm: ${speaker} mean=${meanDb.toFixed(1)}dB → gain=${speakerGainDb[speaker].toFixed(1)}dB`
          );
      }
    } catch (err: any) {
      if (DEBUG)
        console.warn(
          `[diarization] PerSpeakerNorm: volumedetect for ${speaker} failed:`,
          err.message?.slice(0, 100)
        );
    }
  }

  const allSegs = [...pyannoteSegs].sort((a, b) => a.start - b.start);
  let expr = '1.0';
  for (let i = allSegs.length - 1; i >= 0; i--) {
    const seg = allSegs[i];
    const gainDb = speakerGainDb[seg.speaker];
    if (gainDb === undefined || Math.abs(gainDb) < 0.5) continue;
    const gainLinear = Math.pow(10, gainDb / 20);
    expr = `if(between(t,${seg.start.toFixed(3)},${seg.end.toFixed(3)}),${gainLinear.toFixed(4)},${expr})`;
  }
  if (expr === '1.0') return null;

  const { default: osModule } = await import('node:os');
  const outputPath = path.join(osModule.tmpdir(), `spknorm_${Date.now()}.wav`);
  try {
    await execPromise(
      `"${FFMPEG_BINARY}" -y -i "${inputPath}" -af "volume='${expr}'" -threads 4 -ar 16000 -ac 1 "${outputPath}"`,
      { timeout: 300000 }
    );
    if (DEBUG) {
      const origSize = fs.statSync(inputPath).size;
      const normSize = fs.statSync(outputPath).size;
      console.log(
        `[diarization] PerSpeakerNorm: ${speakers.join(',')} — ${(origSize / 1e6).toFixed(1)}MB → ${(normSize / 1e6).toFixed(1)}MB`
      );
    }
    return outputPath;
  } catch (err: any) {
    console.warn('[diarization] PerSpeakerNorm: volume apply failed:', err.message?.slice(0, 100));
    try {
      fs.unlinkSync(outputPath);
    } catch (_) {}
    return null;
  }
}
