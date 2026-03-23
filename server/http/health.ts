import type { Hono } from "hono";
import { resolveBuildMetadata } from "../runtime.ts";

export function registerHealthRoute(app: Hono<any>) {
  app.get("/health", (c) => {
    const build = resolveBuildMetadata(process.env, "0.1.0");
    return c.json({
      ok: true,
      status: "ok",
      uptime: process.uptime(),
      gitSha: build.gitSha,
      buildTime: build.buildTime,
      appVersion: build.appVersion,
      runtime: build.runtime,
    });
  });
}
