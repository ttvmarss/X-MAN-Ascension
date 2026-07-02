@echo off
title WinPerf - Windows performance toolkit
setlocal

echo.
echo   WinPerf - Windows performance toolkit
echo   =====================================
echo.
echo   1. Inspect only        (read-only report, no changes)
echo   2. Optimize            (restore point + safe, reversible changes)
echo   3. Revert              (undo every change WinPerf made)
echo   4. Full                (inspect, optimize, verify)
echo.
set /p CHOICE="  Choose 1-4 [default 1]: "

set MODE=Inspect
if "%CHOICE%"=="2" set MODE=Optimize
if "%CHOICE%"=="3" set MODE=Revert
if "%CHOICE%"=="4" set MODE=Full

echo.
echo   Starting %MODE% mode (an elevation prompt will appear)...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','\"%~dp0WinPerf.ps1\"','-Mode','%MODE%','-Pause'"

if errorlevel 1 (
    echo.
    echo   Elevation was declined. Running read-only inspection without admin instead...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0WinPerf.ps1" -Mode Inspect -Pause
)

endlocal
