# Railway Error Report

**Generated:** 2026-03-31T07:30:00Z
**Source:** GitHub Errors Archive + Health Check

## ✅ Current Status (LIVE)

```json
{
  "ok": true,
  "status": "ok",
  "db": "connected",
  "supabaseRemote": true,
  "uptime": 3117,
  "gitSha": "b41ed2ffd3a04da337b694f02f96d975820a7b3b",
  "buildTime": "2026-03-31T06:48:40.926Z",
  "appVersion": "0.1.0",
  "runtime": "railway",
  "platform": "linux",
  "memory": {
    "heapUsed": "40.74 MB",
    "rss": "142.58 MB"
  }
}
```

**Status:** ✅ **HEALTHY** - Backend działa poprawnie!

---

## 📋 Historical Errors (from GitHub Errors Archive)

### 2026-03-28 - 502 Bad Gateway Errors

**Time:** 08:06:45 UTC and 07:58:08 UTC
**Affected Endpoints:**
- `/media/recordings/:id/transcribe`
- `/state/bootstrap?workspaceId=:id`
- `/health`
- `/media/recordings/:id/progress?token=:token`

**Error Pattern:**
```
GET https://audiorecorder-production.up.railway.app/<endpoint> 
net::ERR_FAILED 502 (Bad Gateway)
```

**Root Cause:** Railway deployment was restarting/crashing at that time.

**CORS Errors:**
```
Access to fetch at 'https://audiorecorder-production.up.railway.app/...' 
from origin 'https://audiorecorder-bvgd2caeu-iwoczajka-2703s-projects.vercel.app' 
has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Impact:** Frontend (Vercel preview) couldn't connect to Railway backend during deployment.

---

## 🔍 Analysis

### Error Timeline
| Date | Time (UTC) | Error Type | Affected Service |
|------|------------|------------|------------------|
| 2026-03-28 | 07:58 | 502 Bad Gateway | All endpoints |
| 2026-03-28 | 08:06 | 502 Bad Gateway | All endpoints |
| 2026-03-31 | Current | ✅ OK | All endpoints |

### Resolution
The 502 errors from 2026-03-28 were caused by:
1. Railway deployment restart
2. Backend was temporarily unavailable
3. Frontend received CORS errors because backend wasn't responding

**Current Status:** ✅ All systems operational

---

## 📊 Health Check Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Uptime | ~52 minutes | ✅ Good |
| Memory (RSS) | 142.58 MB | ✅ Normal (< 4GB limit) |
| Heap Used | 40.74 MB | ✅ Normal |
| Database | Connected | ✅ OK |
| Supabase Remote | Enabled | ✅ OK |
| Git SHA | b41ed2f | ✅ Latest deployment |

---

## 🚂 How to Fetch Fresh Railway Logs

### First Time Setup
```bash
# Login to Railway
railway login

# Link to project
railway link
# Select: maniczko's Projects > audioRecorder
```

### Fetch Error Logs
```bash
# Using the new script
pnpm run errors:railway

# Or directly with Railway CLI
railway logs --lines 100 --filter "@level:error"

# Fetch logs from last hour
railway logs --lines 50 --since 1h --filter "@level:error"
```

### Automated Fetching
GitHub Actions workflow runs every 6 hours:
- Workflow: `.github/workflows/railway-error-reporter.yml`
- Creates GitHub issues if errors found
- Saves reports to `./railway-errors/`

---

## 📝 Notes

- Historical errors are from GitHub browser console captures
- Current health check shows backend is healthy
- Memory usage is well within limits (142MB / 4GB)
- No recent errors detected in live health check

**Recommendation:** Monitor Railway logs regularly using the automated workflow.
