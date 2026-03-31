# 🤖 Automated Error Monitor

## Overview

Automated error monitoring system that checks for errors every 6 hours and automatically creates tasks.

---

## ⏰ Schedule

**Runs every 6 hours at:**
- 00:00 UTC
- 06:00 UTC
- 12:00 UTC
- 18:00 UTC

**Manual trigger:** Available via GitHub Actions UI

---

## 🔍 What It Monitors

### 1. GitHub Actions Errors
- Failed workflow runs
- Error messages from logs
- Workflow names and URLs

### 2. Railway Errors
- Application errors (`@level:error`)
- Deployment failures
- Runtime exceptions

---

## ✅ What It Does

When errors are found, the workflow automatically:

1. **Creates Tasks in TASK_QUEUE.md**
   - Format: `GH-AUTO-YYYY-MM-DD-N` for GitHub errors
   - Format: `RW-AUTO-YYYY-MM-DD-N` for Railway errors
   - Includes error message, source, timestamp, priority

2. **Creates GitHub Issue**
   - Consolidated error report
   - Links to TASK_QUEUE.md tasks
   - Labels: `auto-generated-error`, `monitoring`, `priority-high`

3. **Uploads Artifacts**
   - Error analysis JSON
   - Full error reports (markdown + JSON)
   - Retained for 7 days

---

## 📋 Example Task Created

```markdown
- **GH-AUTO-2026-03-31-1** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** Process completed with exit code 1.
  - **Created:** 2026-03-31T06:00:00.000Z
  - **Priority:** High
```

---

## 🚀 Manual Trigger

You can manually run the workflow:

1. Go to **Actions** → **Error Monitor & Task Creator**
2. Click **Run workflow**
3. Choose options:
   - ✅ Check GitHub Actions errors
   - ✅ Check Railway errors
   - ✅ Create tasks in TASK_QUEUE.md
   - ✅ Create GitHub issues for errors
4. Click **Run workflow**

---

## ⚙️ Configuration

### Required Secrets

| Secret | Required For | How to Get |
|--------|--------------|------------|
| `GITHUB_TOKEN` | GitHub errors | Automatic (provided by GitHub) |
| `RAILWAY_TOKEN` | Railway errors | https://railway.app/account/tokens |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DAYS_BACK` | 1 | How many days of GitHub errors to check |
| `RAILWAY_LOG_LINES` | 50 | Number of Railway log lines to fetch |
| `RAILWAY_LOG_FILTER` | `@level:error` | Railway log filter query |

---

## 📊 Output

### Step Summary

After each run, check the **Summary** tab for:

```
## 📊 Error Monitor Summary

| Source         | Errors Found |
|----------------|--------------|
| GitHub Actions | 2            |
| Railway        | 0            |
| **Total**      | **2**        |

✅ Tasks created in TASK_QUEUE.md
✅ GitHub issue created
```

### Artifacts

Download error reports from the workflow run:
- `error-analysis-<run_id>.zip`
- Contains: JSON analysis, markdown reports

---

## 🔧 Customization

### Change Schedule

Edit `.github/workflows/error-monitor-and-task-creator.yml`:

```yaml
on:
  schedule:
    - cron: '0 */6 * * *'  # Change to your schedule
```

Examples:
- Every hour: `0 * * * *`
- Every 12 hours: `0 */12 * * *`
- Daily at 9 AM: `0 9 * * *`

### Change Error Filter

To monitor warnings too:

```yaml
env:
  RAILWAY_LOG_FILTER: '@level:error OR @level:warn'
```

### Disable Issue Creation

Set `create_issues: false` when triggering manually, or edit the workflow:

```yaml
- name: Create GitHub Issues for Errors
  if: ${{ false }}  # Disabled
```

---

## 📝 Task Queue Format

Tasks are added to `TASK_QUEUE.md` under **### 🔴 Wysoki priorytet**

Format:
```markdown
- **{ID}** — {Title}
  - **Status:** todo
  - **Source:** {GitHub Actions | Railway}
  - **Error:** {Truncated error message}
  - **Created:** {ISO timestamp}
  - **Priority:** High
```

---

## 🐛 Troubleshooting

### "Railway login failed"

Make sure `RAILWAY_TOKEN` secret is set:
```bash
# Check if secret exists
gh secret list | grep RAILWAY_TOKEN

# Add secret
gh secret set RAILWAY_TOKEN
```

### "No errors found" but I see errors

Check the filter:
- GitHub: Checks last 1 day by default
- Railway: Checks last 50 lines with `@level:error` filter

Adjust in workflow inputs or environment variables.

### Tasks not appearing in TASK_QUEUE.md

Check the workflow logs for:
- "Created X new tasks in TASK_QUEUE.md"
- Commit message: "chore: auto-create tasks for X errors"

---

## 📈 Metrics

Track error trends over time:
- Check workflow run history
- Download artifacts for analysis
- Monitor TASK_QUEUE.md for recurring errors

---

## 🔗 Related

- [GitHub Error Reporter](./github-errors/README.md)
- [Railway Error Reporter](./railway-errors/README.md)
- [TASK_QUEUE.md](./TASK_QUEUE.md)

---

**Last Updated:** 2026-03-31
**Workflow:** `.github/workflows/error-monitor-and-task-creator.yml`
