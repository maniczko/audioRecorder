import { createId } from "./storage";
import {
  addUserToWorkspace,
  createWorkspace,
  normalizeWorkspaceCode,
  resolveWorkspaceForUser,
} from "./workspace";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeLines(value) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function fallbackHash(secret) {
  let hash = 0;
  const input = `voicelog:${secret}`;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(16);
}

function copyUserWorkspaceIds(user, workspaceId) {
  return workspaceId
    ? {
        workspaceIds: [workspaceId],
        defaultWorkspaceId: workspaceId,
      }
    : {
        workspaceIds: [],
        defaultWorkspaceId: "",
      };
}

export async function hashSecret(secret) {
  const safeSecret = String(secret || "");

  if (typeof window === "undefined" || !window.crypto?.subtle) {
    return fallbackHash(safeSecret);
  }

  const encoded = new TextEncoder().encode(safeSecret);
  const buffer = await window.crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buffer), (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function registerUser(existingUsers, existingWorkspaces, draft) {
  const email = normalizeEmail(draft.email);
  const password = String(draft.password || "");
  const name = String(draft.name || "").trim();
  const workspaceMode = draft.workspaceMode === "join" ? "join" : "create";
  const workspaceName = String(draft.workspaceName || "").trim();
  const inviteCode = normalizeWorkspaceCode(draft.workspaceCode);

  if (!email || !password || !name) {
    throw new Error("Uzupelnij imie, email i haslo.");
  }

  if (password.length < 6) {
    throw new Error("Haslo musi miec przynajmniej 6 znakow.");
  }

  if (existingUsers.some((user) => normalizeEmail(user.email) === email)) {
    throw new Error("Konto z takim adresem juz istnieje.");
  }

  let workspaceId = "";
  let workspaces = Array.isArray(existingWorkspaces) ? [...existingWorkspaces] : [];

  if (workspaceMode === "join") {
    const workspace = workspaces.find((item) => normalizeWorkspaceCode(item.inviteCode) === inviteCode);
    if (!workspace) {
      throw new Error("Nie znaleziono workspace o takim kodzie.");
    }
    workspaceId = workspace.id;
  } else {
    const workspace = createWorkspace(workspaceName || `${name} workspace`, "");
    workspaceId = workspace.id;
    workspaces = [...workspaces, workspace];
  }

  const passwordHash = await hashSecret(password);
  const user = {
    id: createId("user"),
    email,
    passwordHash,
    name,
    role: String(draft.role || "").trim(),
    company: String(draft.company || "").trim(),
    timezone: draft.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Warsaw",
    googleEmail: email,
    phone: "",
    location: "",
    team: "",
    bio: "",
    avatarUrl: "",
    preferredInsights: [],
    notifyDailyDigest: true,
    autoTaskCapture: true,
    preferredTaskView: "list",
    provider: "local",
    ...copyUserWorkspaceIds(null, workspaceId),
    createdAt: new Date().toISOString(),
  };

  if (workspaceMode === "create") {
    workspaces = workspaces.map((workspace) =>
      workspace.id !== workspaceId
        ? workspace
        : {
            ...workspace,
            ownerUserId: user.id,
            memberIds: [user.id],
            updatedAt: new Date().toISOString(),
          }
    );
  } else {
    workspaces = addUserToWorkspace(workspaces, workspaceId, user.id);
  }

  return {
    user,
    users: [...existingUsers, user],
    workspaces,
    workspaceId,
  };
}

export async function loginUser(existingUsers, existingWorkspaces, draft) {
  const email = normalizeEmail(draft.email);
  const passwordHash = await hashSecret(draft.password);
  const user = existingUsers.find(
    (candidate) => normalizeEmail(candidate.email) === email && candidate.passwordHash === passwordHash
  );

  if (!user) {
    throw new Error("Niepoprawny email lub haslo.");
  }

  const workspaceId = resolveWorkspaceForUser(user, existingWorkspaces, draft.workspaceId);
  if (!workspaceId) {
    throw new Error("To konto nie jest jeszcze przypiete do zadnego workspace.");
  }

  return {
    user,
    workspaceId,
  };
}

export function updateUserProfile(existingUsers, userId, updates) {
  return existingUsers.map((user) =>
    user.id === userId
      ? {
          ...user,
          name: String(updates.name || "").trim(),
          role: String(updates.role || "").trim(),
          company: String(updates.company || "").trim(),
          timezone: updates.timezone || user.timezone,
          googleEmail: String(updates.googleEmail || "").trim(),
          phone: String(updates.phone || "").trim(),
          location: String(updates.location || "").trim(),
          team: String(updates.team || "").trim(),
          bio: String(updates.bio || "").trim(),
          avatarUrl: String(updates.avatarUrl || "").trim(),
          preferredInsights: normalizeLines(updates.preferredInsights),
          notifyDailyDigest: Boolean(updates.notifyDailyDigest),
          autoTaskCapture: Boolean(updates.autoTaskCapture),
          preferredTaskView: updates.preferredTaskView === "kanban" ? "kanban" : "list",
          updatedAt: new Date().toISOString(),
        }
      : user
  );
}

export async function changeUserPassword(existingUsers, userId, draft) {
  const currentPassword = String(draft.currentPassword || "");
  const newPassword = String(draft.newPassword || "");
  const confirmPassword = String(draft.confirmPassword || "");
  const user = existingUsers.find((candidate) => candidate.id === userId);

  if (!user) {
    throw new Error("Nie znaleziono konta.");
  }

  if (!user.passwordHash) {
    throw new Error("Haslem tego konta zarzadza Google.");
  }

  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new Error("Uzupelnij wszystkie pola hasla.");
  }

  if (newPassword.length < 6) {
    throw new Error("Nowe haslo musi miec przynajmniej 6 znakow.");
  }

  if (newPassword !== confirmPassword) {
    throw new Error("Nowe hasla nie sa identyczne.");
  }

  const currentHash = await hashSecret(currentPassword);
  if (currentHash !== user.passwordHash) {
    throw new Error("Aktualne haslo jest niepoprawne.");
  }

  const nextHash = await hashSecret(newPassword);
  return existingUsers.map((candidate) =>
    candidate.id !== userId
      ? candidate
      : {
          ...candidate,
          passwordHash: nextHash,
          updatedAt: new Date().toISOString(),
        }
  );
}

export async function requestPasswordReset(existingUsers, draft) {
  const email = normalizeEmail(draft.email);
  const user = existingUsers.find((candidate) => normalizeEmail(candidate.email) === email);

  if (!user) {
    throw new Error("Nie znaleziono konta z takim adresem.");
  }

  if (!user.passwordHash) {
    throw new Error("To konto korzysta z logowania Google. Reset hasla wykonaj w Google.");
  }

  const recoveryCode = String(Math.floor(100000 + Math.random() * 900000));
  const recoveryCodeHash = await hashSecret(recoveryCode);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  return {
    users: existingUsers.map((candidate) =>
      candidate.id !== user.id
        ? candidate
        : {
            ...candidate,
            recoveryCodeHash,
            recoveryCodeExpiresAt: expiresAt,
            updatedAt: new Date().toISOString(),
          }
    ),
    recoveryCode,
    expiresAt,
  };
}

export async function resetPasswordWithCode(existingUsers, draft) {
  const email = normalizeEmail(draft.email);
  const code = String(draft.code || "").trim();
  const newPassword = String(draft.newPassword || "");
  const confirmPassword = String(draft.confirmPassword || "");
  const user = existingUsers.find((candidate) => normalizeEmail(candidate.email) === email);

  if (!user) {
    throw new Error("Nie znaleziono konta z takim adresem.");
  }

  if (!code || !newPassword || !confirmPassword) {
    throw new Error("Uzupelnij email, kod i oba pola hasla.");
  }

  if (newPassword.length < 6) {
    throw new Error("Nowe haslo musi miec przynajmniej 6 znakow.");
  }

  if (newPassword !== confirmPassword) {
    throw new Error("Nowe hasla nie sa identyczne.");
  }

  if (!user.recoveryCodeHash || !user.recoveryCodeExpiresAt) {
    throw new Error("Najpierw popros o kod resetu.");
  }

  if (new Date(user.recoveryCodeExpiresAt).getTime() < Date.now()) {
    throw new Error("Kod resetu wygasl. Wygeneruj nowy.");
  }

  const codeHash = await hashSecret(code);
  if (codeHash !== user.recoveryCodeHash) {
    throw new Error("Kod resetu jest niepoprawny.");
  }

  const passwordHash = await hashSecret(newPassword);
  return existingUsers.map((candidate) =>
    candidate.id !== user.id
      ? candidate
      : {
          ...candidate,
          passwordHash,
          recoveryCodeHash: "",
          recoveryCodeExpiresAt: "",
          updatedAt: new Date().toISOString(),
        }
  );
}

export function upsertGoogleUser(existingUsers, existingWorkspaces, googleProfile) {
  const email = normalizeEmail(googleProfile.email);
  const existingUser = existingUsers.find(
    (user) => normalizeEmail(user.email) === email || user.googleSub === googleProfile.sub
  );
  const workspaces = Array.isArray(existingWorkspaces) ? [...existingWorkspaces] : [];

  if (existingUser) {
    const workspaceId = resolveWorkspaceForUser(existingUser, workspaces, null);
    const users = existingUsers.map((user) =>
      user.id !== existingUser.id
        ? user
        : {
            ...user,
            email,
            name: googleProfile.name || existingUser.name,
            googleEmail: email,
            googleSub: googleProfile.sub || existingUser.googleSub,
            avatarUrl: googleProfile.picture || existingUser.avatarUrl || "",
            provider: "google",
            updatedAt: new Date().toISOString(),
          }
    );

    return {
      user: users.find((user) => user.id === existingUser.id),
      users,
      workspaces,
      workspaceId,
    };
  }

  const workspace = createWorkspace(`${googleProfile.given_name || googleProfile.name || "Google"} workspace`, "");
  const user = {
    id: createId("user"),
    email,
    passwordHash: null,
    name: String(googleProfile.name || googleProfile.given_name || "Google user").trim(),
    role: "",
    company: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Warsaw",
    googleEmail: email,
    googleSub: googleProfile.sub || "",
    avatarUrl: googleProfile.picture || "",
    preferredInsights: [],
    phone: "",
    location: "",
    team: "",
    bio: "",
    notifyDailyDigest: true,
    autoTaskCapture: true,
    preferredTaskView: "list",
    provider: "google",
    ...copyUserWorkspaceIds(null, workspace.id),
    createdAt: new Date().toISOString(),
  };
  const nextWorkspaces = [
    ...workspaces,
    {
      ...workspace,
      ownerUserId: user.id,
      memberIds: [user.id],
    },
  ];

  return {
    user,
    users: [...existingUsers, user],
    workspaces: nextWorkspaces,
    workspaceId: workspace.id,
  };
}
