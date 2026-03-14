function readMode(value, fallback = "local") {
  return value === "remote" ? "remote" : fallback;
}

export const APP_DATA_PROVIDER = readMode(process.env.REACT_APP_DATA_PROVIDER, "local");
export const MEDIA_PIPELINE_PROVIDER = readMode(process.env.REACT_APP_MEDIA_PROVIDER, "local");
export const API_BASE_URL = String(process.env.REACT_APP_API_BASE_URL || "").trim();

export function remoteApiEnabled() {
  return Boolean(API_BASE_URL);
}
