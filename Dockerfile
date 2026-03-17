FROM node:22-bookworm-slim

# FFmpeg for audio processing pipeline
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install server dependencies only (separate package.json to avoid React deps)
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev 2>/dev/null || npm install

COPY server/ ./server/
RUN mkdir -p .cache && \
    XENOVA_TRANSFORMERS_CACHE=.cache node server/scripts/download_models.js

# Ensure data directories exist (Railway volume overrides this path)
RUN mkdir -p /data/uploads

ENV NODE_ENV=production
ENV VOICELOG_API_HOST=0.0.0.0
ENV VOICELOG_API_PORT=4000
ENV FFMPEG_BINARY=ffmpeg
ENV VOICELOG_DB_PATH=/data/voicelog.sqlite
ENV VOICELOG_UPLOAD_DIR=/data/uploads
ENV XENOVA_TRANSFORMERS_CACHE=/app/.cache

EXPOSE 4000

CMD ["node", "--experimental-sqlite", "server/index.js"]
