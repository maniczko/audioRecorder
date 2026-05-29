// @ts-check
import { expect, test } from '@playwright/test';

import {
  AUDIT_PREFIX,
  attachRuntimeGuard,
  createAuditMeeting,
  fetchWorkspaceState,
  hasProductionAuditConfig,
  installProductionSession,
  patchWorkspaceState,
} from './helpers/productionAudit.js';

function withoutMeeting(meetings, id) {
  return (Array.isArray(meetings) ? meetings : []).filter((meeting) => meeting?.id !== id);
}

function hasMeeting(meetings, id) {
  return Array.isArray(meetings) && meetings.some((meeting) => meeting?.id === id);
}

async function openRecordingsTab(page) {
  const navItem = page.locator('.modern-nav-item').filter({ hasText: 'Nagrania' }).first();
  await expect(navItem).toBeVisible();
  await navItem.click({ force: true });
}

test.describe('production persistence gate', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(
      !hasProductionAuditConfig(),
      'Production persistence audit secrets are not configured.'
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installProductionSession(page, request);
  });

  test('audit meeting delete persists after refresh and remote sync', async ({ page, request }) => {
    test.setTimeout(120_000);
    const guard = attachRuntimeGuard(page);
    const meetingId = `${AUDIT_PREFIX}delete_${Date.now()}`;
    const title = `${AUDIT_PREFIX}delete recording smoke`;

    const initialState = await fetchWorkspaceState(request);
    const originalMeetings = withoutMeeting(initialState.meetings, meetingId);
    const meeting = createAuditMeeting(meetingId, title, {
      latestRecordingId: `${meetingId}_recording`,
      recordings: [
        {
          id: `${meetingId}_recording`,
          createdAt: new Date().toISOString(),
          duration: 30,
          pipelineStatus: 'done',
          transcriptionStatus: 'completed',
          transcript: [{ id: `${meetingId}_seg`, speakerId: 0, text: 'Audit delete transcript.' }],
          speakerNames: { 0: 'Audit' },
          speakerCount: 1,
        },
      ],
    });

    await patchWorkspaceState(request, {
      meetings: [meeting, ...originalMeetings],
      calendarMeta: initialState.calendarMeta || {},
    });

    await page.goto('/');
    await openRecordingsTab(page);
    await expect(page.getByText(title)).toBeVisible();

    const afterSeed = await fetchWorkspaceState(request);
    expect(hasMeeting(afterSeed.meetings, meetingId)).toBe(true);

    const meetingTombstones = [
      ...((afterSeed.calendarMeta && afterSeed.calendarMeta.meetingTombstones) || []),
      { id: meetingId, deletedAt: new Date().toISOString(), source: 'production-persistence-gate' },
    ];
    const recordingTombstones = [
      ...((afterSeed.calendarMeta && afterSeed.calendarMeta.recordingTombstones) || []),
      {
        id: `${meetingId}_recording`,
        deletedAt: new Date().toISOString(),
        source: 'production-persistence-gate',
      },
    ];

    await patchWorkspaceState(request, {
      meetings: withoutMeeting(afterSeed.meetings, meetingId),
      calendarMeta: {
        ...(afterSeed.calendarMeta || {}),
        meetingTombstones,
        recordingTombstones,
      },
    });

    await page.reload();
    await openRecordingsTab(page);
    await expect(page.getByText(title)).toHaveCount(0);
    await page.waitForTimeout(2_000);

    const afterDelete = await fetchWorkspaceState(request);
    expect(hasMeeting(afterDelete.meetings, meetingId)).toBe(false);
    expect(
      ((afterDelete.calendarMeta && afterDelete.calendarMeta.meetingTombstones) || []).some(
        (entry) => entry?.id === meetingId
      )
    ).toBe(true);

    await guard.assertClean();
  });
});
