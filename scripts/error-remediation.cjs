'use strict';

const AUTO_FIX_PATTERNS = [
  /\beslint\b/i,
  /\bprettier\b/i,
  /\bstylelint\b/i,
  /\bformat(?:ting)?\b/i,
  /\blint(?:ing)?\b/i,
  /\bunused import\b/i,
  /\bimport order\b/i,
];

const GUARDED_FIX_PATTERNS = [
  /\btest(?:s)?\b/i,
  /\bvitest\b/i,
  /\bplaywright\b/i,
  /\btypecheck\b/i,
  /\btypescript\b/i,
  /\btsc\b/i,
  /\bbuild\b/i,
  /\bcoverage\b/i,
  /\bheap out of memory\b/i,
  /\btimeout\b/i,
  /\bsnapshot\b/i,
  /\bassert(?:ion)?\b/i,
  /\bmodule not found\b/i,
];

const ESCALATE_PATTERNS = [
  /\bunauthorized\b/i,
  /\bforbidden\b/i,
  /\bpermission\b/i,
  /\bauth(?:entication|orization)?\b/i,
  /\bsecret\b/i,
  /\btoken\b/i,
  /\bdsn\b/i,
  /\bdatabase\b/i,
  /\bpostgres\b/i,
  /\bsupabase\b/i,
  /\bmigration\b/i,
  /\bruntime\b/i,
  /\bincident\b/i,
  /\boutage\b/i,
  /\bnetwork down\b/i,
  /\brate limit\b/i,
  /\bquota\b/i,
  /\bhealth check\b/i,
  /\b500\b/i,
  /\b502\b/i,
  /\b503\b/i,
];

function normalizeInput(input) {
  const normalized = input && typeof input === 'object' ? input : {};
  const source = String(normalized.source || 'github').trim().toLowerCase();
  const workflow = String(normalized.workflow || normalized.title || '').trim();
  const message = String(normalized.message || normalized.text || normalized.error || '').trim();
  const combinedText = [source, workflow, message].filter(Boolean).join(' ');

  return {
    source,
    workflow,
    message,
    combinedText,
  };
}

function resolveOwner(source, combinedText) {
  if (
    source === 'railway' ||
    source === 'vercel' ||
    source === 'sentry' ||
    /\bsecurity\b/i.test(combinedText) ||
    /\bnetwork\b/i.test(combinedText)
  ) {
    return 'Qwen';
  }

  return 'Codex';
}

function matchAny(patterns, value) {
  return patterns.some((pattern) => pattern.test(value));
}

function classifyError(input) {
  const { source, workflow, message, combinedText } = normalizeInput(input);
  const owner = resolveOwner(source, combinedText);
  const githubLike = source === 'github' || source === 'github actions';

  if (matchAny(ESCALATE_PATTERNS, combinedText) && !matchAny(AUTO_FIX_PATTERNS, combinedText)) {
    return {
      automation: 'escalate',
      dispatchMode: 'manual_only',
      owner,
      priority: 'P0',
      reason: 'requires environment, credential, or production investigation',
      source,
      workflow,
      message,
    };
  }

  if (matchAny(AUTO_FIX_PATTERNS, combinedText)) {
    return {
      automation: 'auto_fix',
      dispatchMode: 'direct_patch',
      owner,
      priority: 'P2',
      reason: 'deterministic lint or formatting issue',
      source,
      workflow,
      message,
    };
  }

  if (matchAny(GUARDED_FIX_PATTERNS, combinedText) || githubLike) {
    return {
      automation: 'guarded_fix',
      dispatchMode: 'branch_pr',
      owner,
      priority: source === 'sentry' ? 'P0' : 'P1',
      reason: 'code change should be tested and reviewed before merge',
      source,
      workflow,
      message,
    };
  }

  return {
    automation: source === 'github' ? 'guarded_fix' : 'escalate',
    dispatchMode: source === 'github' ? 'branch_pr' : 'manual_only',
    owner,
    priority: source === 'github' ? 'P1' : 'P0',
    reason: source === 'github' ? 'default safe fallback for code-facing CI failures' : 'manual triage required',
    source,
    workflow,
    message,
  };
}

function summarizeRemediationModes(items) {
  return items.reduce(
    (summary, item) => {
      const mode = classifyError(item).automation;
      summary[mode] = (summary[mode] || 0) + 1;
      return summary;
    },
    { auto_fix: 0, guarded_fix: 0, escalate: 0 }
  );
}

module.exports = {
  classifyError,
  summarizeRemediationModes,
};
