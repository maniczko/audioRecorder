export interface DashboardWorkflowRun {
  name: string;
  status: 'success' | 'failure' | 'skipped';
  branch: string;
  created_at: string;
  updated_at: string;
  duration_ms: number;
  url: string;
}

export interface DashboardExternalServices {
  timestamp: string;
  github: {
    status: 'connected' | 'not-configured';
    repo: { full_name: string };
    actions: {
      recent_runs: DashboardWorkflowRun[];
      latest_by_workflow: DashboardWorkflowRun[];
      total_runs: number;
      success_rate: number;
      last_run: string;
    };
    issues: {
      open: Array<{
        number: number;
        title: string;
        labels: string[];
        updated_at: string;
        url: string;
      }>;
    };
    pull_requests: {
      open: Array<{
        number: number;
        title: string;
        author: string;
        draft: boolean;
        updated_at: string;
        url: string;
      }>;
    };
  };
  sentry: {
    status: 'configured' | 'connected';
    configured: boolean;
    issues: unknown[];
    stats: null | { events_7d: number; daily: Array<{ date: string; events: number }> };
    note: string;
  };
  railway: {
    status: 'connected';
    health: {
      db: string;
      supabaseRemote: boolean;
      uptime: number;
      gitSha: string;
      buildTime: string;
      memory: { rss: string };
    };
    last_deployment: {
      state: string;
      domain: string;
      createdAt: string;
    };
    deployments: Array<{
      status: string;
      state: string;
      id: string;
      domain: string;
      createdAt: string;
    }>;
  };
  vercel: {
    status: 'connected';
    deployments: Array<{
      state: string;
      name: string;
      url: string;
      created: string;
      meta: {
        githubCommitMessage: string;
        githubCommitSha: string;
      };
    }>;
    stats: {
      deployments_7d: number;
      daily: Array<{ date: string; deployments: number }>;
    };
  };
}

export interface DashboardTestResults {
  timestamp: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    totalFiles: number;
    passingFiles: number;
    failingFiles: number;
  };
  files: Array<{
    file: string;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    coverage: number;
  }>;
  failures: unknown[];
  coverage: {
    lines: number;
    statements: number;
    functions: number;
    branches: number;
  };
  external_services: DashboardExternalServices;
}

const successfulRun: DashboardWorkflowRun = {
  name: 'CI',
  status: 'success',
  branch: 'main',
  created_at: '2026-04-25T09:40:00.000Z',
  updated_at: '2026-04-25T09:45:00.000Z',
  duration_ms: 300000,
  url: 'https://example.test/actions/runs/ci-success',
};

const failedRun: DashboardWorkflowRun = {
  name: 'Docker Build',
  status: 'failure',
  branch: 'main',
  created_at: '2026-04-25T09:15:00.000Z',
  updated_at: '2026-04-25T09:22:00.000Z',
  duration_ms: 420000,
  url: 'https://example.test/actions/runs/docker-failure',
};

const skippedRun: DashboardWorkflowRun = {
  name: 'E2E Playwright Tests',
  status: 'skipped',
  branch: 'main',
  created_at: '2026-04-25T09:05:00.000Z',
  updated_at: '2026-04-25T09:05:30.000Z',
  duration_ms: 30000,
  url: 'https://example.test/actions/runs/e2e-skipped',
};

export const externalServicesFixture: DashboardExternalServices = {
  timestamp: '2026-04-25T10:00:00.000Z',
  github: {
    status: 'connected',
    repo: { full_name: 'maniczko/audioRecorder' },
    actions: {
      recent_runs: [successfulRun, failedRun, skippedRun],
      latest_by_workflow: [successfulRun],
      total_runs: 3,
      success_rate: 67,
      last_run: successfulRun.updated_at,
    },
    issues: {
      open: [
        {
          number: 179,
          title: 'Make workflow dashboard tests hermetic',
          labels: ['tests'],
          updated_at: '2026-04-25T09:55:00.000Z',
          url: 'https://example.test/issues/179',
        },
      ],
    },
    pull_requests: {
      open: [
        {
          number: 42,
          title: 'Stabilize dashboard workflow tests',
          author: 'codex',
          draft: false,
          updated_at: '2026-04-25T09:58:00.000Z',
          url: 'https://example.test/pulls/42',
        },
      ],
    },
  },
  sentry: {
    status: 'configured',
    configured: true,
    issues: [],
    stats: null,
    note: 'Fixture snapshot: Sentry auth is intentionally not required.',
  },
  railway: {
    status: 'connected',
    health: {
      db: 'connected',
      supabaseRemote: true,
      uptime: 7200,
      gitSha: '5baa8cf758032c661f270543d3f826209f336756',
      buildTime: '2026-04-25T09:45:00.000Z',
      memory: { rss: '128 MB' },
    },
    last_deployment: {
      state: 'READY',
      domain: 'voicelog-api.example.test',
      createdAt: '2026-04-25T09:45:00.000Z',
    },
    deployments: [
      {
        status: 'SUCCESS',
        state: 'READY',
        id: 'rw-ok',
        domain: 'voicelog-api.example.test',
        createdAt: '2026-04-25T09:45:00.000Z',
      },
      {
        status: 'FAILED',
        state: 'ERROR',
        id: 'rw-failed',
        domain: 'voicelog-api-preview.example.test',
        createdAt: '2026-04-25T09:10:00.000Z',
      },
    ],
  },
  vercel: {
    status: 'connected',
    deployments: [
      {
        state: 'READY',
        name: 'voicelog-web',
        url: 'voicelog.example.test',
        created: '2026-04-25T09:50:00.000Z',
        meta: {
          githubCommitMessage: 'chore(runtime): pin local node 22',
          githubCommitSha: '5baa8cf758032c661f270543d3f826209f336756',
        },
      },
      {
        state: 'ERROR',
        name: 'voicelog-web-preview',
        url: 'voicelog-preview.example.test',
        created: '2026-04-25T09:20:00.000Z',
        meta: {
          githubCommitMessage: 'fix(ci): reproduce dashboard failure',
          githubCommitSha: '0000000000000000000000000000000000000000',
        },
      },
    ],
    stats: {
      deployments_7d: 2,
      daily: [
        { date: '2026-04-24', deployments: 1 },
        { date: '2026-04-25', deployments: 1 },
      ],
    },
  },
};

export const testResultsFixture: DashboardTestResults = {
  timestamp: '2026-04-25T09:55:00.000Z',
  summary: {
    total: 18,
    passed: 18,
    failed: 0,
    skipped: 0,
    totalFiles: 3,
    passingFiles: 3,
    failingFiles: 0,
  },
  files: [
    {
      file: 'scripts/dashboard-services.test.ts',
      passed: 5,
      failed: 0,
      skipped: 0,
      duration: 120,
      coverage: 92,
    },
    {
      file: 'scripts/test-dashboard-pro.test.ts',
      passed: 8,
      failed: 0,
      skipped: 0,
      duration: 260,
      coverage: 88,
    },
    {
      file: 'scripts/workflow-dashboard-hermetic.test.ts',
      passed: 5,
      failed: 0,
      skipped: 0,
      duration: 90,
      coverage: 95,
    },
  ],
  failures: [],
  coverage: {
    lines: 91,
    statements: 90,
    functions: 87,
    branches: 84,
  },
  external_services: externalServicesFixture,
};
