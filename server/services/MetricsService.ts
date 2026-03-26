import client from 'prom-client';

// Use global object to track if default metrics were collected (for tests)
const globalObj = global as typeof globalThis & { __metricsCollected?: boolean };

if (!globalObj.__metricsCollected) {
  client.collectDefaultMetrics();
  globalObj.__metricsCollected = true;
}

export const pipelineStageDuration = new client.Summary({
  name: 'voicelog_pipeline_stage_duration_ms',
  help: 'Duration of pipeline stages in ms',
  labelNames: ['stage'],
  percentiles: [0.5, 0.9, 0.95, 0.99],
});

// Custom store for easy JSON API reading in the React dashboard frontend
const stageStats: Record<string, number[]> = {};

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

  async getPrometheusMetrics() {
    return await client.register.metrics();
  },

  getJsonSummary() {
    const result: Record<string, any> = {};
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
