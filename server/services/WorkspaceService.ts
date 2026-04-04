import type { WorkspaceStatePayload } from '../../src/shared/contracts.ts';

export default class WorkspaceService {
  db: any;
  constructor(db: any) {
    this.db = db;
  }

  async getWorkspaceState(workspaceId: string) {
    return await this.db.getWorkspaceState(workspaceId);
  }

  async saveWorkspaceState(workspaceId: string, payload: WorkspaceStatePayload) {
    return await this.db.saveWorkspaceState(workspaceId, payload);
  }

  async updateWorkspaceMemberRole(workspaceId: string, targetUserId: string, memberRole: string) {
    return await this.db.updateWorkspaceMemberRole(workspaceId, targetUserId, memberRole);
  }

  async removeWorkspaceMember(workspaceId: string, targetUserId: string) {
    return await this.db.removeWorkspaceMember(workspaceId, targetUserId);
  }

  async getMembership(workspaceId: string, userId: string) {
    return await this.db.getMembership(workspaceId, userId);
  }

  async getWorkspaceVoiceProfiles(workspaceId: string) {
    return await this.db.getWorkspaceVoiceProfiles(workspaceId);
  }

  async getWorkspaceMemberNames(workspaceId: string) {
    const members = await this.db.workspaceMembers(workspaceId);
    return members.map((u: any) => u.name);
  }

  async saveVoiceProfile(data: any) {
    return await this.db.saveVoiceProfile(data);
  }

  async upsertVoiceProfile(data: any) {
    return await this.db.upsertVoiceProfile(data);
  }

  async deleteVoiceProfile(id: string, workspaceId: string) {
    return await this.db.deleteVoiceProfile(id, workspaceId);
  }

  async updateVoiceProfileThreshold(id: string, workspaceId: string, threshold: number) {
    return await this.db.updateVoiceProfileThreshold(id, workspaceId, threshold);
  }
}
