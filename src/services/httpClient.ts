import { API_BASE_URL, apiBaseUrlConfigured } from "./config";
import { readLegacySession, readWorkspacePersistedSession } from "../lib/sessionStorage";
import { getHostedRuntimeBuildId, isHostedPreviewHost } from "../runtime/browserRuntime";

const unauthorizedHandlers = new Set();
let previewRuntimeStatus = "unknown";
const HOSTED_PREVIEW_RUNTIME_MESSAGE =
  "Hostowany preview nie moze polaczyc sie z backendem. Odswiez strone lub otworz najnowszy deploy.";
const HOSTED_PREVIEW_STALE_MESSAGE =
  "Hostowany preview jest nieaktualny wzgledem backendu. Odswiez strone lub otworz najnowszy deploy.";

export function onUnauthorized(handler) {
  unauthorizedHandlers.add(handler);
  return () => unauthorizedHandlers.delete(handler);
}

export function getPreviewRuntimeStatus() {
  return previewRuntimeStatus;
}

export function setPreviewRuntimeStatus(status = "unknown") {
  previewRuntimeStatus = String(status || "unknown");
}

export function resetPreviewRuntimeStatus() {
  previewRuntimeStatus = "unknown";
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

function isHostedPreviewRuntime() {
  return typeof window !== "undefined" && isHostedPreviewHost(window.location.hostname);
}

function isTransportFailureMessage(message = "") {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("upstream") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("load failed") ||
    normalized.includes("bad gateway") ||
    normalized.includes("target connection error") ||
    normalized.includes("application failed to respond") ||
    normalized.includes("router_external_target_connection_error")
  );
}

function normalizeApiErrorMessage(message = "", status?: number) {
  if (previewRuntimeStatus === "stale_runtime") {
    return HOSTED_PREVIEW_STALE_MESSAGE;
  }

  if (status === 507) {
    return "Brak miejsca na dysku serwera. Skontaktuj sie z administratorem.";
  }

  if (status === 502) {
    return "Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile.";
  }

  if (status === 401 && String(message).includes("Brak tokenu autoryzacyjnego")) {
    return "Sesja wygasla albo token nie zostal odtworzony. Odswiez sesje logowania.";
  }

  if (isTransportFailureMessage(message)) {
    if (isHostedPreviewRuntime() && previewRuntimeStatus === "healthy") {
      return HOSTED_PREVIEW_RUNTIME_MESSAGE;
    }
    return "Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile.";
  }

  return String(message || "");
}

export async function probeRemoteApiHealth(fetchImpl = fetch) {
  try {
    const response = await fetchImpl(buildUrl("/health"), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      setPreviewRuntimeStatus("backend_unreachable");
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await parseResponse(response);
    const frontendBuildId = getHostedRuntimeBuildId();
    const backendGitSha = String(payload?.gitSha || "").trim();
    if (
      isHostedPreviewRuntime() &&
      frontendBuildId &&
      backendGitSha &&
      frontendBuildId !== backendGitSha
    ) {
      // Railway and Vercel deploy at different times — SHA mismatch is expected.
      // Log a warning but do NOT block requests.
      console.warn(
        `[Preview] Build ID mismatch: frontend=${frontendBuildId.slice(0, 8)} backend=${backendGitSha.slice(0, 8)}. This is expected when Railway and Vercel deploy at different times.`
      );
    }

    setPreviewRuntimeStatus("healthy");
    return payload;
  } catch (error) {
    if (String(error?.message || "").includes("nieaktualny wzgledem backendu")) {
      setPreviewRuntimeStatus("stale_runtime");
    } else {
      setPreviewRuntimeStatus("backend_unreachable");
    }
    throw error;
  }
}

interface ApiOptions extends RequestInit {
  body?: any;
  parseAs?: "json" | "text" | "raw";
}

export async function apiRequest(path: string, options: ApiOptions = {}) {
  const { body, headers, parseAs = "json", ...rest } = options;
  const token = readSessionToken();
  const requestInit: RequestInit = {
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

  let response: Response;
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
      unauthorizedHandlers.forEach((h: any) => h());
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
    const error = new Error(normalizeApiErrorMessage(message, response.status)) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  const payload = parseAs === "raw" ? response : await parseResponse(response);
  return payload;
}
