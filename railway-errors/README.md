# Railway Error Logs

Automatically fetched error logs from Railway deployments.

## Usage

### First Time Setup

You need to link the project to your Railway account:

```bash
# Login to Railway (if not already logged in)
railway login

# Link to the audioRecorder project
railway link
# Select: maniczko's Projects > audioRecorder
```

### Fetch Error Logs

```bash
# Fetch error logs (last 100 lines with @level:error filter)
pnpm run errors:railway

# Fetch error logs as JSON
pnpm run errors:railway:json

# Custom filter and lines
node scripts/fetch-railway-errors.js --lines 50 --filter "error OR fail"
node scripts/fetch-railway-errors.js --lines 200 --filter "@level:warn"
node scripts/fetch-railway-errors.js --json --lines 100
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OUTPUT_DIR` | `./railway-errors` | Output directory for reports |
| `RAILWAY_LOG_LINES` | `100` | Number of log lines to fetch |
| `RAILWAY_LOG_FILTER` | `@level:error` | Log filter query |

### Examples

```bash
# Fetch last 200 error logs
RAILWAY_LOG_LINES=200 pnpm run errors:railway

# Fetch warning logs
RAILWAY_LOG_FILTER="@level:warn" pnpm run errors:railway

# Fetch logs containing "timeout"
RAILWAY_LOG_FILTER="timeout" pnpm run errors:railway

# Fetch logs from last hour (using Railway CLI directly)
railway logs --lines 100 --since 1h --filter "@level:error"
```

## Output

Reports are saved to `./railway-errors/` with timestamps:
- `railway-errors-YYYY-MM-DDTHH-MM-SS.md` - Markdown report
- `railway-errors-YYYY-MM-DDTHH-MM-SS.json` - JSON report (if `--json` flag)

### Report Contents

1. **Error Logs** - Filtered error logs from Railway
2. **Deployment Info** - Recent deployment information
3. **Health Check** - Current health status from `/health` endpoint

## Railway Log Query Syntax

Railway supports powerful query syntax for filtering logs:

```
# Text search
"error message"
"user signup"

# Attribute filters
@level:error
@level:warn
@service:backend

# Combined queries
@level:error AND "database"
@level:warn OR "timeout"
@level:error -"expected"
```

See [Railway Logs Documentation](https://docs.railway.com/guides/logs) for full syntax.

## Health Check

The script also includes a health check from the production endpoint:
- **URL:** https://audiorecorder-production.up.railway.app/health
- **Status:** `ok` = healthy, `degraded` = partial issues, `error` = critical

## Troubleshooting

### "No linked project found"

Run `railway link` and select the audioRecorder project.

### "Not logged in"

Run `railway login` to authenticate.

### "Railway CLI not available"

Install the Railway CLI:
```bash
npm install -g @railway/cli
```

## Automated Fetching

To fetch errors automatically (e.g., in CI/CD):

```bash
# In GitHub Actions or cron job
pnpm run errors:railway

# Check if there are new errors
if [ -s railway-errors/latest.md ]; then
  echo "New errors found!"
  # Send notification, create issue, etc.
fi
```

## Related

- [GitHub Error Fetcher](./scripts/fetch-github-errors.js) - Fetch GitHub Actions errors
- [Railway CLI](https://docs.railway.com/guides/cli) - Official CLI documentation
- [Railway Logs](https://docs.railway.com/guides/logs) - Log query syntax
