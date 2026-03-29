# 🛡️ Anti-Regression & TDD Check Script (PowerShell)
# Usage: .\scripts\tdd-check.ps1 [feature-name]

param(
    [Parameter(Mandatory=$false)]
    [string]$FeatureName
)

Write-Host ""
Write-Host "🛡️  Anti-Regression & TDD Check" -ForegroundColor Cyan
Write-Host "================================"
Write-Host ""

# Check if feature name provided
if ([string]::IsNullOrEmpty($FeatureName)) {
    Write-Host "❌ Usage: .\scripts\tdd-check.ps1 [feature-name]" -ForegroundColor Red
    Write-Host ""
    Write-Host "Example:"
    Write-Host "  .\scripts\tdd-check.ps1 supabaseStorage"
    Write-Host ""
    exit 1
}

$TestFile = "server\tests\lib\${FeatureName}.test.ts"
$ImplFile = "server\lib\${FeatureName}.ts"
$RegressionDir = "server\tests\regression"

Write-Host "📝 Feature: $FeatureName"
Write-Host ""

# ─────────────────────────────────────────────────────────────
# Step 1: Check if test file exists (TDD = tests first!)
# ─────────────────────────────────────────────────────────────
Write-Host "Step 1: Checking test file..." -ForegroundColor Yellow
if (-not (Test-Path $TestFile)) {
    Write-Host "❌ Test file not found: $TestFile" -ForegroundColor Red
    Write-Host ""
    Write-Host "   TDD Rule: Write tests BEFORE implementation!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Create test file first:"
    Write-Host "   New-Item -ItemType Directory -Force server\tests\lib"
    Write-Host "   New-Item -ItemType File $TestFile"
    Write-Host ""
    Write-Host "   Then write failing tests (RED phase)"
    exit 1
}
Write-Host "✅ Test file exists: $TestFile" -ForegroundColor Green
Write-Host ""

# ─────────────────────────────────────────────────────────────
# Step 2: Check if implementation exists
# ─────────────────────────────────────────────────────────────
Write-Host "Step 2: Checking implementation file..." -ForegroundColor Yellow
if (-not (Test-Path $ImplFile)) {
    Write-Host "⏳ Implementation not found: $ImplFile" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Next: Implement code to make tests pass (GREEN phase)"
    Write-Host ""
} else {
    Write-Host "✅ Implementation exists: $ImplFile" -ForegroundColor Green
    Write-Host ""
}

# ─────────────────────────────────────────────────────────────
# Step 3: Run tests
# ─────────────────────────────────────────────────────────────
Write-Host "Step 3: Running tests..." -ForegroundColor Yellow
Write-Host ""

# Convert path to forward slashes for vitest
$TestFileVitest = $TestFile -replace '\\', '/'

$TestResult = pnpm exec vitest run -c server/vitest.config.ts $TestFileVitest --reporter=verbose
$TestExitCode = $LASTEXITCODE

if ($TestExitCode -eq 0) {
    Write-Host ""
    Write-Host "✅ All tests pass (GREEN)" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Tests failed (RED)" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Fix implementation or tests before proceeding"
    exit 1
}
Write-Host ""

# ─────────────────────────────────────────────────────────────
# Step 4: Check coverage
# ─────────────────────────────────────────────────────────────
Write-Host "Step 4: Checking coverage..." -ForegroundColor Yellow
Write-Host ""

$CoverageResult = pnpm exec vitest run -c server/vitest.config.ts $TestFileVitest --coverage --reporter=basic 2>&1
if ($CoverageResult -match "All files") {
    Write-Host $CoverageResult | Select-String "All files"
    Write-Host ""
    Write-Host "✅ Coverage check passed" -ForegroundColor Green
} else {
    Write-Host "⚠️  Could not determine coverage" -ForegroundColor Yellow
    Write-Host "   Consider running: pnpm run test:coverage"
}
Write-Host ""

# ─────────────────────────────────────────────────────────────
# Step 5: Regression test reminder
# ─────────────────────────────────────────────────────────────
Write-Host "Step 5: Regression test check..." -ForegroundColor Yellow
Write-Host ""

if (Test-Path $RegressionDir) {
    $RegressionCount = (Get-ChildItem -Path $RegressionDir -Filter *.test.ts).Count
    Write-Host "📊 Existing regression tests: $RegressionCount" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "   💡 If this is a bug fix, add regression test:"
Write-Host "      New-Item -ItemType Directory -Force $RegressionDir"
$DateStamp = Get-Date -Format "yyyy-MM-dd"
Write-Host "      New-Item -ItemType File ${RegressionDir}\${DateStamp}-${FeatureName}.test.ts"
Write-Host ""

# ─────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────
Write-Host "================================"
Write-Host "✅ TDD Check Complete!" -ForegroundColor Green
Write-Host "================================"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. ✅ Tests written (TDD)"
Write-Host "  2. ✅ Tests passing (GREEN)"
Write-Host "  3. ⏳ Refactor if needed (REFACTOR)"
Write-Host "  4. ⏳ Add regression test (if bug fix)"
Write-Host "  5. ⏳ Update documentation"
Write-Host "  6. ⏳ Run full test suite: pnpm run test"
Write-Host ""
