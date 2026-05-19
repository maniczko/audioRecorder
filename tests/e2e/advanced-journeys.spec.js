// @ts-check
import { test, expect } from '@playwright/test';
import { seedLoggedInUser, seedMeeting, seedQueueItem, seedTask } from './helpers/seed.js';

function smallAudioFile(name = 'advanced-import.webm') {
  return {
    name,
    mimeType: 'audio/webm',
    buffer: Buffer.from('e2e-audio'),
  };
}

test.describe('Advanced release journeys', () => {
  test('navigates core workspace surfaces from a hydrated workspace', async ({ page }) => {
    await seedLoggedInUser(page);
    await seedMeeting(page, {
      id: 'meeting_advanced_release',
      title: 'Advanced release meeting',
      recordings: [],
    });

    await page.goto('/');
    await expect(page.locator('.modern-nav-item').filter({ hasText: 'Studio' })).toBeVisible();

    await page.locator('.modern-nav-item').filter({ hasText: 'Nagrania' }).click();
    await expect(page.getByText('Advanced release meeting')).toBeVisible();

    await page.locator('.modern-nav-item').filter({ hasText: 'Zadania' }).click();
    await expect(page.getByPlaceholder('Dodaj zadanie (N)')).toBeVisible();
  });

  test('keeps recording import blocked when workspace state is not hydrated', async ({ page }) => {
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
    await page
      .getByTestId('recordings-file-input')
      .setInputFiles(smallAudioFile('missing.ws.webm'));

    await expect(
      page.getByRole('alert').getByText(/robocza nie jest jeszcze gotowa/i)
    ).toBeVisible();
    expect(audioUploadSeen).toBe(false);
  });

  test('shows failed import retry without hiding the queued recording', async ({ page }) => {
    await seedLoggedInUser(page);
    await seedMeeting(page, {
      id: 'meeting_failed_import',
      title: 'Failed import meeting',
      recordings: [],
    });
    await seedQueueItem(page, {
      id: 'queue_failed_import',
      recordingId: 'recording_failed_import',
      meetingId: 'meeting_failed_import',
      meetingTitle: 'Failed import meeting',
      status: 'failed',
      errorMessage: 'Pipeline utknal w przetwarzaniu. Sprobuj ponownie.',
      workspaceId: 'ws_e2e',
    });

    await page.goto('/');
    await page.locator('.modern-nav-item').filter({ hasText: 'Nagrania' }).click();

    await expect(page.getByText('Failed import meeting').first()).toBeVisible();
    await expect(page.getByText(/Pipeline utknal/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Spróbuj ponownie|Sprobuj ponownie/i })
    ).toBeVisible();
  });

  test('keeps background transcription processing without showing retry', async ({ page }) => {
    await seedLoggedInUser(page);
    await seedMeeting(page, {
      id: 'meeting_background_processing',
      title: 'Background processing meeting',
      recordings: [],
    });
    await seedQueueItem(page, {
      id: 'queue_background_processing',
      recordingId: 'recording_background_processing',
      meetingId: 'meeting_background_processing',
      meetingTitle: 'Background processing meeting',
      status: 'processing',
      uploaded: true,
      errorMessage: '',
      activeJob: true,
      processingAgeMs: 240_000,
      retryAfterMs: 60_000,
      backoffUntil: 4102444800000,
      workspaceId: 'ws_e2e',
      meetingSnapshot: {
        id: 'meeting_background_processing',
        title: 'Background processing meeting',
        workspaceId: 'ws_e2e',
      },
    });

    await page.goto('/');
    await page.locator('.modern-nav-item').filter({ hasText: 'Nagrania' }).click();

    await expect(page.getByText('Background processing meeting').first()).toBeVisible();
    await expect(page.getByText(/W toku|przetwarz/i).first()).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Spróbuj ponownie|Sprobuj ponownie/i })
    ).toHaveCount(0);
  });

  test('completed transcript review is reachable from recordings', async ({ page }) => {
    await seedLoggedInUser(page);
    await seedMeeting(page, {
      id: 'meeting_completed_transcript',
      title: 'Completed transcript meeting',
      latestRecordingId: 'recording_completed_transcript',
      recordings: [
        {
          id: 'recording_completed_transcript',
          createdAt: '2026-05-19T10:00:00.000Z',
          duration: 120,
          pipelineStatus: 'done',
          transcriptionStatus: 'completed',
          transcript: [{ timestamp: 0, speakerId: 0, text: 'Decyzja: uruchamiamy smoke.' }],
          speakerNames: { 0: 'E2E Tester' },
          analysis: { summary: 'Smoke ready', actionItems: [] },
        },
      ],
    });

    await page.goto('/');
    await page.locator('.modern-nav-item').filter({ hasText: 'Nagrania' }).click();
    await page.getByText('Completed transcript meeting').first().click();

    await expect(page.getByText(/Transkrypcja|Smoke ready|Decyzja/).first()).toBeVisible();
  });

  test('denied microphone shows friendly message and keeps queue stable', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async () => {
            const error = new Error('Permission dismissed');
            error.name = 'NotAllowedError';
            throw error;
          },
        },
      });
    });
    await seedLoggedInUser(page);

    await page.goto('/');
    await page.getByRole('button', { name: 'Nagraj ad hoc' }).click();

    await expect(page.getByText(/Dostep do mikrofonu zablokowany/i)).toBeVisible();
    await page.locator('.modern-nav-item').filter({ hasText: 'Nagrania' }).click();
    await expect(page.getByText(/Blad przetwarzania/i)).toHaveCount(0);
  });

  test('command palette navigation and task creation stay functional together', async ({
    page,
  }) => {
    const taskTitle = `Advanced task ${Date.now()}`;
    await seedLoggedInUser(page);
    await seedMeeting(page, { title: 'Palette meeting' });
    await seedTask(page, { title: 'Existing task' });

    await page.goto('/');
    await page.locator('.modern-search-btn').click();
    await page.locator('.command-palette input').fill('Palette meeting');
    await expect(
      page.locator('.command-result').filter({ hasText: 'Palette meeting' })
    ).toBeVisible();
    await page.keyboard.press('Escape');

    await page.locator('.modern-nav-item').filter({ hasText: 'Zadania' }).click();
    await page.getByPlaceholder('Dodaj zadanie (N)').fill(taskTitle);
    await page.getByRole('button', { name: 'Dodaj' }).click();
    await expect(page.getByText(taskTitle)).toBeVisible();
  });
});
