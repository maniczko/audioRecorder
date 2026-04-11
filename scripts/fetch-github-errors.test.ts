import { partitionWorkflowFailures } from './fetch-github-errors.js';

function makeRun(overrides: Record<string, unknown>) {
  return {
    id: 1,
    name: 'Optimized CI',
    workflow_id: 101,
    conclusion: 'success',
    created_at: '2026-04-11T08:39:53Z',
    head_branch: 'main',
    head_sha: 'abcdef1234567890',
    html_url: 'https://example.test/run',
    ...overrides,
  };
}

describe('partitionWorkflowFailures', () => {
  it('keeps the latest failed run active when no newer success exists', () => {
    const result = partitionWorkflowFailures([
      makeRun({ id: 1, conclusion: 'failure', created_at: '2026-04-11T08:39:53Z' }),
    ]);

    expect(result.activeFailures.map((run) => run.id)).toEqual([1]);
    expect(result.resolvedFailures).toEqual([]);
  });

  it('moves older failures to resolved when a newer success exists for the same workflow', () => {
    const result = partitionWorkflowFailures([
      makeRun({ id: 1, conclusion: 'failure', created_at: '2026-04-11T08:28:56Z' }),
      makeRun({ id: 2, conclusion: 'success', created_at: '2026-04-11T08:39:53Z' }),
    ]);

    expect(result.activeFailures).toEqual([]);
    expect(result.resolvedFailures.map((run) => run.id)).toEqual([1]);
  });

  it('treats the newest failed run as active even if an older success exists', () => {
    const result = partitionWorkflowFailures([
      makeRun({ id: 1, conclusion: 'success', created_at: '2026-04-11T08:28:56Z' }),
      makeRun({ id: 2, conclusion: 'failure', created_at: '2026-04-11T08:39:53Z' }),
    ]);

    expect(result.activeFailures.map((run) => run.id)).toEqual([2]);
    expect(result.resolvedFailures).toEqual([]);
  });

  it('partitions failures independently per workflow name', () => {
    const result = partitionWorkflowFailures([
      makeRun({
        id: 1,
        name: 'Optimized CI',
        conclusion: 'failure',
        created_at: '2026-04-11T08:28:56Z',
      }),
      makeRun({
        id: 2,
        name: 'Optimized CI',
        conclusion: 'success',
        created_at: '2026-04-11T08:39:53Z',
      }),
      makeRun({
        id: 3,
        name: 'Docker Build',
        conclusion: 'failure',
        created_at: '2026-04-11T08:39:53Z',
      }),
    ]);

    expect(result.activeFailures.map((run) => run.id)).toEqual([3]);
    expect(result.resolvedFailures.map((run) => run.id)).toEqual([1]);
  });

  it('uses workflow_id fallback when the workflow name is missing', () => {
    const result = partitionWorkflowFailures([
      makeRun({
        id: 1,
        name: null,
        workflow_id: 501,
        conclusion: 'failure',
        created_at: '2026-04-11T08:28:56Z',
      }),
      makeRun({
        id: 2,
        name: null,
        workflow_id: 501,
        conclusion: 'success',
        created_at: '2026-04-11T08:39:53Z',
      }),
      makeRun({
        id: 3,
        name: null,
        workflow_id: 777,
        conclusion: 'failure',
        created_at: '2026-04-11T08:40:53Z',
      }),
    ]);

    expect(result.activeFailures.map((run) => run.id)).toEqual([3]);
    expect(result.resolvedFailures.map((run) => run.id)).toEqual([1]);
    expect(result.latestByWorkflow).toHaveLength(2);
  });
});
