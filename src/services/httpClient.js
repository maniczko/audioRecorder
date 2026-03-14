import { API_BASE_URL, remoteApiEnabled } from "./config";

function buildUrl(path) {
  const safePath = String(path || "").startsWith("/") ? path : `/${String(path || "")}`;
  if (!remoteApiEnabled()) {
    throw new Error("Remote API is not configured. Set REACT_APP_API_BASE_URL first.");
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

export async function apiRequest(path, options = {}) {
  const { body, headers, parseAs = "json", ...rest } = options;
  const requestInit = {
    ...rest,
    headers: {
      ...(body && !(body instanceof Blob) ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
  };

  if (body !== undefined) {
    requestInit.body = body instanceof Blob || typeof body === "string" ? body : JSON.stringify(body);
  }

  const response = await fetch(buildUrl(path), requestInit);
  const payload = parseAs === "raw" ? response : await parseResponse(response);

  if (!response.ok) {
    const message =
      (typeof payload === "object" && payload?.message) || (typeof payload === "string" && payload) || "Request failed.";
    throw new Error(message);
  }

  return payload;
}
