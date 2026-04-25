import {
  buildMonitoringGroupKey,
  buildMonitoringIssueBody,
  buildMonitoringIssueTitle,
  buildMonitoringLabels,
  extractGithubFailureGroups,
  extractRailwayLogGroups,
  normalizeErrorText,
} from './monitoring-error-groups.mjs';

describe('monitoring error groups', () => {
  it('normalizes volatile timestamps, URLs, run IDs, and line numbers', () => {
    const text = normalizeErrorText(
      '2026-04-25T10:20:30.123Z Error: Run #998877 failed at line 42 https://example.test/run/1'
    );

    expect(text).toBe('<timestamp> error: run <id> failed at line <n> <url>');
  });

  it('builds the same group key for the same root cause with volatile IDs changed', () => {
    const first = buildMonitoringGroupKey({
      source: 'github-actions',
      area: 'Optimized CI > test > Vitest',
      message: 'Error: job 123 failed for request id 9876543210 at line 201',
      statusCode: 'failure',
      runtimeMode: 'ci',
    });
    const second = buildMonitoringGroupKey({
      source: 'github-actions',
      area: 'Optimized CI > test > Vitest',
      message: 'Error: job 999 failed for request id 1234567899 at line 444',
      statusCode: 'failure',
      runtimeMode: 'ci',
    });

    expect(second.key).toBe(first.key);
    expect(second.label).toBe(first.label);
  });

  it('keeps distinct areas in separate groups', () => {
    const testJob = buildMonitoringGroupKey({
      source: 'github-actions',
      area: 'Optimized CI > test',
      message: 'Error: pnpm test failed',
      statusCode: 'failure',
      runtimeMode: 'ci',
    });
    const buildJob = buildMonitoringGroupKey({
      source: 'github-actions',
      area: 'Optimized CI > build',
      message: 'Error: pnpm test failed',
      statusCode: 'failure',
      runtimeMode: 'ci',
    });

    expect(buildJob.key).not.toBe(testJob.key);
  });

  it('groups repeated GitHub workflow failures by stable fingerprint', () => {
    const groups = extractGithubFailureGroups({
      failures: [
        {
          runId: 1001,
          runName: 'Optimized CI',
          branch: 'main',
          commit: 'abcdef1',
          htmlUrl: 'https://example.test/runs/1001',
          errors: [
            {
              jobName: 'test',
              stepName: 'Vitest',
              errors: [{ lineNumber: 90, line: 'Error: job 1001 failed at line 90' }],
            },
          ],
        },
        {
          runId: 1002,
          runName: 'Optimized CI',
          branch: 'main',
          commit: 'abcdef2',
          htmlUrl: 'https://example.test/runs/1002',
          errors: [
            {
              jobName: 'test',
              stepName: 'Vitest',
              errors: [{ lineNumber: 125, line: 'Error: job 1002 failed at line 125' }],
            },
          ],
        },
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].occurrences).toHaveLength(2);
    expect(groups[0].source).toBe('github-actions');
  });

  it('creates a GitHub group even when job logs were not parsed', () => {
    const groups = extractGithubFailureGroups({
      failures: [
        {
          runId: 2001,
          runName: 'Docker Build',
          branch: 'main',
          commit: 'abc1234',
          htmlUrl: 'https://example.test/runs/2001',
          errors: [],
        },
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].area).toBe('docker-build');
    expect(groups[0].occurrences[0].runId).toBe(2001);
  });

  it('groups Railway logs with volatile request data into one issue group', () => {
    const groups = extractRailwayLogGroups([
      {
        timestamp: '2026-04-25T10:20:30.123Z',
        service: 'api',
        level: 'error',
        message: 'Error: request id 1234567890 failed while transcribing',
      },
      {
        timestamp: '2026-04-25T10:25:30.123Z',
        service: 'api',
        level: 'error',
        message: 'Error: request id 9999999999 failed while transcribing',
      },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].occurrences).toHaveLength(2);
    expect(groups[0].source).toBe('railway');
  });

  it('formats issue metadata with stable labels and body marker', () => {
    const group = extractRailwayLogGroups([
      {
        service: 'api',
        level: 'error',
        message: 'Error: storage timeout',
      },
    ])[0];

    expect(buildMonitoringLabels(group)).toEqual(['monitoring', 'railway-error', group.label]);
    expect(buildMonitoringIssueTitle(group)).toContain(`[monitor:${group.id}]`);
    expect(buildMonitoringIssueBody(group, '# Report', new Date('2026-04-25T00:00:00Z'))).toContain(
      `<!-- monitoring-group:${group.key} -->`
    );
  });
});
