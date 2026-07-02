@echo off
title Get PC-Optimizer-AI
setlocal
REM ============================================================
REM  GET-PC-OPTIMIZER.bat - save this ONE file to your Desktop,
REM  double-click it, and it installs PC-Optimizer-AI into
REM  C:\PC-Optimizer-AI and starts the menu. Safe to re-run any
REM  time: it just refreshes the scripts to the latest version.
REM ============================================================

set "DEST=C:\PC-Optimizer-AI"
set "BASE=https://raw.githubusercontent.com/ttvmarss/X-MAN-Ascension/claude/windows-performance-engineer-857o3v/PC-Optimizer-AI"

echo.
echo   Installing PC-Optimizer-AI to %DEST% ...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$dest='%DEST%'; $base='%BASE%';" ^
  "New-Item -ItemType Directory -Path $dest -Force | Out-Null;" ^
  "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;" ^
  "$files=@('START-PC-OPTIMIZER.bat','Common.ps1','Win10Optimizer.ps1','Driver-Scanner.ps1','Nvidia-Optimizer.ps1','Debloat-Safe.ps1','Registry-SafeTweaks.ps1','Revert-Changes.ps1','README.txt');" ^
  "foreach($f in $files){ Write-Host ('  downloading ' + $f); Invoke-WebRequest -Uri ($base + '/' + $f) -OutFile (Join-Path $dest $f) -UseBasicParsing };" ^
  "Write-Host '  All files downloaded.' -ForegroundColor Green"

if errorlevel 1 (
    echo.
    echo   Download failed. Check your internet connection and try again.
    echo   Manual fallback: download the repo ZIP from
    echo   https://github.com/ttvmarss/X-MAN-Ascension and copy the
    echo   PC-Optimizer-AI folder to C:\PC-Optimizer-AI yourself.
    pause
    exit /b 1
)

echo.
echo   Done. Starting PC-Optimizer-AI...
start "" "%DEST%\START-PC-OPTIMIZER.bat"
endlocal
