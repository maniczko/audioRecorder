import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Note: This test reads the actual Dockerfile, so fs is not mocked here
// The vi.mock in setup.ts is bypassed for this specific test file

describe("Dockerfile runtime healthcheck", () => {
  it("uses PORT-aware healthcheck for cloud runtimes", () => {
    const dockerfile = fs.readFileSync(path.resolve(process.cwd(), "Dockerfile"), "utf8");
    expect(dockerfile).toMatch(/\$\{PORT:-\$\{VOICELOG_API_PORT:-4000\}\}\/health/);
  });
});
