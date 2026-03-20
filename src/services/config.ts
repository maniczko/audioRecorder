function readEnv(key, fallback = "") {
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key];
  }
  // @ts-ignore
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  return fallback;
}

function readMode(value, fallback = "local") {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "remote" ? "remote" : fallback;
}

export const APP_DATA_PROVIDER = readMode(
  readEnv("VITE_DATA_PROVIDER") || readEnv("REACT_APP_DATA_PROVIDER") || "local",
  "local"
);

export const MEDIA_PIPELINE_PROVIDER = readMode(
  readEnv("VITE_MEDIA_PROVIDER") || readEnv("REACT_APP_MEDIA_PROVIDER") || "local",
  "local"
);

export const API_BASE_URL = String(
  readEnv("VITE_API_BASE_URL") || readEnv("REACT_APP_API_BASE_URL") || "http://localhost:4000"
).trim();

export function remoteApiEnabled() {
  return APP_DATA_PROVIDER === "remote" && Boolean(API_BASE_URL);
}
