import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NON_LATIN_ARTIFACT_PATTERN =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/u;

function normalizeWords(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

export function wordErrorRate(referenceText, hypothesisText) {
  const reference = normalizeWords(referenceText);
  const hypothesis = normalizeWords(hypothesisText);
  if (!reference.length) return hypothesis.length ? 1 : 0;

  const matrix = Array.from({ length: reference.length + 1 }, () =>
    Array(hypothesis.length + 1).fill(0)
  );
  for (let i = 0; i <= reference.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= hypothesis.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= reference.length; i += 1) {
    for (let j = 1; j <= hypothesis.length; j += 1) {
      const cost = reference[i - 1] === hypothesis[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[reference.length][hypothesis.length] / reference.length;
}

export function evaluateCorpus(manifest) {
  const samples = Array.isArray(manifest?.samples) ? manifest.samples : [];
  const results = samples.map((sample) => {
    const transcript = String(sample.hypothesisTranscript || '');
    return {
      id: sample.id,
      category: sample.category || 'clean-short',
      wer: wordErrorRate(sample.goldTranscript, transcript),
      empty: normalizeWords(transcript).length === 0,
      artifact:
        NON_LATIN_ARTIFACT_PATTERN.test(transcript) &&
        !['review', 'low-confidence', 'filtered'].includes(sample.expectedStatus),
    };
  });

  const byCategory = (category) => results.filter((result) => result.category === category);
  const averageWer = (items) =>
    items.length ? items.reduce((sum, result) => sum + result.wer, 0) / items.length : 0;

  return {
    sampleCount: results.length,
    cleanShortWer: averageWer(byCategory('clean-short')),
    noisyShortWer: averageWer(byCategory('noisy-short')),
    artifactRate: results.filter((result) => result.artifact).length / Math.max(results.length, 1),
    emptySegmentRate: results.filter((result) => result.empty).length / Math.max(results.length, 1),
    results,
  };
}

export function assertCorpusGate(metrics, thresholds = {}) {
  const failures = [];
  const cleanWerLimit = thresholds.cleanShortWer ?? 0.12;
  const noisyWerLimit = thresholds.noisyShortWer ?? 0.2;

  if (metrics.sampleCount < 20)
    failures.push(`expected at least 20 samples, got ${metrics.sampleCount}`);
  if (metrics.artifactRate !== 0)
    failures.push(`artifactRate must be 0, got ${metrics.artifactRate}`);
  if (metrics.emptySegmentRate !== 0) {
    failures.push(`emptySegmentRate must be 0, got ${metrics.emptySegmentRate}`);
  }
  if (metrics.cleanShortWer > cleanWerLimit) {
    failures.push(`cleanShortWer ${metrics.cleanShortWer.toFixed(4)} exceeds ${cleanWerLimit}`);
  }
  if (metrics.noisyShortWer > noisyWerLimit) {
    failures.push(`noisyShortWer ${metrics.noisyShortWer.toFixed(4)} exceeds ${noisyWerLimit}`);
  }

  return failures;
}

export function loadManifest(manifestPath) {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

const entrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isMainModule = entrypointPath === path.resolve(rootDir, 'scripts/stt-corpus-gate.mjs');

if (isMainModule) {
  const manifestPath =
    process.argv[2] || path.join(rootDir, 'server/tests/fixtures/stt-corpus/manifest.json');
  const metrics = evaluateCorpus(loadManifest(manifestPath));
  const failures = assertCorpusGate(metrics);
  console.log(JSON.stringify(metrics, null, 2));
  if (failures.length > 0) {
    console.error(`STT corpus gate failed:\n- ${failures.join('\n- ')}`);
    process.exitCode = 1;
  }
}
