/**
 * Seed helpers — inject localStorage before the app boots so E2E tests
 * can skip the auth screen and start from a known logged-in state.
 *
 * Usage:
 *   await seedLoggedInUser(page);
 *   await page.goto("/");
 */

const SEED_USER = {
  id: "user_e2e",
  email: "e2e@voicelog.test",
  name: "E2E Tester",
  provider: "local",
  passwordHash: "e2e_hash",
  workspaceIds: ["ws_e2e"],
  defaultWorkspaceId: "ws_e2e",
};

const SEED_WORKSPACE = {
  id: "ws_e2e",
  name: "E2E Workspace",
  memberIds: ["user_e2e"],
  inviteCode: "E2ETEST",
};

const SEED_SESSION = {
  userId: "user_e2e",
  workspaceId: "ws_e2e",
};

/**
 * Call before page.goto().
 * Injects a pre-authenticated session so the app renders the main UI.
 */
async function seedLoggedInUser(page) {
  await page.addInitScript(
    ({ user, workspace, session }) => {
      localStorage.setItem(
        "voicelog_workspace_store",
        JSON.stringify({
          state: {
            users: [user],
            workspaces: [workspace],
            session,
          },
          version: 0,
        })
      );
      localStorage.setItem("voicelog.e2e", "true");
    },
    { user: SEED_USER, workspace: SEED_WORKSPACE, session: SEED_SESSION }
  );
}

/**
 * Seed a pre-existing meeting so tests can target the studio meeting view.
 */
async function seedMeeting(page, meeting) {
  const defaultMeeting = {
    id: "meeting_e2e",
    title: "E2E Meeting",
    context: "",
    startsAt: new Date().toISOString(),
    durationMinutes: 30,
    attendees: "",
    tags: [],
    createdAt: new Date().toISOString(),
    workspaceId: "ws_e2e",
    createdByUserId: "user_e2e",
    updatedAt: new Date().toISOString(),
    recordings: [],
    tasks: [],
    activity: [],
  };
  const merged = { ...defaultMeeting, ...(meeting || {}) };
  await page.addInitScript(
    ({ meetings }) => {
      const existingRaw = localStorage.getItem("voicelog_meetings_store");
      const existing = existingRaw ? JSON.parse(existingRaw) : null;
      const existingState = existing?.state || {};
      localStorage.setItem(
        "voicelog_meetings_store",
        JSON.stringify({
          state: {
            meetings,
            manualTasks: existingState.manualTasks || [],
            taskState: existingState.taskState || {},
            taskBoards: existingState.taskBoards || {},
            calendarMeta: existingState.calendarMeta || {},
            vocabulary: existingState.vocabulary || [],
            storedMeetingDrafts: existingState.storedMeetingDrafts || {},
          },
          version: 0,
        })
      );
    },
    { meetings: [merged] }
  );
}

/**
 * Seed a manual task.
 */
async function seedTask(page, task) {
  const defaultTask = {
    id: "task_e2e",
    title: "E2E Task",
    status: "todo",
    priority: "medium",
    owner: "E2E Tester",
    tags: [],
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    workspaceId: "ws_e2e",
    createdByUserId: "user_e2e",
  };
  const merged = { ...defaultTask, ...(task || {}) };
  await page.addInitScript(
    ({ tasks }) => {
      const existingRaw = localStorage.getItem("voicelog_meetings_store");
      const existing = existingRaw ? JSON.parse(existingRaw) : null;
      const existingState = existing?.state || {};
      localStorage.setItem(
        "voicelog_meetings_store",
        JSON.stringify({
          state: {
            meetings: existingState.meetings || [],
            manualTasks: tasks,
            taskState: existingState.taskState || {},
            taskBoards: existingState.taskBoards || {},
            calendarMeta: existingState.calendarMeta || {},
            vocabulary: existingState.vocabulary || [],
            storedMeetingDrafts: existingState.storedMeetingDrafts || {},
          },
          version: 0,
        })
      );
    },
    { tasks: [merged] }
  );
}

/**
 * Seed a recording queue item (e.g. for testing error states).
 */
async function seedQueueItem(page, item) {
  const defaultItem = {
    id: "q_e2e_1",
    recordingId: "rec_e2e_1",
    meetingId: "meeting_e2e",
    status: "failed",
    addedAt: new Date().toISOString(),
    retryCount: 0,
    error: "Mock error",
  };
  const merged = { ...defaultItem, ...(item || {}) };
  await page.addInitScript(
    ({ statePayload }) => {
      localStorage.setItem("voicelog.recordingQueue.v1", JSON.stringify(statePayload));
    },
    { statePayload: { state: { recordingQueue: [merged] }, version: 0 } }
  );
}

export { seedLoggedInUser, seedMeeting, seedTask, seedQueueItem };
