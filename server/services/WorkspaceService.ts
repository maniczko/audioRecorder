import type { WorkspaceStatePayload } from '../../src/shared/contracts.ts';
import { logger } from '../logger.ts';

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

  async updateWorkspaceFeatureFlags(
    workspaceId: string,
    featureFlags: unknown,
    actorUserId = '',
    requestId = ''
  ) {
    return await this.db.updateWorkspaceFeatureFlags(workspaceId, featureFlags, {
      actorUserId,
      requestId,
      source: 'api',
    });
  }

  async updateRetentionPolicy(
    workspaceId: string,
    retentionDays: number,
    actorUserId = '',
    requestId = ''
  ) {
    const current = await this.db.getWorkspaceState(workspaceId);
    const next = await this.db.saveWorkspaceState(workspaceId, {
      ...current,
      retentionDays,
    });
    try {
      const auditWriter = this.db.writeAuditLogBestEffort || this.db.writeAuditLog;
      await auditWriter?.call(this.db, {
        workspaceId,
        actorUserId,
        action: 'workspace.retention.updated',
        entityType: 'workspace',
        entityId: workspaceId,
        metadata: {
          previousRetentionDays: current.retentionDays,
          retentionDays: next.retentionDays,
          source: 'api',
          requestId,
        },
      });
    } catch (error: any) {
      logger.warn('[audit] Failed to persist retention audit log', {
        workspaceId,
        action: 'workspace.retention.updated',
        error: error?.message || String(error),
      });
    }
    return { retentionDays: next.retentionDays, state: next };
  }

  async cleanupExpiredRecordingsByRetention(workspaceId: string, options: any = {}) {
    return await this.db.cleanupExpiredRecordingsByRetention({ ...options, workspaceId });
  }

  async setRecordingRetentionHold(options: any) {
    return await this.db.setRecordingRetentionHold(options);
  }

  async clearRecordingRetentionHold(options: any) {
    return await this.db.clearRecordingRetentionHold(options);
  }

  async listRecordingRetentionHolds(workspaceId: string) {
    return await this.db.listRecordingRetentionHolds(workspaceId);
  }

  async setWorkspaceRetentionHold(options: any) {
    return await this.db.setWorkspaceRetentionHold(options);
  }

  async clearWorkspaceRetentionHold(options: any) {
    return await this.db.clearWorkspaceRetentionHold(options);
  }

  async exportWorkspaceData(workspaceId: string, options: any = {}) {
    return await this.db.exportWorkspaceData(workspaceId, options);
  }

  async listAuditLogs(workspaceId: string, options: any = {}) {
    return await this.db.listAuditLogs(workspaceId, options);
  }

  async exportAuditLogs(workspaceId: string, options: any = {}) {
    return await this.db.exportAuditLogs(workspaceId, options);
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

  async deleteVoiceProfile(id: string, workspaceId: string, options: any = {}) {
    return await this.db.deleteVoiceProfile(id, workspaceId, options);
  }

  async updateVoiceProfileThreshold(id: string, workspaceId: string, threshold: number) {
    return await this.db.updateVoiceProfileThreshold(id, workspaceId, threshold);
  }
}
