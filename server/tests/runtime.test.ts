import { describe, expect, it } from "vitest";
import { buildLocalHealthUrl, resolveServerPort } from "../runtime.ts";

describe("runtime port resolution", () => {
  it("prefers VOICELOG_API_PORT when present", () => {
    expect(resolveServerPort({ VOICELOG_API_PORT: 4100, PORT: 9999 })).toBe(4100);
  });

  it("falls back to PORT when VOICELOG_API_PORT is absent", () => {
    expect(resolveServerPort({ PORT: 43111 })).toBe(43111);
    expect(buildLocalHealthUrl({ PORT: 43111 })).toBe("http://127.0.0.1:43111/health");
  });

  it("falls back to 4000 when no port is configured", () => {
    expect(resolveServerPort({})).toBe(4000);
  });
});
