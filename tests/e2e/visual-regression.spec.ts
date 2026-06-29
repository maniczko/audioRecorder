import { expect, test, type TestInfo } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { seedLoggedInUser, seedMeeting, seedQueueItem, seedTask } from './helpers/seed.js';

const releaseViewports = [
  { name: 'mobile-320', width: 320, height: 844 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'tablet-1024', width: 1024, height: 768 },
  { name: 'desktop-1366', width: 1366, height: 768 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1600', width: 1600, height: 900 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
];

const overlayViewports = [releaseViewports[0], releaseViewports[releaseViewports.length - 1]];
const referenceViewports = releaseViewports.filter((viewport) =>
  ['desktop-1366', 'desktop-1440', 'desktop-1600', 'desktop-1920'].includes(viewport.name)
);

const referenceScreensDir = path.join(
  process.cwd(),
  'tests/e2e/reference-screenshots/premium-light/named'
);

const referenceFixtures = [
  'profile-integrations-desktop-1660x947.png',
  'brief-modal-desktop-678x783.png',
  'tasks-detail-desktop-1161x786.png',
  'notes-detail-desktop-1183x788.png',
  'recordings-table-desktop-1275x777.png',
  'people-profile-desktop-1394x774.png',
];

const consoleErrorsByTest = new WeakMap<TestInfo, string[]>();
const benignConsoleErrorPatterns = [
  /Failed to load resource: net::ERR_CONNECTION_CLOSED/i,
  /Failed to load resource: net::ERR_NETWORK_CHANGED/i,
  /Failed to load resource: net::ERR_REQUEST_RANGE_NOT_SATISFIABLE/i,
  /Failed to load resource: the server responded with a status of 404 \(Not Found\)/i,
];

const coreTabs = [
  { label: 'Studio', surface: 'studio', expected: '.modern-content-wrapper' },
  { label: 'Nagrania', surface: 'recordings', expected: '.recordings-tab-shell, main' },
  { label: 'Kalendarz', surface: 'calendar', expected: '.calendar-view, .calendar-shell, main' },
  { label: 'Zadania', surface: 'tasks', expected: '.tasks-page-shell, .tasks-layout, main' },
  { label: 'Osoby', surface: 'people', expected: '.people-tab, .people-layout, main' },
  { label: 'Notatki', surface: 'notes', expected: '.notes-layout' },
];

async function mockUnmatchedLocalBackendRequests(page) {
  for (const pattern of ['http://127.0.0.1:4000/**', 'http://localhost:4000/**']) {
    await page.route(pattern, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unmocked visual fixture backend request.' }),
      });
    });
  }
}

async function freezeClock(page) {
  await page.addInitScript(`
    {
      const fixedTime = new Date('2026-05-14T10:00:00.000Z').getTime();
      const RealDate = Date;
      class MockDate extends RealDate {
        constructor(...args) {
          super(...(args.length ? args : [fixedTime]));
        }
        static now() {
          return fixedTime;
        }
      }
      MockDate.UTC = RealDate.UTC;
      MockDate.parse = RealDate.parse;
      window.Date = MockDate;
    }
  `);
}

async function seedReleaseData(page) {
  await mockUnmatchedLocalBackendRequests(page);
  const meeting = {
    id: 'meeting_visual_baseline',
    workspaceId: 'ws_e2e',
    createdByUserId: 'user_e2e',
    title: 'Release baseline meeting',
    context: 'Layout validation',
    startsAt: '2026-05-14T10:00:00.000Z',
    createdAt: '2026-05-14T10:00:00.000Z',
    updatedAt: '2026-05-14T10:08:00.000Z',
    durationMinutes: 45,
    owner: 'Anna',
    guests: ['Jan'],
    attendees: ['Anna', 'Jan'],
    tags: ['release'],
    latestRecordingId: 'recording_visual_baseline',
    recordings: [
      {
        id: 'recording_visual_baseline',
        createdAt: '2026-05-14T10:05:00.000Z',
        duration: 180,
        pipelineStatus: 'done',
        transcript: [
          {
            id: 'seg_visual_1',
            speakerId: 0,
            timestamp: 0,
            text: 'Ustalamy priorytety release i zadania po spotkaniu.',
          },
        ],
        speakerNames: { '0': 'Anna' },
        analysis: {
          summary: 'Release baseline summary',
          actionItems: ['Zamknac visual baseline', 'Potwierdzic smoke produkcyjny'],
        },
      },
    ],
  };
  const task = {
    id: 'task_visual_baseline',
    title: 'Release baseline task',
    notes: 'Task seeded for responsive visual baseline.',
    dueDate: '2026-05-14T12:00:00.000Z',
    priority: 'high',
    workspaceId: 'ws_e2e',
    createdByUserId: 'user_e2e',
  };
  const state = {
    meetings: [meeting],
    manualTasks: [task],
    taskState: {},
    taskBoards: {},
    calendarMeta: {},
    vocabulary: [],
    storedMeetingDrafts: {},
  };
  const sessionPayload = {
    user: {
      id: 'user_e2e',
      email: 'e2e@voicelog.test',
      name: 'E2E Tester',
      provider: 'local',
      defaultWorkspaceId: 'ws_e2e',
      workspaceIds: ['ws_e2e'],
      workspaceMemberRole: 'owner',
    },
    users: [
      {
        id: 'user_e2e',
        email: 'e2e@voicelog.test',
        name: 'E2E Tester',
        provider: 'local',
      },
    ],
    workspace: {
      id: 'ws_e2e',
      name: 'E2E Workspace',
      role: 'owner',
      memberIds: ['user_e2e'],
      memberRoles: { user_e2e: 'owner' },
    },
    workspaces: [
      {
        id: 'ws_e2e',
        name: 'E2E Workspace',
        role: 'owner',
        memberIds: ['user_e2e'],
        memberRoles: { user_e2e: 'owner' },
      },
    ],
    workspaceId: 'ws_e2e',
    state,
  };
  await page.route('**/state/bootstrap**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionPayload),
    });
  });
  await page.route('**/auth/session**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionPayload),
    });
  });
  await page.route('**/state/workspaces/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ workspaceId: 'ws_e2e', state }),
    });
  });
  await page.route('**/voice-profiles**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ profiles: [] }),
    });
  });
  await page.route('**/integrations/google/status**', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Google Calendar is not connected in visual fixtures.' }),
    });
  });
  await page.route('**/integrations/google/events**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    });
  });
  await page.route('**/api/client-errors**', async (route) => {
    await route.fulfill({
      status: 204,
      contentType: 'application/json',
      body: '',
    });
  });
  await page.route('**/media/recordings/**/audio**', async (route) => {
    await route.fulfill({
      status: 204,
      contentType: 'audio/webm',
      body: '',
    });
  });
  await seedLoggedInUser(page);
  await seedMeeting(page, meeting);
  await seedTask(page, task);
  await seedQueueItem(page, {
    id: 'q_visual_ready',
    recordingId: 'recording_visual_baseline',
    meetingId: 'meeting_visual_baseline',
    meetingTitle: 'Release baseline meeting',
    meetingSnapshot: meeting,
    status: 'done',
    uploaded: true,
    duration: 180,
    transcriptOutcome: 'normal',
    createdAt: '2026-05-14T10:05:00.000Z',
    updatedAt: '2026-05-14T10:08:00.000Z',
  });
}

async function waitForReleaseWorkspace(page) {
  await expect(page.getByText('Release baseline summary').first()).toBeVisible({
    timeout: 15_000,
  });
}

async function seedReferenceData(
  page,
  options: {
    notesWithoutAnalysis?: boolean;
    recordingsTableReference?: boolean;
    tasksCreateReference?: boolean;
  } = {}
) {
  const referenceMeeting = {
    id: 'meeting_reference_main',
    workspaceId: 'ws_e2e',
    createdByUserId: 'user_e2e',
    title: 'Ad hoc 09 cze, 08:32',
    context: 'Szybkie nagranie bez wczesniejszego briefu.',
    startsAt: '2026-06-09T06:32:00.000Z',
    createdAt: '2026-06-09T06:32:00.000Z',
    updatedAt: '2026-06-09T06:40:00.000Z',
    durationMinutes: 30,
    attendees: ['Iwo Czajka', 'Barbara Zynda'],
    participants: ['Iwo Czajka', 'Barbara Zynda'],
    tags: ['ad-hoc'],
    owner: 'Iwo Czajka',
    latestRecordingId: 'recording_reference_main',
    analysis: {
      summary: 'Iwo bierze udzial w spotkaniach roboczych. Najczesciej oczekuje jasnych ustalen.',
      decisions: ['Domknac projekt referencyjny', 'Utrzymac jasny layout premium'],
      actionItems: ['Zweryfikowac widoki referencyjne'],
    },
    recordings: [
      {
        id: 'recording_reference_main',
        createdAt: '2026-06-09T06:32:00.000Z',
        duration: 1800,
        speakerCount: 2,
        transcriptionStatus: 'completed',
        transcriptOutcome: 'normal',
        audioAvailable: false,
        audioUnavailable: true,
        audioUnavailableReason: 'Audio binary is not part of the visual reference fixture.',
        speakerNames: { '0': 'Iwo Czajka', '1': 'Barbara Zynda' },
        transcript: [
          {
            id: 'reference_segment_1',
            speakerId: 0,
            timestamp: 0,
            text: 'Ustalamy priorytety i kolejne kroki po spotkaniu.',
          },
          {
            id: 'reference_segment_2',
            speakerId: 1,
            timestamp: 45,
            text: 'Potwierdzam zakres i termin wykonania zadania.',
          },
        ],
        analysis: {
          summary: 'Spotkanie ma jasne ustalenia i jedno zadanie do wykonania.',
          decisions: ['Zachowac screenshot-first UI jako standard'],
        },
      },
    ],
  };
  const referenceTask = {
    id: 'task_reference_main',
    title: 'Nauka PgMP',
    notes: 'Zadanie referencyjne dla widoku Microsoft To Do.',
    dueDate: '2026-06-09T10:00:00.000Z',
    priority: 'high',
    owner: 'Iwo Czajka',
    assignedTo: ['Iwo Czajka'],
    tags: ['ad-hoc'],
    important: true,
    sourceMeetingId: 'meeting_reference_main',
    status: 'todo',
    completed: false,
    workspaceId: 'ws_e2e',
    createdByUserId: 'user_e2e',
    createdAt: '2026-06-09T06:32:00.000Z',
    updatedAt: '2026-06-09T06:40:00.000Z',
  };
  const recordingsTableMeetings = [
    {
      title: 'Ad hoc 09 cze, 08:32',
      startsAt: '2026-06-09T06:32:00.000Z',
      durationMinutes: 30,
      attendees: ['Iwo Czajka'],
      tags: ['ad-hoc'],
      status: 'none',
    },
    {
      title: 'Spotkanie zespolu',
      startsAt: '2026-06-08T13:20:00.000Z',
      durationMinutes: 45,
      attendees: ['Iwo Czajka', 'Barbara Zynda', 'Ewa Test', 'Jan Test'],
      tags: ['marketing'],
      status: 'processing',
      processingStartedAt: '2026-06-08T13:53:00.000Z',
    },
    {
      title: 'Sprint planning',
      startsAt: '2026-06-07T09:05:00.000Z',
      durationMinutes: 60,
      attendees: ['Iwo Czajka', 'Barbara Zynda', 'Ewa Test', 'Jan Test', 'Anna Test', 'Piotr Test'],
      tags: ['sprint'],
      status: 'done',
    },
    {
      title: 'Wywiad z klientem',
      startsAt: '2026-06-06T07:15:00.000Z',
      durationMinutes: 25,
      attendees: ['Iwo Czajka', 'Klient'],
      tags: ['klient'],
      status: 'done',
    },
    {
      title: 'Demo produktu',
      startsAt: '2026-06-05T12:30:00.000Z',
      durationMinutes: 50,
      attendees: ['Iwo Czajka', 'Barbara Zynda', 'Klient'],
      tags: ['demo'],
      status: 'done',
    },
    {
      title: 'Retrospektywa',
      startsAt: '2026-06-04T14:45:00.000Z',
      durationMinutes: 40,
      attendees: ['Iwo Czajka', 'Barbara Zynda', 'Ewa Test', 'Jan Test', 'Anna Test'],
      tags: ['retro'],
      status: 'none',
    },
    {
      title: 'Szkolenie onboarding',
      startsAt: '2026-06-03T08:00:00.000Z',
      durationMinutes: 55,
      attendees: [
        'Iwo Czajka',
        'Barbara Zynda',
        'Ewa Test',
        'Jan Test',
        'Anna Test',
        'Piotr Test',
        'Ola Test',
        'Marek Test',
        'Kasia Test',
        'Tomek Test',
      ],
      tags: ['szkolenie'],
      status: 'processing',
      processingStartedAt: '2026-06-03T08:37:00.000Z',
    },
    {
      title: 'Przeglad roadmapy',
      startsAt: '2026-06-02T11:00:00.000Z',
      durationMinutes: 35,
      attendees: ['Iwo Czajka', 'Barbara Zynda', 'Ewa Test'],
      tags: ['roadmap'],
      status: 'done',
    },
    {
      title: 'Daily operacyjne',
      startsAt: '2026-06-01T07:45:00.000Z',
      durationMinutes: 15,
      attendees: ['Iwo Czajka', 'Barbara Zynda', 'Ewa Test', 'Jan Test'],
      tags: ['daily'],
      status: 'done',
    },
    {
      title: 'Analiza feedbacku',
      startsAt: '2026-05-31T10:10:00.000Z',
      durationMinutes: 65,
      attendees: ['Iwo Czajka', 'Klient', 'Barbara Zynda'],
      tags: ['feedback'],
      status: 'done',
    },
    {
      title: 'Plan komunikacji',
      startsAt: '2026-05-30T09:30:00.000Z',
      durationMinutes: 30,
      attendees: ['Iwo Czajka', 'Marketing'],
      tags: ['marketing'],
      status: 'none',
    },
    {
      title: 'Warsztat discovery',
      startsAt: '2026-05-29T12:00:00.000Z',
      durationMinutes: 70,
      attendees: ['Iwo Czajka', 'Barbara Zynda', 'Klient', 'Designer'],
      tags: ['discovery'],
      status: 'done',
    },
  ].map((meeting, index) => {
    const id = `meeting_reference_recording_${index + 1}`;
    const recordingId = `recording_reference_recording_${index + 1}`;
    const isDone = meeting.status === 'done';
    const isProcessing = meeting.status === 'processing';
    return {
      id,
      workspaceId: 'ws_e2e',
      createdByUserId: 'user_e2e',
      title: meeting.title,
      context: 'Fixture zatwierdzonego widoku bazy nagran.',
      startsAt: meeting.startsAt,
      createdAt: meeting.startsAt,
      updatedAt: meeting.startsAt,
      durationMinutes: meeting.durationMinutes,
      attendees: meeting.attendees,
      participants: meeting.attendees,
      tags: meeting.tags,
      owner: meeting.attendees[0],
      latestRecordingId: recordingId,
      processingStartedAt: isProcessing ? meeting.processingStartedAt : undefined,
      analysis: isDone
        ? {
            summary: 'Nagranie ma gotowa analize AI.',
            actionItems: ['Zapisac ustalenia'],
          }
        : null,
      recordings: [
        {
          id: recordingId,
          createdAt: meeting.startsAt,
          duration: meeting.durationMinutes * 60,
          speakerCount: meeting.attendees.length,
          transcriptionStatus: isDone ? 'completed' : isProcessing ? 'processing' : 'pending',
          pipelineStatus: isDone ? 'done' : isProcessing ? 'processing' : 'queued',
          processingStartedAt: isProcessing ? meeting.processingStartedAt : undefined,
          processingEndedAt: isDone
            ? new Date(new Date(meeting.startsAt).getTime() + 2 * 60 * 1000).toISOString()
            : undefined,
          transcript: isDone
            ? [{ id: `${recordingId}_seg_1`, speakerId: 0, timestamp: 0, text: 'Ustalenia.' }]
            : [],
          analysis: isDone ? { summary: 'Gotowe.' } : null,
        },
      ],
    };
  });
  const notesReferenceMeeting = options.notesWithoutAnalysis
    ? {
        ...referenceMeeting,
        latestRecordingId: null,
        analysis: null,
        recordings: [],
      }
    : referenceMeeting;
  const referenceState = {
    meetings: options.recordingsTableReference ? recordingsTableMeetings : [notesReferenceMeeting],
    manualTasks: options.tasksCreateReference ? [] : [referenceTask],
    taskState: {},
    taskBoards: {},
    calendarMeta: {},
    vocabulary: [],
    storedMeetingDrafts: {},
  };
  const referenceSessionPayload = {
    user: {
      id: 'user_e2e',
      email: 'e2e@voicelog.test',
      name: 'E2E Tester',
      provider: 'local',
      defaultWorkspaceId: 'ws_e2e',
      workspaceIds: ['ws_e2e'],
      workspaceMemberRole: 'owner',
    },
    users: [
      {
        id: 'user_e2e',
        email: 'e2e@voicelog.test',
        name: 'E2E Tester',
        provider: 'local',
      },
    ],
    workspace: {
      id: 'ws_e2e',
      name: 'E2E Workspace',
      role: 'owner',
      memberIds: ['user_e2e'],
      memberRoles: { user_e2e: 'owner' },
    },
    workspaces: [
      {
        id: 'ws_e2e',
        name: 'E2E Workspace',
        role: 'owner',
        memberIds: ['user_e2e'],
        memberRoles: { user_e2e: 'owner' },
      },
    ],
    workspaceId: 'ws_e2e',
    state: referenceState,
  };
  await page.route('**/state/bootstrap**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(referenceSessionPayload),
    });
  });
  await page.route('**/auth/session**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(referenceSessionPayload),
    });
  });
  await page.route('**/state/workspaces/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ workspaceId: 'ws_e2e', state: referenceState }),
    });
  });
  await page.route('**/integrations/google/status**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        configured: true,
        connected: true,
        writable: true,
        accountEmail: 'iwo.czajka@gmail.com',
        scopes: 'calendar.readonly calendar.events',
        lastSyncedAt: '2026-06-09T07:42:00.000Z',
      }),
    });
  });
  await page.route('**/integrations/google/events**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'google_reference_event',
            summary: 'Angielski - micro daily',
            start: { dateTime: '2026-06-09T07:40:00+02:00' },
            end: { dateTime: '2026-06-09T08:00:00+02:00' },
          },
        ],
      }),
    });
  });
  await page.route('**/media/recordings/**/audio**', async (route) => {
    await route.fulfill({
      status: 204,
      contentType: 'audio/webm',
      body: '',
    });
  });
  await page.route('**/voice-profiles**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ profiles: [] }),
    });
  });
  await seedLoggedInUser(page);
  await page.addInitScript(
    ({ state }) => {
      localStorage.setItem(
        'voicelog_meetings_store',
        JSON.stringify({
          state: {
            meetings: state.meetings,
            manualTasks: state.manualTasks,
            manualPeople: state.manualPeople || [],
            taskState: state.taskState || {},
            taskBoards: state.taskBoards || {},
            calendarMeta: state.calendarMeta || {},
            vocabulary: state.vocabulary || [],
            storedMeetingDrafts: state.storedMeetingDrafts || {},
          },
          version: 0,
        })
      );
      localStorage.setItem('voicelog.meetings.v3', JSON.stringify(state.meetings));
      localStorage.setItem('voicelog.manualTasks.v1', JSON.stringify(state.manualTasks));
      localStorage.setItem('voicelog.taskState.v1', JSON.stringify(state.taskState || {}));
      localStorage.setItem('voicelog.taskBoards.v1', JSON.stringify(state.taskBoards || {}));
      localStorage.setItem('voicelog.calendarMeta.v1', JSON.stringify(state.calendarMeta || {}));
      localStorage.setItem('voicelog.vocabulary.v1', JSON.stringify(state.vocabulary || []));
    },
    { state: referenceState }
  );
}

async function assertNoGlobalOverflow(page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth || 0
    );
    return documentWidth - window.innerWidth;
  });

  expect(overflow).toBeLessThanOrEqual(2);
}

async function assertVisibleFocus(page) {
  await page.keyboard.press('Tab');
  const focusedBox = await page.evaluate(() => {
    const active = document.activeElement;
    if (!active || active === document.body) return null;
    const rect = active.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
    };
  });

  expect(focusedBox).toBeTruthy();
  expect(focusedBox?.width || 0).toBeGreaterThan(0);
  expect(focusedBox?.height || 0).toBeGreaterThan(0);
}

async function assertNoInternalDebugText(page) {
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toMatch(/\b(undefined|null|NaN)\b/i);
  expect(bodyText).not.toMatch(/\b(workspaceId|missing env variable|ERR_|TypeError)\b/i);
}

async function assertNoSerifFallback(page) {
  const hasSerifFallback = await page.evaluate(() => {
    const sampledElements = [
      document.body,
      ...Array.from(document.querySelectorAll('main, h1, h2, button, input, textarea, table')),
    ].filter(Boolean);

    return sampledElements.some((element) => {
      const families = window
        .getComputedStyle(element)
        .fontFamily.toLowerCase()
        .split(',')
        .map((family) => family.trim().replace(/^["']|["']$/g, ''));
      return families.some((family) =>
        ['serif', 'times', 'times new roman', 'georgia'].includes(family)
      );
    });
  });

  expect(hasSerifFallback).toBe(false);
}

async function assertNoPremiumLightDarkPanels(page) {
  const darkPanelCount = await page.evaluate(() => {
    function isInsideIgnoredLayer(element) {
      return Boolean(
        element.closest(
          '.modal-overlay,.modal-backdrop,[role="dialog"],.modern-user-avatar,.modern-profile-btn'
        )
      );
    }

    function isDarkBackground(color) {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
      if (!match) return false;
      const [, r, g, b, a = '1'] = match;
      const alpha = Number(a);
      return alpha > 0.75 && Number(r) < 85 && Number(g) < 95 && Number(b) < 105;
    }

    return Array.from(
      document.querySelectorAll(
        'main [class], .profile-main-content [class], .tasks-layout [class], .notes-layout [class], .recordings-tab-shell [class]'
      )
    ).filter((element) => {
      if (isInsideIgnoredLayer(element)) return false;
      const rect = element.getBoundingClientRect();
      if (rect.width * rect.height < 2400) return false;
      return isDarkBackground(window.getComputedStyle(element).backgroundColor);
    }).length;
  });

  expect(darkPanelCount).toBe(0);
}

async function assertReferenceScreenQuality(page, options: { allowModalBackdrop?: boolean } = {}) {
  await assertNoGlobalOverflow(page);
  await assertNoInternalDebugText(page);
  await assertNoSerifFallback(page);
  if (!options.allowModalBackdrop) {
    await assertNoPremiumLightDarkPanels(page);
  }
}

async function openShellTab(page, label: string) {
  const hamburger = page.locator('.modern-hamburger-btn');
  if (await hamburger.isVisible()) {
    await hamburger.click();
  }

  const navItem = page.locator('.modern-nav').getByRole('button', { name: label });
  await expect(navItem).toBeVisible();
  await navItem.click();
}

async function screenshotPage(page, name: string) {
  await page.evaluate(() => document.fonts?.ready);
  await expect(page).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.05,
  });
}

test.describe('Release visual baselines', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    consoleErrorsByTest.set(testInfo, consoleErrors);
    page.on('console', (message) => {
      if (message.type() === 'error') {
        const text = message.text();
        if (!benignConsoleErrorPatterns.some((pattern) => pattern.test(text))) {
          consoleErrors.push(text);
        }
      }
    });
    page.on('response', (response) => {
      if (response.status() === 401) {
        consoleErrors.push(`HTTP 401: ${response.url()}`);
      }
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await freezeClock(page);
  });

  test.afterEach(async ({ page: _page }, testInfo) => {
    expect(consoleErrorsByTest.get(testInfo) || []).toEqual([]);
  });

  for (const viewport of releaseViewports) {
    test(`@baseline auth login layout ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await expect(page.locator('.auth-shell')).toBeVisible();
      await assertNoGlobalOverflow(page);
      await assertVisibleFocus(page);
      await screenshotPage(page, `auth-login-${viewport.name}.png`);
    });

    test(`@baseline authenticated shell tabs ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await seedReleaseData(page);
      await page.goto('/');
      await waitForReleaseWorkspace(page);
      await expect(page.locator('.modern-main')).toBeVisible();
      await assertNoGlobalOverflow(page);
      await screenshotPage(page, `shell-home-${viewport.name}.png`);

      for (const tab of coreTabs) {
        await openShellTab(page, tab.label);
        await expect(page.locator(tab.expected).first()).toBeVisible();
        if (tab.surface === 'people') {
          await expect(page.getByRole('heading', { name: 'Osoby' })).toBeVisible();
        }
        await assertNoGlobalOverflow(page);
        await screenshotPage(page, `${tab.surface}-${viewport.name}.png`);
      }

      await page.getByRole('button', { name: /profil/i }).click();
      await expect(page.locator('.profile-shell, .profile-layout, main').first()).toBeVisible();
      await assertNoGlobalOverflow(page);
      await screenshotPage(page, `profile-${viewport.name}.png`);
    });
  }

  for (const viewport of overlayViewports) {
    test(`@state auth register and reset states ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await page.getByRole('button', { name: 'Rejestracja' }).click();
      await expect(page.getByPlaceholder('np. Anna Nowak')).toBeVisible();
      await assertNoGlobalOverflow(page);
      await screenshotPage(page, `auth-register-${viewport.name}.png`);

      await page.getByRole('button', { name: 'Logowanie' }).click();
      await page.getByRole('button', { name: /hasla|hasła/i }).click();
      await expect(page.getByRole('button', { name: /kod resetu/i })).toBeVisible();
      await assertNoGlobalOverflow(page);
      await screenshotPage(page, `auth-reset-${viewport.name}.png`);
    });

    test(`@state overlays and failure states ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await seedReleaseData(page);
      await seedQueueItem(page, {
        id: 'q_visual_failed',
        recordingId: 'recording_visual_failed',
        meetingId: 'meeting_visual_baseline',
        status: 'failed',
        error: 'STT provider unavailable during visual baseline.',
      });
      await page.goto('/');
      await waitForReleaseWorkspace(page);

      await page.locator('.modern-search-btn').click();
      await expect(page.locator('.command-palette')).toBeVisible();
      await assertNoGlobalOverflow(page);
      await screenshotPage(page, `command-palette-${viewport.name}.png`);

      await page.locator('.command-palette input').fill('xqz-no-results-release');
      await expect(page.locator('.empty-panel, .command-palette-results .empty')).toBeVisible();
      await assertNoGlobalOverflow(page);
      await screenshotPage(page, `command-palette-empty-${viewport.name}.png`);

      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Powiadomienia' }).click();
      await expect(page.locator('.notification-panel')).toBeVisible();
      await assertNoGlobalOverflow(page);
      await screenshotPage(page, `notification-center-${viewport.name}.png`);

      await page.keyboard.press('Escape');
      await openShellTab(page, 'Nagrania');
      await assertNoGlobalOverflow(page);
      await screenshotPage(page, `recordings-failure-state-${viewport.name}.png`);
    });
  }

  test('@reference approved screenshot fixtures are available', async () => {
    for (const fixture of referenceFixtures) {
      expect(existsSync(path.join(referenceScreensDir, fixture))).toBe(true);
    }
  });

  for (const viewport of referenceViewports) {
    test(`@reference global shell ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await seedReferenceData(page);
      await page.goto('/');
      await expect(page.locator('.modern-sidebar')).toBeVisible();
      await expect(page.locator('.modern-header')).toBeVisible();
      await assertReferenceScreenQuality(page);
      await screenshotPage(page, `reference-shell-${viewport.name}.png`);
    });

    test(`@reference profile integrations ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await seedReferenceData(page);
      await page.goto('/');
      await page.getByRole('button', { name: 'Otwórz profil' }).click();
      await page.getByRole('button', { name: 'Ustawienia wyciszone' }).click();
      await expect(page.getByRole('heading', { name: 'Ustawienia wyciszone' })).toBeVisible();
      await assertReferenceScreenQuality(page);
      await screenshotPage(page, `reference-profile-integrations-${viewport.name}.png`);
    });

    test(`@reference tasks list with detail panel ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await seedReferenceData(page, { tasksCreateReference: true });
      await page.goto('/');
      await openShellTab(page, 'Zadania');
      await page.getByRole('button', { name: 'Dodaj zadanie' }).first().click();
      await expect(page.getByRole('dialog', { name: 'Nowe zadanie' })).toBeVisible();
      await assertReferenceScreenQuality(page);
      await screenshotPage(page, `reference-tasks-detail-${viewport.name}.png`);
    });

    test(`@reference studio brief modal ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await seedReferenceData(page);
      await page.goto('/');
      await openShellTab(page, 'Studio');
      await page.getByRole('button', { name: /Brief/i }).first().click();
      await expect(page.getByRole('heading', { name: 'Nowe spotkanie' })).toBeVisible();
      await assertReferenceScreenQuality(page, { allowModalBackdrop: true });
      await screenshotPage(page, `reference-brief-modal-${viewport.name}.png`);
    });

    test(`@reference people profile ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await seedReferenceData(page);
      await page.goto('/');
      await openShellTab(page, 'Osoby');
      await page
        .getByRole('button', { name: /Iwo Czajka/i })
        .first()
        .click();
      await expect(page.getByRole('heading', { name: /Iwo Czajka|Iwo/i })).toBeVisible();
      await assertReferenceScreenQuality(page);
      await screenshotPage(page, `reference-people-profile-${viewport.name}.png`);
    });

    test(`@reference notes detail ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await seedReferenceData(page, { notesWithoutAnalysis: true });
      await page.goto('/');
      await openShellTab(page, 'Notatki');
      await page.getByText('Ad hoc 09 cze, 08:32').first().click();
      await expect(page.locator('.notes-detail-panel--reference')).toBeVisible();
      await assertReferenceScreenQuality(page);
      await screenshotPage(page, `reference-notes-detail-${viewport.name}.png`);
    });

    test(`@reference recordings table ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await seedReferenceData(page, { recordingsTableReference: true });
      await page.goto('/');
      await openShellTab(page, 'Nagrania');
      await expect(page.getByText('Ad hoc 09 cze, 08:32')).toBeVisible();
      await assertReferenceScreenQuality(page);
      await screenshotPage(page, `reference-recordings-table-${viewport.name}.png`);
    });
  }
});
