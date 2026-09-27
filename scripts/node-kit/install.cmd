@echo off
rem Installs the Node.js runtime Stream Deck needs, from this kit.
rem Windows blocks a PowerShell script from a USB drive by default, so
rem this script runs install.ps1.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
set status=%errorlevel%

echo.
pause
exit /b %status%
