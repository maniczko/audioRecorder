class AuthService {
  constructor(db) {
    this.db = db;
  }

  registerUser(draft) {
    return this.db.registerUser(draft);
  }

  loginUser(draft) {
    return this.db.loginUser(draft);
  }

  requestPasswordReset(draft) {
    return this.db.requestPasswordReset(draft);
  }

  resetPasswordWithCode(draft) {
    return this.db.resetPasswordWithCode(draft);
  }

  upsertGoogleUser(profile) {
    return this.db.upsertGoogleUser(profile);
  }

  getSession(token) {
    return this.db.getSession(token);
  }

  updateUserProfile(userId, updates) {
    return this.db.updateUserProfile(userId, updates);
  }

  changeUserPassword(userId, draft) {
    return this.db.changeUserPassword(userId, draft);
  }

  buildSessionPayload(userId, workspaceId) {
    return this.db.buildSessionPayload(userId, workspaceId);
  }
}

module.exports = AuthService;
