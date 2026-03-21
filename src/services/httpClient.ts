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

function isBackendUnavailableMessage(message = "") {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("application failed to respond") ||
    normalized.includes("router_external_target_connection_error") ||
    normalized.includes("bad gateway") ||
    normalized.includes("target connection error") ||
    normalized.includes("upstream") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("load failed")
  );
}

function normalizeApiErrorMessage(message = "", status?: number) {
  if (status === 502 || isBackendUnavailableMessage(message)) {
    return "Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile.";
  }

  if (status === 401 && String(message).includes("Brak tokenu autoryzacyjnego")) {
    return "Sesja wygasla albo token nie zostal odtworzony. Odswiez sesje logowania.";
  }

  return String(message || "");
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

  let response;
  try {
    response = await fetch(buildUrl(path), requestInit);
  } catch (error: any) {
    const normalizedMessage = normalizeApiErrorMessage(error?.message || "Failed to fetch");
    const normalizedError = new Error(normalizedMessage);
    (normalizedError as any).cause = error;
    throw normalizedError;
  }

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
    const error = new Error(normalizeApiErrorMessage(message, response.status));
    error.status = response.status;
    throw error;
  }

  const payload = parseAs === "raw" ? response : await parseResponse(response);
  return payload;
}
