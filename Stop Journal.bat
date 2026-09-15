@echo off
title Stop Trading Journal
cd /d "%~dp0"

echo.
call npm run stop
echo.
pause
