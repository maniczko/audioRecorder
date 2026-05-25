// @ts-check
import { test, expect } from '@playwright/test';
import { seedLoggedInUser, seedMeeting, seedTask } from './helpers/seed.js';

function briefDialog(page) {
  return page.getByRole('dialog', { name: /Nowe spotkanie|Edytuj spotkanie/i });
}

async function openShellTab(page, label) {
  const hamburger = page.locator('.modern-hamburger-btn');
  if (await hamburger.isVisible()) {
    await hamburger.click();
  }

  const navItem = page.locator('.modern-nav-item').filter({ hasText: label }).first();
  await expect(navItem).toBeVisible({ timeout: 15_000 });
  await navItem.click();
}

test.describe('Critical User Flows', () => {
  test('registers, opens Studio, and creates the first meeting', async ({ page }) => {
    const email = `critical.${Date.now()}@example.com`;
    const meetingTitle = `Critical meeting ${Date.now()}`;

    await page.goto('/');
    await page.getByRole('button', { name: 'Rejestracja' }).click();
    await page.getByLabel('Imię i nazwisko').fill('Critical Tester');
    await page.getByLabel('Adres email').fill(email);
    await page.getByLabel('Hasło').fill('haslo123');
    await page.getByLabel(/Nazwa nowej przestrzeni/).fill('Critical Workspace');
    await page.getByRole('button', { name: /Wejdź do aplikacji/i }).click();

    await expect(page.locator('.modern-nav-item').filter({ hasText: 'Studio' })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: 'Przygotuj brief' }).click();
    await briefDialog(page).getByPlaceholder('np. Spotkanie z klientem').fill(meetingTitle);
    await briefDialog(page).locator('.brief-actions .primary-button').click();

    await expect(page.locator('.ff-header-title')).toHaveText(meetingTitle, {
      timeout: 15_000,
    });
  });

  test('opens completed recording from Nagrania and shows transcript context', async ({ page }) => {
    await seedLoggedInUser(page);
    await seedMeeting(page, {
      id: 'meeting_critical_recording',
      title: 'Critical completed recording',
      latestRecordingId: 'recording_critical_completed',
      recordings: [
        {
          id: 'recording_critical_completed',
          createdAt: '2026-05-25T09:00:00.000Z',
          duration: 180,
          pipelineStatus: 'done',
          transcriptionStatus: 'completed',
          transcript: [
            {
              id: 'segment_critical_1',
              speakerId: 'speaker_iwo',
              timestamp: 0,
              text: 'To jest krytyczna transkrypcja testowa.',
            },
          ],
          speakerNames: { speaker_iwo: 'Iwo' },
          analysis: {
            summary: 'Krytyczne podsumowanie jest dostępne.',
            actionItems: ['Sprawdzić ścieżkę nagrania'],
          },
        },
      ],
    });

    await page.goto('/');
    await openShellTab(page, 'Nagrania');
    await page.getByText('Critical completed recording').first().click();

    await expect(page.getByText(/Transkrypcja|Krytyczne podsumowanie/).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('To jest krytyczna transkrypcja testowa.')).toBeVisible();
  });

  test('creates, edits, completes, and deletes a task without stale UI', async ({ page }) => {
    const taskTitle = `Critical task ${Date.now()}`;
    await seedLoggedInUser(page);
    await page.goto('/');
    await openShellTab(page, 'Zadania');

    await page.getByPlaceholder('Dodaj zadanie (N)').fill(taskTitle);
    await page.getByRole('button', { name: 'Dodaj' }).click();
    const taskRow = page
      .locator('.todo-table-row, .todo-kanban-card')
      .filter({ hasText: taskTitle });
    await expect(taskRow).toBeVisible({ timeout: 15_000 });

    const titleInput = page.locator('.todo-detail-title-input');
    await expect(titleInput).toBeVisible();
    await titleInput.fill(`${taskTitle} edited`);
    await titleInput.press('Tab');
    await expect(
      page.locator('.todo-table-row, .todo-kanban-card').filter({ hasText: `${taskTitle} edited` })
    ).toBeVisible();
    await page.locator('.todo-detail-modal-close').click();
    await expect(page.locator('.todo-detail-overlay')).toHaveCount(0);

    const editedRow = page
      .locator('.todo-table-row, .todo-kanban-card')
      .filter({ hasText: `${taskTitle} edited` });
    await editedRow.locator('.todo-task-circle').first().click();
    await expect(editedRow.locator('.todo-task-circle').first()).toHaveClass(/completed/);

    await editedRow.click();
    await expect(page.locator('.todo-detail-title-input')).toBeVisible();
    page.on('dialog', (dialog) => dialog.accept());
    await page.locator('[aria-label="Usun zadanie"]').click();
    await expect(
      page.locator('.todo-table-row, .todo-kanban-card').filter({ hasText: `${taskTitle} edited` })
    ).not.toBeVisible();
  });

  test('command palette, people, calendar, and notes surfaces open from the same session', async ({
    page,
  }) => {
    await seedLoggedInUser(page);
    await seedMeeting(page, {
      id: 'meeting_critical_surfaces',
      title: 'Critical surface meeting',
      attendees: ['Barbara', 'Iwo'],
      context: 'Critical notes context',
      startsAt: '2026-06-01T10:00:00.000Z',
    });
    await seedTask(page, { id: 'task_critical_surface', title: 'Critical surface task' });

    await page.goto('/');

    await page.locator('.modern-search-btn').click();
    await page.locator('.command-palette input').fill('Critical surface meeting');
    await expect(
      page.locator('.command-result').filter({ hasText: 'Critical surface meeting' })
    ).toBeVisible();
    await page.keyboard.press('Escape');

    await openShellTab(page, 'Osoby');
    await expect(page.locator('.people-tab, .people-layout, main').first()).toBeVisible();

    await openShellTab(page, 'Kalendarz');
    await expect(page.locator('.calendar-view, .calendar-shell, main').first()).toBeVisible();

    await openShellTab(page, 'Notatki');
    await expect(page.locator('.notes-layout')).toBeVisible();
  });
});
