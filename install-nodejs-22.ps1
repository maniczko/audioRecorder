# Instalacja Node.js 22.x LTS
$installerUrl = "https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi"
$installerPath = "$env:TEMP\node-v22.14.0-x64.msi"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Instalacja Node.js 22.14.0 LTS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Pobieranie Node.js 22.14.0..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
    Write-Host "      ✅ Pobrano: $installerPath" -ForegroundColor Green
} catch {
    Write-Host "      ❌ Błąd pobierania: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Otwórz w przeglądarce:" -ForegroundColor Yellow
    Write-Host "  $installerUrl" -ForegroundColor Cyan
    exit 1
}

Write-Host ""
Write-Host "[2/3] Instalacja..." -ForegroundColor Yellow
Write-Host "      Trwa instalacja (ok. 30 sekund)..." -ForegroundColor Gray

$process = Start-Process msiexec.exe -Wait -PassThru -ArgumentList "/i $installerPath /quiet /norestart"
if ($process.ExitCode -eq 0 -or $process.ExitCode -eq 3010) {
    Write-Host "      ✅ Zainstalowano!" -ForegroundColor Green
} else {
    Write-Host "      ⚠️  Instalacja zakończona z kodem: $($process.ExitCode)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[3/3] Weryfikacja..." -ForegroundColor Yellow

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

try {
    $nodeVersion = & node --version 2>&1
    Write-Host "      Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "      ⚠️  Node.js nie jest w PATH" -ForegroundColor Yellow
    Write-Host "      ℹ️  Zamknij ten terminal i otwórz nowy!" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ Instalacja zakończona!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  WAŻNE:" -ForegroundColor Yellow
Write-Host "  1. Zamknij WSZYSTKIE terminale" -ForegroundColor White
Write-Host "  2. Otwórz NOWY terminal" -ForegroundColor White
Write-Host "  3. Sprawdź: node --version" -ForegroundColor White
Write-Host "  4. Powinno być: v22.14.0" -ForegroundColor White
Write-Host ""
