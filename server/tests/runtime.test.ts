import { describe, expect, it } from "vitest";
import { buildLocalHealthUrl, resolveBuildMetadata, resolveServerPort } from "../runtime.ts";

describe("runtime port resolution", () => {
  it("prefers platform PORT when both PORT and VOICELOG_API_PORT are present", () => {
    expect(resolveServerPort({ VOICELOG_API_PORT: 4100, PORT: 9999 })).toBe(9999);
  });

  it("falls back to PORT when VOICELOG_API_PORT is absent", () => {
    expect(resolveServerPort({ PORT: 43111 })).toBe(43111);
    expect(buildLocalHealthUrl({ PORT: 43111 })).toBe("http://127.0.0.1:43111/health");
  });

  it("falls back to VOICELOG_API_PORT when platform PORT is absent", () => {
    expect(resolveServerPort({ VOICELOG_API_PORT: 4100 })).toBe(4100);
    expect(buildLocalHealthUrl({ VOICELOG_API_PORT: 4100 })).toBe("http://127.0.0.1:4100/health");
  });

  it("falls back to 4000 when no port is configured", () => {
    expect(resolveServerPort({})).toBe(4000);
  });

  it("resolves build metadata from railway-oriented environment variables", () => {
    expect(
      resolveBuildMetadata(
        {
          RAILWAY_GIT_COMMIT_SHA: "abc1234",
          BUILD_TIME: "2026-03-21T20:10:00.000Z",
          APP_VERSION: "1.2.3",
          RAILWAY_PROJECT_ID: "railway-project",
        },
        "0.1.0"
      )
    ).toEqual({
      gitSha: "abc1234",
      buildTime: "2026-03-21T20:10:00.000Z",
      appVersion: "1.2.3",
      runtime: "railway",
    });
  });

  it("falls back to process defaults when build metadata env is absent", () => {
    const metadata = resolveBuildMetadata({}, "9.9.9");
    expect(metadata.gitSha).toBe("unknown");
    expect(metadata.appVersion).toBe("9.9.9");
    expect(metadata.runtime).toBe("node");
    expect(typeof metadata.buildTime).toBe("string");
    expect(metadata.buildTime.length).toBeGreaterThan(0);
  });
});
