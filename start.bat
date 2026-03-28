@echo off
echo ========================================
echo   VoiceLog OS - Uruchamianie
echo ========================================
echo.

echo [1/3] Zabijanie starych procesow Node.js...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo.
echo [2/3] Uruchamianie FRONTENDU (localhost:3000)...
start "VoiceLog Frontend" cmd /k "pnpm start"
timeout /t 5 /nobreak >nul

echo.
echo [3/3] Uruchamianie BACKENDU (port 4000)...
start "VoiceLog Backend" cmd /k "pnpm run start:server"

echo.
echo ========================================
echo   Uruchamianie zakonczone!
echo ========================================
echo.
echo Otworz w przegladarce:
echo   http://localhost:3000
echo.
echo Backend moze wymagac Node.js 22.x
echo Jesli nie dziala, zainstaluj Node.js 22 z:
echo   https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi
echo.
pause
