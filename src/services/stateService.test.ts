import { afterEach, describe, expect, test, vi } from "vitest";

async function loadStateService(provider = "local") {
  const apiRequest = vi.fn();
  vi.resetModules();
  vi.doMock("./config", () => ({
    APP_DATA_PROVIDER: provider,
  }));
  vi.doMock("./httpClient", () => ({
    apiRequest,
  }));

  const module = await import("./stateService");
  return { ...module, apiRequest };
}

describe("stateService", () => {
  afterEach(() => {
    vi.resetModules();
  });

  test("returns local no-op implementation when remote mode is disabled", async () => {
    const { createStateService, apiRequest } = await loadStateService("local");
    const service = createStateService();

    await expect(service.bootstrap("ws1")).resolves.toBeNull();
    await expect(service.syncWorkspaceState("ws1", { foo: "bar" })).resolves.toBeNull();
    expect(service.mode).toBe("local");
    expect(apiRequest).not.toHaveBeenCalled();
  });

  test("calls bootstrap and sync endpoints in remote mode", async () => {
    const { createStateService, apiRequest } = await loadStateService("remote");
    const service = createStateService();

    await service.bootstrap("ws 1");
    await service.syncWorkspaceState("ws1", { meetings: [] });

    expect(service.mode).toBe("remote");
    expect(apiRequest).toHaveBeenNthCalledWith(1, "/state/bootstrap?workspaceId=ws%201", {
      method: "GET",
    });
    expect(apiRequest).toHaveBeenNthCalledWith(2, "/state/workspaces/ws1", {
      method: "PUT",
      body: { meetings: [] },
    });
  });
});
