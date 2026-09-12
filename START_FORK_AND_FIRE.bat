@echo off
title FORK & FIRE - POS CONTROLLER
cd /d "%~dp0"
color 0F

:: If called with argument "1", run headless start directly
if "%1"=="1" (
    goto START_SERVICES
)

:: 1. Clean up old broken/stub exe if under 10KB
for %%A in ("%~dp0START_FORK_AND_FIRE.exe") do (
    if %%~zA LSS 10000 del /f /q "%~dp0START_FORK_AND_FIRE.exe" >nul 2>&1
)

:: 2. Try compiling C# GUI if missing
if not exist "%~dp0START_FORK_AND_FIRE.exe" (
    set CSC="%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
    if not exist %CSC% set CSC="%SystemRoot%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
    if exist %CSC% (
        echo [Compiling Control Panel GUI...]
        %CSC% /nologo /target:winexe /out:"%~dp0START_FORK_AND_FIRE.exe" /r:System.Windows.Forms.dll,System.Drawing.dll,System.dll,System.Core.dll "%~dp0scripts\ControlPanel.cs" >nul 2>&1
    )
)

:: 3. Launch Graphical Controller Window if available
if exist "%~dp0START_FORK_AND_FIRE.exe" (
    start "" "%~dp0START_FORK_AND_FIRE.exe"
) else if exist "%~dp0ForkAndFire_GUI.hta" (
    start "" "%~dp0ForkAndFire_GUI.hta"
)

:MENU
cls
echo ====================================================================
echo                 FORK ^& FIRE - POS SYSTEM CONTROLLER
echo             Restaurant POS System  ^|  Offline Terminal
echo ====================================================================
echo.
echo   Local Web URL:     http://localhost:3000
echo   Admin Login:       Username: admin  /  Password: from .env (admin123)
echo.
echo ====================================================================
echo   CHOOSE AN ACTION:
echo ====================================================================
echo.
echo   [1]  START POS ^& OPEN IN WEB BROWSER
echo   [2]  OPEN WEB BROWSER (http://localhost:3000)
echo   [3]  RESTART ALL SERVERS
echo   [4]  STOP ALL SERVERS
echo   [5]  OPEN GRAPHICAL CONTROL WINDOW
echo   [6]  QUIT / EXIT
echo.
echo ====================================================================
set /p choice="  Enter your choice (1-6) and press Enter: "

if "%choice%"=="1" goto START_SERVICES
if "%choice%"=="2" goto OPEN_BROWSER
if "%choice%"=="3" goto RESTART_SERVICES
if "%choice%"=="4" goto STOP_SERVICES
if "%choice%"=="5" goto OPEN_GUI
if "%choice%"=="6" exit
goto MENU

:START_SERVICES
echo.
echo   [+] Starting Fork ^& Fire POS services...
node scripts/start-all.js
if "%1"=="1" exit
echo.
echo Press any key to return to menu...
pause >nul
goto MENU

:OPEN_BROWSER
echo.
echo   [+] Opening POS in your default browser...
start http://localhost:3000
goto MENU

:RESTART_SERVICES
echo.
echo   [+] Stopping existing servers...
call STOP_FORK_AND_FIRE.bat
echo   [+] Starting fresh servers...
node scripts/start-all.js
echo.
echo Press any key to return to menu...
pause >nul
goto MENU

:STOP_SERVICES
echo.
call STOP_FORK_AND_FIRE.bat
echo.
echo Press any key to return to menu...
pause >nul
goto MENU

:OPEN_GUI
if exist "%~dp0ForkAndFire_GUI.hta" (
    start "" "%~dp0ForkAndFire_GUI.hta"
) else if exist "%~dp0START_FORK_AND_FIRE.exe" (
    start "" "%~dp0START_FORK_AND_FIRE.exe"
)
goto MENU
