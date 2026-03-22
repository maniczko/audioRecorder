import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("runtime.ts", () => {
  describe("resolveServerPort", () => {
    it("returns PORT from config", async () => {
      const { resolveServerPort } = await import("../runtime.ts");
      
      const port = resolveServerPort({ PORT: 8080 });
      
      expect(port).toBe(8080);
    });

    it("returns VOICELOG_API_PORT from config", async () => {
      const { resolveServerPort } = await import("../runtime.ts");
      
      const port = resolveServerPort({ VOICELOG_API_PORT: 9000 });
      
      expect(port).toBe(9000);
    });

    it("PORT takes precedence over VOICELOG_API_PORT", async () => {
      const { resolveServerPort } = await import("../runtime.ts");
      
      const port = resolveServerPort({ PORT: 8080, VOICELOG_API_PORT: 9000 });
      
      expect(port).toBe(8080);
    });

    it("returns default 4000 when no port configured", async () => {
      const { resolveServerPort } = await import("../runtime.ts");
      
      const port = resolveServerPort({});
      
      expect(port).toBe(4000);
    });

    it("handles undefined config", async () => {
      const { resolveServerPort } = await import("../runtime.ts");

      const port = resolveServerPort({} as any);

      expect(port).toBe(4000);
    });

    it("handles string port values", async () => {
      const { resolveServerPort } = await import("../runtime.ts");
      
      const port = resolveServerPort({ PORT: "8080" as any });
      
      expect(port).toBe(8080);
    });
  });

  describe("buildLocalHealthUrl", () => {
    it("returns health URL with configured PORT", async () => {
      const { buildLocalHealthUrl } = await import("../runtime.ts");
      
      const url = buildLocalHealthUrl({ PORT: 8080 });
      
      expect(url).toBe("http://127.0.0.1:8080/health");
    });

    it("returns health URL with default port", async () => {
      const { buildLocalHealthUrl } = await import("../runtime.ts");
      
      const url = buildLocalHealthUrl({});
      
      expect(url).toBe("http://127.0.0.1:4000/health");
    });
  });

  describe("resolveBuildMetadata", () => {
    it("returns metadata from environment variables", async () => {
      const { resolveBuildMetadata } = await import("../runtime.ts");
      
      const metadata = resolveBuildMetadata({
        RAILWAY_GIT_COMMIT_SHA: "abc123",
        BUILD_TIME: "2024-01-01T00:00:00.000Z",
        APP_VERSION: "1.0.0",
        RAILWAY_ENVIRONMENT: "production",
      });
      
      expect(metadata).toEqual({
        gitSha: "abc123",
        buildTime: "2024-01-01T00:00:00.000Z",
        appVersion: "1.0.0",
        runtime: "railway",
      });
    });

    it("uses VERCEL environment variables", async () => {
      const { resolveBuildMetadata } = await import("../runtime.ts");
      
      const metadata = resolveBuildMetadata({
        VERCEL_GIT_COMMIT_SHA: "def456",
        APP_BUILD_TIME: "2024-01-02T00:00:00.000Z",
        npm_package_version: "2.0.0",
        VERCEL: "1",
      });
      
      expect(metadata).toEqual({
        gitSha: "def456",
        buildTime: "2024-01-02T00:00:00.000Z",
        appVersion: "2.0.0",
        runtime: "vercel",
      });
    });

    it("uses GITHUB_SHA for git commit", async () => {
      const { resolveBuildMetadata } = await import("../runtime.ts");
      
      const metadata = resolveBuildMetadata({
        GITHUB_SHA: "ghi789",
      });
      
      expect(metadata.gitSha).toBe("ghi789");
    });

    it("uses fallback version when no version specified", async () => {
      const { resolveBuildMetadata } = await import("../runtime.ts");
      
      const metadata = resolveBuildMetadata({}, "3.0.0");
      
      expect(metadata.appVersion).toBe("3.0.0");
    });

    it("uses default fallback version", async () => {
      const { resolveBuildMetadata } = await import("../runtime.ts");
      
      const metadata = resolveBuildMetadata({});
      
      expect(metadata.appVersion).toBe("0.1.0");
    });

    it("uses process build time when not specified", async () => {
      const { resolveBuildMetadata } = await import("../runtime.ts");
      
      const metadata = resolveBuildMetadata({});
      
      expect(metadata.buildTime).toBeDefined();
      expect(new Date(metadata.buildTime).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it("returns node runtime for local development", async () => {
      const { resolveBuildMetadata } = await import("../runtime.ts");
      
      const metadata = resolveBuildMetadata({});
      
      expect(metadata.runtime).toBe("node");
    });

    it("handles empty environment", async () => {
      const { resolveBuildMetadata } = await import("../runtime.ts");
      
      const metadata = resolveBuildMetadata({});
      
      expect(metadata.gitSha).toBe("unknown");
      expect(metadata.appVersion).toBe("0.1.0");
      expect(metadata.runtime).toBe("node");
    });

    it("handles null environment", async () => {
      const { resolveBuildMetadata } = await import("../runtime.ts");

      const metadata = resolveBuildMetadata({} as any);

      expect(metadata.gitSha).toBe("unknown");
    });
  });
});
