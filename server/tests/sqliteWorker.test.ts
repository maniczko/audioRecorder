import { describe, expect, it } from "vitest";

describe("sqliteWorker", () => {
  it("loads without throwing", async () => {
    await expect(import("../sqliteWorker")).resolves.toBeDefined();
  });
});
