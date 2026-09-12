@echo off
title STOPPING FORK & FIRE POS
echo ========================================================
echo   CLOSING ALL FORK & FIRE WINDOWS AND BACKGROUND SERVERS
echo ========================================================
"%~dp0pgsql\bin\pg_ctl.exe" -D "%~dp0data" -m fast stop >nul 2>&1
taskkill /F /IM postgres.exe /T >nul 2>&1
taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM START_FORK_AND_FIRE.exe /T >nul 2>&1
if exist "%~dp0data\postmaster.pid" del /f /q "%~dp0data\postmaster.pid" >nul 2>&1
echo   [OK] All windows and servers have been closed!
echo ========================================================
timeout /t 2 >nul
exit
