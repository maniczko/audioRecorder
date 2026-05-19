// @ts-check
import { test, expect } from '@playwright/test';
import { seedLoggedInUser } from './helpers/seed.js';

function smallAudioFile() {
  return {
    name: 'workspace-contract.webm',
    mimeType: 'audio/webm',
    buffer: Buffer.from('e2e-audio'),
  };
}

test.describe('Remote media workspace contract', () => {
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
});
