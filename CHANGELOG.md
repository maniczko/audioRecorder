# 0.1.2 (2026-04-25)

### Bug Fixes

- make fatal backend errors exit through graceful shutdown
- relax backend production smoke checks for frontend-only changes
- bring test files back into lint quality gates

### Tests

- add real chunked audio upload/finalize integration coverage
- cover upload resume, storage-error retry, and assembled temp cleanup

### Maintenance

- document fatal process lifecycle policy
- keep backend smoke scope detection covered by workflow tests

# 0.1.1 (2026-04-25)

### Bug Fixes

- stabilize recorder queue processing and failed-start cleanup
- handle `OverconstrainedError` with relaxed microphone constraints
- prevent transcription progress token leakage in URLs
- keep frontend and backend CI suites offline, sharded, and reproducible

### Maintenance

- remove generated logs/reports from versioned sources
- document audioRecorder architecture, quality gates, operations, and next work
- constrain auto-fix workflows to manual execution
- pin patched transitive dependencies for high/critical audit gate

# 0.1.0 (2026-03-25)

### Bug Fixes

- [413] Add missing VAD_ENABLED import in pipeline.ts ([f6b8fa7](https://github.com/maniczko/audioRecorder/commit/f6b8fa7f51a6d8dc3dea9a89138b4239a30f11db))
- [CI] Fix failing server tests ([56b9ccb](https://github.com/maniczko/audioRecorder/commit/56b9ccbe1719afc7cf5001164f57381f3f5028d3))
- [CI] Fix failing server tests ([9e3f9f1](https://github.com/maniczko/audioRecorder/commit/9e3f9f1906d4932e87d3acf09b2031124ac38f60))
- [CI] Fix stt.providers.test - use undefined instead of empty string ([0a30da1](https://github.com/maniczko/audioRecorder/commit/0a30da104b796205f12cdbfb15ba8b29504006bc))
- [Docker] Remove fake node image digest ([98a005d](https://github.com/maniczko/audioRecorder/commit/98a005d9b4b7f8a0fdb461b12ae1a3699e5aa330))
- [Docker] Simplify httpClient to use native fetch ([2a1d048](https://github.com/maniczko/audioRecorder/commit/2a1d048c8cdbc4137f0f02f09f638a49fa8a1e70))
- [Docker] Use uv version tag instead of fake digest ([0878cc3](https://github.com/maniczko/audioRecorder/commit/0878cc3b92b20752ad756fc3a81f8813984bd5cd))
- add --experimental-sqlite flag and fatal error logging ([1f1e9e6](https://github.com/maniczko/audioRecorder/commit/1f1e9e6f55cbeb3fe30786593662458fecfc53eb))
- add local fs fallback when Supabase not configured, fix .ts imports ([9b50881](https://github.com/maniczko/audioRecorder/commit/9b50881f2ac379d1188c2110fa7c26d20d62a0d7))
- allow all CORS origins and make version mismatch non-blocking ([e15f2b4](https://github.com/maniczko/audioRecorder/commit/e15f2b41f5e4b23ed08692aeb77ffa326523079d))
- **api:** Add local proxy for voice profiles and update Studio player layout ([359fba3](https://github.com/maniczko/audioRecorder/commit/359fba3da061597ac4178c8f5d55fe7b222fd365))
- apply Fireflies layout to main StudioMeetingView as well ([d974a9f](https://github.com/maniczko/audioRecorder/commit/d974a9f945357a197e320845a024c4eb1e44c145))
- audio upload limits, retry resilience, and hydration race condition ([8461400](https://github.com/maniczko/audioRecorder/commit/846140088b8a3f44894122382316f4b7bddae7a2)), closes [WAV/hi#quality](https://github.com/WAV/hi/issues/quality)
- **audit:** security, performance and accessibility improvements ([e4d7ce3](https://github.com/maniczko/audioRecorder/commit/e4d7ce37d481e277658e4f01d926c709065c47b8))
- authorize transcription progress stream and normalize stt empty output ([a1af251](https://github.com/maniczko/audioRecorder/commit/a1af2511e05cdd84b099395753cbeb974e19ee0d))
- **auth:** raise login rate limit to 20/min, fix 429 and 503 messages ([71bee61](https://github.com/maniczko/audioRecorder/commit/71bee61be84217861078efb8ea3616dcc49eb671))
- **auth:** restore sync localStorage hydration for session state to prevent blank screen after login ([2081b8b](https://github.com/maniczko/audioRecorder/commit/2081b8baba1e91f4b12d1dfef73ba6c0d8e6a182))
- **auth:** return 4xx instead of 500 for auth errors ([a8d6903](https://github.com/maniczko/audioRecorder/commit/a8d6903051aa4ef0b946ee264aa31ead5744ddc9))
- **backend:** resolve audioPipeline property access error in TranscriptionService ([4b6293c](https://github.com/maniczko/audioRecorder/commit/4b6293c0f2e921efdfec0e523efa9a681d1614ef))
- **build:** add esbuild to devDependencies and use pnpm exec in Dockerfile to fix missing bin resolution ([a2a4276](https://github.com/maniczko/audioRecorder/commit/a2a42761dd679ee03fd42363396eabbf383c80ee))
- **build:** migrate react-window v2 List API, set Vite outDir to build, add storage tests ([ab40b84](https://github.com/maniczko/audioRecorder/commit/ab40b84a9e0a2cb4277ce7604350314af16d8942))
- **build:** resolve react-window Rollup missing export error in CommandPalette ([a01435b](https://github.com/maniczko/audioRecorder/commit/a01435bca681d7685e74e2eebb4ba80d70bb82e8))
- **build:** upgrade Tailwind CSS v3 to v4 to fix Vercel build errors ([74e5db4](https://github.com/maniczko/audioRecorder/commit/74e5db485e6ae1288e94da9f24757b978174c4b8))
- bypass vercel proxy for hosted api calls ([d733fb0](https://github.com/maniczko/audioRecorder/commit/d733fb070951413832968aa7ec77ef0dd2cd41b5))
- **ci:** add .aiderignore + workflows:write permission to fix push ([27fca7e](https://github.com/maniczko/audioRecorder/commit/27fca7ebe3373bea2a08fab805fd56ce176a008e))
- **ci:** add actions:write permission to trigger GPT Auto-Fix workflow ([fb79d79](https://github.com/maniczko/audioRecorder/commit/fb79d791237e0c0ca9f6cf51d9f8a799113a7f06))
- **ci:** add issues:write permission to smoke + GPT auto-fix workflow ([25a84e2](https://github.com/maniczko/audioRecorder/commit/25a84e2359615384d1c89d2db96e0943457e3632))
- **ci:** add models:read permission for GitHub Models API [skip ci] ([a67b500](https://github.com/maniczko/audioRecorder/commit/a67b500b0d48241f0b02ecc49829538ffc4ebf6d))
- **ci:** apply file-level ignore for react-hooks/exhaustive-deps in useWorkspaceData to unblock Vercel build ([bc37727](https://github.com/maniczko/audioRecorder/commit/bc3772774f12ba962976f3f5d8df25eb14c0f1ba))
- **ci:** force push gpt-fix branch to avoid stale branch conflict ([cba5d32](https://github.com/maniczko/audioRecorder/commit/cba5d32512fde468624b387c57886e1f3f201724))
- **ci:** force-reinstall aider>=0.60 to get litellm+Gemini support ([14d407d](https://github.com/maniczko/audioRecorder/commit/14d407d65efe03509c0a20915b77f2585da2189b))
- **ci:** improve GPT Auto-Fix — install deps, better context, stronger prompt ([f9a7f30](https://github.com/maniczko/audioRecorder/commit/f9a7f30b15da2e8d30e190319bea8e44eb7a5166))
- **ci:** increase E2E timeout 10→20min (Playwright browser install takes ~9min) [skip ci] ([bf7fad9](https://github.com/maniczko/audioRecorder/commit/bf7fad926cd7a3fcbd43c3341a365e6da5deb49b))
- **ci:** install setuptools in venv to fix pkg_resources missing ([0f72547](https://github.com/maniczko/audioRecorder/commit/0f72547d5a5ae432b139c37e6664086d67edccd1))
- **ci:** remove invalid workflows:write permission from gpt-fix ([f8cb7ef](https://github.com/maniczko/audioRecorder/commit/f8cb7ef6d8be0504ace215dc044f543888474709))
- **ci:** replace aider with direct Gemini API call via Node.js ([8c34991](https://github.com/maniczko/audioRecorder/commit/8c34991d0ec18bf81d9adf074b3c69f9a14478ee))
- **ci:** retry PR creation 3x + graceful fallback if GitHub API returns 502 [skip ci] ([c418da9](https://github.com/maniczko/audioRecorder/commit/c418da905ecc1e05532f2bfd405ae3cb6ded18a9))
- **ci:** set git remote URL with token before push in GPT Auto-Fix ([71ee665](https://github.com/maniczko/audioRecorder/commit/71ee6653aec8fcce55c593bbba363d7429d29002))
- **ci:** set PATH inline + remove unsupported aider flags ([f668324](https://github.com/maniczko/audioRecorder/commit/f6683244861af29b6d9518fdb1d0ed3dba1a0d73))
- **ci:** suppress react-hooks/exhaustive-deps false-positive in useWorkspaceData ([4f6f2f8](https://github.com/maniczko/audioRecorder/commit/4f6f2f808794e888515ba968250848c3c0db27a7))
- **ci:** switch to Gemini 2.0 Flash as primary AI model for auto-fix ([37a0429](https://github.com/maniczko/audioRecorder/commit/37a04295ff9dbf5c31f29742be426c3d5ff183f4))
- **ci:** switch to gemini-2.0-flash-lite model (1.5-flash deprecated) [skip ci] ([2e6029c](https://github.com/maniczko/audioRecorder/commit/2e6029c28f2cf43f95db17e8ae6168d3c72e4c66))
- **ci:** switch to GitHub Models (gpt-4o-mini) — no quota issues, uses GITHUB_TOKEN [skip ci] ([d2b3857](https://github.com/maniczko/audioRecorder/commit/d2b3857dcc58984d4a2766da4977bf091604ddb0))
- **ci:** trigger GPT Auto-Fix via workflow_dispatch instead of issues:opened ([6831123](https://github.com/maniczko/audioRecorder/commit/68311238af2ac79d275326a9fc3ee5bdce7ebc3e))
- **ci:** upgrade aider + fix PATH + use --yes flag for compatibility ([b4ec256](https://github.com/maniczko/audioRecorder/commit/b4ec256badcdefbae7c2c6bfa2d5f81b2443f31c))
- **ci:** use gemini-1.5-flash to avoid 429 rate limit on 2.0-flash ([faa9774](https://github.com/maniczko/audioRecorder/commit/faa97744fab5b503c3c6aa61408b4763db33e279))
- **ci:** use gpt-4o-mini + limit map-tokens to fix TPM rate limit ([c75d36b](https://github.com/maniczko/audioRecorder/commit/c75d36bf11d6c6d2c2c9df99442915c5090ce1fa))
- **ci:** use Python venv to isolate aider from system package conflicts ([56f7317](https://github.com/maniczko/audioRecorder/commit/56f7317887f7d7c2637c89dba343c622a4313853))
- **ci:** use uv tool install for aider to avoid pkg_resources issues ([97c2d4b](https://github.com/maniczko/audioRecorder/commit/97c2d4bb43ffb1f7fa6d3068c533b7e951a3e77a))
- **config:** tolerate blank stt provider env vars ([abd48cb](https://github.com/maniczko/audioRecorder/commit/abd48cb3a41bf6b34a3ad4a0649ceba11875bf88))
- **cors:** allow vercel auth preflight ([3be75c7](https://github.com/maniczko/audioRecorder/commit/3be75c7f08e646978d2eaf049dab42bc04843f0d))
- **cors:** ensure auth preflight headers are returned ([6cadd6f](https://github.com/maniczko/audioRecorder/commit/6cadd6f68ca04f13af8cf2d94fffba75c0f83c92))
- **cors:** handle auth preflight directly in router ([9783c01](https://github.com/maniczko/audioRecorder/commit/9783c012ed7b41826c75bf2fe70677111e750057))
- **css:** [401] Remove all !important declarations ([b88ff5d](https://github.com/maniczko/audioRecorder/commit/b88ff5ddc7e1366c1a3d31e342a8c3bb71ee177c))
- **css:** [402] Remove duplicate CSS blocks in tasks.css ([805250a](https://github.com/maniczko/audioRecorder/commit/805250a52dbae7187889280feeb166e7de905870))
- database initialization bug causing 502 Bad Gateway crash on startup ([9a7b523](https://github.com/maniczko/audioRecorder/commit/9a7b52382598f57965e8fbe01026cc45ed736a92))
- **db:** load worker using .js extension in production to fix DB hangs ([86388b8](https://github.com/maniczko/audioRecorder/commit/86388b8eeba1ec24807e8b57ed0e261fedd91bc9))
- **db:** make \_buildWorkspaceFromRow async and fix invalid this.db.prepare call ([e2b6a02](https://github.com/maniczko/audioRecorder/commit/e2b6a02fc222de8d6df796101ab9af2e210405b0))
- **db:** remove nonexistent meetings table indexes from migration 003 ([14be518](https://github.com/maniczko/audioRecorder/commit/14be5183bcd02ca73c1c7fa671d59b8c4d9a4ec6))
- **db:** replace SQLite-specific COLLATE NOCASE with portable LOWER() for Postgres compatibility ([d5c835c](https://github.com/maniczko/audioRecorder/commit/d5c835cf4ebe2ed528b1d8d354126b5bccc87125))
- **db:** skip comment-only SQL blocks in migrations + remove verification query with semicolon ([bc3a89e](https://github.com/maniczko/audioRecorder/commit/bc3a89e40ecec21ffa13712c8994e8fcbb127da6))
- delete persistence - remove locally first, pause remote polling to prevent race condition ([13430c8](https://github.com/maniczko/audioRecorder/commit/13430c894d16b128c5170fb75b2c6e2bff437555))
- disable service worker on ephemeral vercel previews ([a56b59c](https://github.com/maniczko/audioRecorder/commit/a56b59c55c343f5649fc0b2eba8e49a1fa9c38be))
- **disk:** add startup cleanup for temp audio files ([f34ec79](https://github.com/maniczko/audioRecorder/commit/f34ec799e5777d82f2b83396de59557f600399df))
- **docker:** Add pnpm-workspace.yaml to COPY for workspace resolution ([6538909](https://github.com/maniczko/audioRecorder/commit/6538909e80ca620778f8fcda3b89156283a1d881))
- **docker:** bundle @sentry/node to fix ERR_MODULE_NOT_FOUND ([9dedf77](https://github.com/maniczko/audioRecorder/commit/9dedf7771fbdccefe6c5152e13ffc9dc5742a03c))
- **docker:** copy uv binary into runtime stage to fix uv not found error ([5c7f9f7](https://github.com/maniczko/audioRecorder/commit/5c7f9f7b88977ad3886051a271f4e1f7d4fbe43a))
- **docker:** externalize all deps and copy server/node_modules to solve dynamic require crash ([0e65a5d](https://github.com/maniczko/audioRecorder/commit/0e65a5d8bf0ae2a129c777fe29b433e8bec12ec2))
- **docker:** install system python3 in torch-deps so venv symlinks work in runtime ([f8881e7](https://github.com/maniczko/audioRecorder/commit/f8881e73cf4f8bf6f136c1710bbc10a5e0d26d9c))
- **docker:** reduce image size by using CPU-only torch to respect Railway 4GB limit ([7b18eb2](https://github.com/maniczko/audioRecorder/commit/7b18eb22ca9db02cb41d2cd416499edb2f320466))
- **docker:** remove cache mount ID to fix Railway build error ([bdf94b3](https://github.com/maniczko/audioRecorder/commit/bdf94b397c4dce05b842f076e8f279ffd41d2a40))
- **docker:** restore backend fixes after conflicting branch merge ([4ce7388](https://github.com/maniczko/audioRecorder/commit/4ce7388e4abfe7e3787512278f4d0a102c0eebf9))
- **docker:** Switch Dockerfile from npm to pnpm to match packageManager ([5e98b17](https://github.com/maniczko/audioRecorder/commit/5e98b17f852531e2c998dec73d413023201c9b3a))
- **docker:** use stable Dockerfile syntax v1.4 and Node 22 LTS ([10e2fa3](https://github.com/maniczko/audioRecorder/commit/10e2fa33e46d4e7f5721b90c738862c9ab8218aa))
- **docker:** use static FFmpeg to prevent memory/dependency bloat breaking Railway builds ([da70461](https://github.com/maniczko/audioRecorder/commit/da70461dd2198971b21a7474657cc9b183692913))
- dodanie zadania i react-window ([8378808](https://github.com/maniczko/audioRecorder/commit/83788088978a2ef8d060d93f338f6b10e02cd5ac))
- **e2e:** add missing placeholders to registration form for Playwright tests ([f501827](https://github.com/maniczko/audioRecorder/commit/f50182749cef59fc4dcf9c9cb459fc88abda844f))
- **e2e:** align register button text between AuthScreen and tests ([6005968](https://github.com/maniczko/audioRecorder/commit/60059681e7ec8ddb4e92787efdda030a35f582ef))
- **e2e:** fix failing Playwright test selector for meeting recordings & clean duplicate tasks ([0e07089](https://github.com/maniczko/audioRecorder/commit/0e07089a9d93484ce8d44036f1a7830f8f07d19b))
- **e2e:** Update smoke test for new inline quick add UI ([0238b1b](https://github.com/maniczko/audioRecorder/commit/0238b1b772cc606f5f2eb160cc54b9ed1c260b73))
- **e2e:** use getByText instead of getByRole(heading) for task title assertion ([fb339c3](https://github.com/maniczko/audioRecorder/commit/fb339c356f9fca032e58ec47301ef9f14ca898e2))
- force split view layout with inline styles - two-column 50/50 grid for summary and transcript ([01e6e52](https://github.com/maniczko/audioRecorder/commit/01e6e524f29a67cf95b0cac21edd88001d095425))
- **frontend:** ensure localStorage is written synchronously to prevent login race condition ([7c4db55](https://github.com/maniczko/audioRecorder/commit/7c4db55f6e1effbb259c17be1a79779060bb2486))
- **frontend:** Set railway base url as Vite fallback on production ([126b50f](https://github.com/maniczko/audioRecorder/commit/126b50f0b663a0e7d3279b03c2a6fb55572062ed))
- **frontend:** stop showing stale-runtime message on temporary Railway 502s ([98d758b](https://github.com/maniczko/audioRecorder/commit/98d758bed3557d515b4cc1f526d6c379c0fe9679))
- harden hosted preview runtime and cors regressions ([fcd3a8c](https://github.com/maniczko/audioRecorder/commit/fcd3a8c07117d554e8f0bcdbf019c1cf1d221d7b))
- harden hosted runtime against stale preview caches ([bfabb0f](https://github.com/maniczko/audioRecorder/commit/bfabb0f857c64feb998cf938c376432e2781992d))
- harden imported audio transcript and studio playback ([dcc3425](https://github.com/maniczko/audioRecorder/commit/dcc3425d3413a64a5ec2b85964b46059a33a7751))
- harden imported mp3 transcription and player scrubber ([cbed08d](https://github.com/maniczko/audioRecorder/commit/cbed08d1f9b74a4357bdedb6cf1675988c430d2f))
- harden imported mp3 transcription and preview runtime ([aefb0c3](https://github.com/maniczko/audioRecorder/commit/aefb0c31e3fc922d5938cf1b1e210cffa94f9a28))
- **health-probe:** prevent concurrent /health requests causing CORS spam ([c6b1e96](https://github.com/maniczko/audioRecorder/commit/c6b1e96dcd15aab64e0871492eba2fc214b01746))
- **hydration:** don't premature-clear isHydratingRemoteState when guard blocks concurrent bootstrap ([880b008](https://github.com/maniczko/audioRecorder/commit/880b008a411a3a1efcd12eccd34e10f7a30c1b9e))
- import styles to ensure new layout renders ([d1da90e](https://github.com/maniczko/audioRecorder/commit/d1da90ed8d770ebc947f21b28db3926b0244e696))
- instalacja brakujacych idb-keyval i zustand zrywających build, testy zapobiegawcze idb ([5e14cc5](https://github.com/maniczko/audioRecorder/commit/5e14cc5363bae2a164e4dd3cc7423f688b86e9e6))
- make runtime healthchecks honor dynamic port ([986ff8b](https://github.com/maniczko/audioRecorder/commit/986ff8bc6dd0b960562d7d4f9851cdccec3c30c4))
- **meetings:** ensure currentWorkspaceId is passed and add test ([b83a604](https://github.com/maniczko/audioRecorder/commit/b83a604d957fc51bb327a9f23991a3ffe2fa7aa7))
- naprawa błędu STT fetch failed - zwiększony timeout i mniejszy concurrency ([5f59bfd](https://github.com/maniczko/audioRecorder/commit/5f59bfd1beb6bc6fa09e1d8962f4416538ddbfde))
- naprawa zmiennych srodowiskowych logowania; dodanie local providera do testow e2e ([cdda1ff](https://github.com/maniczko/audioRecorder/commit/cdda1ff0b7bc97e1b256b15c173745caf94671f5))
- normalize queue fetch failures for recording pipeline ([ae57cf4](https://github.com/maniczko/audioRecorder/commit/ae57cf44cddb03904e39627feee5d7f9e28acefb))
- pelna aktualizacja pipelines i migracji testow serwera na Vitest ([03e4532](https://github.com/maniczko/audioRecorder/commit/03e45323926b9e466a1dcfc35c6930616076f178))
- persist session token for remote api auth ([edc11bc](https://github.com/maniczko/audioRecorder/commit/edc11bcc5e9f5a6e68085df9f731d242cca5c934))
- pre-download ML models during Docker build and set cache path ([5bcf8c6](https://github.com/maniczko/audioRecorder/commit/5bcf8c60b3170f4929d6fb0fe30e810b3ba9a83a))
- prefer platform port in production runtime ([1907270](https://github.com/maniczko/audioRecorder/commit/19072708e1d5d9d539e35b2750935d1733a2e2a2))
- **prod:** remove buildkit cache mounts and reset studio landing ([b1161d8](https://github.com/maniczko/audioRecorder/commit/b1161d84f127b34bca86ce7fd4f3f7fe5b5ef0ec))
- production bug fixes and improvements ([84b044a](https://github.com/maniczko/audioRecorder/commit/84b044ae2ad73e100443b3e5e8d8f3dd5d02c772))
- production stability, detailed logging, and case-insensitive Vercel CORS ([ad7f200](https://github.com/maniczko/audioRecorder/commit/ad7f20073ecf2f8a2b7feee87cc138ba3502e0f0))
- **recorder:** resolve manifest 401 error, hide google env chip, and improve recording queue resilience ([531bd13](https://github.com/maniczko/audioRecorder/commit/531bd130edd0ecef342108826317f1ee203650a8))
- **recordings:** resolve crash when tags is an array & mislabelled error boundary ([385efd0](https://github.com/maniczko/audioRecorder/commit/385efd07f250c73948cdad44483bd22377f47a33))
- recover transcript from word-level stt output ([148a6e8](https://github.com/maniczko/audioRecorder/commit/148a6e8088582e5fdf5c59a75aeb9995dfb5ee95))
- rehydrate remote auth session for protected api flows ([fbace0c](https://github.com/maniczko/audioRecorder/commit/fbace0c42f2e9e959ad1f5f4b9f4fc3161ea5fee))
- remove unused 'auth' variable in UIContext to fix CI build ([f9a661e](https://github.com/maniczko/audioRecorder/commit/f9a661e294c3b8b64e7306eaa30e310bbf51b803))
- replace process.env with import.meta.env for Vite compatibility ([f80f994](https://github.com/maniczko/audioRecorder/commit/f80f994710f7e64367d05f18b079427992826d63))
- resolve CI build errors (unused-vars and useEffect dependencies) ([2131e14](https://github.com/maniczko/audioRecorder/commit/2131e140363af1c07cc07cf6c5a679d5691672bb))
- resolve CI build errors in useAudioHardware.js (remove unused variables) ([f3c3fe7](https://github.com/maniczko/audioRecorder/commit/f3c3fe762a87c482400888dcd7acb1d4c4626d43))
- resolve failing e2e tests and add deleteMeeting hook method ([5f8f7c6](https://github.com/maniczko/audioRecorder/commit/5f8f7c6cdb7c29bb91c97504bd80df9df8d46275))
- resolve Rolldown Vite manualChunks signature and optimize CI pipeline to catch build errors instantly ([1b4c693](https://github.com/maniczko/audioRecorder/commit/1b4c693d06a9e408db7854fb0afd7888180f5c1e))
- resolve stale Response in httpClient tests and achieve stable green CI ([0492c4b](https://github.com/maniczko/audioRecorder/commit/0492c4be5f18d7be2530d94ef339687fb481b795))
- resolve TS test configuration and lint warnings to fix CI pipeline ([c1b688c](https://github.com/maniczko/audioRecorder/commit/c1b688cbe8b69ebfe04cc412f3f05ce642ab1258))
- restore remote auth envs and CI build ([94f662e](https://github.com/maniczko/audioRecorder/commit/94f662e560094a12aeb19600ca0e1c0ab783699e))
- return proper 400/401 status codes on auth errors instead of 500 ([6aaa7d3](https://github.com/maniczko/audioRecorder/commit/6aaa7d380cadbacf4a2d765944d5482a25db2d10))
- route hosted frontend api calls through vercel proxy ([3674e3f](https://github.com/maniczko/audioRecorder/commit/3674e3fb51087bb6e836135549222f7aa292df95))
- **server:** export VAD_ENABLED from transcription.ts to fix ReferenceError in pipeline ([b48036d](https://github.com/maniczko/audioRecorder/commit/b48036d7a0c0d8f76f6f237a0d41a7c6c1497eba))
- **server:** fall back to writable upload dirs ([016cae9](https://github.com/maniczko/audioRecorder/commit/016cae91568a9516e139d878e3c84a525e384a61))
- **server:** match 'Failed to fetch' in isRetryableNetworkError ([2dbc778](https://github.com/maniczko/audioRecorder/commit/2dbc778b763456d60404ebd14e0920819c33bde8))
- **server:** prevent 401 on unknown routes ([9890ecd](https://github.com/maniczko/audioRecorder/commit/9890ecd7291ac65e40ee4a1872273eac5e0d2fb1))
- set server host to 0.0.0.0 and improve Vercel CORS regex ([00324fe](https://github.com/maniczko/audioRecorder/commit/00324fe3f262a43b60db590124835618cc0aa34f))
- **speech:** suppress console.error for aborted SpeechRecognition events ([c537a64](https://github.com/maniczko/audioRecorder/commit/c537a64b24f0620728411d2e568e0d8f7003437d))
- stop audio hydration retry spam for deleted recordings ([1830d51](https://github.com/maniczko/audioRecorder/commit/1830d51c19f8b8f3151a18225257906f11b1b7eb))
- stop service worker from intercepting remote api ([ab54e32](https://github.com/maniczko/audioRecorder/commit/ab54e3266d7f599f6dc337bdd88a41d59db0203a))
- **stt:** auto-enable Groq fallback when API key is available ([f048a2b](https://github.com/maniczko/audioRecorder/commit/f048a2b4c8fcd7c6a9074150781b14d124833c91))
- **stt:** correct model format + add Groq per-provider model override ([bad6db8](https://github.com/maniczko/audioRecorder/commit/bad6db8a6bd16aafee461aabba6bbf32af580272))
- **stt:** handle FormData in httpClient — was JSON.stringify-ing audio ([07315ce](https://github.com/maniczko/audioRecorder/commit/07315ce2ba45809962ee18c65ccaa435bec40d5c))
- **stt:** log network error cause and provider URL at startup ([ad8ffa5](https://github.com/maniczko/audioRecorder/commit/ad8ffa504e8b2343ad6ded15632230407e9d025d))
- **stt:** pass signal to httpClient, fix retry-on-timeout, add tests ([41238c2](https://github.com/maniczko/audioRecorder/commit/41238c2f6b1456b148915d9309df4b20fe9a7b0b))
- **stt:** remove invalid Keep-Alive header causing all STT to fail ([4d2787e](https://github.com/maniczko/audioRecorder/commit/4d2787e4abd94507e006ccf8733800959bc48ad3))
- **studio:** fix undefined setRecordingMessage prop ([29abf78](https://github.com/maniczko/audioRecorder/commit/29abf78e2f0789e8a8a00dd17ce547d8d12a57b2))
- **studio:** show recording view when recording without a selected meeting ([91344a0](https://github.com/maniczko/audioRecorder/commit/91344a02334cc765ce968951e3cb637b295270c1))
- suppress testing-library lint errors in test files; add TranscriptionService regression test ([9f6985e](https://github.com/maniczko/audioRecorder/commit/9f6985e00be9589643e73b18a07782aba691126f))
- sync local changes with production ([92e4cf7](https://github.com/maniczko/audioRecorder/commit/92e4cf7343bfcde8724ca20a16e8d7452294bd42))
- **test:** register user correctly before checking workspace authorization in auth.test.ts ([d4551c7](https://github.com/maniczko/audioRecorder/commit/d4551c7c9815b46094b8172768584c487d2ea749))
- **tests:** naprawa failing CI tests (dockerfile + workspaces) ([11c0f91](https://github.com/maniczko/audioRecorder/commit/11c0f9118f3aebbd7d504410261dd22cb29d6d49))
- **tests:** remove broken services tests + revert intentional fail in appState.test ([27185fa](https://github.com/maniczko/audioRecorder/commit/27185fa0b8d74f6c64678ec1686af802a526620b))
- **tests:** Remove fake timers from httpClient tests ([8fa784f](https://github.com/maniczko/audioRecorder/commit/8fa784f9e76264d26d6693174be53e6a0a4ba337))
- treat empty STT output as completed transcript ([06e9456](https://github.com/maniczko/audioRecorder/commit/06e9456c597eeaddb4d42bbc4a19f1cc1230311b))
- TypeScript configuration and critical fixes ([df5f85d](https://github.com/maniczko/audioRecorder/commit/df5f85d1dd4d2c0f91a254fd1d2e363d3167c59f))
- **ui:** avoid stale recording hydration spam ([28361e5](https://github.com/maniczko/audioRecorder/commit/28361e5642f09b50602ec6a80ba6d6b111964924))
- **ui:** persist meeting deletion immediately ([9738e19](https://github.com/maniczko/audioRecorder/commit/9738e19325709e45ef660de96d93cf538744cd19))
- **ui:** restore ad hoc recording navigation ([d5f8aee](https://github.com/maniczko/audioRecorder/commit/d5f8aeecc32e8d5db28e2705b7355603d44cccae))
- unblock ci lint and server coverage ([9b91c8b](https://github.com/maniczko/audioRecorder/commit/9b91c8bae5584c67345aeeffa3377bf8c418bf8a))
- update pnpm lockfile ([4fc29b9](https://github.com/maniczko/audioRecorder/commit/4fc29b94fcba2eaca2b256b55415074e2bfabd56))
- **vercel:** inject production environment fallbacks for Railway API to avoid local mode mock ([5cd8a74](https://github.com/maniczko/audioRecorder/commit/5cd8a744993a0793eead2998befe7cfb1d1cb8ee))
- **vercel:** polyfill rollup-plugin-visualizer for Vite 8 Vercel crash ([7e5754e](https://github.com/maniczko/audioRecorder/commit/7e5754ed3296bd066af9c1d48979524059085f7a))
- WaitLM tokenizer download error in speakerEmbedder and init script ([cbee981](https://github.com/maniczko/audioRecorder/commit/cbee981412bf55068c57b469def870dbb8a03908))

### Features

- add 'Nagrania' tab, move meeting selection there, and implement global 401 session fix ([1293380](https://github.com/maniczko/audioRecorder/commit/12933806c6126cdeebd5c10cf9c91e295b50e283))
- add AI automation and performance optimization tasks ([228c81a](https://github.com/maniczko/audioRecorder/commit/228c81aeb39601fdc73f6b9b32f2a6c94518d961))
- add backend version diagnostics and retryable transcription ([cd66970](https://github.com/maniczko/audioRecorder/commit/cd66970a3bb314a270fcf9f730716d42450b916f))
- Add Beaver theme, fix recording button message, and optimize Supabase login latency ([e538cd1](https://github.com/maniczko/audioRecorder/commit/e538cd17a686e8530637a56f04e128864b973cc1))
- Add comprehensive unit tests and fix integration tests ([956c2bf](https://github.com/maniczko/audioRecorder/commit/956c2bf86b6d6e1787a5523b030f71cbd58ed46d))
- add icons to tab navigation menu ([bb2d773](https://github.com/maniczko/audioRecorder/commit/bb2d7738735d30449cd980935d8756e0ed07d570))
- **components:** [403] Add reusable ProgressBar component ([0a4b0ef](https://github.com/maniczko/audioRecorder/commit/0a4b0efb865d65e20d172938aa90070120c2c6c5))
- comprehensive audit fixes P01-P04 ([2559837](https://github.com/maniczko/audioRecorder/commit/2559837c1c6278bb97f8eb4d94e86c031dfd3109))
- **css:** [404] Add comprehensive design tokens ([a24b617](https://github.com/maniczko/audioRecorder/commit/a24b6172377c91ce663e4aee48bf633c5d69f86f))
- **docker:** [101-104] Docker security and reproducibility improvements ([2ad9dcc](https://github.com/maniczko/audioRecorder/commit/2ad9dcca79f651b443924c33abfa56b04007d8f2))
- **frontend:** add meetings list table to Recordings tab ([ecc2bf2](https://github.com/maniczko/audioRecorder/commit/ecc2bf2190a6d7fcaf79e551c93edac41a478a86))
- implement Fireflies / AskFred transcription layout specs ([48d2ddc](https://github.com/maniczko/audioRecorder/commit/48d2ddc6d9012795077eee2b2a84d4f4f8af3f23))
- **kanban:** Improve drag and drop UX ([67819b5](https://github.com/maniczko/audioRecorder/commit/67819b5db038e9a3da5230933ee2f13453552e9d))
- migracja do Vite.js oraz TurboRepo dając ultraszybkie deploymenty ([56bad91](https://github.com/maniczko/audioRecorder/commit/56bad91513b3c63e27935a3c0aa6ee280144a37d))
- migrate audio storage to Supabase Storage + add delete recording feature ([6c9b0b1](https://github.com/maniczko/audioRecorder/commit/6c9b0b104291ca80aab180c32d5b693c0225c128))
- migrate entire project to TypeScript extensions ([05dfdde](https://github.com/maniczko/audioRecorder/commit/05dfdde780441069b8e2f50360926789658b5318))
- pelna migracja do pnpm, turbo i vite z optymalizacja CI/CD ([fbb350b](https://github.com/maniczko/audioRecorder/commit/fbb350bcd22372c48b4cef6479aa1c203859515d))
- **player:** improve player bar status and add retry button ([d00b9bc](https://github.com/maniczko/audioRecorder/commit/d00b9bcc74e400d7bd82426d2c8b3c048c671227))
- rewrite backend to hono, configure turborepo build system, refine test configs ([9d74b66](https://github.com/maniczko/audioRecorder/commit/9d74b66b7ce4205508147372a0590f20f887f334))
- rozszerzone testy sqliteWorker.ts (~85-90% coverage) + helper functions ([e970144](https://github.com/maniczko/audioRecorder/commit/e97014409335a0377bc7af21eb2c822f0ecf21c6))
- **settings:** add changelog section to profile tab ([c966c03](https://github.com/maniczko/audioRecorder/commit/c966c0395900fab32ec8c43c9468608ab0963777))
- setup Docker and Compose for ML native dependencies ([924d6f4](https://github.com/maniczko/audioRecorder/commit/924d6f40f6952e1c2f471dc99131383e34a8ee6e))
- show live recording pipeline status in recordings tab ([a2c8151](https://github.com/maniczko/audioRecorder/commit/a2c815166ce51f51f15c26480ea2fdd2fbcf416b))
- show recording pipeline progress ([6b2c17a](https://github.com/maniczko/audioRecorder/commit/6b2c17a807ad31eaba59c62ac5aa5d4229a8647c))
- **studio:** add 4 intelligence tabs to meeting view (Summary, Needs, Profile, Feedback) ([7382647](https://github.com/maniczko/audioRecorder/commit/73826476e2bd4faacc65a8eb34424eda30b8d9e3))
- **studio:** populate intelligence tabs (Summary, Needs, Profile, Feedback) with AI data and styling ([67a3a40](https://github.com/maniczko/audioRecorder/commit/67a3a400b3f88fdc689e47ba17df4c4b02492550))
- **studio:** remove AskFred, improve layout ratio, and fix player bar visibility on errors ([76ff403](https://github.com/maniczko/audioRecorder/commit/76ff403a6f974a5c9b3ae8ec199790623f67b23e))
- surface imported recordings immediately with queue status ([cdef84f](https://github.com/maniczko/audioRecorder/commit/cdef84f70ee551f635c450da552bcbd8b3227a4d))
- switch to hono adapter ([e671bf2](https://github.com/maniczko/audioRecorder/commit/e671bf29651a0e3e0a3919ef6d8f690f52447c2e))
- **tasks:** add big green quick add button ([a01c0f6](https://github.com/maniczko/audioRecorder/commit/a01c0f64c991e52f61041adfc44fe0a415ab2288))
- **ui:** add base-ui theme scaffolding and workspace updates ([45f33a0](https://github.com/maniczko/audioRecorder/commit/45f33a0477b136bdc47e7df9d46c16886e73c39c))
- **ui:** Add Flat Design layout preset ([332a2cd](https://github.com/maniczko/audioRecorder/commit/332a2cd0daa0c2b7a1c1abdb8b3df1a17b0085cc))
- **ui:** add inline speaker edit and low confidence warning in transcript panel ([35fe09b](https://github.com/maniczko/audioRecorder/commit/35fe09b2cef24260ce21301df83632c706f429bd))
- **ui:** close meeting brief form when canceling or saving ([bd8686c](https://github.com/maniczko/audioRecorder/commit/bd8686cba131bfc9b6b9e73affee95237d67dc2a))
- **ui:** convert AiTaskSuggestionsPanel into a dedicated 'Zadania' tab ([b3d91db](https://github.com/maniczko/audioRecorder/commit/b3d91db3ca292a90e7c363418b1174d6abd03b94))
- **ui:** Make meeting title creatively editable inline in StudioView ([61f9344](https://github.com/maniczko/audioRecorder/commit/61f9344a4f8a8cc48e4700b2e7cdc2af1b3556bc))
- **ui:** make player bar full-width and fix total duration display ([78d625d](https://github.com/maniczko/audioRecorder/commit/78d625d3a5679db1bbb96ef9d7016e844c929e3a))
- **ui:** Merge Quick Add with toolbar + fix test ([f41a879](https://github.com/maniczko/audioRecorder/commit/f41a87981cc59e5174476625b58bcc955a39a588))
- **ui:** set summary as default analysis tab ([0672645](https://github.com/maniczko/audioRecorder/commit/0672645a00aaaadc5fc008d67da49a0bb2851de0))
- **ui:** show STT error message in recording diagnostics panel ([1259d19](https://github.com/maniczko/audioRecorder/commit/1259d196051a10b045bc12045f65ebaaf8079c77))
- **ui:** split monolithic CSS into per-tab modules, add mobile 1fr workspace grid, and implement global Skeleton Loader states ([adaf5f8](https://github.com/maniczko/audioRecorder/commit/adaf5f8933ec9d9efe19e2c724d9eaebb7e667f5))
- **ui:** Standardize layout with WorkspaceSidebar and Forms UI Kit ([1c163c0](https://github.com/maniczko/audioRecorder/commit/1c163c024e9b90f4510afee90dc83d72a9991f4d))
- **ui:** unify recordings list, add tags column and filtering by date and tags ([bf75a4f](https://github.com/maniczko/audioRecorder/commit/bf75a4fe1fc92d633614d051c825d7eb493ede47))
- **ui:** update normalization button to indicate noise reduction ([d692ad1](https://github.com/maniczko/audioRecorder/commit/d692ad15fcd548b4926b0f164e86c94ca4d0a63b))

### Performance Improvements

- [301] parallel VAD + diarization processing ([f3177af](https://github.com/maniczko/audioRecorder/commit/f3177afeb85b3ce136626661a58e0966e7c5874e))
- [303] Adaptive overlap for STT chunking ([24f3972](https://github.com/maniczko/audioRecorder/commit/24f3972bb4f9a369a73ce8aeaf36cdf639319f8c))
- [320] HTTP/2 + keep-alive for external APIs ([38d1350](https://github.com/maniczko/audioRecorder/commit/38d1350c03c9d483cc8fdb99258ed80d0bcfd778))
- [320] Update providers to use HTTP keep-alive ([37dcdee](https://github.com/maniczko/audioRecorder/commit/37dcdeef732b4140ee13ae70c8dee7f6adcf22b7))
- **audio:** Fast seeking with ffmpeg, chunk caching and local asset materialization ([a876b58](https://github.com/maniczko/audioRecorder/commit/a876b580ad1d77fc2c36768de83fe82bd11364d5))
- drastically improve application scaling and caching ([b6ebd53](https://github.com/maniczko/audioRecorder/commit/b6ebd53685840b1235d30956f1c9d38465bd6eae))
- **frontend:** add memoization and code splitting for task views ([4d2239d](https://github.com/maniczko/audioRecorder/commit/4d2239df4b82513a5d0ee8b4bdc19e3604e7de28))
- pipeline audio optimizations ([45b5654](https://github.com/maniczko/audioRecorder/commit/45b5654d107e29c136462e98ebe996613be1c540))

# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.0.0](2026-03-24)

### Features

- Initial release
- Automated testing suite
- CI/CD pipeline
- Pre-commit hooks
- AI-powered auto-fix
- Smart linting
- Security auto-patch
- Code migration scripts
- Automated documentation

### Bug Fixes

- Various bug fixes and improvements

### Performance

- Optimized CI/CD pipeline (50% faster)
- Smart lint staging (50% faster commits)

### Documentation

- Automated documentation generation
- Comprehensive automation guides
