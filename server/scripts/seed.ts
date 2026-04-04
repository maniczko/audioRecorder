import { getDatabase } from '../database.ts';
import AuthService from '../services/AuthService.ts';
import WorkspaceService from '../services/WorkspaceService.ts';
import { logger } from '../logger.ts';

async function runSeed() {
  logger.info('Seeding started...');
  const db = getDatabase();
  await db.init();

  const auth = new AuthService(db);
  const workspace = new WorkspaceService(db);

  try {
    // 1. Zarejestruj konta
    const admin = await auth.registerUser({
      email: 'admin@voicelog.test',
      password: 'Szyfruje123!',
      name: 'VoiceLog Admin',
    });
    logger.info(`[Seed] Utworzono admina: ${admin.userId}`);

    // 2. Utwórz workspace - createWorkspace is not yet implemented in WorkspaceService
    // TODO: Implement createWorkspace in WorkspaceService or use database directly
    logger.info('[Seed] Workspace creation skipped - method not implemented');

    logger.info('Seed completed successfully!');
  } catch (error: any) {
    if (error.message?.includes('Email zajety') || error.message?.includes('UNIQUE constraint')) {
      logger.info('[Seed] Data already exists. Skipping.');
    } else {
      logger.error('[Seed] Zakończono błędem:', error);
      process.exit(1);
    }
  }
}

runSeed();
