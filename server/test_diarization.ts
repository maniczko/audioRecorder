/**
 * Diagnostic test for diarizeFromTranscript + full pipeline.
 * Run: node server/test_diarization.js
 */
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.VOICELOG_OPENAI_API_KEY || '';
const OPENAI_BASE_URL = String(
  process.env.VOICELOG_OPENAI_BASE_URL || 'https://api.openai.com/v1'
).replace(/\/$/, '');

if (!OPENAI_API_KEY) {
  console.error('BŁĄD: Brak OPENAI_API_KEY w .env');
  process.exit(1);
}

console.log('API URL:', OPENAI_BASE_URL);
console.log('API Key: sk-…' + OPENAI_API_KEY.slice(-6));
console.log('');

// Synthetic 2-person Polish conversation (clear speaker alternation)
const syntheticSegments = [
  { text: 'Dzień dobry, opowiedz mi o swojej pracy.', start: 0, end: 3 },
  { text: 'Dzień dobry. Pracuję jako programista od pięciu lat.', start: 4, end: 8 },
  { text: 'Co cię najbardziej interesuje w tej pracy?', start: 9, end: 12 },
  {
    text: 'Najbardziej lubię rozwiązywać skomplikowane problemy algorytmiczne.',
    start: 13,
    end: 18,
  },
  { text: 'Czy pracujesz zdalnie czy w biurze?', start: 19, end: 22 },
  { text: 'Pracuję hybrydowo, dwa dni w tygodniu w biurze, a reszta zdalnie.', start: 23, end: 29 },
  { text: 'A jakie technologie używasz na co dzień?', start: 30, end: 33 },
  {
    text: 'Głównie JavaScript i TypeScript, ale też trochę Python do skryptów.',
    start: 34,
    end: 40,
  },
  { text: 'Rozumiem. Czy planujesz zmianę pracy w najbliższym czasie?', start: 41, end: 46 },
  { text: 'Na razie nie, ale jestem otwarty na nowe możliwości.', start: 47, end: 52 },
];

async function diarizeFromTranscript(segments) {
  if (!OPENAI_API_KEY || !segments.length) return null;

  const CHUNK_SIZE = 180;
  const chunk = segments.slice(0, CHUNK_SIZE);

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const lines = chunk
    .map(
      (seg, i) =>
        `[${i}] ${fmt(seg.start ?? 0)}: "${(seg.text || '').replace(/"/g, "'").slice(0, 240)}"`
    )
    .join('\n');

  const systemPrompt =
    'Jesteś ekspertem od analizy nagrań spotkań. Identyfikujesz mówców na podstawie struktury rozmowy.';

  const userPrompt = [
    'Poniżej transkrypt nagrania. Przypisz każdemu segmentowi mówcę (A, B, C…).',
    'Zmiana mówcy następuje gdy: ktoś odpowiada na pytanie, zmienia się styl mówienia, pojawia się nowa osoba.',
    "Jeśli to monolog jednej osoby — użyj tylko 'A'.",
    '',
    'Transkrypt:',
    lines,
    '',
    'Odpowiedź TYLKO w formacie JSON: {"segments": [{"i": 0, "s": "A"}, {"i": 1, "s": "B"}, ...]}',
    'Każdy segment musi mieć "i" (numer) i "s" (litera mówcy). Brak pomijanych segmentów.',
  ].join('\n');

  console.log('=== PROMPT WYSŁANY DO GPT-4o-mini ===');
  console.log(userPrompt.slice(0, 800));
  console.log('...');
  console.log('');

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
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
  });

  console.log('=== HTTP STATUS:', resp.status, resp.statusText, '===');

  const rawText = await resp.text();
  console.log('=== RAW RESPONSE ===');
  console.log(rawText.slice(0, 1000));
  console.log('');

  if (!resp.ok) throw new Error(`OpenAI HTTP ${resp.status}: ${rawText.slice(0, 200)}`);

  const json = JSON.parse(rawText);
  const content = json.choices?.[0]?.message?.content || '{}';

  console.log('=== EXTRACTED CONTENT ===');
  console.log(content);
  console.log('');

  const parsed = JSON.parse(content);
  const assignments = Array.isArray(parsed?.segments) ? parsed.segments : [];

  console.log('=== ASSIGNMENTS ===');
  assignments.forEach((a) => console.log(`  segment[${a.i}] → speaker ${a.s}`));
  console.log('');

  const speakers = [...new Set(assignments.map((a) => a.s))];
  console.log(`=== UNIQUE SPEAKERS: ${speakers.length} (${speakers.join(', ')}) ===`);

  return assignments;
}

async function main() {
  console.log(
    `Testowanie diaryzacji na ${syntheticSegments.length} segmentach syntetycznej rozmowy PL...`
  );
  console.log('');

  try {
    const result = await diarizeFromTranscript(syntheticSegments);

    if (!result || !result.length) {
      console.error('PROBLEM: Diaryzacja zwróciła pusty wynik!');
      return;
    }

    const speakers = [...new Set(result.map((a) => a.s))];
    if (speakers.length < 2) {
      console.warn(
        `PROBLEM: Tylko ${speakers.length} mówca(y) wykryto — oczekiwano 2 dla tej rozmowy Q&A.`
      );
    } else {
      console.log(`✓ SUKCES: ${speakers.length} mówców wykryto poprawnie: ${speakers.join(', ')}`);
    }

    // Verify assignment makes sense: even indices = A (interviewer), odd = B (interviewee)
    const evenSpeakers = result.filter((a) => a.i % 2 === 0).map((a) => a.s);
    const oddSpeakers = result.filter((a) => a.i % 2 === 1).map((a) => a.s);
    const evenDominant = evenSpeakers.sort(
      (a, b) =>
        evenSpeakers.filter((s) => s === b).length - evenSpeakers.filter((s) => s === a).length
    )[0];
    const oddDominant = oddSpeakers.sort(
      (a, b) =>
        oddSpeakers.filter((s) => s === b).length - oddSpeakers.filter((s) => s === a).length
    )[0];

    if (evenDominant !== oddDominant) {
      console.log(`✓ Wzorzec prawidłowy: pytający=${evenDominant}, odpowiadający=${oddDominant}`);
    } else {
      console.warn(`PROBLEM: Pytający i odpowiadający to ten sam mówca (${evenDominant})`);
    }
  } catch (err) {
    console.error('BŁĄD:', err.message);
    console.error(err.stack);
  }
}

main();
