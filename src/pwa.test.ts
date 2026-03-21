import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { registerServiceWorker } from "./pwa";

describe("registerServiceWorker", () => {
  const originalNavigator = window.navigator;
  const originalLocation = window.location;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window, "navigator", { configurable: true, value: originalNavigator });
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  test("registers service worker, promotes waiting worker and reloads once on controller change", async () => {
    const waitingWorker = { postMessage: vi.fn() };
    const installingListeners: Record<string, () => void> = {};
    const installingWorker = {
      state: "installed",
      postMessage: vi.fn(),
      addEventListener: vi.fn((event: string, handler: () => void) => {
        installingListeners[event] = handler;
      }),
    };
    const registrationListeners: Record<string, () => void> = {};
    const registration = {
      waiting: waitingWorker,
      installing: installingWorker,
      addEventListener: vi.fn((event: string, handler: () => void) => {
        registrationListeners[event] = handler;
      }),
      update: vi.fn().mockResolvedValue(undefined),
    };
    const serviceWorkerListeners: Record<string, () => void> = {};
    const register = vi.fn().mockResolvedValue(registration);
    const reload = vi.fn();

    Object.defineProperty(window, "navigator", {
      configurable: true,
      value: {
        serviceWorker: {
          controller: {},
          register,
          addEventListener: vi.fn((event: string, handler: () => void) => {
            serviceWorkerListeners[event] = handler;
          }),
        },
      },
    });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload },
    });

    registerServiceWorker();
    window.dispatchEvent(new Event("load"));
    await Promise.resolve();

    expect(register).toHaveBeenCalledWith("/service-worker.js", { updateViaCache: "none" });
    expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });

    registrationListeners.updatefound?.();
    installingListeners.statechange?.();
    serviceWorkerListeners.controllerchange?.();
    serviceWorkerListeners.controllerchange?.();

    expect(installingWorker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(registration.update).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
