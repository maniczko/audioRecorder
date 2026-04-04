import { describe, test, expect, vi } from 'vitest';
import { MetricsService } from '../../services/MetricsService.ts';

describe('MetricsService', () => {
  test('observeStageDuration records duration', () => {
    MetricsService.observeStageDuration('transcription', 1500);
    MetricsService.observeStageDuration('diarization', 3000);
    MetricsService.observeStageDuration('transcription', 2000);
    const summary = MetricsService.getJsonSummary();
    expect(summary.transcription).toBeDefined();
    expect(summary.diarization).toBeDefined();
  });

  test('getJsonSummary returns stats for recorded stages', () => {
    MetricsService.observeStageDuration('test_stage', 100);
    MetricsService.observeStageDuration('test_stage', 200);
    MetricsService.observeStageDuration('test_stage', 300);
    const summary = MetricsService.getJsonSummary();
    const stats = summary.test_stage;
    expect(stats).toBeDefined();
    expect(stats.count).toBe(3);
    expect(stats.min).toBe(100);
    expect(stats.max).toBe(300);
    expect(stats.avg).toBe(200);
  });

  test('getJsonSummary calculates percentiles', () => {
    for (let i = 1; i <= 100; i++) {
      MetricsService.observeStageDuration('pctl_test', i);
    }
    const summary = MetricsService.getJsonSummary();
    const stats = summary.pctl_test;
    expect(stats.p50).toBeGreaterThan(0);
    expect(stats.p95).toBeGreaterThan(stats.p50);
    expect(stats.p99).toBeGreaterThan(stats.p95);
  });

  test('getJsonSummary handles single observation', () => {
    MetricsService.observeStageDuration('single', 42);
    const summary = MetricsService.getJsonSummary();
    const stats = summary.single;
    expect(stats.count).toBe(1);
    expect(stats.min).toBe(42);
    expect(stats.max).toBe(42);
    expect(stats.p50).toBe(42);
  });

  test('getJsonSummary caps at 1000 entries per stage', () => {
    for (let i = 0; i < 1100; i++) {
      MetricsService.observeStageDuration('cap_test', i);
    }
    const summary = MetricsService.getJsonSummary();
    expect(summary.cap_test.count).toBeLessThanOrEqual(1000);
  });

  test('getPrometheusMetrics returns a string', async () => {
    const metrics = await MetricsService.getPrometheusMetrics();
    expect(typeof metrics).toBe('string');
    expect(metrics.length).toBeGreaterThan(0);
  });

  test('getJsonSummary skips stages with no data', () => {
    const summary = MetricsService.getJsonSummary();
    // No stage with 'nonexistent' should be in the summary unless we recorded it
    expect(summary.nonexistent).toBeUndefined();
  });
});
