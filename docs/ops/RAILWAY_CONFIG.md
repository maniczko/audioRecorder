# Railway Configuration Guide

## Required Environment Variables

### 🔴 CRITICAL - Server won't work without these

```env
# Hugging Face Token (for speaker diarization)
HF_TOKEN=your_huggingface_token_here

# OpenAI API Key (for STT transcription)
OPENAI_API_KEY=sk-your_openai_key_here

# Supabase Storage (CRITICAL for persistent audio)
# Without these, recordings are lost after every redeploy!
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 🟡 RECOMMENDED - Enhanced functionality

```env
# Groq API Key (faster STT fallback)
GROQ_API_KEY=gsk_your_groq_key_here

# Anthropic API Key (for AI analysis)
ANTHROPIC_API_KEY=sk-ant-your_anthropic_key_here

# Google API Key (for calendar integration)
GOOGLE_API_KEY=your_google_key_here
```

### 🔵 OPTIONAL - Configuration

```env
# Database (Railway auto-provides PostgreSQL)
DATABASE_URL=postgresql://...

# Upload directory
VOICELOG_UPLOAD_DIR=/app/server/data/uploads

# Allowed origins
VOICELOG_ALLOWED_ORIGINS=https://your-domain.com

# Trust proxy (for Railway)
VOICELOG_TRUST_PROXY=true
```

---

## How to Get HF_TOKEN

1. Go to https://huggingface.co/settings/tokens
2. Click "Create new token"
3. Name: `VoiceLog-Diarization`
4. Type: `Read`
5. Copy the token
6. Add to Railway Environment Variables

---

## Railway Setup

### 1. Add Environment Variables

Go to **Railway Dashboard** → **Variables** → **Add Variable**

Add these:

- `HF_TOKEN` = (your Hugging Face token)
- `OPENAI_API_KEY` = (your OpenAI key)
- `SUPABASE_URL` = (your Supabase project URL)
- `SUPABASE_SERVICE_ROLE_KEY` = (your Supabase Service Role key)
- `GROQ_API_KEY` = (your Groq key, optional)

### 2. Configure Volume

Railway automatically mounts `/app/server/data` as persistent volume.

If upload dir is not writable:

```bash
# In Railway Dashboard → Settings → Volumes
# Ensure /app/server/data is mounted
```

### 3. Health and Readiness Checks

After deployment, check:

```
https://voicelog-production.up.railway.app/health/live
https://voicelog-production.up.railway.app/health
https://voicelog-production.up.railway.app/ready
```

Endpoint contract:

- `/health/live` is the lightweight process liveness check for frontend availability probes. It must return `200` when the backend process is running and must not depend on database or Supabase Storage readiness.
- `/health` is the compatibility health/build metadata endpoint used by Railway/GitHub release checks. It includes `gitSha`, `supabaseStorage`, STT, diarization, and readiness summary fields.
- `/ready` is strict dependency readiness. It may return `503` when production dependencies such as Supabase Storage are degraded.

Expected `/health` response:

```json
{
  "ok": true,
  "status": "ok",
  "db": "connected",
  "supabaseRemote": true
}
```

### 4. Persistence Release Check

Before public launch, verify this sequence on Railway:

1. Upload a short audio recording.
2. Confirm `/health` reports `"supabaseRemote": true`.
3. Transcribe the recording and open the generated transcript.
4. Restart or redeploy the backend.
5. Reopen the same recording and confirm audio plus transcript are still available.

Do not launch a public environment when `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing.
Do not launch when `/ready` returns `503` or `status: "degraded"`.

### 5. Supabase Postgres URL Preflight

If `/health` returns an error like `ENOTFOUND ... postgres.<project-ref> not found`, the Railway
Postgres connection string is incomplete.

Use a complete Supabase direct host or pooler host, for example:

```text
postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

Do not use a host shaped only like `postgres.<project-ref>` or `db.<project-ref>`.
`scripts/validate-env.js` blocks that pattern for production deployments.

---

## Troubleshooting

### "Disk space critically low"

**Automatic fix:** Server auto-cleans old files on startup

**Manual fix:**

```bash
# In Railway Dashboard → Logs
# Click "Redeploy" - cleanup runs on bootstrap
```

**Prevent:**

- Set up scheduled cleanup (cron job)
- Increase Railway disk quota

### "HF_TOKEN missing"

1. Get token from https://huggingface.co/settings/tokens
2. Add to Railway Variables
3. Redeploy

### "Upload dir not writable"

Railway uses `/app/server/data/uploads` by default.

Fix in `.env`:

```env
VOICELOG_UPLOAD_DIR=/app/server/data/uploads
```

---

## Monitoring

### Disk Usage

```bash
# Check via Railway Logs
df -h /app/server/data
```

### API Health

```bash
curl https://voicelog-production.up.railway.app/health/live
curl https://voicelog-production.up.railway.app/health
curl https://voicelog-production.up.railway.app/ready
```

### Logs

Railway Dashboard → Logs

---

## Cost Optimization

Railway charges based on:

- **Memory**: 512MB default (upgrade if needed)
- **Disk**: 20GB included
- **Compute hours**: ~$5/month for always-on

**Tips:**

- Enable auto-sleep for dev environments
- Clean up old recordings regularly
- Use Groq for faster/cheaper STT
