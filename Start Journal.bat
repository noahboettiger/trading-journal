@echo off
title Trading Journal
cd /d "%~dp0"

echo.
echo   Starting your trading journal...
echo   Your browser will open automatically in a moment.
echo.
echo   Keep this window open while you use the journal.
echo   Closing it stops the journal.
echo.

set JOURNAL_OPEN_BROWSER=1
call npm start

echo.
echo   The journal has stopped.
pause
