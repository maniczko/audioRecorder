class WorkspaceService {
  constructor(db) {
    this.db = db;
  }

  getWorkspaceState(workspaceId) {
    return this.db.getWorkspaceState(workspaceId);
  }

  saveWorkspaceState(workspaceId, payload) {
    return this.db.saveWorkspaceState(workspaceId, payload);
  }

  updateWorkspaceMemberRole(workspaceId, targetUserId, memberRole) {
    return this.db.updateWorkspaceMemberRole(workspaceId, targetUserId, memberRole);
  }

  getMembership(workspaceId, userId) {
    return this.db.getMembership(workspaceId, userId);
  }

  getWorkspaceVoiceProfiles(workspaceId) {
    return this.db.getWorkspaceVoiceProfiles(workspaceId);
  }

  saveVoiceProfile(data) {
    return this.db.saveVoiceProfile(data);
  }

  deleteVoiceProfile(id, workspaceId) {
    return this.db.deleteVoiceProfile(id, workspaceId);
  }
}

module.exports = WorkspaceService;
