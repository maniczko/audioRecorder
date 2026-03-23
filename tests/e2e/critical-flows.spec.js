import { test, expect } from '@playwright/test';
import { seedLoggedInUser } from './helpers/seed';

test.describe('Critical User Flows', () => {
  test('complete flow: registration → first meeting → recording → transcription', async ({ page }) => {
    // Step 1: Register new user
    await page.goto('/');
    await page.click('button:has-text("Rejestracja")');
    await page.fill('input[type="email"]', 'test-e2e@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.fill('input[type="text"]', 'Test User');
    await page.click('button:has-text("Zarejestruj się")');
    
    // Wait for successful registration and redirect
    await expect(page.locator('.auth-panel')).toBeVisible();
    
    // Step 2: Create first meeting
    await page.click('button:has-text("Nowe spotkanie")');
    await page.fill('input[placeholder*="tytuł"]', 'E2E Test Meeting');
    await page.fill('textarea[placeholder*="kontekst"]', 'Test context for E2E');
    
    // Step 3: Start recording (mock)
    await page.click('button:has-text("Rozpocznij nagrywanie")');
    await expect(page.locator('[data-testid="recording-indicator"]')).toBeVisible();
    
    // Step 4: Stop recording
    await page.click('button:has-text("Zatrzymaj")');
    
    // Step 5: Wait for transcription to complete
    await expect(page.locator('[data-testid="transcript-status"]')).toContainText('Gotowe');
    
    // Step 6: Verify transcript exists
    const transcriptSegments = page.locator('[data-testid="transcript-segment"]');
    await expect(transcriptSegments).toHaveCount({ min: 1 });
  });

  test('complete flow: login → view meetings → edit transcript', async ({ page }) => {
    // Seed logged in user
    await seedLoggedInUser(page);
    
    // Step 1: Navigate to meetings list
    await page.goto('/');
    await page.click('[data-tab="meetings"]');
    
    // Step 2: Select a meeting
    await page.click('[data-testid="meeting-item"]:first-child');
    
    // Step 3: Open transcript editor
    await page.click('[data-testid="edit-transcript-btn"]');
    
    // Step 4: Edit a transcript segment
    const firstSegment = page.locator('[data-testid="transcript-segment"]:first-child');
    await firstSegment.dblclick();
    await firstSegment.locator('textarea').fill('Edited transcript text');
    await firstSegment.locator('button:has-text("Zapisz")').click();
    
    // Step 5: Verify save success
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible();
  });

  test('complete flow: tasks create → edit → complete → delete', async ({ page }) => {
    await seedLoggedInUser(page);
    
    // Step 1: Navigate to tasks
    await page.goto('/');
    await page.click('[data-tab="tasks"]');
    
    // Step 2: Create new task
    await page.click('[data-testid="add-task-btn"]');
    await page.fill('[data-testid="task-title-input"]', 'E2E Test Task');
    await page.press('[data-testid="task-title-input"]', 'Enter');
    
    // Step 3: Edit task
    const taskCard = page.locator('[data-testid="task-card"]:has-text("E2E Test Task")');
    await taskCard.click();
    await page.fill('[data-testid="task-description-input"]', 'Test description');
    await page.click('[data-testid="save-task-btn"]');
    
    // Step 4: Complete task
    await taskCard.locator('[data-testid="complete-task-btn"]').click();
    await expect(taskCard).toHaveClass(/completed/);
    
    // Step 5: Delete task
    await taskCard.locator('[data-testid="delete-task-btn"]').click();
    await page.click('button:has-text("Usuń")');
    await expect(taskCard).not.toBeVisible();
  });

  test('complete flow: people profile → psych profile → meeting history', async ({ page }) => {
    await seedLoggedInUser(page);
    
    // Step 1: Navigate to people tab
    await page.goto('/');
    await page.click('[data-tab="people"]');
    
    // Step 2: Select a person
    await page.click('[data-testid="person-item"]:first-child');
    
    // Step 3: View psych profile
    await page.click('[data-testid="psych-profile-tab"]');
    await expect(page.locator('[data-testid="disc-chart"]')).toBeVisible();
    
    // Step 4: View meeting history
    await page.click('[data-testid="meeting-history-tab"]');
    const meetingHistory = page.locator('[data-testid="meeting-history-item"]');
    await expect(meetingHistory).toHaveCount({ min: 0 });
  });

  test('complete flow: calendar → create meeting → Google Calendar sync', async ({ page }) => {
    await seedLoggedInUser(page);
    
    // Step 1: Navigate to calendar
    await page.goto('/');
    await page.click('[data-tab="calendar"]');
    
    // Step 2: Create meeting from calendar
    await page.click('[data-testid="calendar-day"]:first-child');
    await page.fill('input[placeholder*="tytuł"]', 'Calendar E2E Meeting');
    await page.click('button:has-text("Utwórz")');
    
    // Step 3: Verify meeting created
    await expect(page.locator('[data-testid="calendar-event"]:has-text("Calendar E2E Meeting")')).toBeVisible();
    
    // Step 4: Sync to Google Calendar (if connected)
    const syncBtn = page.locator('[data-testid="sync-google-btn"]');
    if (await syncBtn.isVisible()) {
      await syncBtn.click();
      await expect(page.locator('[data-testid="sync-success"]')).toBeVisible({ timeout: 5000 });
    }
  });
});
