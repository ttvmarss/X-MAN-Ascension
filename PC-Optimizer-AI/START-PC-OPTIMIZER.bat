@echo off
title PC-Optimizer-AI
setlocal

echo.
echo   ============================================
echo    PC-Optimizer-AI  -  one-button Windows 10
echo   ============================================
echo.
echo   1. Inspect only              (read-only report, changes nothing)
echo   2. Driver scan only          (versions + official links, no installs)
echo   3. NVIDIA optimization only
echo   4. Safe debloat              (asks before removing anything)
echo   5. Safe registry optimization
echo   6. FULL optimize with verification
echo   7. Revert changes            (undo everything)
echo   8. Open latest report
echo.
set /p CHOICE="  Choose 1-8 [default 1]: "

set "SCRIPT=Win10Optimizer.ps1"
set "ARGS=-Mode Inspect"
if "%CHOICE%"=="2" (set "SCRIPT=Driver-Scanner.ps1"      & set "ARGS=")
if "%CHOICE%"=="3" (set "SCRIPT=Nvidia-Optimizer.ps1"    & set "ARGS=")
if "%CHOICE%"=="4" (set "SCRIPT=Debloat-Safe.ps1"        & set "ARGS=")
if "%CHOICE%"=="5" (set "SCRIPT=Registry-SafeTweaks.ps1" & set "ARGS=")
if "%CHOICE%"=="6" (set "SCRIPT=Win10Optimizer.ps1"      & set "ARGS=-Mode Full")
if "%CHOICE%"=="7" (set "SCRIPT=Revert-Changes.ps1"      & set "ARGS=")
if "%CHOICE%"=="8" (set "SCRIPT=Win10Optimizer.ps1"      & set "ARGS=-Mode OpenReport")

echo.
echo   Launching %SCRIPT% %ARGS%  (a Windows elevation prompt will appear)...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command','& ''%~dp0%SCRIPT%'' %ARGS% -Pause'"

if errorlevel 1 (
    echo.
    echo   Elevation declined. Running a read-only inspection without admin instead...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Win10Optimizer.ps1" -Mode Inspect -Pause
)

endlocal
