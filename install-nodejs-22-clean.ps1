# Odinstalowanie Node.js 24.x i instalacja 22.x

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Odinstalowanie Node.js 24.x" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Znajdź Node.js w Program Files
$nodeUninstallPath = Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\* | Where-Object { $_.DisplayName -like "*Node.js*" } | Select-Object -First 1

if ($nodeUninstallPath) {
    Write-Host "[1/4] Znaleziono Node.js:" -ForegroundColor Yellow
    Write-Host "      $($nodeUninstallPath.DisplayName)" -ForegroundColor White
    
    $uninstallString = $nodeUninstallPath.UninstallString
    Write-Host ""
    Write-Host "[2/4] Odinstalowanie..." -ForegroundColor Yellow
    
    # Spróbuj odinstalować
    if ($uninstallString -like "*MsiUninstall*") {
        $productCode = ($uninstallString -replace '{','') -replace '}',''
        Start-Process msiexec.exe -Wait -ArgumentList "/x {$productCode} /quiet"
    } elseif ($uninstallString) {
        Start-Process cmd.exe -Wait -ArgumentList "/c $uninstallString /quiet"
    }
    
    Write-Host "      ✅ Odinstalowano!" -ForegroundColor Green
} else {
    Write-Host "      ℹ️  Nie znaleziono Node.js w Programach" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[3/4] Czyszczenie PATH..." -ForegroundColor Yellow

# Usuń Node.js z PATH (rejestr)
$machinePath = [System.Environment]::GetEnvironmentVariable("Path","Machine")
$userPath = [System.Environment]::GetEnvironmentVariable("Path","User")

$machinePath = $machinePath -replace ";?C:\\Program Files\\nodejs" -replace ";?C:\\Program Files (x86)\\nodejs"
$userPath = $userPath -replace ";?C:\\Program Files\\nodejs" -replace ";?C:\\Program Files (x86)\\nodejs"

[System.Environment]::SetEnvironmentVariable("Path",$machinePath,"Machine")
[System.Environment]::SetEnvironmentVariable("Path",$userPath,"User")

Write-Host "      ✅ Wyczyszczono PATH" -ForegroundColor Green

Write-Host ""
Write-Host "[4/4] Instalacja Node.js 22.14.0..." -ForegroundColor Yellow

$installerUrl = "https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi"
$installerPath = "$env:TEMP\node-v22.14.0-x64.msi"

try {
    Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
    Write-Host "      ✅ Pobrano installer" -ForegroundColor Green
    
    Start-Process msiexec.exe -Wait -ArgumentList "/i $installerPath /quiet /norestart"
    Write-Host "      ✅ Zainstalowano Node.js 22.14.0" -ForegroundColor Green
} catch {
    Write-Host "      ❌ Błąd: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ Gotowe!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  WAŻNE:" -ForegroundColor Yellow
Write-Host "  1. Zamknij WSZYSTKIE terminale" -ForegroundColor White
Write-Host "  2. Uruchom ponownie komputer (zalecane)" -ForegroundColor White
Write-Host "  3. Otwórz NOWY terminal" -ForegroundColor White
Write-Host "  4. Sprawdź: node --version" -ForegroundColor White
Write-Host "  5. Powinno być: v22.14.0" -ForegroundColor White
Write-Host ""
