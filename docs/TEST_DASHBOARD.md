# 🧪 Test Dashboard

Interactive visualization of test suite status for VoiceLog project.

## Quick Start

```bash
# Run tests and open dashboard
pnpm run dashboard

# Or use PowerShell script (Windows)
.\scripts\run-dashboard.ps1

# Just generate data (run tests separately)
pnpm run test:generate

# Open existing dashboard
pnpm run dashboard:open
```

## Features

### 📊 Visual Overview
- **Total test count** with pass/fail breakdown
- **Success rate** progress bar
- **Coverage metrics** for frontend and backend
- **Interactive charts** using Chart.js

### 🔍 Detailed Analysis
- **Failed tests list** with error messages
- **File-by-file status** (sorted by failures first)
- **Color-coded indicators** for quick scanning
- **Print-friendly** layout for reports

### 📈 Tracking Progress
- **Timestamp** shows when tests were last run
- **Status badge** (ALL PASSING vs X TESTS FAILING)
- **Trend indicators** for each metric

## Dashboard Files

| File | Purpose |
|------|---------|
| `scripts/test-dashboard.html` | Interactive dashboard UI |
| `scripts/generate-test-results.js` | Parses test output → JSON |
| `scripts/test-results.json` | Generated test data (auto-created) |
| `scripts/run-dashboard.ps1` | All-in-one PowerShell script |

## How It Works

```
1. Run tests with JSON reporter
   ↓
2. Parse vitest-results.json
   ↓
3. Generate test-results.json
   ↓
4. Open dashboard in browser
   ↓
5. View visual report with charts
```

## Updating Dashboard

After each test run:

```bash
# Option 1: All-in-one
pnpm run test:with-report

# Option 2: Manual steps
npx vitest run --reporter=json --outputFile=reports/vitest-results.json
pnpm run test:generate
pnpm run dashboard:open
```

## Customization

### Update Coverage Numbers
Edit `scripts/generate-test-results.js` line 88:
```javascript
coverage: {
  frontend: 55, // Update with actual frontend coverage
  backend: 65   // Update with actual backend coverage
}
```

### Change Theme Colors
Edit `scripts/test-dashboard.html` CSS:
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

### Add More Charts
Add new `<canvas>` elements and Chart.js configurations in the HTML.

## Troubleshooting

### Dashboard shows "No test results"
- Run tests first: `pnpm test`
- Check if `scripts/test-results.json` exists
- Run: `pnpm run test:generate`

### Charts not loading
- Check internet connection (Chart.js loads from CDN)
- Open browser console (F12) for errors

### Outdated data
- Refresh the page after running new tests
- Click "🔄 Refresh" button in dashboard

## Integration with CI

Add to GitHub Actions workflow:

```yaml
- name: Generate Test Dashboard
  run: |
    npx vitest run --reporter=json --outputFile=reports/vitest-results.json
    node scripts/generate-test-results.js
    
- name: Upload Dashboard
  uses: actions/upload-artifact@v3
  with:
    name: test-dashboard
    path: scripts/test-dashboard.html
```

## Future Enhancements

- [ ] Auto-refresh every 5 minutes
- [ ] Historical trends graph
- [ ] Filter by file pattern
- [ ] Click to open failing test in editor
- [ ] Export to PDF
- [ ] Slack notification on test failures
- [ ] Integration with GitHub PR checks

## Tech Stack

- **Chart.js** - Beautiful charts
- **Vanilla JS** - No build step required
- **CSS Grid** - Responsive layout
- **Vitest JSON Reporter** - Test data source

---

💡 **Tip**: Keep the dashboard open in a background tab and refresh after each major change to track progress visually!
