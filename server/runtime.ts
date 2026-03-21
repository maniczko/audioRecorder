export function resolveServerPort(configLike: { VOICELOG_API_PORT?: number; PORT?: number }) {
  return Number(configLike.VOICELOG_API_PORT || configLike.PORT) || 4000;
}

export function buildLocalHealthUrl(configLike: { VOICELOG_API_PORT?: number; PORT?: number }) {
  return `http://127.0.0.1:${resolveServerPort(configLike)}/health`;
}
