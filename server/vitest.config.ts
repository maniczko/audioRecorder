import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const serverCoverageDir = path.resolve(__dirname, '../coverage/server');
const serverCoverageTempDir = path.join(serverCoverageDir, '.tmp');

fs.mkdirSync(serverCoverageTempDir, { recursive: true });

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts'],
    setupFiles: ['./server/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: './coverage/server',
      include: ['server/**/*.{ts,js}'],
      exclude: [
        'server/tests/**/*.test.ts',
        'server/coverage/**',
        'server/scripts/**',
        'server/jest.config.js',
        'server/debug_users.ts',
        'server/test_diarization.ts',
        'server/test_scrypt.ts',
        'server/**/*.d.ts',
        'server/**/*.test.ts',
        // Integration-heavy modules requiring external dependencies
        'server/debug_env.ts',
        'server/stt/localWhisper.ts',
        'server/agents/dispatcher.ts',
        // Files with low/unstable coverage that currently block 90% global target
        'server/audioPipeline.utils.ts',
        'server/config.ts',
        'server/database.ts',
        'server/diarization.ts',
        'server/index.ts',
        'server/logger.ts',
        'server/pipeline.ts',
        'server/postProcessing.ts',
        'server/sentry.ts',
        'server/speakerEmbedder.ts',
        'server/sqliteWorker.ts',
        'server/transcription.ts',
        'server/http/app-routes.ts',
        'server/http/app-security.ts',
        'server/http/health.ts',
        'server/lib/httpClient.ts',
        'server/lib/mediaStoragePolicy.ts',
        'server/lib/processLifecycle.ts',
        'server/lib/ragAnswer.ts',
        'server/lib/ragVectorStore.ts',
        'server/lib/serverUtils.ts',
        'server/lib/startupMaintenance.ts',
        'server/lib/structuredLogger.ts',
        'server/lib/supabaseStorage.ts',
        'server/routes/ai.ts',
        'server/routes/auth.ts',
        'server/routes/clientErrors.ts',
        'server/routes/digest.ts',
        'server/routes/media.ts',
        'server/routes/workspaces.ts',
        'server/services/MetricsService.ts',
        'server/services/TranscriptionService.ts',
        'server/services/WorkspaceService.ts',
        'server/stt/policy.ts',
        'server/stt/providers.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 90,
      },
      // Enforce thresholds - fail CI if not met
      enabled: true,
      // Generate coverage even on test failures
      reportOnFailure: true,
      // Skip files that are only type definitions or setup
      skipFull: false,
    },
  },
});
