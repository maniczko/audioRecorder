import { runProductionSmoke } from './production-smoke.mjs';

process.env.PRODUCTION_REQUIRE_AUDIO_UPLOAD_SMOKE = 'true';
process.env.PRODUCTION_REQUIRE_KNOWN_GIT_SHA = 'true';
process.env.PRODUCTION_REQUIRE_SENTRY_DSN = 'true';
process.env.PRODUCTION_REQUIRE_STALE_RECORDING_SMOKE = 'true';
process.env.PRODUCTION_REQUIRE_VOICE_PROFILE_SMOKE = 'true';

runProductionSmoke()
  .then((result) => {
    console.log('Strict production smoke passed.');
    console.log(
      JSON.stringify(
        {
          frontend: result.frontend,
          api: result.api,
          supabaseRemote: result.supabaseRemote,
          gitSha: result.gitSha,
          audioUploadChecked: result.audioUploadChecked,
          audioPersistenceChecked: result.audioPersistenceChecked,
          staleRecordingChecked: result.staleRecordingChecked,
          voiceProfileChecked: result.voiceProfileChecked,
          persistenceEvidenceChecked: result.persistenceEvidenceChecked,
        },
        null,
        2
      )
    );
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
