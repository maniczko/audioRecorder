# syntax=docker/dockerfile:1.4

# Use official Node.js LTS image
# Note: Digest pinning removed for reliability - use version tags instead
ARG NODE_IMAGE=node:22.14-bookworm-slim

FROM ${NODE_IMAGE} AS base

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

RUN corepack enable && corepack prepare pnpm@9.12.1 --activate

WORKDIR /app


FROM base AS deps

COPY --link package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --link server/package.json ./server/package.json

RUN pnpm install --frozen-lockfile


FROM deps AS build

COPY --link server/ ./server/
COPY --link src/shared/ ./src/shared/

RUN pnpm exec esbuild server/index.ts server/sqliteWorker.ts \
    --bundle \
    --platform=node \
    --format=esm \
    --outdir=dist-server \
    --packages=external

RUN node -e " \
  const fs=require('fs'); \
  const path=require('path'); \
  const pnpmDir='/app/node_modules/.pnpm'; \
  const ffmpegPkg=fs.readdirSync(pnpmDir).find((name)=>name.startsWith('ffmpeg-static@')); \
  const ffprobePkg=fs.readdirSync(pnpmDir).find((name)=>name.startsWith('ffprobe-static@')); \
  if(!ffmpegPkg || !ffprobePkg){ throw new Error('Missing ffmpeg-static or ffprobe-static in pnpm store'); } \
  const ffmpeg=require(path.join(pnpmDir,ffmpegPkg,'node_modules','ffmpeg-static')); \
  const ffprobe=require(path.join(pnpmDir,ffprobePkg,'node_modules','ffprobe-static')).path; \
  fs.copyFileSync(ffmpeg,'/tmp/ffmpeg'); \
  fs.copyFileSync(ffprobe,'/tmp/ffprobe'); \
  fs.chmodSync('/tmp/ffmpeg',0o755); \
  fs.chmodSync('/tmp/ffprobe',0o755);"

FROM build AS prod-deps

ENV HUSKY=0

RUN pnpm deploy --filter voicelog-api --prod /prod/server



FROM ${NODE_IMAGE} AS runtime

ARG APP_UID=10001
ARG APP_GID=10001

ENV NODE_ENV=production
ENV TZ=Etc/UTC
ENV VOICELOG_API_HOST=0.0.0.0
ENV FFMPEG_BINARY=ffmpeg
ENV VOICELOG_DB_PATH=/data/voicelog.sqlite
ENV VOICELOG_UPLOAD_DIR=/data/uploads
ENV NODE_OPTIONS="--max-old-space-size=384"

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      tini && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd --gid "${APP_GID}" app && \
    useradd --uid "${APP_UID}" --gid "${APP_GID}" --create-home --shell /usr/sbin/nologin app

WORKDIR /app

COPY --link --from=build /tmp/ffmpeg /usr/local/bin/ffmpeg
COPY --link --from=build /tmp/ffprobe /usr/local/bin/ffprobe
COPY --link --chown=10001:10001 --from=prod-deps /prod/server/node_modules ./server/node_modules
COPY --link --chown=10001:10001 --from=prod-deps /prod/server/package.json ./server/package.json
COPY --link --chown=10001:10001 --from=build /app/dist-server ./server
COPY --link --chown=10001:10001 server/migrations/ ./server/migrations/

RUN mkdir -p /data/uploads /app/server/data && \
    chown -R app:app /data /app/server/data

USER app

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "const port = Number(process.env.PORT || process.env.VOICELOG_API_PORT || 4000); const http = require('node:http'); const req = http.get({ host: '127.0.0.1', port, path: '/health', timeout: 5000 }, (res) => process.exit(res.statusCode === 200 ? 0 : 1)); req.on('error', () => process.exit(1)); req.on('timeout', () => { req.destroy(); process.exit(1); });"

EXPOSE 4000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server/index.js"]
