import { createId } from "./storage";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function clean(value) {
  return String(value || "").trim();
}

function unique(values) {
  return [...new Set(safeArray(values).map((value) => clean(value)).filter(Boolean))];
}

function nowIso() {
  return new Date().toISOString();
}

function generateInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function normalizeWorkspaceCode(code) {
  return clean(code).replace(/\s+/g, "").toUpperCase();
}

export function createWorkspace(name, ownerUserId) {
  const createdAt = nowIso();
  return {
    id: createId("workspace"),
    name: clean(name) || "Shared workspace",
    ownerUserId,
    memberIds: ownerUserId ? [ownerUserId] : [],
    inviteCode: generateInviteCode(),
    createdAt,
    updatedAt: createdAt,
  };
}

export function addUserToWorkspace(workspaces, workspaceId, userId) {
  return safeArray(workspaces).map((workspace) =>
    workspace.id !== workspaceId
      ? workspace
      : {
          ...workspace,
          memberIds: unique([...(workspace.memberIds || []), userId]),
          updatedAt: nowIso(),
        }
  );
}

export function workspaceMembers(users, workspace) {
  if (!workspace) {
    return [];
  }

  const memberIds = new Set(workspace.memberIds || []);
  return safeArray(users).filter((user) => memberIds.has(user.id));
}

export function userWorkspaceIds(user, workspaces) {
  if (!user) {
    return [];
  }

  return unique([
    ...(user.workspaceIds || []),
    ...safeArray(workspaces)
      .filter((workspace) => (workspace.memberIds || []).includes(user.id))
      .map((workspace) => workspace.id),
  ]);
}

export function resolveWorkspaceForUser(user, workspaces, preferredWorkspaceId) {
  const workspaceIds = userWorkspaceIds(user, workspaces);
  if (!workspaceIds.length) {
    return null;
  }

  if (preferredWorkspaceId && workspaceIds.includes(preferredWorkspaceId)) {
    return preferredWorkspaceId;
  }

  if (user?.defaultWorkspaceId && workspaceIds.includes(user.defaultWorkspaceId)) {
    return user.defaultWorkspaceId;
  }

  return workspaceIds[0];
}

function personalWorkspaceName(user) {
  const name = clean(user?.name) || clean(user?.email) || "Workspace";
  return `${name} workspace`;
}

export function migrateWorkspaceData({ users, workspaces, meetings, manualTasks, taskBoards, session }) {
  let changed = false;
  let nextUsers = safeArray(users).map((user) => ({ ...user }));
  let nextWorkspaces = safeArray(workspaces).map((workspace) => ({
    ...workspace,
    memberIds: unique(workspace.memberIds),
    inviteCode: normalizeWorkspaceCode(workspace.inviteCode) || generateInviteCode(),
  }));
  let nextMeetings = safeArray(meetings).map((meeting) => ({ ...meeting }));
  let nextManualTasks = safeArray(manualTasks).map((task) => ({ ...task }));
  let nextTaskBoards = taskBoards ? { ...taskBoards } : {};
  let nextSession = session ? { ...session } : session;

  if (!nextWorkspaces.length && nextUsers.length) {
    nextUsers = nextUsers.map((user) => {
      const workspace = createWorkspace(personalWorkspaceName(user), user.id);
      nextWorkspaces.push(workspace);
      changed = true;
      return {
        ...user,
        workspaceIds: [workspace.id],
        defaultWorkspaceId: workspace.id,
      };
    });
  }

  nextUsers = nextUsers.map((user) => {
    const memberships = userWorkspaceIds(user, nextWorkspaces);
    if (!memberships.length) {
      const workspace = createWorkspace(personalWorkspaceName(user), user.id);
      nextWorkspaces.push(workspace);
      changed = true;
      return {
        ...user,
        workspaceIds: [workspace.id],
        defaultWorkspaceId: workspace.id,
      };
    }

    const defaultWorkspaceId =
      user.defaultWorkspaceId && memberships.includes(user.defaultWorkspaceId) ? user.defaultWorkspaceId : memberships[0];

    if (
      JSON.stringify(user.workspaceIds || []) !== JSON.stringify(memberships) ||
      user.defaultWorkspaceId !== defaultWorkspaceId
    ) {
      changed = true;
      return {
        ...user,
        workspaceIds: memberships,
        defaultWorkspaceId,
      };
    }

    return user;
  });

  nextWorkspaces = nextWorkspaces.map((workspace) => {
    const normalizedMemberIds = unique(workspace.memberIds);
    if (normalizedMemberIds.length !== (workspace.memberIds || []).length) {
      changed = true;
    }
    return {
      ...workspace,
      memberIds: normalizedMemberIds,
      name: clean(workspace.name) || "Shared workspace",
      inviteCode: normalizeWorkspaceCode(workspace.inviteCode) || generateInviteCode(),
    };
  });

  const defaultWorkspaceByUserId = nextUsers.reduce((result, user) => {
    result[user.id] = user.defaultWorkspaceId;
    return result;
  }, {});

  nextMeetings = nextMeetings.map((meeting) => {
    if (meeting.workspaceId) {
      return meeting;
    }

    const workspaceId = defaultWorkspaceByUserId[meeting.userId] || "";
    changed = true;
    return {
      ...meeting,
      workspaceId,
      createdByUserId: meeting.createdByUserId || meeting.userId || "",
    };
  });

  nextManualTasks = nextManualTasks.map((task) => {
    if (task.workspaceId) {
      return task;
    }

    const workspaceId = defaultWorkspaceByUserId[task.userId] || "";
    changed = true;
    return {
      ...task,
      workspaceId,
      createdByUserId: task.createdByUserId || task.userId || "",
    };
  });

  nextUsers.forEach((user) => {
    const workspaceId = user.defaultWorkspaceId;
    if (!workspaceId || !nextTaskBoards?.[user.id] || nextTaskBoards?.[workspaceId]) {
      return;
    }
    nextTaskBoards = {
      ...nextTaskBoards,
      [workspaceId]: nextTaskBoards[user.id],
    };
    changed = true;
  });

  if (nextSession?.userId && !nextSession.workspaceId) {
    const sessionUser = nextUsers.find((user) => user.id === nextSession.userId);
    const workspaceId = resolveWorkspaceForUser(sessionUser, nextWorkspaces, null);
    if (workspaceId) {
      nextSession = {
        ...nextSession,
        workspaceId,
      };
      changed = true;
    }
  }

  return {
    changed,
    users: nextUsers,
    workspaces: nextWorkspaces,
    meetings: nextMeetings,
    manualTasks: nextManualTasks,
    taskBoards: nextTaskBoards,
    session: nextSession,
  };
}
