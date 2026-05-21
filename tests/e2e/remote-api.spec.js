// @ts-check
import { test, expect } from '@playwright/test';
import { seedLoggedInUser, seedMeeting, seedQueueItem } from './helpers/seed.js';

function smallAudioFile() {
  return {
    name: 'workspace-contract.webm',
    mimeType: 'audio/webm',
    buffer: Buffer.from('e2e-audio'),
  };
}

async function readPersistedRecordingQueue(page) {
  return page.evaluate(async () => {
    const storageKey = 'voicelog.recordingQueue.v1';
    const readLocal = () => JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (!window.indexedDB) {
      return readLocal();
    }

    try {
      const value = await new Promise((resolve, reject) => {
        const openRequest = window.indexedDB.open('keyval-store');
        openRequest.onerror = () => reject(openRequest.error);
        openRequest.onsuccess = () => {
          const db = openRequest.result;
          const transaction = db.transaction('keyval', 'readonly');
          const store = transaction.objectStore('keyval');
          const getRequest = store.get(storageKey);
          getRequest.onerror = () => reject(getRequest.error);
          getRequest.onsuccess = () => resolve(getRequest.result);
        };
      });
      return value || readLocal();
    } catch {
      return readLocal();
    }
  });
}

test.describe('Remote media workspace contract', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/media/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mode: 'no-key' }),
      });
    });
  });

  test('sends auth and X-Workspace-Id before remote audio upload', async ({ page }) => {
    let audioUploadSeen = false;

    await page.route('**/media/recordings/*/audio', async (route, request) => {
      if (request.method() !== 'PUT') {
        await route.fallback();
        return;
      }

      audioUploadSeen = true;
      const headers = request.headers();
      expect(headers.authorization).toBe('Bearer e2e-token');
      expect(headers['x-workspace-id']).toBe('ws_e2e');
      expect(headers['x-meeting-id']).toBeTruthy();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ storageMode: 'remote', audioQuality: null }),
      });
    });

    await page.route('**/media/recordings/*/transcribe', async (route, request) => {
      if (request.method() !== 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            pipelineStatus: 'done',
            segments: [{ timestamp: 0, text: 'Test transcript', speakerId: 0 }],
            speakerNames: { 0: 'E2E Tester' },
            speakerCount: 1,
          }),
        });
        return;
      }

      const body = request.postDataJSON();
      expect(body.workspaceId).toBe('ws_e2e');
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          pipelineStatus: 'done',
          segments: [{ timestamp: 0, text: 'Test transcript', speakerId: 0 }],
          speakerNames: { 0: 'E2E Tester' },
          speakerCount: 1,
        }),
      });
    });

    await seedLoggedInUser(page);
    await page.goto('/');
    await page.locator('.modern-nav-item').filter({ hasText: 'Nagrania' }).click();
    await page.getByTestId('recordings-file-input').setInputFiles(smallAudioFile());

    await expect.poll(() => audioUploadSeen).toBe(true);
  });

  test('does not call remote audio upload when workspace is unavailable', async ({ page }) => {
    let audioUploadSeen = false;

    await page.route('**/media/recordings/*/audio', async (route, request) => {
      if (request.method() === 'PUT') {
        audioUploadSeen = true;
      }
      await route.fulfill({ status: 500, body: 'unexpected upload' });
    });

    await seedLoggedInUser(page);
    await page.addInitScript(() => {
      localStorage.setItem('voicelog.e2e.forceMissingImportWorkspace', 'true');
    });

    await page.goto('/');
    await page.locator('.modern-nav-item').filter({ hasText: 'Nagrania' }).click();
    await page.getByTestId('recordings-file-input').setInputFiles(smallAudioFile());

    await expect(
      page.getByRole('alert').getByText(/robocza nie jest jeszcze gotowa/i)
    ).toBeVisible();
    expect(audioUploadSeen).toBe(false);
  });

  test('turns a persisted stale remote queue item into a permanent local state', async ({
    page,
  }) => {
    const staleRecordingId = 'recording_stale_remote_404';
    let statusRequests = 0;
    let retryRequests = 0;
    const queueFailureLogs = [];

    page.on('console', (message) => {
      const text = message.text();
      if (text.includes('Recording queue item failed')) {
        queueFailureLogs.push(text);
      }
    });

    await page.route(
      `**/media/recordings/${staleRecordingId}/transcribe`,
      async (route, request) => {
        if (request.method() === 'GET') {
          statusRequests += 1;
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Nie znaleziono nagrania.' }),
          });
          return;
        }

        await route.fulfill({ status: 500, body: 'unexpected transcribe mutation' });
      }
    );

    await page.route(`**/media/recordings/${staleRecordingId}/retry-transcribe`, async (route) => {
      retryRequests += 1;
      await route.fulfill({ status: 500, body: 'unexpected retry' });
    });

    await seedLoggedInUser(page);
    await seedMeeting(page, {
      id: 'meeting_stale_remote',
      title: 'Stale remote meeting',
      workspaceId: 'ws_e2e',
      recordings: [],
    });
    await seedQueueItem(page, {
      id: 'queue_stale_remote',
      recordingId: staleRecordingId,
      meetingId: 'meeting_stale_remote',
      meetingTitle: 'Stale remote meeting',
      status: 'processing',
      uploaded: true,
      retryCount: 0,
      attempts: 0,
      workspaceId: 'ws_e2e',
      createdAt: new Date().toISOString(),
      meetingSnapshot: {
        id: 'meeting_stale_remote',
        title: 'Stale remote meeting',
        workspaceId: 'ws_e2e',
      },
    });

    await page.goto('/');
    await page.locator('.modern-nav-item').filter({ hasText: 'Nagrania' }).click();

    await expect(page.getByText('Stale remote meeting').first()).toBeVisible();
    await expect(
      page.locator('.pipeline-error-text').filter({
        hasText: /Nagranie nie jest juz dostepne na serwerze/i,
      })
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.pipeline-retry-btn')).toHaveCount(0);

    await page.waitForTimeout(1500);
    expect(statusRequests).toBe(1);
    expect(retryRequests).toBe(0);
    expect(queueFailureLogs).toEqual([]);

    await expect
      .poll(
        async () => {
          const queueState = await readPersistedRecordingQueue(page);
          return queueState?.state?.recordingQueue?.[0]?.status || '';
        },
        { timeout: 5_000 }
      )
      .toBe('failed_permanent');
  });

  // -----------------------------------------------------------------
  // Issue #0 - persisted missing X-Workspace-Id failure survived reload
  // Date: 2026-05-21
  // Bug: stale local queue state kept polling/retry UI after refresh.
  // Fix: hydrate it into failed_permanent without backend calls.
  // -----------------------------------------------------------------
  test('normalizes persisted workspace-header queue failure after reload', async ({ page }) => {
    const recordingId = 'recording_missing_workspace_after_reload';
    let statusRequests = 0;
    let retryRequests = 0;
    let uploadRequests = 0;

    await page.route(`**/media/recordings/${recordingId}/transcribe`, async (route) => {
      statusRequests += 1;
      await route.fulfill({ status: 500, body: 'unexpected transcribe poll' });
    });

    await page.route(`**/media/recordings/${recordingId}/retry-transcribe`, async (route) => {
      retryRequests += 1;
      await route.fulfill({ status: 500, body: 'unexpected retry' });
    });

    await page.route(`**/media/recordings/${recordingId}/audio`, async (route, request) => {
      if (request.method() === 'PUT') {
        uploadRequests += 1;
      }
      await route.fulfill({ status: 500, body: 'unexpected upload' });
    });

    await seedLoggedInUser(page);
    await seedMeeting(page, {
      id: 'meeting_missing_workspace_reload',
      title: 'Missing workspace reload',
      workspaceId: '',
      recordings: [],
    });
    await seedQueueItem(page, {
      id: 'queue_missing_workspace_reload',
      recordingId,
      meetingId: 'meeting_missing_workspace_reload',
      meetingTitle: 'Missing workspace reload',
      status: 'failed',
      uploaded: true,
      retryCount: 0,
      attempts: 0,
      workspaceId: '',
      errorMessage: 'Brakuje X-Workspace-Id.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      meetingSnapshot: {
        id: 'meeting_missing_workspace_reload',
        title: 'Missing workspace reload',
        workspaceId: '',
      },
    });

    await page.goto('/');
    await page.locator('.modern-nav-item').filter({ hasText: 'Nagrania' }).click();

    await expect(page.getByText('Missing workspace reload').first()).toBeVisible();
    await expect(
      page.locator('.pipeline-error-text').filter({
        hasText: /robocza nie jest jeszcze gotowa/i,
      })
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.pipeline-retry-btn')).toHaveCount(0);

    await page.waitForTimeout(1500);
    expect(statusRequests).toBe(0);
    expect(retryRequests).toBe(0);
    expect(uploadRequests).toBe(0);

    await expect
      .poll(
        async () => {
          const queueState = await readPersistedRecordingQueue(page);
          const item = queueState?.state?.recordingQueue?.[0];
          return {
            status: item?.status || '',
            isTechnicalError: String(item?.errorMessage || '').includes('Brakuje X-Workspace-Id'),
          };
        },
        { timeout: 5_000 }
      )
      .toEqual({ status: 'failed_permanent', isTechnicalError: false });
  });
});
