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

# Copy server code
COPY server/ ./server/

# Transpile TS -> JS using esbuild into dist-server/
RUN find server -name "*.ts" -o -name "*.js" | xargs npx esbuild --outdir=dist-server --platform=node --format=cjs

# Prune node_modules down to only production dependencies to save space
RUN pnpm prune --prod


# ==========================================
# STAGE 2: Production Release
# ==========================================
FROM node:22.12-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Etc/UTC

# Install Python and dependencies, skip ffmpeg apt package to avoid heavy GPU/X11 libraries which cause Railway OOM
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-venv wget xz-utils bash ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install static FFmpeg build directly
RUN wget -q https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz && \
    tar xf ffmpeg-release-amd64-static.tar.xz && \
    mv ffmpeg-*-amd64-static/ffmpeg /usr/local/bin/ && \
    mv ffmpeg-*-amd64-static/ffprobe /usr/local/bin/ && \
    rm -rf ffmpeg-*-amd64-static*

# Install uv (astronomically fast API from Astral) to build python modules 100x faster
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Create virtual environment and activate it permanently for the container
RUN uv venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Cache ML dependencies layer efficiently so Docker reuses it when JS/TS bits change
COPY server/requirements.txt ./server/
RUN uv pip install -r server/requirements.txt

# Copy production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
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
ENV VOICELOG_API_PORT=4000
ENV FFMPEG_BINARY=ffmpeg
ENV PYTHON_BINARY=python3
ENV VOICELOG_DB_PATH=/data/voicelog.sqlite
ENV VOICELOG_UPLOAD_DIR=/data/uploads

EXPOSE 4000

# Execute natively instead of using tsx (huge memory savings & instant boot)
CMD ["node", "server/index.js"]
