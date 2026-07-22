import { expect, test, type Page, type Route } from '@playwright/test';
import { installRuntimeGuard } from '../../src/testing/runtimeGuard';
import { fixtureAudioFile } from './fixtures/audioFixture.js';

const QA_USER = {
  id: 'e2e-user',
  email: 'owner@example.test',
  name: 'QA Owner',
  workspaceMemberRole: 'owner',
};
const QA_WORKSPACE = {
  id: 'e2e-workspace',
  name: 'QA Workspace',
  memberIds: [QA_USER.id],
  memberRoles: { [QA_USER.id]: 'owner' },
};
const QA_PASSWORD = 'safe-e2e-password';

type AuthRouteOptions = {
  loginStatus?: 200 | 401;
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function authPayload() {
  return {
    token: 'e2e-session-token',
    user: QA_USER,
    workspaceId: QA_WORKSPACE.id,
  };
}

function bootstrapPayload() {
  return {
    workspaceId: QA_WORKSPACE.id,
    users: [QA_USER],
    workspaces: [QA_WORKSPACE],
    state: {
      meetings: [],
      manualTasks: [],
      manualPeople: [],
      taskState: {},
      taskBoards: {},
      calendarMeta: {},
      vocabulary: [],
    },
  };
}

function readyCapabilitiesPayload() {
  return {
    ok: true,
    status: 'ready',
    capabilities: {},
    degradedCapabilities: [],
    telemetry: {
      fallbackModeUsed: false,
      fallbackModeCapabilities: [],
    },
  };
}

async function installAuthRoutes(page: Page, options: AuthRouteOptions = {}) {
  const stats = { loginRequests: 0, bootstrapRequests: 0, unauthorizedBootstrapRequests: 0 };
  const loginStatus = options.loginStatus || 200;
  let sessionExpired = false;

  await page.route('**/auth/login', async (route) => {
    stats.loginRequests += 1;
    if (loginStatus === 401) {
      await json(route, { message: 'Nieprawidłowy email lub hasło.' }, 401);
      return;
    }
    await json(route, authPayload());
  });

  await page.route('**/state/bootstrap?*', async (route) => {
    stats.bootstrapRequests += 1;
    if (sessionExpired) {
      stats.unauthorizedBootstrapRequests += 1;
      await json(route, { message: 'Sesja wygasła.' }, 401);
      return;
    }
    await json(route, bootstrapPayload());
  });

  await page.route('**/api/capabilities', (route) => json(route, readyCapabilitiesPayload()));
  await page.route('**/workspaces/*/capabilities', (route) =>
    json(route, readyCapabilitiesPayload())
  );
  await page.route('**/voice-profiles', (route) => json(route, { profiles: [] }));
  await page.route('**/state/workspaces/*', (route) => json(route, { ok: true }));

  return {
    stats,
    expireSession() {
      sessionExpired = true;
    },
  };
}

async function installUploadExpiryRoutes(page: Page) {
  const stats = {
    uploadRequests: 0,
    transcriptionStartRequests: 0,
    recordingIds: new Set<string>(),
  };
  let uploadAllowedAfterReauthentication = false;
  let resolveUploadStarted: () => void = () => {};
  const uploadStarted = new Promise<void>((resolve) => {
    resolveUploadStarted = resolve;
  });

  const rememberRecording = (route: Route) => {
    const segments = new URL(route.request().url()).pathname.split('/');
    const recordingId = segments[segments.indexOf('recordings') + 1] || '';
    if (recordingId) {
      stats.recordingIds.add(recordingId);
    }
  };

  await page.route('**/media/upload-policy', (route) =>
    json(route, {
      maxRawUploadBytes: 200 * 1024 * 1024,
      clientChunkBytes: 4 * 1024 * 1024,
      singleObjectMaxBytes: 24 * 1024 * 1024,
      storageContentType: 'audio/wav',
    })
  );

  await page.route('**/media/recordings/*/audio/chunk-status?*', (route) =>
    json(route, { nextIndex: 0 })
  );

  await page.route('**/media/recordings/*/audio/chunk?*', (route) => {
    if (route.request().method() !== 'PUT') {
      return route.fallback();
    }

    stats.uploadRequests += 1;
    rememberRecording(route);
    resolveUploadStarted();
    if (!uploadAllowedAfterReauthentication) {
      return json(route, { message: 'Sesja wygasła.' }, 401);
    }
    return json(route, { ok: true });
  });

  await page.route('**/media/recordings/*/audio/finalize', (route) =>
    json(route, {
      storageMode: 'remote',
      partCount: 7,
      durationMs: 1000,
      audioQuality: { rmsDb: -18, clipping: false },
    })
  );

  await page.route('**/media/recordings/*/transcribe', (route) => {
    rememberRecording(route);
    if (route.request().method() === 'POST') {
      stats.transcriptionStartRequests += 1;
      return json(
        route,
        {
          pipelineStatus: 'processing',
          activeJob: true,
          queuedPosition: 1,
          retryAfterMs: 1,
        },
        202
      );
    }

    return json(route, {
      pipelineStatus: 'done',
      activeJob: false,
      segments: [
        {
          id: 'auth-upload-segment-1',
          timestamp: 0,
          endTimestamp: 1,
          speakerId: 0,
          text: 'Audio upload recovered after reauthentication.',
          verificationStatus: 'verified',
        },
      ],
      speakerNames: { 0: 'QA Owner' },
      speakerCount: 1,
      confidence: 0.99,
    });
  });

  await page.route('**/media/recordings/*/progress*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'event: completed\ndata: {"status":"done"}\n\n',
    })
  );

  await page.route('**/media/analyze', (route) =>
    json(route, {
      summary: 'Recovered upload analysis.',
      actionItems: [],
      decisions: [],
    })
  );

  return {
    stats,
    uploadStarted,
    allowUploadAfterReauthentication() {
      uploadAllowedAfterReauthentication = true;
    },
  };
}

async function logInThroughVisibleForm(page: Page) {
  await page.getByRole('button', { name: 'Logowanie' }).click();
  await page.getByLabel('Adres email').fill(QA_USER.email);
  await page.getByLabel('Hasło').fill(QA_PASSWORD);
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
}

async function openProtectedNavigation(page: Page, label: string) {
  const hamburger = page.locator('.modern-hamburger-btn');
  const navItem = page.locator('.modern-nav-item').filter({ hasText: label }).first();

  if (!(await navItem.isVisible().catch(() => false)) && (await hamburger.isVisible())) {
    await hamburger.click();
  }

  await expect(navItem).toBeVisible();
  await navItem.click();
}

async function hasPersistedSession(page: Page) {
  return page.evaluate(() => {
    const session = JSON.parse(window.localStorage.getItem('voicelog.session.v3') || 'null');
    const workspaceStore = JSON.parse(
      window.localStorage.getItem('voicelog_workspace_store') || 'null'
    );
    return Boolean(session?.token || workspaceStore?.state?.session?.token);
  });
}

async function readPersistedRecordingQueue(page: Page) {
  return page.evaluate(async () => {
    const persistedQueue = await new Promise<unknown>((resolve, reject) => {
      const openRequest = window.indexedDB.open('keyval-store');
      openRequest.onerror = () => reject(openRequest.error);
      openRequest.onsuccess = () => {
        const database = openRequest.result;
        if (!database.objectStoreNames.contains('keyval')) {
          resolve(null);
          return;
        }
        const transaction = database.transaction('keyval', 'readonly');
        const readRequest = transaction.objectStore('keyval').get('voicelog.recordingQueue.v1');
        readRequest.onerror = () => reject(readRequest.error);
        readRequest.onsuccess = () => resolve(readRequest.result);
      };
    });
    return (
      (persistedQueue as { state?: { recordingQueue?: unknown[] } } | null)?.state
        ?.recordingQueue || []
    );
  });
}

async function assertNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
}

test.describe('Authentication session scenarios', () => {
  test('AUTH-001 completes visible login, restores the QA workspace after refresh, and prevents duplicates', async ({
    page,
  }) => {
    const runtime = installRuntimeGuard(page);
    const routes = await installAuthRoutes(page);

    await page.goto('/');
    await logInThroughVisibleForm(page);

    const submit = page.getByRole('button', { name: 'Zaloguj się' });
    await expect(page.locator('.app-shell-modern')).toBeVisible();
    await expect(page.getByText(QA_WORKSPACE.name).first()).toBeVisible();
    expect(routes.stats.loginRequests).toBe(1);
    await expect(submit).not.toBeVisible();
    expect(await hasPersistedSession(page)).toBe(true);

    await page.reload();
    await expect(page.locator('.app-shell-modern')).toBeVisible();
    await expect(page.getByText(QA_WORKSPACE.name).first()).toBeVisible();
    await expect.poll(() => routes.stats.bootstrapRequests).toBeGreaterThanOrEqual(2);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.app-shell-modern')).toBeVisible();
    await assertNoHorizontalOverflow(page);

    runtime.assertHealthy();
    runtime.dispose();
  });

  test('AUTH-002 keeps an invalid login generic, masked, recoverable, and session-free', async ({
    page,
  }) => {
    const runtime = installRuntimeGuard(page, {
      allowedConsoleErrors: [/status of 401 \(Unauthorized\)/i],
    });
    const routes = await installAuthRoutes(page, { loginStatus: 401 });

    await page.goto('/');
    await logInThroughVisibleForm(page);

    const error = page.locator('.inline-alert.error');
    await expect(error).toBeVisible();
    await expect(error).toHaveText('Nieprawidłowy email lub hasło.');
    await expect(page.locator('.auth-shell')).toBeVisible();
    await expect(page.getByLabel('Hasło')).toHaveAttribute('type', 'password');
    await expect(page.getByLabel('Hasło')).toBeEditable();
    expect(await hasPersistedSession(page)).toBe(false);
    expect(routes.stats.loginRequests).toBe(1);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByLabel('Adres email')).toBeVisible();
    await assertNoHorizontalOverflow(page);

    runtime.assertHealthy();
    runtime.dispose();
  });

  test('AUTH-003 invalidates a session after protected navigation without stale UI or a retry loop', async ({
    page,
  }) => {
    const runtime = installRuntimeGuard(page, {
      allowedConsoleErrors: [/status of 401 \(Unauthorized\)/i],
    });
    const routes = await installAuthRoutes(page);

    await page.goto('/');
    await logInThroughVisibleForm(page);
    await expect(page.locator('.app-shell-modern')).toBeVisible();
    await expect.poll(() => routes.stats.bootstrapRequests).toBeGreaterThanOrEqual(1);

    await page.evaluate(() => {
      window.localStorage.setItem(
        'voicelog.session.v3',
        JSON.stringify({
          userId: 'e2e-user',
          workspaceId: 'e2e-workspace',
          token: 'expired-e2e-session',
        })
      );
    });
    routes.expireSession();
    await openProtectedNavigation(page, 'Nagrania');

    await expect
      .poll(() => routes.stats.bootstrapRequests, { timeout: 12_000 })
      .toBeGreaterThanOrEqual(2);
    await expect(page.locator('.auth-shell')).toBeVisible();
    await expect(page.locator('.app-shell-modern')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Logowanie' })).toBeVisible();
    expect(await hasPersistedSession(page)).toBe(false);
    expect(routes.stats.unauthorizedBootstrapRequests).toBe(1);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('button', { name: 'Logowanie' })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    runtime.assertHealthy();
    runtime.dispose();
  });

  // ─────────────────────────────────────────────────────────────────
  // Issue #1549 — stop workspace polling after session expiry
  // Date: 2026-07-22
  // Bug: a controlled bootstrap 401 left repeated protected polling active.
  // Fix: one sync owner cancels bootstrap and poll timers until a new token exists.
  // ─────────────────────────────────────────────────────────────────
  test('AUTH-004 pauses an expired upload until visible reauthentication and one explicit retry', async ({
    page,
  }) => {
    const runtime = installRuntimeGuard(page, {
      allowedConsoleErrors: [/status of 401 \(Unauthorized\)/i],
    });
    const authRoutes = await installAuthRoutes(page);
    const upload = await installUploadExpiryRoutes(page);

    await page.goto('/');
    await logInThroughVisibleForm(page);
    await expect(page.locator('.app-shell-modern')).toBeVisible();
    await openProtectedNavigation(page, 'Nagrania');

    await page
      .getByTestId('recordings-file-input')
      .setInputFiles(fixtureAudioFile('expired-session-upload.wav'));
    await upload.uploadStarted;
    await expect(page.locator('.auth-shell')).toBeVisible();
    await expect(page.locator('.app-shell-modern')).not.toBeVisible();

    await expect.poll(() => readPersistedRecordingQueue(page), { timeout: 10_000 }).toHaveLength(1);
    const pausedQueue = await readPersistedRecordingQueue(page);
    expect(pausedQueue).toHaveLength(1);
    expect(pausedQueue[0]).toMatchObject({
      status: 'auth_required',
      uploaded: false,
      retryCount: 0,
      retryable: true,
      errorCode: 'AUTH_REQUIRED',
    });
    const failedChunkBatchRequests = upload.stats.uploadRequests;
    expect(failedChunkBatchRequests).toBe(3);
    expect(upload.stats.transcriptionStartRequests).toBe(0);
    expect(upload.stats.recordingIds.size).toBe(1);

    upload.allowUploadAfterReauthentication();
    await logInThroughVisibleForm(page);
    await expect(page.locator('.app-shell-modern')).toBeVisible();
    await openProtectedNavigation(page, 'Nagrania');

    const recoveryAlert = page.getByRole('alert', { name: /Wymagane ponowne logowanie/i });
    await expect(recoveryAlert).toBeVisible();
    await expect(page.getByText(/Brak autoryzacji do backendu/i)).toBeVisible();
    await expect(
      page.getByText('Audio upload recovered after reauthentication.')
    ).not.toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole('button', { name: 'Zaloguj ponownie i ponów upload' })
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Zaloguj ponownie i ponów upload' }).click();
    await expect(page.getByText(/Nagranie zosta.*przetworzone\./i)).toBeVisible({
      timeout: 15_000,
    });
    await expect.poll(() => readPersistedRecordingQueue(page), { timeout: 10_000 }).toHaveLength(0);

    expect(authRoutes.stats.loginRequests).toBe(2);
    expect(upload.stats.uploadRequests).toBe(failedChunkBatchRequests + 7);
    expect(upload.stats.transcriptionStartRequests).toBe(1);
    expect(upload.stats.recordingIds.size).toBe(1);

    runtime.assertHealthy();
    runtime.dispose();
  });

  test('Regression: Issue #1549 — one bootstrap 401 clears the session without further protected polls', async ({
    page,
  }) => {
    let sessionExpired = false;
    let bootstrapRequests = 0;
    let unauthorizedBootstrapRequests = 0;

    const user = { id: 'e2e-user', email: 'owner@example.test', name: 'QA Owner' };
    const workspace = {
      id: 'e2e-workspace',
      name: 'QA Workspace',
      memberIds: [user.id],
      memberRoles: { [user.id]: 'owner' },
    };
    const readyCapabilities = {
      ok: true,
      status: 'ready',
      capabilities: {},
      degradedCapabilities: [],
      telemetry: { fallbackModeUsed: false, fallbackModeCapabilities: [] },
    };

    await page.route('**/auth/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'e2e-session-token', user, workspaceId: workspace.id }),
      })
    );
    await page.route('**/state/bootstrap?*', (route) => {
      bootstrapRequests += 1;
      if (sessionExpired) {
        unauthorizedBootstrapRequests += 1;
        return route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Sesja wygasła.' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          workspaceId: workspace.id,
          users: [user],
          workspaces: [workspace],
          state: {
            meetings: [],
            manualTasks: [],
            manualPeople: [],
            taskState: {},
            taskBoards: {},
            calendarMeta: {},
            vocabulary: [],
          },
        }),
      });
    });
    await page.route('**/api/capabilities', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(readyCapabilities),
      })
    );
    await page.route('**/workspaces/*/capabilities', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(readyCapabilities),
      })
    );
    await page.route('**/voice-profiles', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ profiles: [] }),
      })
    );

    await page.goto('/');
    await page.getByRole('button', { name: 'Logowanie' }).click();
    await page.getByLabel('Adres email').fill(user.email);
    await page.getByLabel('Hasło').fill('safe-e2e-password');
    await page.getByRole('button', { name: 'Zaloguj się' }).click();
    await expect(page.locator('.app-shell-modern')).toBeVisible();
    await expect.poll(() => bootstrapRequests).toBeGreaterThanOrEqual(1);
    expect(bootstrapRequests).toBe(1);

    sessionExpired = true;
    const navItem = page.locator('.modern-nav-item').filter({ hasText: 'Nagrania' }).first();
    await expect(navItem).toBeVisible();
    await navItem.click();

    await expect.poll(() => unauthorizedBootstrapRequests, { timeout: 12_000 }).toBe(1);
    await expect(page.locator('.auth-shell')).toBeVisible();
    await expect(page.locator('.app-shell-modern')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Logowanie' })).toBeVisible();
    expect(
      await page.evaluate(() => {
        const session = JSON.parse(window.localStorage.getItem('voicelog.session.v3') || 'null');
        const workspaceStore = JSON.parse(
          window.localStorage.getItem('voicelog_workspace_store') || 'null'
        );
        return Boolean(session?.token || workspaceStore?.state?.session?.token);
      })
    ).toBe(false);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('button', { name: 'Logowanie' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
  });
});
