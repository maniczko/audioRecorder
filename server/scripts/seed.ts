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
    const admin = await auth.registerUser('admin@voicelog.test', 'Szyfruje123!', 'VoiceLog Admin');
    logger.info(`[Seed] Utworzono admina: ${admin.userId}`);

    // 2. Utwórz organizację
    const ws = await workspace.createWorkspace('VoiceLog Staging Workspace', admin.userId);
    logger.info(`[Seed] Utworzono workspace: ${ws.id}`);

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
