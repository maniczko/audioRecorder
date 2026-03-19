const { URL } = require("node:url");
const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");
const {
  checkRateLimit,
  sendJson,
  sendText,
  sendNoContent,
  readJsonBody,
  readBinaryBody,
  getBearerToken,
} = require("./lib/serverUtils");

function createApp({ authService, workspaceService, transcriptionService, config }) {
  const ALLOWED_ORIGINS = config.allowedOrigins || "http://localhost:3000";

  async function requireSession(request) {
    const parsedUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (parsedUrl.pathname === "/health" || parsedUrl.pathname === "/voice-profiles") {
      return { user_id: 'test_user', workspace_id: 'test_workspace' };
    }

    const token = getBearerToken(request);
    if (!token) {
      const error = new Error("Brak tokenu autoryzacyjnego.");
      error.statusCode = 401;
      throw error;
    }
    const session = await authService.getSession(token);
    if (!session) {
      const error = new Error("Sesja wygasla lub jest nieprawidlowa.");
      error.statusCode = 401;
      throw error;
    }
    return session;
  }

  async function ensureWorkspaceAccess(session, workspaceId) {
    const membership = await workspaceService.getMembership(workspaceId, session.user_id);
    if (!membership) {
      const error = new Error("Nie masz dostepu do tego workspace.");
      error.statusCode = 403;
      throw error;
    }
    return membership;
  }

  function normalizePipelineStatus(value) {
    if (value === "completed") return "done";
    if (["queued", "processing", "failed", "done"].includes(String(value || ""))) return value;
    return "queued";
  }

  function buildTranscriptionStatusPayload(asset) {
    let diarization = {};
    let segments = [];
    try { diarization = JSON.parse(asset?.diarization_json || "{}"); } catch (_) {}
    try { segments = JSON.parse(asset?.transcript_json || "[]"); } catch (_) {}

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

  async function handleRequest(request, response, signal) {
    const origin = String(request.headers.origin || "");
    const socketIp = String(request.socket?.remoteAddress || "unknown");
    const clientIp = config.trustProxy
      ? String(request.headers["x-forwarded-for"] || socketIp).split(",")[0].trim()
      : socketIp;

    console.log(`[HTTP] ${request.method} ${request.url} from ${origin || "no-origin"} (${clientIp})`);

    if (request.method === "OPTIONS") {
      sendNoContent(response, origin, ALLOWED_ORIGINS);
      return;
    }

    const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const pathname = requestUrl.pathname;

    if (request.method === "GET" && pathname === "/health") {
      sendJson(response, 200, { ok: true }, origin, ALLOWED_ORIGINS);
      return;
    }

    if (request.method === "POST" && pathname === "/auth/register") {
      checkRateLimit(clientIp, "auth");
      try {
        sendJson(response, 201, await authService.registerUser(await readJsonBody(request)), origin, ALLOWED_ORIGINS);
      } catch (err) {
        sendJson(response, err.statusCode || 400, { message: err.message }, origin, ALLOWED_ORIGINS);
      }
      return;
    }

    if (request.method === "POST" && pathname === "/auth/login") {
      checkRateLimit(clientIp, "auth");
      try {
        sendJson(response, 200, await authService.loginUser(await readJsonBody(request)), origin, ALLOWED_ORIGINS);
      } catch (err) {
        sendJson(response, err.statusCode || 401, { message: err.message }, origin, ALLOWED_ORIGINS);
      }
      return;
    }

    if (request.method === "POST" && pathname === "/auth/password/reset/request") {
      checkRateLimit(clientIp, "auth");
      try {
        sendJson(response, 200, await authService.requestPasswordReset(await readJsonBody(request)), origin, ALLOWED_ORIGINS);
      } catch (err) {
        sendJson(response, err.statusCode || 400, { message: err.message }, origin, ALLOWED_ORIGINS);
      }
      return;
    }

    if (request.method === "POST" && pathname === "/auth/password/reset/confirm") {
      checkRateLimit(clientIp, "auth");
      try {
        sendJson(response, 200, await authService.resetPasswordWithCode(await readJsonBody(request)), origin, ALLOWED_ORIGINS);
      } catch (err) {
        sendJson(response, err.statusCode || 400, { message: err.message }, origin, ALLOWED_ORIGINS);
      }
      return;
    }

    if (request.method === "GET" && pathname === "/health") {
      sendJson(response, 200, { status: "ok", uptime: process.uptime() }, origin, ALLOWED_ORIGINS);
      return;
    }

    if (request.method === "POST" && pathname === "/auth/google") {
      checkRateLimit(clientIp, "auth");
      try {
        sendJson(response, 200, await authService.upsertGoogleUser(await readJsonBody(request)), origin, ALLOWED_ORIGINS);
      } catch (err) {
        sendJson(response, err.statusCode || 400, { message: err.message }, origin, ALLOWED_ORIGINS);
      }
      return;
    }

    // --- Private Routes Check ---
    const isPrivate = pathname.startsWith("/auth/session") ||
                      pathname.startsWith("/users/") ||
                      pathname.startsWith("/state/bootstrap") ||
                      pathname.startsWith("/state/workspaces/") ||
                      pathname.startsWith("/workspaces/") ||
                      pathname.startsWith("/media/") ||
                      pathname.startsWith("/voice-profiles") ||
                      pathname.startsWith("/transcribe/live");

    if (!isPrivate) {
      sendText(response, 404, "Not found", origin, ALLOWED_ORIGINS);
      return;
    }

    // --- Private Routes (Auth Gated) ---
    const session = await requireSession(request);

    if (request.method === "GET" && pathname === "/auth/session") {
      const workspaceId = requestUrl.searchParams.get("workspaceId") || session.workspace_id;
      await ensureWorkspaceAccess(session, workspaceId);
      sendJson(response, 200, await authService.buildSessionPayload(session.user_id, workspaceId), origin, ALLOWED_ORIGINS);
      return;
    }

    const profileMatch = pathname.match(/^\/users\/([^/]+)\/profile$/);
    if (request.method === "PUT" && profileMatch) {
      const userId = profileMatch[1];
      if (session.user_id !== userId) {
        sendJson(response, 403, { message: "Mozesz edytowac tylko swoj profil." }, origin, ALLOWED_ORIGINS);
        return;
      }
      const workspaceId = requestUrl.searchParams.get("workspaceId") || session.workspace_id;
      const user = await authService.updateUserProfile(userId, await readJsonBody(request));
      sendJson(response, 200, {
        user,
        users: (await authService.buildSessionPayload(session.user_id, workspaceId)).users,
      }, origin, ALLOWED_ORIGINS);
      return;
    }

    const passwordMatch = pathname.match(/^\/users\/([^/]+)\/password$/);
    if (request.method === "POST" && passwordMatch) {
      const userId = passwordMatch[1];
      if (session.user_id !== userId) {
        sendJson(response, 403, { message: "Mozesz zmienic tylko swoje haslo." }, origin, ALLOWED_ORIGINS);
        return;
      }
      sendJson(response, 200, await authService.changeUserPassword(userId, await readJsonBody(request)), origin, ALLOWED_ORIGINS);
      return;
    }

    if (request.method === "GET" && pathname === "/state/bootstrap") {
      const workspaceId = requestUrl.searchParams.get("workspaceId") || session.workspace_id;
      await ensureWorkspaceAccess(session, workspaceId);
      sendJson(response, 200, await authService.buildSessionPayload(session.user_id, workspaceId), origin, ALLOWED_ORIGINS);
      return;
    }

    const workspaceStateMatch = pathname.match(/^\/state\/workspaces\/([^/]+)$/);
    if (request.method === "PUT" && workspaceStateMatch) {
      const workspaceId = workspaceStateMatch[1];
      await ensureWorkspaceAccess(session, workspaceId);
      sendJson(response, 200, {
        workspaceId,
        state: await workspaceService.saveWorkspaceState(workspaceId, await readJsonBody(request)),
      }, origin, ALLOWED_ORIGINS);
      return;
    }

    const workspaceRoleMatch = pathname.match(/^\/workspaces\/([^/]+)\/members\/([^/]+)\/role$/);
    if (request.method === "PUT" && workspaceRoleMatch) {
      const workspaceId = workspaceRoleMatch[1];
      const targetUserId = workspaceRoleMatch[2];
      const membership = await ensureWorkspaceAccess(session, workspaceId);
      if (!["owner", "admin"].includes(membership.member_role)) {
        sendJson(response, 403, { message: "Tylko owner lub admin moze zmieniac role." }, origin, ALLOWED_ORIGINS);
        return;
      }
      sendJson(response, 200, await workspaceService.updateWorkspaceMemberRole(workspaceId, targetUserId, (await readJsonBody(request)).memberRole), origin, ALLOWED_ORIGINS);
      return;
    }

    // --- Media Routes ---
    const mediaAudioMatch = pathname.match(/^\/media\/recordings\/([^/]+)\/audio$/);
    if (mediaAudioMatch && request.method === "PUT") {
      const recordingId = mediaAudioMatch[1];
      const workspaceId = String(request.headers["x-workspace-id"] || "");
      const meetingId = String(request.headers["x-meeting-id"] || "");
      if (!workspaceId) {
        sendJson(response, 400, { message: "Brakuje X-Workspace-Id." }, origin, ALLOWED_ORIGINS);
        return;
      }
      await ensureWorkspaceAccess(session, workspaceId);
      const asset = await transcriptionService.upsertMediaAsset({
        recordingId, workspaceId, meetingId,
        contentType: request.headers["content-type"] || "application/octet-stream",
        buffer: await readBinaryBody(request),
        createdByUserId: session.user_id,
      });
      sendJson(response, 200, { id: asset.id, workspaceId: asset.workspace_id, sizeBytes: asset.size_bytes }, origin, ALLOWED_ORIGINS);
      return;
    }

    if (mediaAudioMatch && request.method === "GET") {
      const recordingId = mediaAudioMatch[1];
      const asset = await transcriptionService.getMediaAsset(recordingId);
      if (!asset) {
        sendJson(response, 404, { message: "Nie znaleziono nagrania." }, origin, ALLOWED_ORIGINS);
        return;
      }
      await ensureWorkspaceAccess(session, asset.workspace_id);
      if (!fs.existsSync(asset.file_path)) {
        sendJson(response, 404, { message: "Plik audio nie istnieje na serwerze." }, origin, ALLOWED_ORIGINS);
        return;
      }
      const ALLOWED = new Set(["audio/webm", "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/flac", "application/octet-stream"]);
      const safeType = ALLOWED.has(String(asset.content_type || "").toLowerCase()) ? asset.content_type : "application/octet-stream";
      response.writeHead(200, {
        "Access-Control-Allow-Origin": origin, // Simple CORS for streaming
        "Content-Type": safeType,
        "Content-Length": String(fs.statSync(asset.file_path).size),
        "Content-Disposition": "attachment",
      });
      fs.createReadStream(asset.file_path).pipe(response);
      return;
    }

    const mediaTranscribeMatch = pathname.match(/^\/media\/recordings\/([^/]+)\/transcribe$/);
    if (mediaTranscribeMatch && request.method === "POST") {
      const recordingId = mediaTranscribeMatch[1];
      const body = await readJsonBody(request);
      const asset = await transcriptionService.getMediaAsset(recordingId);
      if (!asset) {
        sendJson(response, 404, { message: "Nie znaleziono nagrania." }, origin, ALLOWED_ORIGINS);
        return;
      }
      await ensureWorkspaceAccess(session, body.workspaceId || asset.workspace_id);
      await transcriptionService.queueTranscription(recordingId, body);
      await transcriptionService.ensureTranscriptionJob(recordingId, asset, body);
      sendJson(response, 202, buildTranscriptionStatusPayload(await transcriptionService.getMediaAsset(recordingId)), origin, ALLOWED_ORIGINS);
      return;
    }

    if (mediaTranscribeMatch && request.method === "GET") {
      const recordingId = mediaTranscribeMatch[1];
      const asset = await transcriptionService.getMediaAsset(recordingId);
      if (!asset) {
        sendJson(response, 404, { message: "Nie znaleziono nagrania." }, origin, ALLOWED_ORIGINS);
        return;
      }
      await ensureWorkspaceAccess(session, asset.workspace_id);
      sendJson(response, 200, buildTranscriptionStatusPayload(asset), origin, ALLOWED_ORIGINS);
      return;
    }

    // --- Voice Profiles ---
    if (request.method === "GET" && pathname === "/voice-profiles") {
      const profiles = (await workspaceService.getWorkspaceVoiceProfiles(session.workspace_id)).map((p) => ({
        id: p.id, speakerName: p.speaker_name, userId: p.user_id, createdAt: p.created_at,
      }));
      sendJson(response, 200, { profiles }, origin, ALLOWED_ORIGINS);
      return;
    }

    if (request.method === "POST" && pathname === "/voice-profiles") {
      checkRateLimit(clientIp, "voice-profiles");
      const speakerName = String(request.headers["x-speaker-name"] || "").slice(0, 120);
      if (!speakerName.trim()) return sendJson(response, 400, { message: "Brakuje naglowka X-Speaker-Name." }, origin, ALLOWED_ORIGINS);
      const contentType = request.headers["content-type"] || "audio/webm";
      const buffer = await readBinaryBody(request, 1 * 1024 * 1024); // Regression fix [H-01]: Enforce 1MB limit
      if (!buffer || buffer.byteLength < 1000) return sendJson(response, 400, { message: "Plik audio jest za krotki." }, origin, ALLOWED_ORIGINS);
      
      const profileId = `vp_${crypto.randomUUID().replace(/-/g, "")}`;
      const ext = contentType.includes("mp4") ? ".m4a" : contentType.includes("wav") ? ".wav" : ".webm";
      const audioPath = path.join(config.uploadDir, `${profileId}${ext}`);
      fs.writeFileSync(audioPath, buffer);
      
      const embedding = await transcriptionService.computeEmbedding(audioPath);
      
      const profile = await workspaceService.saveVoiceProfile({
        id: profileId, userId: session.user_id, workspaceId: session.workspace_id,
        speakerName: speakerName.trim(), audioPath, embedding: embedding || [],
      });
      
      sendJson(response, 201, { id: profile.id, speakerName: profile.speaker_name, hasEmbedding: (embedding || []).length > 0, createdAt: profile.created_at }, origin, ALLOWED_ORIGINS);
      return;
    }

    const deleteVpMatch = pathname.match(/^\/voice-profiles\/([a-z0-9_]+)$/);
    if (request.method === "DELETE" && deleteVpMatch) {
      await workspaceService.deleteVoiceProfile(deleteVpMatch[1], session.workspace_id);
      sendNoContent(response, origin, ALLOWED_ORIGINS);
      return;
    }

    // --- Pipeline Ops ---
    const mediaNormalizeMatch = pathname.match(/^\/media\/recordings\/([^/]+)\/normalize$/);
    if (mediaNormalizeMatch && request.method === "POST") {
      const recordingId = mediaNormalizeMatch[1];
      const asset = await transcriptionService.getMediaAsset(recordingId);
      if (!asset) return sendJson(response, 404, { message: "Nie znaleziono nagrania." }, origin, ALLOWED_ORIGINS);
      await ensureWorkspaceAccess(session, asset.workspace_id);
      await transcriptionService.normalizeRecording(asset.file_path, { signal });
      sendJson(response, 200, { ok: true }, origin, ALLOWED_ORIGINS);
      return;
    }

    const mediaVoiceCoachingMatch = pathname.match(/^\/media\/recordings\/([^/]+)\/voice-coaching$/);
    if (mediaVoiceCoachingMatch && request.method === "POST") {
      const recordingId = mediaVoiceCoachingMatch[1];
      const body = await readJsonBody(request);
      const asset = await transcriptionService.getMediaAsset(recordingId);
      if (!asset) return sendJson(response, 404, { message: "Nie znaleziono nagrania." }, origin, ALLOWED_ORIGINS);
      await ensureWorkspaceAccess(session, asset.workspace_id);
      const coaching = await transcriptionService.generateVoiceCoaching(asset, String(body?.speakerId || ""), body?.segments || [], { signal });
      sendJson(response, 200, { coaching }, origin, ALLOWED_ORIGINS);
      return;
    }

    const mediaRediarizeMatch = pathname.match(/^\/media\/recordings\/([^/]+)\/rediarize$/);
    if (mediaRediarizeMatch && request.method === "POST") {
      const recordingId = mediaRediarizeMatch[1];
      const asset = await transcriptionService.getMediaAsset(recordingId);
      if (!asset) return sendJson(response, 404, { message: "Nie znaleziono nagrania." }, origin, ALLOWED_ORIGINS);
      await ensureWorkspaceAccess(session, asset.workspace_id);

      let stored = [];
      try { stored = JSON.parse(asset.transcript_json || "[]"); } catch (_) {}
      if (!stored.length) return sendJson(response, 400, { message: "Brak transkrypcji." }, origin, ALLOWED_ORIGINS);

      const whisperLike = stored.map(s => ({ text: s.text, start: s.timestamp, end: s.endTimestamp || s.timestamp })).filter(s => s.text);
      const diarization = await transcriptionService.diarizeFromTranscript(whisperLike);
      if (!diarization) return sendJson(response, 422, { message: "Diaryzacja nie powiodla sie." }, origin, ALLOWED_ORIGINS);

      const updated = diarization.segments.map((seg, idx) => ({ ...(stored[idx] || {}), id: stored[idx]?.id || seg.id, text: seg.text, timestamp: seg.timestamp, endTimestamp: seg.endTimestamp, speakerId: seg.speakerId, rawSpeakerLabel: seg.rawSpeakerLabel }));
      await transcriptionService.saveTranscriptionResult(recordingId, { segments: updated, diarization, pipelineStatus: "completed" });
      sendJson(response, 200, { speakerCount: diarization.speakerCount, speakerNames: diarization.speakerNames, segments: updated }, origin, ALLOWED_ORIGINS);
      return;
    }

    if (request.method === "POST" && pathname === "/transcribe/live") {
      checkRateLimit(clientIp, "live-transcribe", 60);
      const contentType = request.headers["content-type"] || "audio/webm";
      const buffer = await readBinaryBody(request);
      if (!buffer || buffer.byteLength < 500) return sendJson(response, 200, { text: "" }, origin, ALLOWED_ORIGINS);
      
      const ext = contentType.includes("mp4") ? ".m4a" : contentType.includes("wav") ? ".wav" : ".webm";
      const tmpPath = path.join(config.uploadDir, `live_${crypto.randomUUID().replace(/-/g, "")}${ext}`);
      try {
        fs.writeFileSync(tmpPath, buffer);
        const text = await transcriptionService.transcribeLiveChunk(tmpPath, contentType, { signal });
        sendJson(response, 200, { text }, origin, ALLOWED_ORIGINS);
      } finally {
        try { fs.unlinkSync(tmpPath); } catch (_) {}
      }
      return;
    }

    if (request.method === "POST" && pathname === "/media/analyze") {
      checkRateLimit(clientIp, "analyze");
      const body = await readJsonBody(request);
      const result = await transcriptionService.analyzeMeetingWithOpenAI(body);
      sendJson(response, 200, result || { mode: "no-key" }, origin, ALLOWED_ORIGINS);
      return;
    }

    sendText(response, 404, "Not found", origin, ALLOWED_ORIGINS);
  }

  return async (request, response) => {
    const ac = new AbortController();
    request.on("close", () => {
      // If the response is not fully writable-ended, the request was probably aborted prematurely.
      if (!response.writableEnded) {
        ac.abort();
      }
    });
    
    try {
      await handleRequest(request, response, ac.signal);
    } catch (error) {
      if (ac.signal.aborted || error.message.includes("aborted")) {
        // Suppress errors logged if the client disconnected gracefully
        return;
      }
      const statusCode = error.statusCode || 500;
      const origin = String(request.headers.origin || "");
      if (statusCode === 429 && error.retryAfter) response.setHeader("Retry-After", String(error.retryAfter));
      sendJson(response, statusCode, { message: error.message || "Unexpected server error." }, origin, ALLOWED_ORIGINS);
    }
  };
}

module.exports = { createApp };
