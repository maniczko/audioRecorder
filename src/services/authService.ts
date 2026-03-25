import {
  changeUserPassword,
  loginUser,
  requestPasswordReset,
  registerUser,
  resetPasswordWithCode,
  updateUserProfile,
  upsertGoogleUser,
} from '../lib/auth';
import { apiRequest } from './httpClient';
import { APP_DATA_PROVIDER } from './config';

function createLocalAuthService() {
  return {
    mode: 'local',
    register({ users, workspaces, draft }) {
      return registerUser(users, workspaces, draft);
    },
    login({ users, workspaces, draft }) {
      return loginUser(users, workspaces, draft);
    },
    requestPasswordReset({ users, draft }) {
      return requestPasswordReset(users, draft);
    },
    resetPassword({ users, draft }) {
      return resetPasswordWithCode(users, draft);
    },
    updateProfile({ users, userId, updates }) {
      return Promise.resolve(updateUserProfile(users, userId, updates));
    },
    changePassword({ users, userId, draft }) {
      return changeUserPassword(users, userId, draft);
    },
    signInWithGoogle({ users, workspaces, profile }) {
      return Promise.resolve(upsertGoogleUser(users, workspaces, profile));
    },
  };
}

function createRemoteAuthService() {
  return {
    mode: 'remote',
    register({ draft }) {
      return apiRequest('/auth/register', {
        method: 'POST',
        body: draft,
      });
    },
    login({ draft }) {
      return apiRequest('/auth/login', {
        method: 'POST',
        body: draft,
      });
    },
    requestPasswordReset({ draft }) {
      return apiRequest('/auth/password/reset/request', {
        method: 'POST',
        body: draft,
      });
    },
    resetPassword({ draft }) {
      return apiRequest('/auth/password/reset/confirm', {
        method: 'POST',
        body: draft,
      });
    },
    updateProfile({ userId, updates }) {
      return apiRequest(`/users/${userId}/profile`, {
        method: 'PUT',
        body: updates,
      });
    },
    changePassword({ userId, draft }) {
      return apiRequest(`/users/${userId}/password`, {
        method: 'POST',
        body: draft,
      });
    },
    signInWithGoogle({ profile }) {
      return apiRequest('/auth/google', {
        method: 'POST',
        body: profile,
      });
    },
  };
}

export function createAuthService() {
  return APP_DATA_PROVIDER === 'remote' ? createRemoteAuthService() : createLocalAuthService();
}
