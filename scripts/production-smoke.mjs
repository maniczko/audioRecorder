import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOJIBAKE_PATTERN =
  /[\u00c4\u00c5\u0102\u00c2\ufffd]|\u00e2[\u0080-\u00bf\u20ac\u201a-\u201e]/;
const TRANSIENT_SMOKE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEFAULT_VOICE_PROFILE_RETRY_ATTEMPTS = 6;
const DEFAULT_VOICE_PROFILE_RETRY_DELAY_MS = 5000;

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

function sleep(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePositiveInteger(value, fallback) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return fallback;

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInteger(value, fallback) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return fallback;

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function extractFrontendBuildId(html) {
  const text = String(html || '');

  const inlineScriptMatch = text.match(
    /window\.__VOICELOG_FRONTEND_BUILD_ID__\s*=\s*["']([a-fA-F0-9]+)["']/m
  );
  if (inlineScriptMatch?.[1]) {
    return inlineScriptMatch[1].toLowerCase();
  }

  const fallbackMatch = text.match(/data-voicelog-build-id=(["'])([a-fA-F0-9]+)\1/i);
  if (fallbackMatch?.[2]) {
    return fallbackMatch[2].toLowerCase();
  }

  return '';
}

async function fetchWithTransientRetry(
  url,
  init,
  { label = 'production smoke request', attempts = 3, retryDelayMs = 1000 } = {}
) {
  const maxAttempts = Math.max(1, attempts);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      const shouldRetry =
        !response.ok && TRANSIENT_SMOKE_STATUSES.has(response.status) && attempt < maxAttempts;
      if (!shouldRetry) return response;

      const body = await response.text().catch(() => '');
      console.warn(
        `[production-smoke] ${label} returned ${response.status}; retrying ${attempt}/${maxAttempts}. ${body.slice(0, 180)}`
      );
    } catch (error) {
      if (attempt >= maxAttempts) throw error;
      console.warn(
        `[production-smoke] ${label} failed; retrying ${attempt}/${maxAttempts}. ${error?.message || error}`
      );
    }

    await sleep(retryDelayMs * attempt);
  }

  throw new Error(`${label} failed before receiving a response.`);
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
  requirePersistenceEvidence = process.env.PRODUCTION_REQUIRE_AUDIO_UPLOAD_SMOKE === 'true',
} = {}) {
  const token = String(authToken || '').trim();
  const workspace = String(workspaceId || '').trim();
  if (!token || !workspace) {
    return false;
  }

  const recordingId = `production_smoke_${Date.now()}`;
  const uploadUrl = `${api}/media/recordings/${recordingId}/audio`;
  const audioBuffer = createSyntheticWavBuffer();
  const response = await fetchWithTransientRetry(
    uploadUrl,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'audio/wav',
        'X-Workspace-Id': workspace,
        'X-Meeting-Id': meetingId,
      },
      body: audioBuffer,
    },
    { label: 'audio upload smoke' }
  );

  if (!response.ok) {
    throw new Error(`Audio upload smoke failed: ${response.status} ${await response.text()}`);
  }

  const expectedStoragePath = `${recordingId}.wav`;
  let persistenceChecked = false;
  if (requirePersistenceEvidence) {
    await assertAudioUploadPersistence({ recordingId, expectedStoragePath });
    persistenceChecked = true;
  }

  await fetch(`${api}/media/recordings/${recordingId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Workspace-Id': workspace,
    },
  }).catch(() => undefined);

  return { checked: true, persistenceChecked };
}

function isValidSupabaseProjectUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
}

async function assertAudioUploadPersistence({ recordingId, expectedStoragePath }) {
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Audio upload persistence smoke requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }
  if (!isValidSupabaseProjectUrl(supabaseUrl)) {
    throw new Error(
      'Audio upload persistence smoke requires SUPABASE_URL to be the Supabase project API URL, not a Postgres connection string.'
    );
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const assetResult = await supabase
    .from('media_assets')
    .select('file_path')
    .eq('id', recordingId)
    .maybeSingle();

  if (assetResult.error) {
    throw new Error(
      `Audio upload persistence smoke failed to read media_assets: ${assetResult.error.message}`
    );
  }

  const filePath = String(assetResult.data?.file_path || '');
  if (filePath !== expectedStoragePath) {
    throw new Error(
      `Audio upload persistence smoke expected media_assets.file_path=${expectedStoragePath}, received ${filePath || '<missing>'}.`
    );
  }

  const objectResult = await supabase.storage.from('recordings').list('', {
    limit: 1,
    search: expectedStoragePath,
  });

  if (objectResult.error) {
    throw new Error(
      `Audio upload persistence smoke failed to list Supabase Storage objects: ${objectResult.error.message}`
    );
  }

  const objectExists = Array.isArray(objectResult.data)
    ? objectResult.data.some((entry) => entry?.name === expectedStoragePath)
    : false;
  if (!objectExists) {
    throw new Error(
      `Audio upload persistence smoke expected Supabase Storage object recordings/${expectedStoragePath}.`
    );
  }
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

function createSyntheticWavBuffer({ durationSeconds = 2.5, sampleRate = 16000 } = {}) {
  const channels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const sampleCount = Math.max(1, Math.floor(durationSeconds * sampleRate));
  const dataSize = sampleCount * channels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const envelope = Math.min(
      1,
      index / (sampleRate * 0.08),
      (sampleCount - index) / (sampleRate * 0.08)
    );
    const sample =
      Math.sin(2 * Math.PI * 220 * time) * 0.28 * envelope +
      Math.sin(2 * Math.PI * 440 * time) * 0.12 * envelope;
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + index * 2);
  }

  return buffer;
}

async function createSupabaseSmokeClient(client) {
  if (client) return client;

  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Voice profile smoke dynamic fixture requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }
  if (!isValidSupabaseProjectUrl(supabaseUrl)) {
    throw new Error(
      'Voice profile smoke dynamic fixture requires SUPABASE_URL to be the Supabase project API URL, not a Postgres connection string.'
    );
  }

  const { createClient } = await import('@supabase/supabase-js');
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function seedVoiceProfileSmokeTranscript({
  supabaseClient,
  recordingId,
  workspaceId,
  speakerId,
  speakerName,
}) {
  const segment = {
    id: `${recordingId}_segment_1`,
    speakerId,
    speakerName,
    text: 'To jest testowy fragment audytu profilu glosu.',
    timestamp: 0.15,
    endTimestamp: 2.15,
  };
  const nowIso = new Date().toISOString();
  const updateResult = await supabaseClient
    .from('media_assets')
    .update({
      transcription_status: 'completed',
      transcript_json: JSON.stringify([segment]),
      diarization_json: JSON.stringify({
        speakerCount: 1,
        speakerNames: { [speakerId]: speakerName },
        segments: [segment],
        source: 'production_smoke_dynamic_fixture',
      }),
      updated_at: nowIso,
    })
    .eq('id', recordingId)
    .eq('workspace_id', workspaceId)
    .select('id,file_path')
    .maybeSingle();

  if (updateResult.error) {
    throw new Error(
      `Voice profile smoke failed to seed media_assets transcript: ${updateResult.error.message}`
    );
  }
  if (!updateResult.data?.id) {
    throw new Error(
      `Voice profile smoke failed to find uploaded media_assets row for ${recordingId}.`
    );
  }
  return updateResult.data;
}

async function assertVoiceProfilePreflightReady({
  api,
  token,
  workspace,
  recording,
  speaker,
  name,
  retryAttempts,
  retryDelayMs,
}) {
  const response = await fetchWithTransientRetry(
    `${api}/media/recordings/${encodeURIComponent(recording)}/voice-profiles/from-speaker/preflight`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Workspace-Id': workspace,
      },
      body: JSON.stringify({ speakerId: speaker, speakerName: name }),
    },
    { label: 'voice profile preflight smoke', attempts: retryAttempts, retryDelayMs }
  );
  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(`Voice profile preflight smoke failed: ${response.status}`);
  }
  if (payload?.ready !== true) {
    const code = payload?.code ? ` ${payload.code}` : '';
    const stage = payload?.stage ? ` stage=${payload.stage}` : '';
    const message = payload?.message ? ` ${payload.message}` : '';
    throw new Error(`Voice profile preflight smoke failed:${code}${stage}${message}`.trim());
  }
}

async function enrollVoiceProfileFromSpeaker({
  api,
  token,
  workspace,
  recording,
  speaker,
  name,
  retryAttempts,
  retryDelayMs,
}) {
  const enrollResponse = await fetchWithTransientRetry(
    `${api}/media/recordings/${encodeURIComponent(recording)}/voice-profiles/from-speaker`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Workspace-Id': workspace,
      },
      body: JSON.stringify({ speakerId: speaker, speakerName: name }),
    },
    { label: 'voice profile enrollment smoke', attempts: retryAttempts, retryDelayMs }
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

  const profilesResponse = await fetchWithTransientRetry(
    `${api}/voice-profiles`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Workspace-Id': workspace,
      },
    },
    { label: 'voice profile refresh smoke', attempts: retryAttempts, retryDelayMs }
  );
  const profilesPayload = await readJsonResponse(profilesResponse);
  if (!profilesResponse.ok) {
    throw new Error(`Voice profile refresh smoke failed: ${profilesResponse.status}`);
  }

  const profiles = Array.isArray(profilesPayload?.profiles) ? profilesPayload.profiles : [];
  const normalizedName = name.toLowerCase();
  const profile = profiles.find((candidate) =>
    String(candidate?.speakerName || candidate?.speaker_name || '')
      .trim()
      .toLowerCase()
      .includes(normalizedName)
  );
  if (!profile) {
    throw new Error(`Voice profile smoke failed: saved profile for "${name}" was not visible.`);
  }

  return {
    profileId: String(profile.id || enrollPayload?.id || '').trim(),
  };
}

async function cleanupVoiceProfileSmokeFixture({
  api,
  token,
  workspace,
  recording,
  profileIds,
  retryAttempts,
  retryDelayMs,
}) {
  for (const profileId of [...new Set(profileIds.filter(Boolean))]) {
    const response = await fetchWithTransientRetry(
      `${api}/voice-profiles/${encodeURIComponent(profileId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Workspace-Id': workspace,
        },
      },
      { label: 'voice profile cleanup smoke', attempts: retryAttempts, retryDelayMs }
    );
    if (![204, 404].includes(response.status)) {
      throw new Error(
        `Voice profile smoke cleanup failed for profile ${profileId}: ${response.status}`
      );
    }
  }

  if (recording) {
    const response = await fetchWithTransientRetry(
      `${api}/media/recordings/${encodeURIComponent(recording)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Workspace-Id': workspace,
        },
      },
      { label: 'voice profile recording cleanup smoke', attempts: retryAttempts, retryDelayMs }
    );
    if (![204, 404].includes(response.status)) {
      throw new Error(
        `Voice profile smoke cleanup failed for recording ${recording}: ${response.status}`
      );
    }
  }
}

export async function runVoiceProfileSmoke({
  api,
  authToken = process.env.PRODUCTION_SMOKE_AUTH_TOKEN,
  workspaceId = process.env.PRODUCTION_SMOKE_WORKSPACE_ID,
  recordingId = process.env.PRODUCTION_SMOKE_VOICE_PROFILE_RECORDING_ID,
  speakerId = process.env.PRODUCTION_SMOKE_VOICE_PROFILE_SPEAKER_ID,
  speakerName = process.env.PRODUCTION_SMOKE_VOICE_PROFILE_SPEAKER_NAME,
  mode = process.env.PRODUCTION_SMOKE_VOICE_PROFILE_MODE || 'dynamic',
  now = () => Date.now(),
  supabaseClient,
  retryAttempts = parsePositiveInteger(
    process.env.PRODUCTION_SMOKE_VOICE_PROFILE_ATTEMPTS,
    DEFAULT_VOICE_PROFILE_RETRY_ATTEMPTS
  ),
  retryDelayMs = parseNonNegativeInteger(
    process.env.PRODUCTION_SMOKE_VOICE_PROFILE_RETRY_DELAY_MS,
    DEFAULT_VOICE_PROFILE_RETRY_DELAY_MS
  ),
} = {}) {
  const token = String(authToken || '').trim();
  const workspace = String(workspaceId || '').trim();
  if (!token || !workspace) {
    return false;
  }

  if (
    String(mode || '')
      .trim()
      .toLowerCase() === 'static'
  ) {
    const recording = String(recordingId || '').trim();
    const speaker = String(speakerId || '').trim();
    const name = String(speakerName || '').trim();
    if (!recording || !speaker || !name) {
      return false;
    }
    await assertVoiceProfilePreflightReady({
      api,
      token,
      workspace,
      recording,
      speaker,
      name,
      retryAttempts,
      retryDelayMs,
    });
    await enrollVoiceProfileFromSpeaker({
      api,
      token,
      workspace,
      recording,
      speaker,
      name,
      retryAttempts,
      retryDelayMs,
    });
    return true;
  }

  const runId = String(now()).replace(/[^a-zA-Z0-9_-]/g, '') || String(Date.now());
  const recording = `production_smoke_voice_profile_${runId}`;
  const meeting = `production_smoke_voice_profile_meeting_${runId}`;
  const speaker = `speaker_smoke_${runId}`;
  const name = `production_smoke_voice_${runId}`;
  const profileIds = [];
  let primaryError = null;

  try {
    const uploadResponse = await fetchWithTransientRetry(
      `${api}/media/recordings/${recording}/audio`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'audio/wav',
          'X-Workspace-Id': workspace,
          'X-Meeting-Id': meeting,
        },
        body: createSyntheticWavBuffer(),
      },
      {
        label: 'voice profile fixture upload',
        attempts: retryAttempts,
        retryDelayMs,
      }
    );
    if (!uploadResponse.ok) {
      throw new Error(
        `Voice profile fixture upload failed: ${uploadResponse.status} ${await uploadResponse.text()}`
      );
    }

    const client = await createSupabaseSmokeClient(supabaseClient);
    await seedVoiceProfileSmokeTranscript({
      supabaseClient: client,
      recordingId: recording,
      workspaceId: workspace,
      speakerId: speaker,
      speakerName: name,
    });

    await assertVoiceProfilePreflightReady({
      api,
      token,
      workspace,
      recording,
      speaker,
      name,
      retryAttempts,
      retryDelayMs,
    });
    const result = await enrollVoiceProfileFromSpeaker({
      api,
      token,
      workspace,
      recording,
      speaker,
      name,
      retryAttempts,
      retryDelayMs,
    });
    if (result.profileId) profileIds.push(result.profileId);
    return true;
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try {
      await cleanupVoiceProfileSmokeFixture({
        api,
        token,
        workspace,
        recording,
        profileIds,
        retryAttempts,
        retryDelayMs,
      });
    } catch (cleanupError) {
      if (!primaryError) {
        throw cleanupError;
      }
      console.warn(
        '[production-smoke] Voice profile cleanup failed after primary error:',
        cleanupError?.message || cleanupError
      );
    }
  }
}

export function evaluateHealthPayload(
  payload,
  {
    requireSupabaseRemote = true,
    requireKnownGitSha = false,
    expectedGitSha = '',
    frontendBuildId = '',
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
  if (requireSupabaseRemote && payload.supabaseStorage?.ready !== true) {
    failures.push('health supabaseStorage.ready must be true in production');
  }
  if (
    requireSupabaseRemote &&
    payload.supabaseStorage?.status &&
    payload.supabaseStorage.status !== 'ready'
  ) {
    failures.push(
      `health supabaseStorage.status must be ready in production, received ${payload.supabaseStorage.status}`
    );
  }

  if (payload.status && !['ok', 'healthy'].includes(String(payload.status))) {
    failures.push(`health status must be ok/healthy, received ${payload.status}`);
  }

  const gitSha = String(payload.gitSha || '')
    .trim()
    .toLowerCase();
  const normalizedFrontendBuildId = String(frontendBuildId || '')
    .trim()
    .toLowerCase();
  if (requireKnownGitSha && (!gitSha || gitSha === 'unknown')) {
    failures.push('health gitSha must be configured and cannot be unknown in production');
  }
  if (requireKnownGitSha && !normalizedFrontendBuildId) {
    failures.push('frontend build id must be configured and cannot be empty in production');
  }

  const normalizedExpectedGitSha = String(expectedGitSha || '')
    .trim()
    .toLowerCase();
  if (normalizedExpectedGitSha && (!gitSha || gitSha !== normalizedExpectedGitSha)) {
    failures.push(
      `backend health gitSha mismatch (expected ${normalizedExpectedGitSha}, received ${gitSha || 'unknown'})`
    );
  }
  if (
    normalizedExpectedGitSha &&
    (!normalizedFrontendBuildId || normalizedFrontendBuildId !== normalizedExpectedGitSha)
  ) {
    failures.push(
      `frontend build id mismatch (expected ${normalizedExpectedGitSha}, received ${normalizedFrontendBuildId || 'unknown'})`
    );
  }
  if (
    !normalizedExpectedGitSha &&
    gitSha &&
    normalizedFrontendBuildId &&
    gitSha !== normalizedFrontendBuildId
  ) {
    failures.push(`frontend/backend gitSha mismatch (${normalizedFrontendBuildId} vs ${gitSha})`);
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
  expectedGitSha = process.env.PRODUCTION_EXPECTED_GIT_SHA || process.env.GITHUB_SHA || '',
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
  const frontendBuildId = extractFrontendBuildId(frontendResult.text);
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
    expectedGitSha,
    requirePremiumStt,
    frontendBuildId,
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

  const audioUploadResult = await runAudioUploadSmoke({ api });
  const audioUploadChecked = Boolean(audioUploadResult && audioUploadResult.checked);
  const audioPersistenceChecked = Boolean(
    audioUploadResult && audioUploadResult.persistenceChecked
  );
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
      'Voice profile smoke requires PRODUCTION_SMOKE_AUTH_TOKEN and PRODUCTION_SMOKE_WORKSPACE_ID. Dynamic fixture seeding also requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  return {
    frontend,
    api,
    supabaseRemote: Boolean(healthPayload.supabaseRemote),
    gitSha: String(healthPayload.gitSha || ''),
    frontendBuildId,
    audioUploadChecked,
    audioPersistenceChecked,
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
            audioPersistenceChecked: result.audioPersistenceChecked,
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
