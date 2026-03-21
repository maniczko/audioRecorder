import { API_BASE_URL, apiBaseUrlConfigured } from "./config";
import { readLegacySession, readWorkspacePersistedSession } from "../lib/sessionStorage";

const unauthorizedHandlers = new Set();
export function onUnauthorized(handler) {
  unauthorizedHandlers.add(handler);
  return () => unauthorizedHandlers.delete(handler);
}

function buildUrl(path) {
  const safePath = String(path || "").startsWith("/") ? path : `/${String(path || "")}`;
  if (!apiBaseUrlConfigured()) {
    throw new Error("Remote API is not configured. Set VITE_API_BASE_URL or REACT_APP_API_BASE_URL first.");
  }

  return `${API_BASE_URL}${safePath}`;
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

function readSessionToken() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const session = readLegacySession() || readWorkspacePersistedSession();
    return String(session?.token || "");
  } catch (error) {
    console.error("Unable to read auth token from storage.", error);
    return "";
  }
}

export async function apiRequest(path, options = {}) {
  const { body, headers, parseAs = "json", ...rest } = options;
  const token = readSessionToken();
  const requestInit = {
    ...rest,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !(body instanceof Blob) ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
  };

  if (body !== undefined) {
    requestInit.body = body instanceof Blob || typeof body === "string" ? body : JSON.stringify(body);
  }

  const response = await fetch(buildUrl(path), requestInit);

  if (!response.ok) {
    if (response.status === 401) {
      unauthorizedHandlers.forEach((h) => h());
    }
    let message = `HTTP ${response.status}`;
    try {
      const errorBody = await parseResponse(response);
      message =
        (typeof errorBody === "object" && errorBody?.message) ||
        (typeof errorBody === "string" && errorBody) ||
        message;
    } catch (_) {
      // ignore parse errors
    }
    if (response.status === 401 && message.includes("Brak tokenu autoryzacyjnego")) {
      message = "Sesja wygasla albo token nie zostal odtworzony. Odswiez sesje logowania.";
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const payload = parseAs === "raw" ? response : await parseResponse(response);
  return payload;
}
