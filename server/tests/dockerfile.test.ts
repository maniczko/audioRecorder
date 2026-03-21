import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Dockerfile runtime healthcheck", () => {
  it("uses PORT-aware healthcheck for cloud runtimes", () => {
    const dockerfile = fs.readFileSync(path.resolve(process.cwd(), "Dockerfile"), "utf8");
    expect(dockerfile).toMatch(/\$\{PORT:-\$\{VOICELOG_API_PORT:-4000\}\}\/health/);
  });
});
