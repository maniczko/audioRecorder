import { parseErrors, partitionWorkflowFailures } from './github-error-reporting.mjs';

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

describe('parseErrors', () => {
  it('keeps terminal Vitest worker failures instead of recorder stderr from tests', () => {
    const errors = parseErrors(`
stderr | src/hooks/useAudioHardware.test.ts > useAudioHardware > cleanupRecorder is invoked when recorder setup fails
Recording start failed. Error: MediaRecorder init failed
[2985:0xaaf5000] allocation failure
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
Unhandled Errors
Error: [vitest-pool]: Worker forks emitted error.
Caused by: Error: Worker exited unexpectedly
ELIFECYCLE Command failed with exit code 1.
`);

    expect(errors.map((error) => error.line)).toContain(
      'FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory'
    );
    expect(errors.map((error) => error.line)).toContain(
      'Error: [vitest-pool]: Worker forks emitted error.'
    );
    expect(errors.map((error) => error.line)).not.toContain(
      'Recording start failed. Error: MediaRecorder init failed'
    );
  });

  it('keeps compressed-size action setup failures as actionable GitHub errors', () => {
    const errors = parseErrors(`
Run preactjs/compressed-size-action@v3
Error: Unable to locate executable file: build. Please verify either the file path exists or the file can be found within a directory specified by the PATH environment variable.
Process completed with exit code 1.
`);

    expect(errors.map((error) => error.line)).toContain(
      'Error: Unable to locate executable file: build. Please verify either the file path exists or the file can be found within a directory specified by the PATH environment variable.'
    );
  });
});
