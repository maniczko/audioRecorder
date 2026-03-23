import fs from "node:fs";
import path from "node:path";
import { config } from "../config.ts";
import { resolveConfiguredSttProviders, transcribeWithProviders, type SttProvider } from "../stt/providers.ts";
import { computeWerProxy, clean } from "../audioPipeline.utils.ts";

interface BenchmarkManifestEntry {
  id: string;
  audioPath: string;
  transcriptPath?: string;
  referenceText?: string;
  contentType?: string;
}

interface BenchmarkManifest {
  datasetName?: string;
  items: BenchmarkManifestEntry[];
}

function loadManifest(manifestPath: string): BenchmarkManifest {
  const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!parsed || !Array.isArray(parsed.items)) {
    throw new Error("Manifest benchmarku musi zawierac tablice items.");
  }
  return parsed as BenchmarkManifest;
}

function resolveReferenceText(item: BenchmarkManifestEntry, manifestDir: string) {
  if (item.referenceText) {
    return clean(item.referenceText);
  }
  if (item.transcriptPath) {
    return clean(fs.readFileSync(path.resolve(manifestDir, item.transcriptPath), "utf8"));
  }
  throw new Error(`Brak referenceText albo transcriptPath dla ${item.id}.`);
}

function resolveAudioPath(item: BenchmarkManifestEntry, manifestDir: string) {
  const audioPath = path.resolve(manifestDir, item.audioPath);
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Nie znaleziono pliku audio: ${audioPath}`);
  }
  return audioPath;
}

async function benchmarkProvider(provider: SttProvider, items: BenchmarkManifestEntry[], manifestDir: string) {
  const rows = [];

  for (const item of items) {
    const audioPath = resolveAudioPath(item, manifestDir);
    const referenceText = resolveReferenceText(item, manifestDir);
    const startedAt = performance.now();

    try {
      const result = await transcribeWithProviders([provider], (activeProvider) => ({
        filePath: audioPath,
        contentType: item.contentType || "audio/wav",
        fields: {
          model: activeProvider.defaultModel,
          language: config.AUDIO_LANGUAGE,
          response_format: "verbose_json",
          temperature: 0,
        },
      }));

      const hypothesis = clean(result?.payload?.text || result?.payload?.transcript || "");
      rows.push({
        id: item.id,
        providerId: provider.id,
        providerLabel: provider.label,
        model: result.model,
        durationMs: Math.round(performance.now() - startedAt),
        werProxy: computeWerProxy(referenceText, hypothesis),
        referenceLength: referenceText.length,
        hypothesisLength: hypothesis.length,
        success: true,
      });
    } catch (error: any) {
      rows.push({
        id: item.id,
        providerId: provider.id,
        providerLabel: provider.label,
        model: provider.defaultModel,
        durationMs: Math.round(performance.now() - startedAt),
        werProxy: null,
        referenceLength: referenceText.length,
        hypothesisLength: 0,
        success: false,
        errorMessage: error?.message || String(error),
      });
    }
  }

  return rows;
}

async function main() {
  const manifestPath = process.argv[2];
  if (!manifestPath) {
    throw new Error("Uzycie: pnpm exec tsx server/scripts/benchmark-polish-stt.ts <manifest.json>");
  }

  const resolvedManifestPath = path.resolve(process.cwd(), manifestPath);
  const manifestDir = path.dirname(resolvedManifestPath);
  const manifest = loadManifest(resolvedManifestPath);

  const providers = resolveConfiguredSttProviders({
    preferredProvider: config.VOICELOG_STT_PROVIDER,
    fallbackProvider: config.VOICELOG_STT_FALLBACK_PROVIDER,
    openAiApiKey: config.VOICELOG_OPENAI_API_KEY || config.OPENAI_API_KEY,
    openAiBaseUrl: config.VOICELOG_OPENAI_BASE_URL,
    groqApiKey: config.GROQ_API_KEY,
    openAiModel: config.VERIFICATION_MODEL,
    groqModel: "whisper-large-v3",
  }).filter((provider) => provider.isAvailable());

  if (!providers.length) {
    throw new Error("Brak skonfigurowanego providera STT do benchmarku.");
  }

  const allRows = [];
  for (const provider of providers) {
    const providerRows = await benchmarkProvider(provider, manifest.items, manifestDir);
    allRows.push(...providerRows);
  }

  const summary = providers.map((provider) => {
    const providerRows = allRows.filter((row) => row.providerId === provider.id);
    const successfulRows = providerRows.filter((row) => row.success && typeof row.werProxy === "number");
    const averageWerProxy = successfulRows.length
      ? successfulRows.reduce((sum, row) => sum + Number(row.werProxy), 0) / successfulRows.length
      : null;
    const failureRate = providerRows.length
      ? providerRows.filter((row) => !row.success).length / providerRows.length
      : 0;

    return {
      providerId: provider.id,
      providerLabel: provider.label,
      model: provider.defaultModel,
      items: providerRows.length,
      averageWerProxy,
      failureRate,
    };
  });

  console.log(JSON.stringify({
    datasetName: manifest.datasetName || path.basename(resolvedManifestPath),
    language: config.AUDIO_LANGUAGE,
    generatedAt: new Date().toISOString(),
    summary,
    rows: allRows,
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
