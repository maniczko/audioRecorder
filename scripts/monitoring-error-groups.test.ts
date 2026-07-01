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

  it('selects the terminal GitHub CI failure over Vitest stderr noise', () => {
    const groups = extractGithubFailureGroups({
      failures: [
        {
          runId: 3001,
          runName: 'Code Review',
          branch: 'dependabot/npm_and_yarn/development-dependencies-70c9663c6e',
          commit: 'fe8a218',
          htmlUrl: 'https://example.test/runs/3001',
          errors: [
            {
              jobName: 'coverage-check',
              stepName: 'Run pnpm run test:coverage',
              errors: [
                {
                  lineNumber: 40,
                  line: 'Recording start failed. Error: MediaRecorder init failed',
                },
                {
                  lineNumber: 150,
                  line: 'FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory',
                },
                {
                  lineNumber: 190,
                  line: 'Error: [vitest-pool]: Worker forks emitted error.',
                },
              ],
            },
          ],
        },
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].message).toContain('fatal error: reached heap limit');
    expect(groups[0].originalMessage).not.toContain('Recording start failed');
    expect(groups[0].occurrences[0].lineNumber).toBe(150);
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

  it('ignores Railway runtime noise fragments from multiline info logs', () => {
    const groups = extractRailwayLogGroups([
      { message: "  requestId: 'a3263a1c-329a-423b-9473-84649ac53c92'," },
      { message: "  method: 'GET'," },
      { message: "  route: '/state/bootstrap'," },
      { message: '  status: 401,' },
      { message: "  durationMs: '181.05'" },
      { message: '[INFO] [REQ] GET /health - 200 [1885.9ms] {' },
      { message: '[INFO] [Cleanup] Periodic: triggered garbage collection.' },
      { message: '}' },
    ]);

    expect(groups).toHaveLength(0);
  });

  it('keeps real Railway runtime errors actionable after noise filtering', () => {
    const groups = extractRailwayLogGroups([
      { level: 'info', message: '[INFO] [REQ] GET /health - 200 [40ms]' },
      {
        level: 'error',
        service: 'api',
        message: 'Unhandled exception while saving workspace state',
      },
      {
        level: 'error',
        service: 'api',
        message: 'Unhandled exception while saving workspace state',
      },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual(
      expect.objectContaining({
        source: 'railway',
        area: 'api',
      })
    );
    expect(groups[0].occurrences).toHaveLength(2);
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
