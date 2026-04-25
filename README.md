# VoiceLog OS / audioRecorder

VoiceLog OS is an AI-first meeting recorder and analysis workspace. The app records audio in the browser, uploads or stores it through the selected media mode, runs transcription and diarization, then turns the transcript into summaries, decisions, and action items.

## Stack

- Frontend: React 19, TypeScript, Vite, Zustand, TailwindCSS, shadcn/ui patterns.
- Backend: Hono on Node.js 22, LangChain/LangGraph integrations, SQLite locally, PostgreSQL/Supabase for production-style deployments.
- Testing: Vitest, Testing Library, Playwright.
- Package manager: pnpm 9.12.1.

## Quick Start

Use Node.js 22.x and pnpm from the repository root.

If you use `nvm`:

```bash
nvm use
```

If you use `fnm`:

```bash
fnm use
```

```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm run start:server:watch
pnpm start
```

Default local ports:

- Frontend: `http://localhost:3000`
- Backend API: `http://127.0.0.1:4000`

## Runtime Modes

Remote mode:

```env
VITE_DATA_PROVIDER=remote
VITE_MEDIA_PROVIDER=remote
VITE_API_BASE_URL=http://127.0.0.1:4000
```

Local mode:

```env
VITE_DATA_PROVIDER=local
VITE_MEDIA_PROVIDER=local
```

Remote mode is the preferred development path for audio pipeline work because it exercises upload, processing, transcription status, and backend auth boundaries.

## Audio Pipeline

The critical flow is:

1. Browser microphone capture through `MediaRecorder`.
2. Optional client-side silence filtering and audio enhancement.
3. Queue orchestration in `src/store/recorderStore.ts`.
4. Per-item processing in `src/store/recorderQueueProcessor.ts`.
5. Backend upload/transcription/diarization status polling.
6. Meeting attachment, transcript persistence, AI analysis, and UI completion state.

Important queue statuses:

- `queued`
- `uploading`
- `processing`
- `diarization`
- `review`
- `failed`
- `failed_permanent`
- `done`

## Required Verification

All gates should run on Node.js 22.x. If pnpm reports an unsupported engine warning, switch to the pinned version from `.nvmrc` / `.node-version` before treating the result as release-ready.

For focused frontend changes:

```bash
pnpm run typecheck
pnpm run lint:all
pnpm exec vitest run src/path/to/file.test.ts --coverage.enabled=false
```

For backend changes:

```bash
pnpm run typecheck:server
pnpm run test:server:retry
```

For release readiness:

```bash
pnpm run typecheck:all
pnpm run lint:all
$env:NODE_OPTIONS='--max-old-space-size=8192'; pnpm run test:frontend:ci
pnpm run test:server:retry
pnpm run build
```

## Quality Gates

See:

- `AGENTS.md` for the canonical agent workflow.
- `docs/README.md` for the documentation map.
- `docs/QUALITY_GATES.md` for merge and release gates.
- `docs/AUTOMATION_POLICY.md` for auto-fix and auto-PR rules.
- `ARCHITECTURE.md` for system boundaries and major flows.

## Release Notes

Releases use conventional commits and `CHANGELOG.md`.

```bash
pnpm run release
git add package.json CHANGELOG.md
git commit -m "fix(audio): stabilize recorder queue processing"
git tag vX.Y.Z
```
