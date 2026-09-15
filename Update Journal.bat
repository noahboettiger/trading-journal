@echo off
title Update Trading Journal
cd /d "%~dp0"

echo.
echo   Updating the trading journal
echo.
echo   Your trades are not touched by this. The data folder is kept
echo   separate from the code on purpose.
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo   Git is not installed, so this cannot fetch updates automatically.
  echo   Install it from https://git-scm.com/download/win and run this again,
  echo   or download a fresh ZIP from GitHub and copy your data folder across.
  echo.
  pause
  exit /b 1
)

REM A copy running in the background would keep serving the old version after
REM the rebuild, so stop it first and start it again at the end.
set WASRUNNING=0
if exist "data\.server.pid" set WASRUNNING=1
echo   Stopping the journal if it is running...
call npm run stop
echo.

echo   Fetching the latest version...
call git pull
if errorlevel 1 goto failed
echo.

echo   Installing anything new...
call npm install
if errorlevel 1 goto failed
echo.

echo   Rebuilding...
call npm run build
if errorlevel 1 goto failed

echo.
if "%WASRUNNING%"=="1" (
  echo   Restarting in the background...
  start "" wscript.exe "%~dp0scripts\windows\journal-background.vbs"
  echo   Done. The journal is running again at http://localhost:4317
) else (
  echo   Done. Start the journal with "Start Journal.bat".
)
echo.
pause
exit /b 0

:failed
echo.
echo   Update failed. Copy the error text above and ask about it.
echo.
pause
exit /b 1
