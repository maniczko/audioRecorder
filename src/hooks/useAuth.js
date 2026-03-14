import { useEffect, useMemo, useState } from "react";
import { buildProfileDraft } from "../lib/appState";
import { createAuthService } from "../services/authService";

const EMPTY_AUTH_DRAFT = {
  name: "",
  role: "",
  company: "",
  email: "",
  password: "",
  workspaceMode: "create",
  workspaceName: "",
  workspaceCode: "",
};

const EMPTY_RESET_DRAFT = {
  email: "",
  code: "",
  newPassword: "",
  confirmPassword: "",
};

const EMPTY_PASSWORD_DRAFT = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function mergeUserIntoCollection(existingUsers, user) {
  if (!user) {
    return existingUsers;
  }

  const nextUsers = Array.isArray(existingUsers) ? [...existingUsers] : [];
  const existingIndex = nextUsers.findIndex((candidate) => candidate.id === user.id);
  if (existingIndex === -1) {
    return [...nextUsers, user];
  }

  nextUsers[existingIndex] = {
    ...nextUsers[existingIndex],
    ...user,
  };
  return nextUsers;
}

export default function useAuth({
  currentUser,
  users,
  setUsers,
  workspaces,
  setWorkspaces,
  setSession,
}) {
  const authService = useMemo(() => createAuthService(), []);
  const [authMode, setAuthMode] = useState("register");
  const [authDraft, setAuthDraft] = useState(EMPTY_AUTH_DRAFT);
  const [authError, setAuthError] = useState("");
  const [googleAuthMessage, setGoogleAuthMessage] = useState("");
  const [resetDraft, setResetDraft] = useState(EMPTY_RESET_DRAFT);
  const [resetMessage, setResetMessage] = useState("");
  const [resetPreviewCode, setResetPreviewCode] = useState("");
  const [resetExpiresAt, setResetExpiresAt] = useState("");
  const [profileDraft, setProfileDraft] = useState(buildProfileDraft(null));
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordDraft, setPasswordDraft] = useState(EMPTY_PASSWORD_DRAFT);
  const [securityMessage, setSecurityMessage] = useState("");

  useEffect(() => {
    setProfileDraft(buildProfileDraft(currentUser));
    setPasswordDraft(EMPTY_PASSWORD_DRAFT);
    setProfileMessage("");
    setSecurityMessage("");
  }, [currentUser]);

  useEffect(() => {
    setAuthError("");
    setGoogleAuthMessage("");
    if (authMode !== "forgot") {
      setResetMessage("");
      setResetPreviewCode("");
      setResetExpiresAt("");
    }
  }, [authMode]);

  async function submitAuth(event) {
    event.preventDefault();
    setAuthError("");
    setResetMessage("");

    try {
      if (authMode === "register") {
        const result = await authService.register({ users, workspaces, draft: authDraft });
        if (result.users) {
          setUsers(result.users);
        } else if (result.user) {
          setUsers((previous) => mergeUserIntoCollection(previous, result.user));
        }
        if (result.workspaces) {
          setWorkspaces(result.workspaces);
        }
        setSession({ userId: result.user.id, workspaceId: result.workspaceId, token: result.token || "" });
      } else {
        const result = await authService.login({ users, workspaces, draft: authDraft });
        if (result.users) {
          setUsers(result.users);
        } else if (result.user) {
          setUsers((previous) => mergeUserIntoCollection(previous, result.user));
        }
        if (result.workspaces) {
          setWorkspaces(result.workspaces);
        }
        setSession({ userId: result.user.id, workspaceId: result.workspaceId, token: result.token || "" });
      }
    } catch (error) {
      setAuthError(error.message);
    }
  }

  async function requestResetCode() {
    setAuthError("");
    setResetMessage("");
    try {
      const result = await authService.requestPasswordReset({ users, draft: resetDraft });
      if (result.users) {
        setUsers(result.users);
      }
      setResetPreviewCode(result.recoveryCode || "");
      setResetExpiresAt(result.expiresAt || "");
      setResetMessage("Kod resetu jest gotowy. Ustaw nowe haslo ponizej.");
    } catch (error) {
      setAuthError(error.message);
    }
  }

  async function completeReset() {
    setAuthError("");
    setResetMessage("");
    try {
      const nextUsers = await authService.resetPassword({ users, draft: resetDraft });
      if (Array.isArray(nextUsers)) {
        setUsers(nextUsers);
      } else if (Array.isArray(nextUsers?.users)) {
        setUsers(nextUsers.users);
      }
      setResetMessage("Haslo zostalo zmienione. Mozesz sie teraz zalogowac.");
      setResetPreviewCode("");
      setResetExpiresAt("");
      setResetDraft({
        ...EMPTY_RESET_DRAFT,
        email: resetDraft.email,
      });
      setAuthMode("login");
    } catch (error) {
      setAuthError(error.message);
    }
  }

  async function handleGoogleProfile(profile) {
    try {
      const result = await authService.signInWithGoogle({ users, workspaces, profile });
      if (result.users) {
        setUsers(result.users);
      } else if (result.user) {
        setUsers((previous) => mergeUserIntoCollection(previous, result.user));
      }
      if (result.workspaces) {
        setWorkspaces(result.workspaces);
      }
      setSession({ userId: result.user.id, workspaceId: result.workspaceId, token: result.token || "" });
      setGoogleAuthMessage(`Zalogowano przez Google jako ${profile.email}.`);
      setAuthError("");
    } catch (error) {
      setGoogleAuthMessage(error.message);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!currentUser) {
      return;
    }

    setSecurityMessage("");
    try {
      const result = await authService.updateProfile({
        users,
        userId: currentUser.id,
        updates: profileDraft,
      });
      if (Array.isArray(result)) {
        setUsers(result);
      } else if (Array.isArray(result?.users)) {
        setUsers(result.users);
      } else if (result?.user) {
        setUsers((previous) => mergeUserIntoCollection(previous, result.user));
      }
      setProfileMessage("Profil zapisany.");
    } catch (error) {
      setSecurityMessage(error.message);
    }
  }

  async function updatePassword(event) {
    event.preventDefault();
    if (!currentUser) {
      return;
    }

    setProfileMessage("");
    try {
      const result = await authService.changePassword({
        users,
        userId: currentUser.id,
        draft: passwordDraft,
      });
      if (Array.isArray(result)) {
        setUsers(result);
      } else if (Array.isArray(result?.users)) {
        setUsers(result.users);
      } else if (result?.user) {
        setUsers((previous) => mergeUserIntoCollection(previous, result.user));
      }
      setPasswordDraft(EMPTY_PASSWORD_DRAFT);
      setSecurityMessage("Haslo zostalo zmienione.");
    } catch (error) {
      setSecurityMessage(error.message);
    }
  }

  return {
    authMode,
    setAuthMode,
    authDraft,
    setAuthDraft,
    authError,
    googleAuthMessage,
    resetDraft,
    setResetDraft,
    resetMessage,
    resetPreviewCode,
    resetExpiresAt,
    profileDraft,
    setProfileDraft,
    profileMessage,
    passwordDraft,
    setPasswordDraft,
    securityMessage,
    submitAuth,
    requestResetCode,
    completeReset,
    saveProfile,
    updatePassword,
    handleGoogleProfile,
    setGoogleAuthMessage,
    setAuthError,
  };
}
