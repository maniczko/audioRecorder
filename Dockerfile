FROM node:22.12-bookworm-slim

# FFmpeg and Python for ML audio processing pipeline (Pyannote / Silero VAD)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install server dependencies
COPY server/package.json server/package-lock.json* ./
# Install ALL dependencies (including dev for tsx)
RUN npm install

COPY server/ ./server/

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

CMD ["npx", "tsx", "server/index.ts"]
