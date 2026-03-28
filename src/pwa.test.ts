import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { registerServiceWorker } from './pwa';

describe('registerServiceWorker', () => {
  const originalNavigator = window.navigator;
  const originalLocation = window.location;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window, 'navigator', { configurable: true, value: originalNavigator });
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  test('unregisters existing service workers in development mode', async () => {
    const unregister = vi.fn();
    const getRegistrations = vi.fn().mockResolvedValue([{ unregister }]);
    const register = vi.fn();

    Object.defineProperty(window, 'navigator', {
      configurable: true,
      value: {
        serviceWorker: {
          controller: {},
          register,
          getRegistrations,
          addEventListener: vi.fn(),
        },
      },
    });

    registerServiceWorker();
    await Promise.resolve();
    await Promise.resolve();

    expect(getRegistrations).toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });

  test('does not register service worker on hosted vercel previews', async () => {
    const register = vi.fn();
    const getRegistrations = vi.fn().mockResolvedValue([]);

    Object.defineProperty(window, 'navigator', {
      configurable: true,
      value: {
        serviceWorker: {
          register,
          getRegistrations,
          addEventListener: vi.fn(),
        },
      },
    });
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'preview-deployment.vercel.app', reload: vi.fn() },
    });

    registerServiceWorker();
    await Promise.resolve();

    expect(register).not.toHaveBeenCalled();
  });
});
