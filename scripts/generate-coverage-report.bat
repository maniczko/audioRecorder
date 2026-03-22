@echo off
REM ============================================
REM Skrypt generuje raporty coverage HTML
REM dla frontendu i servera
REM ============================================

echo.
echo ==========================================
echo  GENEROWANIE RAPORTOW COVERAGE
echo ==========================================
echo.

REM Ustawienie większej pamięci dla Node.js
set NODE_OPTIONS=--max-old-space-size=4096

REM 1. Testy servera z coverage
echo [1/2] Uruchamianie testow servera z coverage...
call npm run test:server:coverage
if %ERRORLEVEL% neq 0 (
    echo.
    echo UWAGA: Testy servera nie powiodly sie w 100%%, ale raport zostal wygenerowany.
    echo.
)

REM 2. Testy frontendu z coverage (opcjonalne - odkomentuj jeśli potrzebne)
REM echo [2/2] Uruchamianie testow frontendu z coverage...
REM call npm run test:coverage
REM if %ERRORLEVEL% neq 0 (
REM     echo.
REM     echo UWAGA: Testy frontendu nie powiodly sie w 100%%, ale raport zostal wygenerowany.
REM     echo.
REM )

echo.
echo ==========================================
echo  RAPORTY ZAPISANE W:
echo  - Server:   coverage/server/index.html
echo  - Frontend: coverage/frontend/index.html
echo ==========================================
echo.
echo Aby otworzyc raport servera:
echo   start coverage\server\index.html
echo.
echo Aby otworzyc raport frontendu:
echo   start coverage\frontend\index.html
echo.
