const http = require("node:http");
const fs = require("node:fs");
const { URL } = require("node:url");
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
  saveTranscriptionResult,
  markTranscriptionFailure,
  queueTranscription,
  updateWorkspaceMemberRole,
  getHealth,
} = require("./database");
const { transcribeRecording } = require("./audioPipeline");

const PORT = Number(process.env.VOICELOG_API_PORT) || 4000;
const HOST = process.env.VOICELOG_API_HOST || "127.0.0.1";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Workspace-Id, X-Meeting-Id",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  };
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    ...corsHeaders(),
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, body) {
  response.writeHead(statusCode, {
    ...corsHeaders(),
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(body);
}

function sendNoContent(response) {
  response.writeHead(204, corsHeaders());
  response.end();
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
  if (request.method === "OPTIONS") {
    sendNoContent(response);
    return;
  }

  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;

  if (request.method === "GET" && pathname === "/health") {
    sendJson(response, 200, getHealth());
    return;
  }

  if (request.method === "POST" && pathname === "/auth/register") {
    sendJson(response, 201, registerUser(await readJsonBody(request)));
    return;
  }

  if (request.method === "POST" && pathname === "/auth/login") {
    sendJson(response, 200, loginUser(await readJsonBody(request)));
    return;
  }

  if (request.method === "POST" && pathname === "/auth/password/reset/request") {
    sendJson(response, 200, requestPasswordReset(await readJsonBody(request)));
    return;
  }

  if (request.method === "POST" && pathname === "/auth/password/reset/confirm") {
    sendJson(response, 200, resetPasswordWithCode(await readJsonBody(request)));
    return;
  }

  if (request.method === "POST" && pathname === "/auth/google") {
    sendJson(response, 200, upsertGoogleUser(await readJsonBody(request)));
    return;
  }

  if (request.method === "GET" && pathname === "/auth/session") {
    const session = requireSession(request);
    const workspaceId = requestUrl.searchParams.get("workspaceId") || session.workspace_id;
    ensureWorkspaceAccess(session, workspaceId);
    sendJson(response, 200, buildSessionPayload(session.user_id, workspaceId));
    return;
  }

  const profileMatch = pathname.match(/^\/users\/([^/]+)\/profile$/);
  if (request.method === "PUT" && profileMatch) {
    const session = requireSession(request);
    const userId = profileMatch[1];
    if (session.user_id !== userId) {
      sendJson(response, 403, { message: "Mozesz edytowac tylko swoj profil." });
      return;
    }

    const workspaceId = requestUrl.searchParams.get("workspaceId") || session.workspace_id;
    const user = updateUserProfile(userId, await readJsonBody(request));
    sendJson(response, 200, {
      user,
      users: buildSessionPayload(session.user_id, workspaceId).users,
    });
    return;
  }

  const passwordMatch = pathname.match(/^\/users\/([^/]+)\/password$/);
  if (request.method === "POST" && passwordMatch) {
    const session = requireSession(request);
    const userId = passwordMatch[1];
    if (session.user_id !== userId) {
      sendJson(response, 403, { message: "Mozesz zmienic tylko swoje haslo." });
      return;
    }

    sendJson(response, 200, changeUserPassword(userId, await readJsonBody(request)));
    return;
  }

  if (request.method === "GET" && pathname === "/state/bootstrap") {
    const session = requireSession(request);
    const workspaceId = requestUrl.searchParams.get("workspaceId") || session.workspace_id;
    ensureWorkspaceAccess(session, workspaceId);
    sendJson(response, 200, buildSessionPayload(session.user_id, workspaceId));
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
    });
    return;
  }

  const workspaceRoleMatch = pathname.match(/^\/workspaces\/([^/]+)\/members\/([^/]+)\/role$/);
  if (request.method === "PUT" && workspaceRoleMatch) {
    const session = requireSession(request);
    const workspaceId = workspaceRoleMatch[1];
    const targetUserId = workspaceRoleMatch[2];
    const membership = ensureWorkspaceAccess(session, workspaceId);
    if (!["owner", "admin"].includes(membership.member_role)) {
      sendJson(response, 403, { message: "Tylko owner lub admin moze zmieniac role." });
      return;
    }

    sendJson(
      response,
      200,
      updateWorkspaceMemberRole(workspaceId, targetUserId, (await readJsonBody(request)).memberRole)
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
      sendJson(response, 400, { message: "Brakuje X-Workspace-Id." });
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
    });
    return;
  }

  if (mediaAudioMatch && request.method === "GET") {
    const session = requireSession(request);
    const recordingId = mediaAudioMatch[1];
    const asset = getMediaAsset(recordingId);
    if (!asset) {
      sendJson(response, 404, { message: "Nie znaleziono nagrania." });
      return;
    }

    ensureWorkspaceAccess(session, asset.workspace_id);
    if (!fs.existsSync(asset.file_path)) {
      sendJson(response, 404, { message: "Plik audio nie istnieje na serwerze." });
      return;
    }

    response.writeHead(200, {
      ...corsHeaders(),
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
      sendJson(response, 404, { message: "Nie znaleziono nagrania." });
      return;
    }

    ensureWorkspaceAccess(session, body.workspaceId || asset.workspace_id);
    queueTranscription(recordingId, body);

    try {
      const result = await transcribeRecording(asset, body);
      saveTranscriptionResult(recordingId, result);
      sendJson(response, 200, result);
    } catch (error) {
      markTranscriptionFailure(recordingId, error.message);
      throw error;
    }
    return;
  }

  sendText(response, 404, "Not found");
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    sendJson(response, error.statusCode || 500, {
      message: error.message || "Unexpected server error.",
    });
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
