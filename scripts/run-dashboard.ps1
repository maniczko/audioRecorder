# Test Dashboard Generator
# Runs tests, generates JSON report, and opens dashboard

Write-Host "🧪 Running tests and generating dashboard..." -ForegroundColor Cyan

# Create reports directory
if (-not (Test-Path "reports")) {
    New-Item -Path "reports" -ItemType Directory | Out-Null
}

# Run tests with JSON reporter
Write-Host "`n📊 Running frontend tests..." -ForegroundColor Yellow
npx vitest run --reporter=json --outputFile=reports/vitest-results.json 2>$null

# Run server tests
Write-Host "`n🖥️  Running server tests..." -ForegroundColor Yellow
npx vitest run -c server/vitest.config.ts --reporter=json --outputFile=reports/vitest-server-results.json 2>$null

# Generate dashboard data
Write-Host "`n🔧 Generating dashboard data..." -ForegroundColor Yellow
node scripts/generate-test-results.js

# Open dashboard
Write-Host "`n🌐 Opening dashboard..." -ForegroundColor Green
Start-Process "scripts/test-dashboard.html"

Write-Host "`n✓ Dashboard ready! Refresh after each test run to see updated results." -ForegroundColor Green
