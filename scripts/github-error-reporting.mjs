function getWorkflowKey(run) {
  return run.name || String(run.workflow_id || run.id || 'unknown-workflow');
}

export function partitionWorkflowFailures(runs) {
  const latestByWorkflow = new Map();

  for (const run of runs) {
    const key = getWorkflowKey(run);
    const currentLatest = latestByWorkflow.get(key);

    if (
      !currentLatest ||
      new Date(run.created_at).getTime() > new Date(currentLatest.created_at).getTime()
    ) {
      latestByWorkflow.set(key, run);
    }
  }

  const activeFailures = [];
  const resolvedFailures = [];

  for (const run of runs) {
    if (run.conclusion !== 'failure') {
      continue;
    }

    const latestRun = latestByWorkflow.get(getWorkflowKey(run));
    if (latestRun && latestRun.id === run.id) {
      activeFailures.push(run);
    } else {
      resolvedFailures.push(run);
    }
  }

  return {
    activeFailures,
    resolvedFailures,
    latestByWorkflow: Array.from(latestByWorkflow.values()),
  };
}

function stripLogFormatting(line) {
  return String(line || '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s+/, '')
    .trim();
}

function isVitestStreamMarker(line) {
  return /^(stderr|stdout)\s+\|/i.test(stripLogFormatting(line));
}

function isKnownTestStderrNoise(line, previousLines) {
  const text = stripLogFormatting(line);
  const recentContext = previousLines.slice(-3).map(stripLogFormatting).join('\n');

  if (isVitestStreamMarker(text)) {
    return true;
  }

  if (!/^(stderr|stdout)\s+\|/im.test(recentContext)) {
    return false;
  }

  return (
    /^Recording start failed\./i.test(text) ||
    /^Immediate workspace sync after delete failed:/i.test(text) ||
    /^Audio hydration failed\b/i.test(text) ||
    /^\[httpClient\]\s+/i.test(text) ||
    /^Failed to fetch$/i.test(text) ||
    /^Permission denied$/i.test(text)
  );
}

function isActionableGithubLogLine(line, previousLines) {
  const text = stripLogFormatting(line);

  if (!text || isKnownTestStderrNoise(text, previousLines)) {
    return false;
  }

  if (
    /FATAL ERROR:/i.test(text) ||
    /\[vitest-pool\]/i.test(text) ||
    /Worker exited unexpectedly/i.test(text) ||
    /ELIFECYCLE.*exit code/i.test(text) ||
    /Process completed with exit code/i.test(text) ||
    /Unable to locate executable file:/i.test(text) ||
    /Code style issues found/i.test(text)
  ) {
    return true;
  }

  return (
    text.includes('Error:') ||
    text.includes('ERROR') ||
    text.includes('FAILED') ||
    text.includes('failed')
  );
}

// Parse actionable error lines from GitHub job logs. Test stderr often contains
// expected simulated failures, so prefer terminal CI failure lines.
export function parseErrors(logs) {
  const errors = [];
  const lines = logs.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isActionableGithubLogLine(line, lines.slice(0, i))) {
      const start = Math.max(0, i - 5);
      const end = Math.min(lines.length, i + 5);
      const context = lines.slice(start, end).join('\n');

      errors.push({
        line: stripLogFormatting(line),
        context,
        lineNumber: i + 1,
      });
    }
  }

  return errors;
}
