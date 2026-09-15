@echo off
title Trading Journal
cd /d "%~dp0"

echo.
echo   Trading Journal
echo.

REM A fresh copy of the project has no dependencies installed yet, and a fresh
REM pull may have changed the app since it was last built. Handle both here so
REM double-clicking this always works rather than failing with a stack trace.
if not exist "node_modules\" (
  echo   First run: installing dependencies.
  echo   This takes a minute or two and prints a lot. That is normal.
  echo.
  call npm install
  if errorlevel 1 goto failed
  echo.
)

if not exist "dist\" (
  echo   Building the app...
  call npm run build
  if errorlevel 1 goto failed
  echo.
)

echo   Starting up. Your browser will open in a moment.
echo.
echo   Keep this window open while you use the journal.
echo   Closing it stops the journal.
echo.

set JOURNAL_OPEN_BROWSER=1
call npm start
goto done

:failed
echo.
echo   Something went wrong above. Copy the error text and ask about it.
echo.

:done
echo.
echo   The journal has stopped.
pause
