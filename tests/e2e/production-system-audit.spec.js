// @ts-check
import { expect, test } from '@playwright/test';

const FRONTEND_URL =
  process.env.PRODUCTION_FRONTEND_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  'https://voicelog-audiorecorder.vercel.app';
const API_BASE_URL = process.env.PRODUCTION_API_BASE_URL || FRONTEND_URL;
const AUTH_TOKEN = process.env.PRODUCTION_SMOKE_AUTH_TOKEN || '';
const WORKSPACE_ID = process.env.PRODUCTION_SMOKE_WORKSPACE_ID || '';
const VOICE_PROFILE_RECORDING_ID = process.env.PRODUCTION_SMOKE_VOICE_PROFILE_RECORDING_ID || '';
const VOICE_PROFILE_SPEAKER_ID = process.env.PRODUCTION_SMOKE_VOICE_PROFILE_SPEAKER_ID || '';
const VOICE_PROFILE_SPEAKER_NAME = process.env.PRODUCTION_SMOKE_VOICE_PROFILE_SPEAKER_NAME || '';
const AUDIT_REQUIRED = process.env.PRODUCTION_SYSTEM_AUDIT_REQUIRED === 'true';
const AUDIT_PREFIX = 'audit_20260524_';
const API_REQUEST_TIMEOUT_MS = 30_000;
const CLEANUP_REQUEST_TIMEOUT_MS = 8_000;

const coreTabs = ['Studio', 'Nagrania', 'Kalendarz', 'Zadania', 'Osoby', 'Notatki'];

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withProductionRetry(label, operation, attempts = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await sleep(attempt * 2_000);
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`${label} failed after ${attempts} attempts: ${reason}`);
}

function requireProductionAuditConfig() {
  const missing = [];
  if (!AUTH_TOKEN) missing.push('PRODUCTION_SMOKE_AUTH_TOKEN');
  if (!WORKSPACE_ID) missing.push('PRODUCTION_SMOKE_WORKSPACE_ID');

  if (missing.length > 0 && AUDIT_REQUIRED) {
    throw new Error(`Production system audit is missing required env: ${missing.join(', ')}`);
  }

  return missing.length === 0;
}

function requireVoiceProfileFixtureConfig() {
  const missing = [];
  if (!VOICE_PROFILE_RECORDING_ID) missing.push('PRODUCTION_SMOKE_VOICE_PROFILE_RECORDING_ID');
  if (!VOICE_PROFILE_SPEAKER_ID) missing.push('PRODUCTION_SMOKE_VOICE_PROFILE_SPEAKER_ID');
  if (!VOICE_PROFILE_SPEAKER_NAME) missing.push('PRODUCTION_SMOKE_VOICE_PROFILE_SPEAKER_NAME');

  if (missing.length > 0 && AUDIT_REQUIRED) {
    throw new Error(
      `Production voice-profile UI audit is missing required env: ${missing.join(', ')}`
    );
  }

  return missing.length === 0;
}

function apiUrl(path) {
  return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${AUTH_TOKEN}`,
    'X-Workspace-Id': WORKSPACE_ID,
  };
}

async function fetchProductionSession(request) {
  const payload = await withProductionRetry('Fetch production auth session', async () => {
    const response = await request.get(
      apiUrl(`/auth/session?workspaceId=${encodeURIComponent(WORKSPACE_ID)}`),
      {
        headers: authHeaders(),
        timeout: API_REQUEST_TIMEOUT_MS,
      }
    );
    const responseText = await response.text();
    expect(response.status(), responseText).toBeLessThan(500);
    expect(response.ok(), responseText).toBe(true);
    return responseText ? JSON.parse(responseText) : {};
  });
  const user = payload.user || payload.users?.[0] || null;
  const userId = user?.id || payload.userId || payload.session?.userId || payload.session?.user_id;
  expect(userId, 'production auth session must resolve a user id').toBeTruthy();

  const workspaces =
    Array.isArray(payload.workspaces) && payload.workspaces.length > 0
      ? payload.workspaces
      : payload.workspace
        ? [payload.workspace]
        : [
            {
              id: WORKSPACE_ID,
              name: 'Production smoke workspace',
              memberIds: [userId],
            },
          ];

  return {
    users: Array.isArray(payload.users) && payload.users.length > 0 ? payload.users : [user],
    workspaces,
    session: {
      userId,
      workspaceId: payload.workspaceId || WORKSPACE_ID,
      token: AUTH_TOKEN,
    },
  };
}

async function fetchWorkspaceState(request) {
  const payload = await withProductionRetry('Fetch production workspace state', async () => {
    const response = await request.get(
      apiUrl(`/state/bootstrap?workspaceId=${encodeURIComponent(WORKSPACE_ID)}`),
      {
        headers: authHeaders(),
        timeout: API_REQUEST_TIMEOUT_MS,
      }
    );
    const responseText = await response.text();
    expect(response.status(), responseText).toBeLessThan(500);
    expect(response.ok(), responseText).toBe(true);
    return responseText ? JSON.parse(responseText) : {};
  });
  return payload.state || {};
}

async function patchWorkspaceState(request, delta, options = {}) {
  const attempts = options.attempts || 3;
  const timeout = options.timeout || API_REQUEST_TIMEOUT_MS;
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await request.patch(
        apiUrl(`/state/workspaces/${encodeURIComponent(WORKSPACE_ID)}`),
        {
          headers: authHeaders(),
          data: delta,
          timeout,
        }
      );

      const responseText = await response.text();
      expect(response.status(), responseText).toBeLessThan(500);
      expect(response.ok(), responseText).toBe(true);

      return responseText ? JSON.parse(responseText) : {};
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await sleep(attempt * 2_000);
    }
  }

  throw lastError || new Error('Production workspace patch failed.');
}

async function cleanupWorkspaceState(request, delta) {
  await patchWorkspaceState(request, delta, {
    attempts: 1,
    timeout: CLEANUP_REQUEST_TIMEOUT_MS,
  }).catch(() => {});
}

function hasItemWithId(items, id) {
  return Array.isArray(items) && items.some((candidate) => candidate?.id === id);
}

function createAuditMeeting(id, title, overrides = {}) {
  const now = new Date().toISOString();
  return {
    id,
    title,
    context: `${title} context`,
    startsAt: now,
    durationMinutes: 30,
    attendees: [],
    tags: ['audit'],
    needs: [],
    desiredOutputs: [],
    recordings: [],
    workspaceId: WORKSPACE_ID,
    createdByUserId: 'production-audit',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function installProductionSession(page, request) {
  const sessionPayload = await fetchProductionSession(request);

  await page.addInitScript(({ users, workspaces, session }) => {
    localStorage.setItem('voicelog.session.v3', JSON.stringify(session));
    localStorage.setItem(
      'voicelog_workspace_store',
      JSON.stringify({
        state: {
          users,
          workspaces,
          session,
        },
        version: 0,
      })
    );
    localStorage.setItem('voicelog.e2e.production', 'true');
  }, sessionPayload);
}

async function installProductionMeetingSnapshot(page, meeting) {
  await page.addInitScript(
    ({ snapshot }) => {
      const existingRaw = localStorage.getItem('voicelog_meetings_store');
      const existing = existingRaw ? JSON.parse(existingRaw) : null;
      const existingState = existing?.state || {};
      const meetings = Array.isArray(existingState.meetings) ? existingState.meetings : [];
      const filteredMeetings = meetings.filter((candidate) => candidate?.id !== snapshot.id);

      localStorage.setItem(
        'voicelog_meetings_store',
        JSON.stringify({
          state: {
            ...existingState,
            meetings: [snapshot, ...filteredMeetings],
          },
          version: 0,
        })
      );
    },
    { snapshot: meeting }
  );
}

function attachRuntimeGuard(page) {
  const failures = [];

  page.on('pageerror', (error) => {
    failures.push(`pageerror: ${error.message}`);
  });

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/ResizeObserver loop/i.test(text)) return;
    failures.push(`console error: ${text}`);
  });

  page.on('response', (response) => {
    const status = response.status();
    if (status < 400) return;

    const url = response.url();
    if (url.includes('/api/client-errors') && status < 500) return;
    failures.push(`network ${status}: ${url}`);
  });

  return {
    async assertClean() {
      await page.waitForTimeout(500);
      expect(failures).toEqual([]);
    },
  };
}

async function openShellTab(page, label) {
  const hamburger = page.locator('.modern-hamburger-btn');
  if (await hamburger.isVisible()) {
    await hamburger.click();
  }

  const navItem = page.locator('.modern-nav-item').filter({ hasText: label }).first();
  await expect(navItem).toBeVisible({ timeout: 15_000 });
  await navItem.click();
  await expect(page.locator('.modern-main, main').first()).toBeVisible();
}

async function openProfileSurface(page) {
  const profileButton = page
    .getByLabel(/profil|ustawienia profilu|otworz profil|otwórz profil/i)
    .first();
  await expect(profileButton).toBeVisible({ timeout: 15_000 });
  await profileButton.click();
  await expect(page.getByText(/Profil i Styl pracy/i)).toBeVisible({ timeout: 15_000 });
}

test.describe('Production system audit', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);

  test.skip(
    !AUDIT_REQUIRED && (!AUTH_TOKEN || !WORKSPACE_ID),
    'Production system audit requires PRODUCTION_SMOKE_AUTH_TOKEN and PRODUCTION_SMOKE_WORKSPACE_ID.'
  );

  test.beforeEach(async () => {
    requireProductionAuditConfig();
  });

  test('opens every core workspace tab with a real production session and no runtime errors', async ({
    page,
    request,
  }) => {
    await installProductionSession(page, request);
    const guard = attachRuntimeGuard(page);

    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.modern-main, main').first()).toBeVisible({ timeout: 20_000 });

    await page.locator('.modern-search-btn').click();
    await expect(page.locator('.command-palette')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByLabel('Powiadomienia').click();
    await expect(page.locator('.notification-panel, .notification-center').first()).toBeVisible();
    await page.keyboard.press('Escape');

    for (const tab of coreTabs) {
      await openShellTab(page, tab);
    }
    await openProfileSurface(page);

    await guard.assertClean();
  });

  test('keeps production backend prefixes proxied instead of falling through to Vercel 404', async ({
    request,
  }) => {
    const aiResponse = await request.post(apiUrl('/ai/suggest-tasks'), {
      data: { transcript: [], people: [] },
    });
    expect(aiResponse.status(), await aiResponse.text()).toBe(200);

    const voiceProfilesResponse = await request.get(apiUrl('/voice-profiles'), {
      headers: authHeaders(),
    });
    expect(voiceProfilesResponse.status(), await voiceProfilesResponse.text()).not.toBe(404);
    expect(voiceProfilesResponse.status(), await voiceProfilesResponse.text()).toBeLessThan(500);
  });

  test('keeps production auth endpoints routed and validates bad payloads without 500s', async ({
    request,
  }) => {
    const authContracts = [
      {
        path: '/auth/login',
        data: { email: 'not-an-email', password: '' },
      },
      {
        path: '/auth/register',
        data: { email: 'not-an-email', password: '123', name: '' },
      },
      {
        path: '/auth/password/reset/request',
        data: { email: 'not-an-email' },
      },
      {
        path: '/auth/password/reset/confirm',
        data: {
          email: 'not-an-email',
          code: '',
          newPassword: '123',
          confirmPassword: '456',
        },
      },
    ];

    for (const contract of authContracts) {
      const response = await request.post(apiUrl(contract.path), { data: contract.data });
      const body = await response.text();
      expect(response.status(), `${contract.path}: ${body}`).not.toBe(404);
      expect(response.status(), `${contract.path}: ${body}`).toBeLessThan(500);
      expect(body, `${contract.path} must not leak infra details`).not.toMatch(
        /NOT_FOUND|ENOTFOUND|postgres|tenant\/user|stack/i
      );
    }
  });

  test('persists an audit task and confirms it does not return after refresh once deleted', async ({
    request,
  }) => {
    const now = new Date().toISOString();
    const taskId = `${AUDIT_PREFIX}task_${Date.now()}`;
    const taskTitle = `${AUDIT_PREFIX}task_persistence`;
    const task = {
      id: taskId,
      title: taskTitle,
      status: 'todo',
      priority: 'medium',
      owner: 'production-audit',
      tags: ['audit'],
      completed: false,
      createdAt: now,
      updatedAt: now,
      workspaceId: WORKSPACE_ID,
      createdByUserId: 'production-audit',
    };

    try {
      await patchWorkspaceState(request, {
        manualTasks: { upsert: [task] },
      });

      let state = await fetchWorkspaceState(request);
      expect(
        (state.manualTasks || []).some((candidate) => candidate.id === taskId),
        'audit task should be visible after production state write'
      ).toBe(true);

      await patchWorkspaceState(request, {
        manualTasks: { removeIds: [taskId] },
      });

      state = await fetchWorkspaceState(request);
      expect(
        (state.manualTasks || []).some((candidate) => candidate.id === taskId),
        'deleted audit task does not return after refresh'
      ).toBe(false);
    } finally {
      await cleanupWorkspaceState(request, {
        manualTasks: { removeIds: [taskId] },
      });
    }
  });

  test('persists note, people/calendar, and recording shell meetings and removes them after refresh', async ({
    request,
  }) => {
    const stamp = Date.now();
    const noteMeetingId = `${AUDIT_PREFIX}note_meeting_${stamp}`;
    const peopleCalendarMeetingId = `${AUDIT_PREFIX}people_calendar_meeting_${stamp}`;
    const recordingShellMeetingId = `${AUDIT_PREFIX}recording_shell_meeting_${stamp}`;
    const calendarMetaKey = `meeting:${peopleCalendarMeetingId}`;

    const noteMeeting = createAuditMeeting(
      noteMeetingId,
      `${AUDIT_PREFIX}note meeting persistence`,
      {
        context: 'Production audit note body.',
        tags: ['audit', 'notatka'],
        durationMinutes: 0,
      }
    );
    const peopleAndCalendarMeeting = createAuditMeeting(
      peopleCalendarMeetingId,
      `${AUDIT_PREFIX}people and calendar meeting persistence`,
      {
        attendees: [`${AUDIT_PREFIX}person`],
        startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        durationMinutes: 45,
        location: 'production-audit',
      }
    );
    const recordingShellMeeting = createAuditMeeting(
      recordingShellMeetingId,
      `${AUDIT_PREFIX}recording shell meeting persistence`,
      {
        recordings: [
          {
            id: `${AUDIT_PREFIX}recording_shell_${stamp}`,
            title: `${AUDIT_PREFIX}recording shell`,
            status: 'completed',
            transcript: [],
          },
        ],
      }
    );

    try {
      await patchWorkspaceState(request, {
        meetings: {
          upsert: [noteMeeting, peopleAndCalendarMeeting, recordingShellMeeting],
        },
        calendarMeta: {
          [calendarMetaKey]: {
            source: 'production-system-audit',
            reminderMinutes: 15,
          },
        },
      });

      let state = await fetchWorkspaceState(request);
      expect(hasItemWithId(state.meetings, noteMeetingId), 'note meeting should persist').toBe(
        true
      );
      expect(
        hasItemWithId(state.meetings, peopleCalendarMeetingId),
        'people and calendar meeting should persist'
      ).toBe(true);
      expect(
        hasItemWithId(state.meetings, recordingShellMeetingId),
        'recording shell meeting should persist'
      ).toBe(true);
      expect(state.calendarMeta?.[calendarMetaKey], 'calendarMeta should persist').toEqual(
        expect.objectContaining({ source: 'production-system-audit' })
      );

      await patchWorkspaceState(request, {
        meetings: {
          removeIds: [noteMeetingId, peopleCalendarMeetingId, recordingShellMeetingId],
        },
        calendarMeta: {
          [calendarMetaKey]: null,
        },
      });

      state = await fetchWorkspaceState(request);
      expect(
        hasItemWithId(state.meetings, noteMeetingId),
        'deleted note meeting does not return after refresh'
      ).toBe(false);
      expect(
        hasItemWithId(state.meetings, peopleCalendarMeetingId),
        'deleted people and calendar meeting does not return after refresh'
      ).toBe(false);
      expect(
        hasItemWithId(state.meetings, recordingShellMeetingId),
        'deleted recording shell meeting does not return after refresh'
      ).toBe(false);
      expect(state.calendarMeta?.[calendarMetaKey], 'deleted calendarMeta does not return').toBe(
        undefined
      );
    } finally {
      await cleanupWorkspaceState(request, {
        meetings: {
          removeIds: [noteMeetingId, peopleCalendarMeetingId, recordingShellMeetingId],
        },
        calendarMeta: {
          [calendarMetaKey]: null,
        },
      });
    }
  });

  test('deletes an audit_delete recording meeting and fails if it resurrects after refresh', async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const meetingId = `audit_delete_meeting_${stamp}`;
    const recordingId = `audit_delete_recording_${stamp}`;
    const title = `audit_delete_recording_${stamp}`;
    const meeting = createAuditMeeting(meetingId, title, {
      latestRecordingId: recordingId,
      recordings: [
        {
          id: recordingId,
          title,
          status: 'completed',
          pipelineStatus: 'done',
          transcriptionStatus: 'done',
          transcript: [],
        },
      ],
    });

    try {
      await patchWorkspaceState(request, {
        meetings: {
          upsert: [meeting],
        },
      });

      let state = await fetchWorkspaceState(request);
      expect(hasItemWithId(state.meetings, meetingId), 'audit_delete fixture should persist').toBe(
        true
      );

      await installProductionSession(page, request);
      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await openShellTab(page, 'Nagrania');
      await expect(page.getByText(title).first()).toBeVisible({ timeout: 20_000 });

      await patchWorkspaceState(request, {
        meetings: {
          removeIds: [meetingId],
        },
      });

      state = await fetchWorkspaceState(request);
      expect(hasItemWithId(state.meetings, meetingId), 'deleted audit_delete meeting is gone').toBe(
        false
      );
      expect(state.calendarMeta?.meetingTombstones || []).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: meetingId })])
      );

      await page.reload({ waitUntil: 'domcontentloaded' });
      await openShellTab(page, 'Nagrania');
      await expect(page.getByText(title)).toHaveCount(0, { timeout: 20_000 });
      await page.waitForTimeout(3_000);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await openShellTab(page, 'Nagrania');
      await expect(page.getByText(title)).toHaveCount(0, { timeout: 20_000 });
    } finally {
      await cleanupWorkspaceState(request, {
        meetings: {
          removeIds: [meetingId],
        },
      });
    }
  });

  test('keeps transcript visible for a completed recording when audio is unavailable after refresh', async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const meetingId = `${AUDIT_PREFIX}audio_unavailable_transcript_${stamp}`;
    const recordingId = `${AUDIT_PREFIX}audio_unavailable_recording_${stamp}`;
    const title = `${AUDIT_PREFIX}audio unavailable transcript`;
    const transcriptText = 'Ten transkrypt musi zostac widoczny mimo braku audio.';
    const meeting = createAuditMeeting(meetingId, title, {
      latestRecordingId: recordingId,
      recordings: [
        {
          id: recordingId,
          title,
          status: 'completed',
          pipelineStatus: 'done',
          transcriptionStatus: 'done',
          audioAvailable: false,
          audioUnavailable: true,
          audioUnavailableReason: 'production_audit_ui_fixture',
          transcript: [
            {
              id: `${AUDIT_PREFIX}audio_unavailable_segment_${stamp}`,
              speakerId: '0',
              timestamp: 0,
              endTimestamp: 8,
              text: transcriptText,
            },
          ],
          speakerNames: { 0: 'Speaker 1' },
          speakerCount: 1,
        },
      ],
    });

    try {
      await patchWorkspaceState(request, {
        meetings: {
          upsert: [meeting],
        },
      });

      await installProductionSession(page, request);
      await installProductionMeetingSnapshot(page, meeting);
      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await openShellTab(page, 'Studio');
      await expect(page.getByText(transcriptText).first()).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/Audio nie jest dost/i).first()).toBeVisible({
        timeout: 20_000,
      });

      await page.reload({ waitUntil: 'domcontentloaded' });
      await openShellTab(page, 'Studio');
      await expect(page.getByText(transcriptText).first()).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/Brak transkrypcji/i)).toHaveCount(0, { timeout: 20_000 });
    } finally {
      await cleanupWorkspaceState(request, {
        meetings: {
          removeIds: [meetingId],
        },
      });
    }
  });

  test('covers the Studio voice-profile UI journey without silently saving unnamed speakers', async ({
    page,
    request,
  }) => {
    test.skip(
      !requireVoiceProfileFixtureConfig(),
      'Studio voice-profile UI audit requires PRODUCTION_SMOKE_VOICE_PROFILE_* evidence.'
    );

    const preflightResponse = await request.post(
      apiUrl(
        `/media/recordings/${encodeURIComponent(
          VOICE_PROFILE_RECORDING_ID
        )}/voice-profiles/from-speaker/preflight`
      ),
      {
        headers: authHeaders(),
        data: {
          speakerId: VOICE_PROFILE_SPEAKER_ID,
          speakerName: VOICE_PROFILE_SPEAKER_NAME,
        },
      }
    );
    expect(preflightResponse.status(), await preflightResponse.text()).not.toBe(404);
    expect(preflightResponse.status(), await preflightResponse.text()).toBeLessThan(500);
    expect(preflightResponse.ok(), await preflightResponse.text()).toBe(true);

    const stamp = Date.now();
    const meetingId = `${AUDIT_PREFIX}voice_profile_ui_${stamp}`;
    const title = `${AUDIT_PREFIX}voice profile UI journey`;
    const sourceSpeakerId = `${VOICE_PROFILE_SPEAKER_ID}_source`;
    const sourceSpeakerName = `${AUDIT_PREFIX}source speaker`;
    const recording = {
      id: VOICE_PROFILE_RECORDING_ID,
      title,
      createdAt: new Date().toISOString(),
      duration: 90,
      pipelineStatus: 'done',
      transcriptionStatus: 'completed',
      status: 'completed',
      audioAvailable: false,
      audioUnavailable: true,
      audioUnavailableReason: 'production_audit_ui_fixture',
      transcript: [
        {
          id: `${AUDIT_PREFIX}vp_segment_${stamp}`,
          speakerId: sourceSpeakerId,
          timestamp: 0,
          endTimestamp: 12,
          text: 'To jest kontrolny fragment audytu profili glosowych.',
        },
      ],
      speakerNames: {
        [sourceSpeakerId]: sourceSpeakerName,
        [VOICE_PROFILE_SPEAKER_ID]: VOICE_PROFILE_SPEAKER_NAME,
      },
      analysis: {
        summary: 'Voice profile UI audit fixture',
        actionItems: [],
      },
    };

    const meeting = createAuditMeeting(meetingId, title, {
      latestRecordingId: VOICE_PROFILE_RECORDING_ID,
      durationMinutes: 2,
      speakerCount: 2,
      recordings: [recording],
    });

    try {
      await patchWorkspaceState(request, {
        meetings: {
          upsert: [meeting],
        },
      });
      const state = await fetchWorkspaceState(request);
      expect(
        hasItemWithId(state.meetings, meetingId),
        'voice-profile UI fixture should persist'
      ).toBe(true);

      await installProductionSession(page, request);
      await installProductionMeetingSnapshot(page, meeting);
      const guard = attachRuntimeGuard(page);
      const fromSpeakerRequests = [];
      page.on('request', (event) => {
        if (event.method() === 'POST' && event.url().includes('/voice-profiles/from-speaker')) {
          fromSpeakerRequests.push(event.url());
        }
      });

      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await openShellTab(page, 'Nagrania');
      await expect(page.getByText(title).first()).toBeVisible({ timeout: 20_000 });
      await page.getByText(title).first().click();

      await expect(page.getByText(title).first()).toBeVisible({ timeout: 20_000 });
      const speakerButton = page
        .locator('.ff-speaker-trigger')
        .filter({ hasText: sourceSpeakerName })
        .first();
      await expect(speakerButton).toBeVisible({ timeout: 20_000 });
      await speakerButton.click();

      const newSpeakerOption = page
        .locator('.ff-speaker-dropdown-item')
        .filter({ hasText: 'Nowy m' })
        .first();
      await expect(newSpeakerOption).toBeVisible();
      await newSpeakerOption.click();

      await expect(page.getByText('Nazwij nowego mowce')).toBeVisible();
      await expect(page.getByLabel('Nazwa nowego mowcy')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Utworz mowce' })).toBeDisabled();
      expect(fromSpeakerRequests, 'clicking Nowy mówca must not save a nameless profile').toEqual(
        []
      );

      await page.getByLabel('Nazwa nowego mowcy').fill(`${AUDIT_PREFIX}named speaker`);
      await expect(page.getByRole('button', { name: 'Utworz mowce' })).toBeEnabled();
      expect(fromSpeakerRequests, 'typing a name must not call from-speaker before submit').toEqual(
        []
      );

      await page.getByRole('button', { name: 'Anuluj' }).click();
      await guard.assertClean();
    } finally {
      await cleanupWorkspaceState(request, {
        meetings: { removeIds: [meetingId] },
      });
    }
  });
});
