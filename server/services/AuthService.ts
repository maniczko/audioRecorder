import { UserDraft } from '../lib/types.ts';
import type { SessionPayload } from '../../src/shared/contracts.ts';

export default class AuthService {
  db: any;
  constructor(db: any) {
    this.db = db;
  }

  async registerUser(draft: UserDraft) {
    return await this.db.registerUser(draft);
  }

  async loginUser(draft: UserDraft) {
    return await this.db.loginUser(draft);
  }

  async requestPasswordReset(draft: { email: string }) {
    return await this.db.requestPasswordReset(draft);
  }

  async resetPasswordWithCode(draft: {
    email: string;
    code: string;
    newPassword?: string;
    confirmPassword?: string;
  }) {
    return await this.db.resetPasswordWithCode(draft);
  }

  async upsertGoogleUser(profile: UserDraft) {
    return await this.db.upsertGoogleUser(profile);
  }

  async getSession(token: string) {
    return await this.db.getSession(token);
  }

  async updateUserProfile(userId: string, updates: Partial<UserDraft>) {
    return await this.db.updateUserProfile(userId, updates);
  }

  async changeUserPassword(userId: string, draft: any) {
    return await this.db.changeUserPassword(userId, draft);
  }

  async buildSessionPayload(userId: string, workspaceId: string): Promise<SessionPayload> {
    return await this.db.buildSessionPayload(userId, workspaceId);
  }
}
