import client from 'prom-client';

// Use global object to track if metrics were collected (for tests)
const globalObj = global as typeof globalThis & {
  __metricsCollected?: boolean;
  __pipelineStageDuration?: client.Summary<string>;
};

if (!globalObj.__metricsCollected) {
  client.collectDefaultMetrics();
  globalObj.__metricsCollected = true;
}

// Reuse existing metric if already registered (for tests)
export const pipelineStageDuration =
  globalObj.__pipelineStageDuration ||
  new client.Summary({
    name: 'voicelog_pipeline_stage_duration_ms',
    help: 'Duration of pipeline stages in ms',
    labelNames: ['stage'],
    percentiles: [0.5, 0.9, 0.95, 0.99],
  });

if (!globalObj.__pipelineStageDuration) {
  globalObj.__pipelineStageDuration = pipelineStageDuration;
}

// Custom store for easy JSON API reading in the React dashboard frontend
const stageStats: Record<string, number[]> = {};
const capabilityModeCounts: Record<string, number> = {};
const aiAnalysisCounts: Record<string, number> = {};
const aiFallbackCounts: Record<string, number> = {};

type AiAnalysisMetric = {
  workspaceId?: string;
  endpoint?: string;
  source?: string;
};

type AiFallbackMetric = {
  workspaceId?: string;
  endpoint?: string;
  reason?: string;
  mode?: string;
};

function safeMetricLabel(value: unknown, fallback = 'unknown') {
  return String(value || fallback).replace(/[^a-zA-Z0-9_-]/g, '_') || fallback;
}

interface DeadLetterMetrics {
  count: number;
  oldestAgeMinutes: number;
  byErrorCode: Record<string, number>;
}

function safeMetricNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function safeLabelValue(value: unknown) {
  return String(value || 'UNKNOWN')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '_')
    .slice(0, 120);
}

export const MetricsService = {
  observeStageDuration(stage: string, durationMs: number) {
    if (!stageStats[stage]) {
      stageStats[stage] = [];
    }
    stageStats[stage].push(durationMs);
    if (stageStats[stage].length > 1000) {
      stageStats[stage].shift();
    }
    pipelineStageDuration.labels(stage).observe(durationMs);
  },

  observeCapabilityMode(capability: string, mode: string) {
    const safeCapability = safeMetricLabel(capability);
    const safeMode = safeMetricLabel(mode);
    const key = `${safeCapability}:${safeMode}`;
    capabilityModeCounts[key] = (capabilityModeCounts[key] || 0) + 1;
  },

  observeAiAnalysis(metric: AiAnalysisMetric) {
    const workspaceId = safeMetricLabel(metric.workspaceId, 'workspace_unknown');
    const endpoint = safeMetricLabel(metric.endpoint, 'endpoint_unknown');
    const source = safeMetricLabel(metric.source, 'unknown');
    const key = `${workspaceId}:${endpoint}:${source}`;
    aiAnalysisCounts[key] = (aiAnalysisCounts[key] || 0) + 1;
  },

  observeAiFallback(metric: AiFallbackMetric) {
    const workspaceId = safeMetricLabel(metric.workspaceId, 'workspace_unknown');
    const endpoint = safeMetricLabel(metric.endpoint, 'endpoint_unknown');
    const reason = safeMetricLabel(metric.reason, 'unknown');
    const mode = safeMetricLabel(metric.mode, 'fallback');
    const key = `${workspaceId}:${endpoint}:${reason}:${mode}`;
    aiFallbackCounts[key] = (aiFallbackCounts[key] || 0) + 1;
  },

  async getPrometheusMetrics() {
    return await client.register.metrics();
  },

  formatTranscriptionDeadLetterMetrics(metrics: DeadLetterMetrics) {
    const lines = [
      '# HELP voicelog_transcription_dead_letter_jobs Number of transcription jobs parked in the dead-letter queue.',
      '# TYPE voicelog_transcription_dead_letter_jobs gauge',
      `voicelog_transcription_dead_letter_jobs ${safeMetricNumber(metrics?.count)}`,
      '# HELP voicelog_transcription_dead_letter_oldest_age_minutes Age in minutes of the oldest transcription dead-letter job.',
      '# TYPE voicelog_transcription_dead_letter_oldest_age_minutes gauge',
      `voicelog_transcription_dead_letter_oldest_age_minutes ${safeMetricNumber(
        metrics?.oldestAgeMinutes
      )}`,
      '# HELP voicelog_transcription_dead_letter_jobs_by_error_code Number of dead-letter transcription jobs grouped by safe error code.',
      '# TYPE voicelog_transcription_dead_letter_jobs_by_error_code gauge',
    ];

    for (const [errorCode, count] of Object.entries(metrics?.byErrorCode || {})) {
      lines.push(
        `voicelog_transcription_dead_letter_jobs_by_error_code{error_code="${safeLabelValue(
          errorCode
        )}"} ${safeMetricNumber(count)}`
      );
    }

    return `${lines.join('\n')}\n`;
  },

  getJsonSummary() {
    const result: Record<string, any> = {};
    if (Object.keys(capabilityModeCounts).length > 0) {
      result.capabilityModes = { ...capabilityModeCounts };
    }
    if (Object.keys(aiFallbackCounts).length > 0) {
      const total = Object.values(aiFallbackCounts).reduce((sum, count) => sum + count, 0);
      const analysisTotal = Object.values(aiAnalysisCounts).reduce((sum, count) => sum + count, 0);
      const byWorkspace: Record<string, number> = {};
      const byEndpoint: Record<string, number> = {};
      const byReason: Record<string, number> = {};

      for (const [key, count] of Object.entries(aiFallbackCounts)) {
        const [workspaceId, endpoint, reason] = key.split(':');
        byWorkspace[workspaceId] = (byWorkspace[workspaceId] || 0) + count;
        byEndpoint[endpoint] = (byEndpoint[endpoint] || 0) + count;
        byReason[reason] = (byReason[reason] || 0) + count;
      }

      result.aiFallbacks = {
        total,
        analysisTotal,
        fallbackRate: analysisTotal > 0 ? total / analysisTotal : 1,
        counts: { ...aiFallbackCounts },
        analysisCounts: { ...aiAnalysisCounts },
        byWorkspace,
        byEndpoint,
        byReason,
      };
    }
    for (const [stage, times] of Object.entries(stageStats)) {
      if (times.length === 0) continue;
      const sorted = [...times].sort((a, b) => a - b);
      const count = sorted.length;

      const getPercentile = (p: number) => {
        const index = Math.floor((count - 1) * p);
        return sorted[index];
      };

      result[stage] = {
        count,
        min: sorted[0],
        max: sorted[count - 1],
        p50: getPercentile(0.5) || 0,
        p95: getPercentile(0.95) || 0,
        p99: getPercentile(0.99) || 0,
        avg: times.reduce((a, b) => a + b, 0) / count,
      };
    }
    return result;
  },
};
