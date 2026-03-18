class WorkspaceService {
  constructor(db) {
    this.db = db;
  }

  async getWorkspaceState(workspaceId) {
    return await this.db.getWorkspaceState(workspaceId);
  }

  async saveWorkspaceState(workspaceId, payload) {
    return await this.db.saveWorkspaceState(workspaceId, payload);
  }

  async updateWorkspaceMemberRole(workspaceId, targetUserId, memberRole) {
    return await this.db.updateWorkspaceMemberRole(workspaceId, targetUserId, memberRole);
  }

  async getMembership(workspaceId, userId) {
    return await this.db.getMembership(workspaceId, userId);
  }

  async getWorkspaceVoiceProfiles(workspaceId) {
    return await this.db.getWorkspaceVoiceProfiles(workspaceId);
  }

  async getWorkspaceMemberNames(workspaceId) {
    const members = await this.db.workspaceMembers(workspaceId);
    return members.map((u) => u.name);
  }

  async saveVoiceProfile(data) {
    return await this.db.saveVoiceProfile(data);
  }

  async deleteVoiceProfile(id, workspaceId) {
    return await this.db.deleteVoiceProfile(id, workspaceId);
  }
}

module.exports = WorkspaceService;
