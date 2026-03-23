# Disk Space Management

## Problem
The server stores audio recordings and chunk files on disk. Over time, these files can accumulate and fill up the available disk space, causing `ENOSPC: no space left on device` errors.

## Symptoms
- Error: `ENOSPC: no space left on device`
- Error: `Brak miejsca na dysku serwera`
- HTTP 507 responses from chunk upload endpoints
- Failed recording uploads

## Solutions

### 1. Automatic Cleanup (Recommended)

The server now automatically:
- Checks disk space before writing chunk files
- Returns HTTP 507 with helpful error message when disk is full
- Logs disk space warnings on startup

### 2. Manual Cleanup via API

Check disk space status:
```bash
GET /api/media/disk-space/status
Authorization: Bearer <token>
```

Response:
```json
{
  "ok": true,
  "freeBytes": 524288000,
  "freeMB": 500,
  "timestamp": "2026-03-23T12:00:00.000Z"
}
```

Clean up old chunks (admin only):
```bash
POST /api/media/disk-space/cleanup?maxAge=24
Authorization: Bearer <admin-token>
```

Response:
```json
{
  "success": true,
  "deleted": 150,
  "bytesFreed": 524288000,
  "mbFreed": 500
}
```

### 3. Manual Cleanup via Script

Run from project root:

```bash
# Clean files older than 24 hours (default)
pnpm run cleanup:disk

# Clean files older than 1 hour (urgent)
pnpm run cleanup:disk:urgent

# Custom age (in hours)
node scripts/cleanup-disk-space.js 48
```

### 4. Railway Dashboard

If you're deploying on Railway:
1. Open Railway dashboard
2. Go to your project
3. Click "Open Logs"
4. Run cleanup command:
   ```
   pnpm run cleanup:disk:urgent
   ```

## Prevention

### Increase Railway Disk Quota
1. Go to Railway dashboard
2. Select your project
3. Click "Settings"
4. Increase "Disk" quota (default is 1GB, consider 5-10GB)

### Enable Automatic Cleanup
Add to your Railway environment variables:
```
VOICELOG_AUTO_CLEANUP=true
VOICELOG_CLEANUP_MAX_AGE_HOURS=24
```

### Monitor Disk Space
Set up monitoring alerts in Railway:
1. Go to project Settings
2. Click "Alerts"
3. Add alert for disk usage > 80%

## File Locations

- Upload directory: `/server/data/uploads`
- Chunk files: `/server/data/uploads/chunks`
- Audio files: `/server/data/uploads/recordings`

## Old Chunk Cleanup Policy

Chunks are automatically cleaned when:
- They are older than 24 hours (default)
- They are orphaned (no matching recording)
- Disk space is critically low (< 100MB)

## Error Handling

When disk space is low, the server will:
1. Check available space before each chunk upload
2. Return HTTP 507 with free space information
3. Log error to server logs
4. Clean up any partial writes

## Troubleshooting

### Still getting ENOSPC errors?

1. **Check current disk usage:**
   ```bash
   GET /api/media/disk-space/status
   ```

2. **Run urgent cleanup:**
   ```bash
   pnpm run cleanup:disk:urgent
   ```

3. **Check for large files:**
   ```bash
   # On Railway, open shell and run:
   du -sh ./server/data/uploads/*
   ```

4. **Increase Railway disk quota** (recommended long-term solution)

### Cleanup script not working?

1. Check Node.js version (requires Node 18+)
2. Ensure you're in the project root directory
3. Check file permissions
4. Try running with sudo (local development only)

## Contact

If disk space issues persist, contact support with:
- Disk space status output
- Recent server logs
- Railway project name
