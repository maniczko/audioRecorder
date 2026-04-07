(function attachDashboardServices(global) {
  const VERCEL_NON_FAILURE_STATES = new Set(['READY', 'BUILDING', 'QUEUED', 'INITIALIZING']);
  const RAILWAY_NON_FAILURE_STATUSES = new Set([
    'SUCCESS',
    'SUCCESSFUL',
    'SUCCEEDED',
    'COMPLETED',
    'DEPLOYED',
    'LIVE',
    'BUILDING',
    'QUEUED',
    'INITIALIZING',
    'IN_PROGRESS',
  ]);

  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeStatus(value) {
    return typeof value === 'string' ? value.trim().toUpperCase() : '';
  }

  function isVercelFailure(state) {
    const normalized = normalizeStatus(state);
    return normalized.length > 0 && !VERCEL_NON_FAILURE_STATES.has(normalized);
  }

  function isRailwayFailure(status) {
    const normalized = normalizeStatus(status);
    return normalized.length > 0 && !RAILWAY_NON_FAILURE_STATUSES.has(normalized);
  }

  function normalizeServicesData(services) {
    const raw = services && typeof services === 'object' ? services : {};

    const github = raw.github && typeof raw.github === 'object' ? raw.github : {};
    const githubActions =
      github.actions && typeof github.actions === 'object' ? github.actions : {};
    const githubRepo = github.repo && typeof github.repo === 'object' ? github.repo : {};
    const githubIssues =
      github.issues && typeof github.issues === 'object' ? github.issues : {};
    const githubPullRequests =
      github.pull_requests && typeof github.pull_requests === 'object' ? github.pull_requests : {};

    const runs = toArray(githubActions.recent_runs);
    const latest = toArray(githubActions.latest_by_workflow);
    const issues = toArray(githubIssues.open);
    const pullRequests = toArray(githubPullRequests.open);

    const sentry = raw.sentry && typeof raw.sentry === 'object' ? raw.sentry : {};
    const sentryIssues = toArray(sentry.issues);
    const sentryStats = sentry.stats && typeof sentry.stats === 'object' ? sentry.stats : null;

    const railway = raw.railway && typeof raw.railway === 'object' ? raw.railway : {};
    const railwayDeployments = toArray(railway.deployments);
    const railwayFailedDeployments = railwayDeployments.filter((deployment) =>
      isRailwayFailure(deployment?.status)
    );

    const vercel = raw.vercel && typeof raw.vercel === 'object' ? raw.vercel : {};
    const vercelDeployments = toArray(vercel.deployments);
    const vercelFailedDeployments = vercelDeployments.filter((deployment) =>
      isVercelFailure(deployment?.state)
    );

    const successCount = runs.filter((run) => run?.status === 'success').length;
    const failureCount = runs.filter((run) => run?.status === 'failure').length;
    const skippedCount = runs.filter((run) => run?.status === 'skipped').length;

    return {
      timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : null,
      github: {
        status: github.status || 'not-configured',
        note: github.note,
        repo: githubRepo,
        actions: githubActions,
        runs,
        latest,
        issues,
        pullRequests,
        successCount,
        failureCount,
        skippedCount,
        totalRuns: githubActions.total_runs || 0,
        successRate: githubActions.success_rate || 0,
        lastRun: githubActions.last_run || null,
      },
      sentry: {
        ...sentry,
        issues: sentryIssues,
        stats: sentryStats,
      },
      railway: {
        ...railway,
        deployments: railwayDeployments,
        failedDeployments: railwayFailedDeployments,
      },
      vercel: {
        ...vercel,
        deployments: vercelDeployments,
        failedDeployments: vercelFailedDeployments,
      },
    };
  }

  global.DashboardServices = {
    normalizeServicesData,
    isRailwayFailure,
    isVercelFailure,
  };
})(typeof window !== 'undefined' ? window : globalThis);
