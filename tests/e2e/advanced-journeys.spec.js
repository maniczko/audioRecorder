/**
 * E2E Tests — Advanced Critical User Journeys
 * 
 * Following AGENTS.md §2.1:
 * - Tests cover complete user workflows
 * - Each test is independent and can run in isolation
 * - Tests use realistic data and scenarios
 * 
 * Run: pnpm run test:e2e:advanced
 */

import { test, expect } from '@playwright/test';
import { seedLoggedInUser } from './helpers/seed';

test.describe('Advanced Critical User Journeys', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // Journey 1: Recording Studio Workflow
  // ───────────────────────────────────────────────────────────────────────────

  test.describe('Recording Studio Workflow', () => {
    test('complete recording workflow: start → pause → resume → stop → review', async ({ page }) => {
      await seedLoggedInUser(page);
      await page.goto('/');

      // Step 1: Navigate to recording studio
      await page.click('[data-testid="record-btn"]');
      await expect(page.locator('[data-testid="recording-studio"]')).toBeVisible();

      // Step 2: Start recording
      await page.click('[data-testid="start-recording-btn"]');
      await expect(page.locator('[data-testid="recording-timer"]')).toBeVisible();
      await expect(page.locator('[data-testid="waveform-visualizer"]')).toBeVisible();

      // Step 3: Pause recording
      await page.click('[data-testid="pause-recording-btn"]');
      await expect(page.locator('[data-testid="recording-timer"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="paused-indicator"]')).toBeVisible();

      // Step 4: Resume recording
      await page.click('[data-testid="resume-recording-btn"]');
      await expect(page.locator('[data-testid="recording-timer"]')).toBeVisible();

      // Step 5: Stop recording
      await page.click('[data-testid="stop-recording-btn"]');
      await expect(page.locator('[data-testid="processing-indicator"]')).toBeVisible();

      // Step 6: Wait for processing to complete
      await expect(page.locator('[data-testid="processing-indicator"]')).not.toBeVisible({ timeout: 30000 });

      // Step 7: Verify recording appears in list
      await page.click('[data-tab="meetings"]');
      const recordingItem = page.locator('[data-testid="recording-item"]:first-child');
      await expect(recordingItem).toBeVisible();
    });

    test('recording with live transcription enabled', async ({ page }) => {
      await seedLoggedInUser(page);
      await page.goto('/studio?liveTranscript=true');

      // Step 1: Enable live transcription
      await page.click('[data-testid="live-transcript-toggle"]');
      await expect(page.locator('[data-testid="live-transcript-enabled"]')).toBeVisible();

      // Step 2: Start recording
      await page.click('[data-testid="start-recording-btn"]');

      // Step 3: Verify live transcript appears
      const liveTranscript = page.locator('[data-testid="live-transcript"]');
      await expect(liveTranscript).toBeVisible();

      // Step 4: Stop recording
      await page.click('[data-testid="stop-recording-btn"]');

      // Step 5: Verify final transcript is saved
      await expect(page.locator('[data-testid="final-transcript"]')).toBeVisible();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Journey 2: Multi-Speaker Meeting Workflow
  // ───────────────────────────────────────────────────────────────────────────

  test.describe('Multi-Speaker Meeting Workflow', () => {
    test('diarization: detect speakers → assign names → verify segments', async ({ page }) => {
      await seedLoggedInUser(page);
      await page.goto('/');

      // Step 1: Create meeting with multiple speakers
      await page.click('[data-testid="new-meeting-btn"]');
      await page.fill('[data-testid="meeting-title"]', 'Multi-Speaker Test');
      await page.click('[data-testid="add-participant-btn"]');
      await page.fill('[data-testid="participant-name-1"]', 'Alice');
      await page.click('[data-testid="add-participant-btn"]');
      await page.fill('[data-testid="participant-name-2"]', 'Bob');
      await page.click('[data-testid="save-meeting-btn"]');

      // Step 2: Upload multi-speaker audio (mock)
      await page.click('[data-testid="upload-audio-btn"]');
      await page.setInputFiles('[data-testid="file-input"]', {
        name: 'multi-speaker-test.wav',
        mimeType: 'audio/wav',
        buffer: Buffer.alloc(1024),
      });

      // Step 3: Wait for diarization to complete
      await expect(page.locator('[data-testid="diarization-status"]')).toContainText('Przetwarzanie');
      await expect(page.locator('[data-testid="diarization-status"]')).toContainText('Gotowe', { timeout: 60000 });

      // Step 4: Verify speaker labels
      const speakerALabels = page.locator('[data-testid="speaker-label"]:has-text("Alice")');
      const speakerBLabels = page.locator('[data-testid="speaker-label"]:has-text("Bob")');
      await expect(speakerALabels).toHaveCount({ min: 1 });
      await expect(speakerBLabels).toHaveCount({ min: 1 });

      // Step 5: Assign speaker name to unknown speaker
      const unknownSpeaker = page.locator('[data-testid="speaker-label"]:has-text("Speaker")');
      if (await unknownSpeaker.count() > 0) {
        await unknownSpeaker.first().click();
        await page.fill('[data-testid="speaker-name-input"]', 'Charlie');
        await page.click('[data-testid="save-speaker-name-btn"]');
        await expect(page.locator('[data-testid="speaker-label"]:has-text("Charlie")')).toBeVisible();
      }
    });

    test('voice profile matching: record → create profile → auto-assign speakers', async ({ page }) => {
      await seedLoggedInUser(page);
      await page.goto('/people');

      // Step 1: Create voice profile
      await page.click('[data-testid="create-voice-profile-btn"]');
      await page.fill('[data-testid="profile-name-input"]', 'Test User Profile');
      await page.click('[data-testid="upload-voice-sample-btn"]');
      await page.setInputFiles('[data-testid="voice-sample-input"]', {
        name: 'voice-sample.wav',
        mimeType: 'audio/wav',
        buffer: Buffer.alloc(512),
      });
      await page.click('[data-testid="save-voice-profile-btn"]');

      // Step 2: Verify profile created
      await expect(page.locator('[data-testid="voice-profile-item"]:has-text("Test User Profile")')).toBeVisible();

      // Step 3: Create meeting with voice profile matching enabled
      await page.goto('/');
      await page.click('[data-testid="new-meeting-btn"]');
      await page.check('[data-testid="enable-voice-matching"]');
      await page.click('[data-testid="save-meeting-btn"]');

      // Step 4: Upload audio and verify auto-assignment
      await page.click('[data-testid="upload-audio-btn"]');
      await page.setInputFiles('[data-testid="file-input"]', {
        name: 'voice-match-test.wav',
        mimeType: 'audio/wav',
        buffer: Buffer.alloc(1024),
      });

      // Wait for voice matching
      await expect(page.locator('[data-testid="voice-match-status"]')).toContainText('Gotowe', { timeout: 60000 });

      // Verify speaker was auto-assigned
      const matchedSpeaker = page.locator('[data-testid="speaker-label"]:has-text("Test User")');
      await expect(matchedSpeaker).toHaveCount({ min: 1 });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Journey 3: Task Management Workflow
  // ───────────────────────────────────────────────────────────────────────────

  test.describe('Task Management Workflow', () => {
    test('AI task suggestions: generate → review → accept/reject → track', async ({ page }) => {
      await seedLoggedInUser(page);
      await page.goto('/');

      // Step 1: Navigate to meeting with transcript
      await page.click('[data-tab="meetings"]');
      await page.click('[data-testid="meeting-item"]:first-child');

      // Step 2: Request AI task suggestions
      await page.click('[data-testid="ai-suggest-tasks-btn"]');
      await expect(page.locator('[data-testid="ai-tasks-loading"]')).toBeVisible();

      // Step 3: Wait for AI suggestions
      await expect(page.locator('[data-testid="ai-tasks-loading"]')).not.toBeVisible({ timeout: 30000 });

      // Step 4: Review suggestions
      const suggestedTasks = page.locator('[data-testid="suggested-task-item"]');
      await expect(suggestedTasks).toHaveCount({ min: 1 });

      // Step 5: Accept some tasks, reject others
      const firstTask = suggestedTasks.first();
      await firstTask.locator('[data-testid="accept-task-btn"]').click();
      await expect(firstTask).not.toBeVisible();

      // Step 6: Verify accepted task appears in task list
      await page.click('[data-tab="tasks"]');
      await expect(page.locator('[data-testid="task-item"]:last-child')).toBeVisible();
    });

    test('task lifecycle: create → assign → set priority → track status → complete', async ({ page }) => {
      await seedLoggedInUser(page);
      await page.goto('/tasks');

      // Step 1: Create new task
      await page.click('[data-testid="create-task-btn"]');
      await page.fill('[data-testid="task-title-input"]', 'E2E Advanced Task');
      await page.fill('[data-testid="task-description-input"]', 'This is a comprehensive E2E test task');

      // Step 2: Assign to person
      await page.click('[data-testid="task-assignee-select"]');
      await page.click('[data-testid="assignee-option"]:first-child');

      // Step 3: Set priority
      await page.click('[data-testid="task-priority-select"]');
      await page.click('[data-testid="priority-option-high"]');

      // Step 4: Set due date
      await page.fill('[data-testid="task-due-date-input"]', '2026-04-15');

      // Step 5: Link to meeting
      await page.click('[data-testid="task-meeting-select"]');
      await page.click('[data-testid="meeting-option"]:first-child');

      // Step 6: Save task
      await page.click('[data-testid="save-task-btn"]');

      // Step 7: Verify task appears in list
      const taskCard = page.locator('[data-testid="task-card"]:has-text("E2E Advanced Task")');
      await expect(taskCard).toBeVisible();

      // Step 8: Verify priority badge
      await expect(taskCard.locator('[data-testid="priority-badge-high"]')).toBeVisible();

      // Step 9: Change status to in progress
      await taskCard.click();
      await page.click('[data-testid="task-status-select"]');
      await page.click('[data-testid="status-option-in-progress"]');
      await page.click('[data-testid="save-task-btn"]');

      // Step 10: Complete task
      await taskCard.locator('[data-testid="complete-task-btn"]').click();
      await expect(taskCard).toHaveClass(/completed/);
    });

    test('Kanban view: drag tasks between columns → verify state persistence', async ({ page }) => {
      await seedLoggedInUser(page);
      await page.goto('/tasks?view=kanban');

      // Step 1: Verify Kanban columns exist
      await expect(page.locator('[data-testid="kanban-column-todo"]')).toBeVisible();
      await expect(page.locator('[data-testid="kanban-column-in-progress"]')).toBeVisible();
      await expect(page.locator('[data-testid="kanban-column-done"]')).toBeVisible();

      // Step 2: Create a task in TODO column
      await page.click('[data-testid="kanban-column-todo"] [data-testid="add-task-btn"]');
      await page.fill('[data-testid="task-title-input"]', 'Kanban Test Task');
      await page.click('[data-testid="save-task-btn"]');

      // Step 3: Drag task from TODO to IN PROGRESS
      const taskCard = page.locator('[data-testid="kanban-card"]:has-text("Kanban Test Task")');
      const inProgressColumn = page.locator('[data-testid="kanban-column-in-progress"]');
      
      await taskCard.dragTo(inProgressColumn);

      // Step 4: Verify task is now in IN PROGRESS column
      await expect(inProgressColumn.locator('[data-testid="kanban-card"]:has-text("Kanban Test Task")')).toBeVisible();

      // Step 5: Refresh page and verify state persisted
      await page.reload();
      await expect(inProgressColumn.locator('[data-testid="kanban-card"]:has-text("Kanban Test Task")')).toBeVisible();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Journey 4: Search & Discovery Workflow
  // ───────────────────────────────────────────────────────────────────────────

  test.describe('Search & Discovery Workflow', () => {
    test('semantic search: query → RAG retrieval → AI answer → cite sources', async ({ page }) => {
      await seedLoggedInUser(page);
      await page.goto('/');

      // Step 1: Open AI search
      await page.click('[data-testid="ai-search-btn"]');

      // Step 2: Enter semantic query
      await page.fill('[data-testid="ai-search-input"]', 'What were the main decisions from last week?');
      await page.click('[data-testid="ai-search-submit"]');

      // Step 3: Wait for AI response
      await expect(page.locator('[data-testid="ai-search-loading"]')).toBeVisible();
      await expect(page.locator('[data-testid="ai-search-loading"]')).not.toBeVisible({ timeout: 30000 });

      // Step 4: Verify AI answer
      const aiAnswer = page.locator('[data-testid="ai-search-answer"]');
      await expect(aiAnswer).toBeVisible();
      await expect(aiAnswer).not.toBeEmpty();

      // Step 5: Verify source citations
      const citations = page.locator('[data-testid="search-citation"]');
      await expect(citations).toHaveCount({ min: 1 });

      // Step 6: Click citation to navigate to source
      await citations.first().click();
      await expect(page.locator('[data-testid="source-meeting-view"]')).toBeVisible();
    });

    test('command palette: search meetings → navigate → quick actions', async ({ page }) => {
      await seedLoggedInUser(page);
      await page.goto('/');

      // Step 1: Open command palette
      await page.keyboard.press('Meta+K');
      await expect(page.locator('[data-testid="command-palette"]')).toBeVisible();

      // Step 2: Search for meeting
      await page.fill('[data-testid="command-palette-input"]', 'meeting');
      
      // Step 3: Select first meeting result
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');

      // Step 4: Verify navigation to meeting
      await expect(page.locator('[data-testid="meeting-detail-view"]')).toBeVisible();

      // Step 5: Reopen command palette and use quick action
      await page.keyboard.press('Meta+K');
      await page.fill('[data-testid="command-palette-input"]', 'new task');
      await page.keyboard.press('Enter');

      // Step 6: Verify task creation modal opened
      await expect(page.locator('[data-testid="task-create-modal"]')).toBeVisible();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Journey 5: Workspace Collaboration Workflow
  // ───────────────────────────────────────────────────────────────────────────

  test.describe('Workspace Collaboration Workflow', () => {
    test('invite member → accept invite → assign role → share meeting', async ({ page }) => {
      await seedLoggedInUser(page);
      await page.goto('/settings/workspace');

      // Step 1: Invite new member
      await page.click('[data-testid="invite-member-btn"]');
      await page.fill('[data-testid="invite-email-input"]', 'newmember@example.com');
      await page.click('[data-testid="send-invite-btn"]');
      await expect(page.locator('[data-testid="invite-success"]')).toBeVisible();

      // Step 2: Verify pending invite
      const pendingInvite = page.locator('[data-testid="pending-invite"]:has-text("newmember@example.com")');
      await expect(pendingInvite).toBeVisible();

      // Step 3: Assign member role (owner/member)
      await page.click('[data-testid="member-role-select"]');
      await page.click('[data-testid="role-option-admin"]');

      // Step 4: Share meeting with workspace
      await page.goto('/meetings');
      await page.click('[data-testid="meeting-item"]:first-child');
      await page.click('[data-testid="share-meeting-btn"]');
      await page.check('[data-testid="share-with-workspace"]');
      await page.click('[data-testid="save-share-btn"]');

      // Step 5: Verify sharing success
      await expect(page.locator('[data-testid="share-success"]')).toBeVisible();
    });

    test('workspace state sync: edit on one tab → verify update on another', async ({ page, context }) => {
      await seedLoggedInUser(page);
      
      // Step 1: Open two tabs
      const tab1 = page;
      const tab2 = await context.newPage();
      await tab2.goto('/');

      // Step 2: Edit workspace state on tab 1
      await tab1.goto('/settings/workspace');
      await tab1.fill('[data-testid="workspace-name-input"]', 'Updated Workspace Name');
      await tab1.click('[data-testid="save-workspace-btn"]');
      await expect(tab1.locator('[data-testid="save-success"]')).toBeVisible();

      // Step 3: Refresh tab 2 and verify sync
      await tab2.reload();
      await expect(tab2.locator('[data-testid="workspace-name"]')).toContainText('Updated Workspace Name');

      // Step 4: Close tab 2
      await tab2.close();
    });
  });
});
