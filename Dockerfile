# ==========================================
# STAGE 1: Build (TypeScript Compilation)
# ==========================================
FROM node:22.12-bookworm-slim AS builder

# Install pnpm globally (matching packageManager version)
RUN corepack enable && corepack prepare pnpm@9.12.1 --activate

WORKDIR /app

# Copy only manifest + lockfile + workspace config for maximum Docker cache efficiency
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package*.json ./server/

# Install everything including dev dependencies so we get esbuild/typescript
RUN pnpm install --frozen-lockfile

# Copy server code and shared types used by server imports
COPY server/ ./server/
COPY src/shared/ ./src/shared/

# Transpile TS -> JS using esbuild into dist-server/
RUN pnpm exec esbuild server/index.ts server/sqliteWorker.ts --bundle --platform=node --format=esm --outdir=dist-server --packages=external

# Extract ffmpeg/ffprobe binaries from npm packages into /tmp for stage 2
RUN node -e " \
  const fs=require('fs'); \
  const ffmpeg=require('ffmpeg-static'); \
  const ffprobe=require('ffprobe-static').path; \
  fs.copyFileSync(ffmpeg,'/tmp/ffmpeg'); \
  fs.copyFileSync(ffprobe,'/tmp/ffprobe'); \
  fs.chmodSync('/tmp/ffmpeg',0o755); \
  fs.chmodSync('/tmp/ffprobe',0o755);"

# Prune node_modules down to only production dependencies to save space
RUN pnpm prune --prod


# ==========================================
# STAGE 2: Production Release
# ==========================================
FROM node:22.12-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Etc/UTC

# Copy static ffmpeg binaries from builder (avoids re-download and OOM)
COPY --from=builder /tmp/ffmpeg /usr/local/bin/ffmpeg
COPY --from=builder /tmp/ffprobe /usr/local/bin/ffprobe

# Install Python and runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-venv xz-utils bash ca-certificates libgomp1 libsndfile1 wget curl && \
    rm -rf /var/lib/apt/lists/*

# Install uv via official installer — avoids Docker Hub / ghcr.io registry dependency
RUN curl -LsSf https://astral.sh/uv/install.sh | UV_INSTALL_DIR=/usr/local/bin sh

# Create virtual environment and activate it permanently for the container
RUN uv venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Cache ML dependencies layer efficiently so Docker reuses it when JS/TS bits change
COPY server/requirements.txt ./server/
# Install CPU-only PyTorch first (saves ~6GB of image space), then the rest without caching wheels
RUN uv pip install --no-cache --index-url https://download.pytorch.org/whl/cpu torch torchaudio && \
    uv pip install --no-cache -r server/requirements.txt

# Copy production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/package.json ./

# Copy compiled backend code instead of raw TS
COPY --from=builder /app/dist-server ./server

# Copy python scripts separately since esbuild doesn't transpile .py
COPY server/*.py ./server/

# Copy server package mapping (optional if needed for runtime)
COPY server/package*.json ./server/

# Copy SQL migrations for database setup
COPY server/migrations/ ./server/migrations/

# Ensure data directories exist
RUN mkdir -p /data/uploads

ENV NODE_ENV=production
ENV VOICELOG_API_HOST=0.0.0.0
ENV FFMPEG_BINARY=ffmpeg
ENV PYTHON_BINARY=python3
ENV VOICELOG_DB_PATH=/data/voicelog.sqlite
ENV VOICELOG_UPLOAD_DIR=/data/uploads

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT:-${VOICELOG_API_PORT:-4000}}/health || exit 1

EXPOSE 4000

# Execute natively instead of using tsx (huge memory savings & instant boot)
CMD ["node", "server/index.js"]
