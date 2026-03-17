// Load .env from project root before any other requires
require("dotenv").config({ path: require("node:path").resolve(__dirname, "../.env") });

const http = require("node:http");
const fs = require("node:fs");
const { URL } = require("node:url");
const path = require("node:path");
const crypto = require("node:crypto");
const {
  getSession,
  getMembership,
  buildSessionPayload,
  registerUser,
  loginUser,
  requestPasswordReset,
  resetPasswordWithCode,
  upsertGoogleUser,
  updateUserProfile,
  changeUserPassword,
  saveWorkspaceState,
  upsertMediaAsset,
  getMediaAsset,
  markTranscriptionProcessing,
  saveTranscriptionResult,
  markTranscriptionFailure,
  queueTranscription,
  updateWorkspaceMemberRole,
  getHealth,
  UPLOAD_DIR,
  saveVoiceProfile,
  getWorkspaceVoiceProfiles,
  deleteVoiceProfile,
} = require("./database");
const { transcribeRecording, normalizeRecording, transcribeLiveChunk, generateVoiceCoaching } = require("./audioPipeline");
const { computeEmbedding } = require("./speakerEmbedder");

const PORT = Number(process.env.VOICELOG_API_PORT) || 4000;
const HOST = process.env.VOICELOG_API_HOST || "127.0.0.1";
const transcriptionJobs = new Map();

/* ── CORS ──────────────────────────────────────────────── */

const ALLOWED_ORIGINS = (process.env.VOICELOG_ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function corsHeaders(requestOrigin) {
  const origin = ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Workspace-Id, X-Meeting-Id, X-Speaker-Name",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  };
}

/* ── Rate limiting ─────────────────────────────────────── */

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const rateLimitMap = new Map();

// Periodically remove expired rate-limit entries to prevent unbounded memory growth.
// .unref() ensures the interval does not prevent clean process shutdown.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000).unref();

function checkRateLimit(ip, route) {
  const key = `${ip}:${route}`;
  const now = Date.now();
  let entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(key, entry);
  }

  entry.count += 1;

  if (entry.count > RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    const error = new Error("Zbyt wiele prob. Sprobuj ponownie za chwile.");
    error.statusCode = 429;
    error.retryAfter = retryAfter;
    throw error;
  }
}

/* ── Security headers ──────────────────────────────────── */

function securityHeaders() {
  return {
    "Content-Security-Policy": "default-src 'none'",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

function sendJson(response, statusCode, payload, requestOrigin) {
  response.writeHead(statusCode, {
    ...corsHeaders(requestOrigin),
    ...securityHeaders(),
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, body, requestOrigin) {
  response.writeHead(statusCode, {
    ...corsHeaders(requestOrigin),
    ...securityHeaders(),
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(body);
}

function sendNoContent(response, requestOrigin) {
  response.writeHead(204, { ...corsHeaders(requestOrigin), ...securityHeaders() });
  response.end();
}

function safeJsonParse(raw, fallbackValue) {
  if (!raw) {
    return fallbackValue;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    return fallbackValue;
  }
}

function normalizePipelineStatus(value) {
  if (value === "completed") {
    return "done";
  }
  if (["queued", "processing", "failed", "done"].includes(String(value || ""))) {
    return value;
  }
  return "queued";
}

function buildTranscriptionStatusPayload(asset) {
  const diarization = safeJsonParse(asset?.diarization_json, {});
  const segments = safeJsonParse(asset?.transcript_json, []);
  return {
    recordingId: asset?.id || "",
    pipelineStatus: normalizePipelineStatus(asset?.transcription_status),
    segments: Array.isArray(segments) ? segments : [],
    diarization: diarization && typeof diarization === "object" ? diarization : {},
    speakerNames: diarization?.speakerNames || {},
    speakerCount: diarization?.speakerCount || 0,
    confidence: diarization?.confidence || 0,
    reviewSummary: diarization?.reviewSummary || null,
    errorMessage: diarization?.errorMessage || "",
    updatedAt: asset?.updated_at || "",
  };
}

function ensureTranscriptionJob(recordingId, asset, options) {
  if (!recordingId || transcriptionJobs.has(recordingId)) {
    return;
  }

  const jobPromise = Promise.resolve()
    .then(async () => {
      markTranscriptionProcessing(recordingId);
      const result = await transcribeRecording(asset, {
        ...options,
        voiceProfiles: getWorkspaceVoiceProfiles(asset.workspace_id),
      });
      saveTranscriptionResult(recordingId, {
        ...result,
        pipelineStatus: "completed",
      });
    })
    .catch((error) => {
      markTranscriptionFailure(recordingId, error.message);
    })
    .finally(() => {
      transcriptionJobs.delete(recordingId);
    });

  transcriptionJobs.set(recordingId, jobPromise);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(new Error("Invalid JSON payload."));
      }
    });
    request.on("error", reject);
  });
}

function readBinaryBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function readRawBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function getBearerToken(request) {
  const header = String(request.headers.authorization || "");
  if (!header.startsWith("Bearer ")) {
    return "";
  }

  return header.slice("Bearer ".length).trim();
}

function requireSession(request) {
  const token = getBearerToken(request);
  if (!token) {
    const error = new Error("Brak tokenu autoryzacyjnego.");
    error.statusCode = 401;
    throw error;
  }

  const session = getSession(token);
  if (!session) {
    const error = new Error("Sesja wygasla lub jest nieprawidlowa.");
    error.statusCode = 401;
    throw error;
  }

  return session;
}

function ensureWorkspaceAccess(session, workspaceId) {
  const membership = getMembership(workspaceId, session.user_id);
  if (!membership) {
    const error = new Error("Nie masz dostepu do tego workspace.");
    error.statusCode = 403;
    throw error;
  }

  return membership;
}

async function handleRequest(request, response) {
  const origin = String(request.headers.origin || "");
  const clientIp = String(
    request.headers["x-forwarded-for"] || request.socket?.remoteAddress || "unknown"
  ).split(",")[0].trim();

  if (request.method === "OPTIONS") {
    sendNoContent(response, origin);
    return;
  }

  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;

  if (request.method === "GET" && pathname === "/health") {
    sendJson(response, 200, getHealth(), origin);
    return;
  }

  if (request.method === "POST" && pathname === "/auth/register") {
    checkRateLimit(clientIp, "auth");
    sendJson(response, 201, registerUser(await readJsonBody(request)), origin);
    return;
  }

  if (request.method === "POST" && pathname === "/auth/login") {
    checkRateLimit(clientIp, "auth");
    sendJson(response, 200, loginUser(await readJsonBody(request)), origin);
    return;
  }

  if (request.method === "POST" && pathname === "/auth/password/reset/request") {
    checkRateLimit(clientIp, "auth");
    sendJson(response, 200, requestPasswordReset(await readJsonBody(request)), origin);
    return;
  }

  if (request.method === "POST" && pathname === "/auth/password/reset/confirm") {
    checkRateLimit(clientIp, "auth");
    sendJson(response, 200, resetPasswordWithCode(await readJsonBody(request)), origin);
    return;
  }

  if (request.method === "POST" && pathname === "/auth/google") {
    checkRateLimit(clientIp, "auth");
    sendJson(response, 200, upsertGoogleUser(await readJsonBody(request)), origin);
    return;
  }

  if (request.method === "GET" && pathname === "/auth/session") {
    const session = requireSession(request);
    const workspaceId = requestUrl.searchParams.get("workspaceId") || session.workspace_id;
    ensureWorkspaceAccess(session, workspaceId);
    sendJson(response, 200, buildSessionPayload(session.user_id, workspaceId), origin);
    return;
  }

  const profileMatch = pathname.match(/^\/users\/([^/]+)\/profile$/);
  if (request.method === "PUT" && profileMatch) {
    const session = requireSession(request);
    const userId = profileMatch[1];
    if (session.user_id !== userId) {
      sendJson(response, 403, { message: "Mozesz edytowac tylko swoj profil." }, origin);
      return;
    }

    const workspaceId = requestUrl.searchParams.get("workspaceId") || session.workspace_id;
    const user = updateUserProfile(userId, await readJsonBody(request));
    sendJson(response, 200, {
      user,
      users: buildSessionPayload(session.user_id, workspaceId).users,
    }, origin);
    return;
  }

  const passwordMatch = pathname.match(/^\/users\/([^/]+)\/password$/);
  if (request.method === "POST" && passwordMatch) {
    const session = requireSession(request);
    const userId = passwordMatch[1];
    if (session.user_id !== userId) {
      sendJson(response, 403, { message: "Mozesz zmienic tylko swoje haslo." }, origin);
      return;
    }

    sendJson(response, 200, changeUserPassword(userId, await readJsonBody(request)), origin);
    return;
  }

  if (request.method === "GET" && pathname === "/state/bootstrap") {
    const session = requireSession(request);
    const workspaceId = requestUrl.searchParams.get("workspaceId") || session.workspace_id;
    ensureWorkspaceAccess(session, workspaceId);
    sendJson(response, 200, buildSessionPayload(session.user_id, workspaceId), origin);
    return;
  }

  const workspaceStateMatch = pathname.match(/^\/state\/workspaces\/([^/]+)$/);
  if (request.method === "PUT" && workspaceStateMatch) {
    const session = requireSession(request);
    const workspaceId = workspaceStateMatch[1];
    ensureWorkspaceAccess(session, workspaceId);
    sendJson(response, 200, {
      workspaceId,
      state: saveWorkspaceState(workspaceId, await readJsonBody(request)),
    }, origin);
    return;
  }

  const workspaceRoleMatch = pathname.match(/^\/workspaces\/([^/]+)\/members\/([^/]+)\/role$/);
  if (request.method === "PUT" && workspaceRoleMatch) {
    const session = requireSession(request);
    const workspaceId = workspaceRoleMatch[1];
    const targetUserId = workspaceRoleMatch[2];
    const membership = ensureWorkspaceAccess(session, workspaceId);
    if (!["owner", "admin"].includes(membership.member_role)) {
      sendJson(response, 403, { message: "Tylko owner lub admin moze zmieniac role." }, origin);
      return;
    }

    sendJson(
      response,
      200,
      updateWorkspaceMemberRole(workspaceId, targetUserId, (await readJsonBody(request)).memberRole),
      origin
    );
    return;
  }

  const mediaAudioMatch = pathname.match(/^\/media\/recordings\/([^/]+)\/audio$/);
  if (mediaAudioMatch && request.method === "PUT") {
    const session = requireSession(request);
    const recordingId = mediaAudioMatch[1];
    const workspaceId = String(request.headers["x-workspace-id"] || "");
    const meetingId = String(request.headers["x-meeting-id"] || "");
    if (!workspaceId) {
      sendJson(response, 400, { message: "Brakuje X-Workspace-Id." }, origin);
      return;
    }

    ensureWorkspaceAccess(session, workspaceId);
    const asset = upsertMediaAsset({
      recordingId,
      workspaceId,
      meetingId,
      contentType: request.headers["content-type"] || "application/octet-stream",
      buffer: await readBinaryBody(request),
      createdByUserId: session.user_id,
    });

    sendJson(response, 200, {
      id: asset.id,
      workspaceId: asset.workspace_id,
      sizeBytes: asset.size_bytes,
    }, origin);
    return;
  }

  if (mediaAudioMatch && request.method === "GET") {
    const session = requireSession(request);
    const recordingId = mediaAudioMatch[1];
    const asset = getMediaAsset(recordingId);
    if (!asset) {
      sendJson(response, 404, { message: "Nie znaleziono nagrania." }, origin);
      return;
    }

    ensureWorkspaceAccess(session, asset.workspace_id);
    if (!fs.existsSync(asset.file_path)) {
      sendJson(response, 404, { message: "Plik audio nie istnieje na serwerze." }, origin);
      return;
    }

    response.writeHead(200, {
      ...corsHeaders(origin),
      "Content-Type": asset.content_type,
      "Content-Length": String(fs.statSync(asset.file_path).size),
    });
    fs.createReadStream(asset.file_path).pipe(response);
    return;
  }

  const mediaTranscribeMatch = pathname.match(/^\/media\/recordings\/([^/]+)\/transcribe$/);
  if (mediaTranscribeMatch && request.method === "POST") {
    const session = requireSession(request);
    const recordingId = mediaTranscribeMatch[1];
    const body = await readJsonBody(request);
    const asset = getMediaAsset(recordingId);
    if (!asset) {
      sendJson(response, 404, { message: "Nie znaleziono nagrania." }, origin);
      return;
    }

    ensureWorkspaceAccess(session, body.workspaceId || asset.workspace_id);
    queueTranscription(recordingId, body);
    ensureTranscriptionJob(recordingId, asset, body);
    sendJson(response, 202, buildTranscriptionStatusPayload(getMediaAsset(recordingId)), origin);
    return;
  }

  if (mediaTranscribeMatch && request.method === "GET") {
    const session = requireSession(request);
    const recordingId = mediaTranscribeMatch[1];
    const asset = getMediaAsset(recordingId);
    if (!asset) {
      sendJson(response, 404, { message: "Nie znaleziono nagrania." }, origin);
      return;
    }

    ensureWorkspaceAccess(session, asset.workspace_id);
    sendJson(response, 200, buildTranscriptionStatusPayload(asset), origin);
    return;
  }

  // GET /voice-profiles
  if (request.method === "GET" && pathname === "/voice-profiles") {
    const session = requireSession(request);
    const profiles = getWorkspaceVoiceProfiles(session.workspace_id).map((p) => ({
      id: p.id,
      speakerName: p.speaker_name,
      userId: p.user_id,
      createdAt: p.created_at,
    }));
    return sendJson(response, 200, { profiles }, origin);
  }

  // POST /voice-profiles  — receive raw audio body
  if (request.method === "POST" && pathname === "/voice-profiles") {
    const session = requireSession(request);
    const speakerName = request.headers["x-speaker-name"] || "";
    if (!speakerName.trim()) {
      return sendJson(response, 400, { message: "Brakuje naglowka X-Speaker-Name." }, origin);
    }
    const contentType = request.headers["content-type"] || "audio/webm";
    const buffer = await readRawBody(request);
    if (!buffer || buffer.byteLength < 1000) {
      return sendJson(response, 400, { message: "Plik audio jest za krotki lub pusty." }, origin);
    }
    const profileId = `vp_${crypto.randomUUID().replace(/-/g, "")}`;
    const ext = contentType.includes("mp4") ? ".m4a" : contentType.includes("wav") ? ".wav" : ".webm";
    const audioPath = path.join(UPLOAD_DIR, `${profileId}${ext}`);
    fs.writeFileSync(audioPath, buffer);
    const embedding = await computeEmbedding(audioPath);
    const profile = saveVoiceProfile({
      id: profileId,
      userId: session.user_id,
      workspaceId: session.workspace_id,
      speakerName: speakerName.trim(),
      audioPath,
      embedding: embedding || [],
    });
    return sendJson(response, 201, {
      id: profile.id,
      speakerName: profile.speaker_name,
      hasEmbedding: (embedding || []).length > 0,
      createdAt: profile.created_at,
    }, origin);
  }

  // DELETE /voice-profiles/:id
  const deleteVpMatch = pathname.match(/^\/voice-profiles\/([a-z0-9_]+)$/);
  if (request.method === "DELETE" && deleteVpMatch) {
    const session = requireSession(request);
    deleteVoiceProfile(deleteVpMatch[1], session.workspace_id);
    return sendNoContent(response, origin);
  }

  const mediaNormalizeMatch = pathname.match(/^\/media\/recordings\/([^/]+)\/normalize$/);
  if (mediaNormalizeMatch && request.method === "POST") {
    const session = requireSession(request);
    const recordingId = mediaNormalizeMatch[1];
    const asset = getMediaAsset(recordingId);
    if (!asset) {
      sendJson(response, 404, { message: "Nie znaleziono nagrania." }, origin);
      return;
    }
    ensureWorkspaceAccess(session, asset.workspace_id);
    if (!fs.existsSync(asset.file_path)) {
      sendJson(response, 404, { message: "Plik audio nie istnieje na serwerze." }, origin);
      return;
    }
    await normalizeRecording(asset.file_path);
    sendJson(response, 200, { ok: true }, origin);
    return;
  }

  // POST /media/recordings/:id/voice-coaching — GPT-4o audio-preview coaching for a single speaker
  const mediaVoiceCoachingMatch = pathname.match(/^\/media\/recordings\/([^/]+)\/voice-coaching$/);
  if (mediaVoiceCoachingMatch && request.method === "POST") {
    const session = requireSession(request);
    const recordingId = mediaVoiceCoachingMatch[1];
    const body = await readJsonBody(request);
    const asset = getMediaAsset(recordingId);
    if (!asset) {
      sendJson(response, 404, { message: "Nie znaleziono nagrania." }, origin);
      return;
    }
    ensureWorkspaceAccess(session, asset.workspace_id);
    if (!fs.existsSync(asset.file_path)) {
      sendJson(response, 404, { message: "Plik audio nie istnieje na serwerze." }, origin);
      return;
    }
    const speakerId = String(body?.speakerId || "");
    if (!speakerId) {
      sendJson(response, 400, { message: "Brakuje speakerId." }, origin);
      return;
    }
    const segments = Array.isArray(body?.segments) ? body.segments : [];
    const coaching = await generateVoiceCoaching(asset, speakerId, segments);
    sendJson(response, 200, { coaching }, origin);
    return;
  }

  // POST /transcribe/live — accepts a small audio blob, returns Whisper text for live captioning
  if (request.method === "POST" && pathname === "/transcribe/live") {
    requireSession(request);
    const contentType = request.headers["content-type"] || "audio/webm";
    const buffer = await readBinaryBody(request);
    if (!buffer || buffer.byteLength < 500) {
      sendJson(response, 200, { text: "" }, origin);
      return;
    }
    const ext = contentType.includes("mp4") ? ".m4a" : contentType.includes("wav") ? ".wav" : ".webm";
    const tmpPath = path.join(UPLOAD_DIR, `live_${crypto.randomUUID().replace(/-/g, "")}${ext}`);
    try {
      fs.writeFileSync(tmpPath, buffer);
      const text = await transcribeLiveChunk(tmpPath, contentType);
      sendJson(response, 200, { text }, origin);
    } finally {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
    return;
  }

  sendText(response, 404, "Not found", origin);
}

const server = http.createServer((request, response) => {
  const origin = String(request.headers.origin || "");
  handleRequest(request, response).catch((error) => {
    const statusCode = error.statusCode || 500;
    if (statusCode === 429 && error.retryAfter) {
      response.setHeader("Retry-After", String(error.retryAfter));
    }
    sendJson(response, statusCode, {
      message: error.message || "Unexpected server error.",
    }, origin);
  });
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`VoiceLog API listening on http://${HOST}:${PORT}`);
  });
}

module.exports = {
  server,
};
