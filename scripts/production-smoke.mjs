import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOJIBAKE_PATTERN =
  /[\u00c4\u00c5\u0102\u00c2\ufffd]|\u00e2[\u0080-\u00bf\u20ac\u201a-\u201e]/;

function normalizeBaseUrl(value, name) {
  const normalized = String(value || '')
    .trim()
    .replace(/\/+$/, '');
  if (!normalized) {
    throw new Error(`${name} is required.`);
  }
  return normalized;
}

async function fetchText(url) {
  const response = await fetch(url, { redirect: 'follow' });
  const text = await response.text();
  return { response, text };
}

export function findMojibake(text) {
  const value = String(text || '');
  const index = value.search(MOJIBAKE_PATTERN);
  if (index < 0) return null;

  return {
    index,
    sample: value.slice(Math.max(0, index - 80), index + 160),
  };
}

export function collectFrontendAssetUrls(html, frontendUrl) {
  const frontend = new URL(frontendUrl);
  const urls = new Set();
  const assetPattern =
    /<(?:script|link)\b[^>]+(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/gi;

  for (const match of html.matchAll(assetPattern)) {
    const assetUrl = new URL(match[1], frontend);
    if (assetUrl.origin === frontend.origin) {
      urls.add(assetUrl.href);
    }
  }

  return [...urls];
}

async function assertNoFrontendMojibake(frontend, html) {
  const htmlIssue = findMojibake(html);
  if (htmlIssue) {
    throw new Error(
      `Frontend mojibake smoke failed in HTML near index ${htmlIssue.index}: ${htmlIssue.sample}`
    );
  }

  for (const assetUrl of collectFrontendAssetUrls(html, frontend)) {
    const assetResult = await fetchText(assetUrl);
    if (!assetResult.response.ok) {
      throw new Error(`Frontend asset smoke failed: ${assetResult.response.status} ${assetUrl}`);
    }

    const assetIssue = findMojibake(assetResult.text);
    if (assetIssue) {
      throw new Error(
        `Frontend mojibake smoke failed in ${assetUrl} near index ${assetIssue.index}: ${assetIssue.sample}`
      );
    }
  }
}

async function runAudioUploadSmoke({
  api,
  authToken = process.env.PRODUCTION_SMOKE_AUTH_TOKEN,
  workspaceId = process.env.PRODUCTION_SMOKE_WORKSPACE_ID,
  meetingId = process.env.PRODUCTION_SMOKE_MEETING_ID || 'production-smoke-meeting',
} = {}) {
  const token = String(authToken || '').trim();
  const workspace = String(workspaceId || '').trim();
  if (!token || !workspace) {
    return false;
  }

  const recordingId = `production_smoke_${Date.now()}`;
  const uploadUrl = `${api}/media/recordings/${recordingId}/audio`;
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'audio/webm',
      'X-Workspace-Id': workspace,
      'X-Meeting-Id': meetingId,
    },
    body: new Blob(['production-smoke-audio'], { type: 'audio/webm' }),
  });

  if (!response.ok) {
    throw new Error(`Audio upload smoke failed: ${response.status} ${await response.text()}`);
  }

  await fetch(`${api}/media/recordings/${recordingId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Workspace-Id': workspace,
    },
  }).catch(() => undefined);

  return true;
}

export async function runStaleRecordingSmoke({
  api,
  authToken = process.env.PRODUCTION_SMOKE_AUTH_TOKEN,
  workspaceId = process.env.PRODUCTION_SMOKE_WORKSPACE_ID,
  staleRecordingId = process.env.PRODUCTION_SMOKE_STALE_RECORDING_ID ||
    `production_smoke_missing_${Date.now()}`,
} = {}) {
  const token = String(authToken || '').trim();
  const workspace = String(workspaceId || '').trim();
  const recordingId = String(staleRecordingId || '').trim();
  if (!token || !workspace) {
    return false;
  }

  const response = await fetch(
    `${api}/media/recordings/${encodeURIComponent(recordingId)}/transcribe`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Workspace-Id': workspace,
      },
    }
  );

  if (response.status === 404) {
    return true;
  }

  throw new Error(
    `Stale recording smoke expected 404 for ${recordingId}, received ${response.status}: ${await response.text()}`
  );
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch (_) {
    return null;
  }
}

export async function runVoiceProfileSmoke({
  api,
  authToken = process.env.PRODUCTION_SMOKE_AUTH_TOKEN,
  workspaceId = process.env.PRODUCTION_SMOKE_WORKSPACE_ID,
  recordingId = process.env.PRODUCTION_SMOKE_VOICE_PROFILE_RECORDING_ID,
  speakerId = process.env.PRODUCTION_SMOKE_VOICE_PROFILE_SPEAKER_ID,
  speakerName = process.env.PRODUCTION_SMOKE_VOICE_PROFILE_SPEAKER_NAME,
} = {}) {
  const token = String(authToken || '').trim();
  const workspace = String(workspaceId || '').trim();
  const recording = String(recordingId || '').trim();
  const speaker = String(speakerId || '').trim();
  const name = String(speakerName || '').trim();
  if (!token || !workspace || !recording || !speaker || !name) {
    return false;
  }

  const enrollResponse = await fetch(
    `${api}/media/recordings/${encodeURIComponent(recording)}/voice-profiles/from-speaker`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Workspace-Id': workspace,
      },
      body: JSON.stringify({ speakerId: speaker, speakerName: name }),
    }
  );

  const enrollPayload = await readJsonResponse(enrollResponse);
  if (!enrollResponse.ok) {
    const code = enrollPayload?.code ? ` ${enrollPayload.code}` : '';
    const stage = enrollPayload?.stage ? ` stage=${enrollPayload.stage}` : '';
    const message = enrollPayload?.message ? ` ${enrollPayload.message}` : '';
    throw new Error(
      `Voice profile smoke failed: ${enrollResponse.status}${code}${stage}${message}`.trim()
    );
  }

  const profilesResponse = await fetch(`${api}/voice-profiles`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Workspace-Id': workspace,
    },
  });
  const profilesPayload = await readJsonResponse(profilesResponse);
  if (!profilesResponse.ok) {
    throw new Error(`Voice profile refresh smoke failed: ${profilesResponse.status}`);
  }

  const profiles = Array.isArray(profilesPayload?.profiles) ? profilesPayload.profiles : [];
  const normalizedName = name.toLowerCase();
  const hasProfile = profiles.some((profile) =>
    String(profile?.speakerName || profile?.speaker_name || '')
      .trim()
      .toLowerCase()
      .includes(normalizedName)
  );
  if (!hasProfile) {
    throw new Error(`Voice profile smoke failed: saved profile for "${name}" was not visible.`);
  }

  return true;
}

export function evaluateHealthPayload(
  payload,
  {
    requireSupabaseRemote = true,
    requireKnownGitSha = false,
    requirePremiumStt = process.env.PRODUCTION_REQUIRE_PREMIUM_STT !== 'false',
  } = {}
) {
  const failures = [];

  if (!payload || typeof payload !== 'object') {
    failures.push('health payload is not JSON object');
    return failures;
  }

  if (payload.ok !== true) {
    failures.push(`health ok must be true, received ${payload.ok}`);
  }

  if (requireSupabaseRemote && payload.supabaseRemote !== true) {
    failures.push('health supabaseRemote must be true in production');
  }

  if (payload.status && !['ok', 'healthy'].includes(String(payload.status))) {
    failures.push(`health status must be ok/healthy, received ${payload.status}`);
  }

  const gitSha = String(payload.gitSha || '')
    .trim()
    .toLowerCase();
  if (requireKnownGitSha && (!gitSha || gitSha === 'unknown')) {
    failures.push('health gitSha must be configured and cannot be unknown in production');
  }

  if (requirePremiumStt) {
    const stt = payload.stt || {};
    if (stt.policy !== 'premium') {
      failures.push(`health stt.policy must be premium, received ${stt.policy}`);
    }
    if (stt.provider !== 'openai') {
      failures.push(`health stt.provider must be openai, received ${stt.provider}`);
    }
    if (stt.fullModel !== 'gpt-4o-transcribe') {
      failures.push(`health stt.fullModel must be gpt-4o-transcribe, received ${stt.fullModel}`);
    }
    if (stt.language !== 'pl') {
      failures.push(`health stt.language must be pl, received ${stt.language}`);
    }
  }

  return failures;
}

export async function runProductionSmoke({
  frontendUrl = process.env.PRODUCTION_FRONTEND_URL,
  apiBaseUrl = process.env.PRODUCTION_API_BASE_URL || frontendUrl,
  requireSupabaseRemote = process.env.PRODUCTION_REQUIRE_SUPABASE_REMOTE !== 'false',
  requireKnownGitSha = process.env.PRODUCTION_REQUIRE_KNOWN_GIT_SHA === 'true',
  requirePremiumStt = process.env.PRODUCTION_REQUIRE_PREMIUM_STT !== 'false',
  requireSentryDsn = process.env.PRODUCTION_REQUIRE_SENTRY_DSN === 'true',
  requireAudioUploadSmoke = process.env.PRODUCTION_REQUIRE_AUDIO_UPLOAD_SMOKE === 'true',
  requireStaleRecordingSmoke = process.env.PRODUCTION_REQUIRE_STALE_RECORDING_SMOKE === 'true',
  requireVoiceProfileSmoke = process.env.PRODUCTION_REQUIRE_VOICE_PROFILE_SMOKE === 'true',
  persistenceEvidenceUrl = process.env.PRODUCTION_PERSISTENCE_EVIDENCE_URL,
} = {}) {
  const frontend = normalizeBaseUrl(frontendUrl, 'PRODUCTION_FRONTEND_URL');
  const api = normalizeBaseUrl(apiBaseUrl, 'PRODUCTION_API_BASE_URL');

  const frontendResult = await fetchText(frontend);
  if (!frontendResult.response.ok) {
    throw new Error(`Frontend smoke failed: ${frontendResult.response.status} ${frontend}`);
  }
  if (!/id=["']root["']|VoiceLog/i.test(frontendResult.text)) {
    throw new Error('Frontend smoke failed: app shell marker not found.');
  }
  await assertNoFrontendMojibake(frontend, frontendResult.text);

  if (
    requireSentryDsn &&
    !String(process.env.VITE_SENTRY_DSN || process.env.SENTRY_DSN || '').trim()
  ) {
    throw new Error('Sentry smoke failed: VITE_SENTRY_DSN/SENTRY_DSN is required for production.');
  }

  const healthResult = await fetchText(`${api}/health`);
  if (!healthResult.response.ok) {
    throw new Error(`Health smoke failed: ${healthResult.response.status} ${api}/health`);
  }

  let healthPayload;
  try {
    healthPayload = JSON.parse(healthResult.text);
  } catch (error) {
    throw new Error(`Health smoke failed: response is not JSON (${error.message}).`);
  }

  const healthFailures = evaluateHealthPayload(healthPayload, {
    requireSupabaseRemote,
    requireKnownGitSha,
    requirePremiumStt,
  });
  if (healthFailures.length > 0) {
    throw new Error(`Health smoke failed:\n- ${healthFailures.join('\n- ')}`);
  }

  if (persistenceEvidenceUrl) {
    const evidenceResult = await fetchText(persistenceEvidenceUrl);
    if (!evidenceResult.response.ok) {
      throw new Error(
        `Persistence evidence URL failed: ${evidenceResult.response.status} ${persistenceEvidenceUrl}`
      );
    }
  }

  const audioUploadChecked = await runAudioUploadSmoke({ api });
  if (requireAudioUploadSmoke && !audioUploadChecked) {
    throw new Error(
      'Audio upload smoke requires PRODUCTION_SMOKE_AUTH_TOKEN and PRODUCTION_SMOKE_WORKSPACE_ID.'
    );
  }

  const staleRecordingChecked = await runStaleRecordingSmoke({ api });
  if (requireStaleRecordingSmoke && !staleRecordingChecked) {
    throw new Error(
      'Stale recording smoke requires PRODUCTION_SMOKE_AUTH_TOKEN and PRODUCTION_SMOKE_WORKSPACE_ID.'
    );
  }

  const voiceProfileChecked = await runVoiceProfileSmoke({ api });
  if (requireVoiceProfileSmoke && !voiceProfileChecked) {
    throw new Error(
      'Voice profile smoke requires PRODUCTION_SMOKE_AUTH_TOKEN, PRODUCTION_SMOKE_WORKSPACE_ID, PRODUCTION_SMOKE_VOICE_PROFILE_RECORDING_ID, PRODUCTION_SMOKE_VOICE_PROFILE_SPEAKER_ID, and PRODUCTION_SMOKE_VOICE_PROFILE_SPEAKER_NAME.'
    );
  }

  return {
    frontend,
    api,
    supabaseRemote: Boolean(healthPayload.supabaseRemote),
    gitSha: String(healthPayload.gitSha || ''),
    audioUploadChecked,
    staleRecordingChecked,
    voiceProfileChecked,
    persistenceEvidenceChecked: Boolean(persistenceEvidenceUrl),
  };
}

const entrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isMainModule = entrypointPath === path.resolve(rootDir, 'scripts/production-smoke.mjs');

if (isMainModule) {
  runProductionSmoke()
    .then((result) => {
      console.log('Production smoke passed.');
      console.log(
        JSON.stringify(
          {
            frontend: result.frontend,
            api: result.api,
            supabaseRemote: result.supabaseRemote,
            gitSha: result.gitSha,
            audioUploadChecked: result.audioUploadChecked,
            staleRecordingChecked: result.staleRecordingChecked,
            voiceProfileChecked: result.voiceProfileChecked,
            persistenceEvidenceChecked: result.persistenceEvidenceChecked,
          },
          null,
          2
        )
      );
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
