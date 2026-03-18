class AuthService {
  constructor(db) {
    this.db = db;
  }

  async registerUser(draft) {
    return await this.db.registerUser(draft);
  }

  async loginUser(draft) {
    return await this.db.loginUser(draft);
  }

  async requestPasswordReset(draft) {
    return await this.db.requestPasswordReset(draft);
  }

  async resetPasswordWithCode(draft) {
    return await this.db.resetPasswordWithCode(draft);
  }

  async upsertGoogleUser(profile) {
    return await this.db.upsertGoogleUser(profile);
  }

  async getSession(token) {
    return await this.db.getSession(token);
  }

  async updateUserProfile(userId, updates) {
    return await this.db.updateUserProfile(userId, updates);
  }

  async changeUserPassword(userId, draft) {
    return await this.db.changeUserPassword(userId, draft);
  }

  async buildSessionPayload(userId, workspaceId) {
    return await this.db.buildSessionPayload(userId, workspaceId);
  }
}

module.exports = AuthService;
