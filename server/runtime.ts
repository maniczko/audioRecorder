export function resolveServerPort(configLike: { VOICELOG_API_PORT?: number; PORT?: number }) {
  return Number(configLike.PORT || configLike.VOICELOG_API_PORT) || 4000;
}

export function buildLocalHealthUrl(configLike: { VOICELOG_API_PORT?: number; PORT?: number }) {
  return `http://127.0.0.1:${resolveServerPort(configLike)}/health`;
}

const PROCESS_BUILD_TIME = new Date().toISOString();

export function resolveBuildMetadata(
  envLike: Record<string, string | number | undefined> = process.env,
  fallbackVersion = "0.1.0"
) {
  const gitSha = String(
    envLike.RAILWAY_GIT_COMMIT_SHA ||
      envLike.VERCEL_GIT_COMMIT_SHA ||
      envLike.GITHUB_SHA ||
      "unknown"
  );
  const buildTime = String(envLike.BUILD_TIME || envLike.APP_BUILD_TIME || PROCESS_BUILD_TIME);
  const appVersion = String(envLike.APP_VERSION || envLike.npm_package_version || fallbackVersion);
  const runtime =
    envLike.RAILWAY_ENVIRONMENT || envLike.RAILWAY_PROJECT_ID
      ? "railway"
      : envLike.VERCEL
        ? "vercel"
        : "node";

  return {
    gitSha,
    buildTime,
    appVersion,
    runtime,
  };
}
