@echo off
setlocal EnableExtensions
title Jarvis Setup and Launch

echo.
echo  ========================================
echo   JARVIS - Automatic Setup and Launch
echo  ========================================
echo.

set "REPO_DIR=%USERPROFILE%\Documents\X-MAN-Ascension"
set "JARVIS_DIR=%REPO_DIR%\Jarvis"
set "PROJECT=%JARVIS_DIR%\src\Jarvis\Jarvis.csproj"
set "REPO_URL=https://github.com/ttvmarss/X-MAN-Ascension.git"

:: ---- Check .NET ----
where dotnet >nul 2>&1
if errorlevel 1 (
    echo [ERROR] .NET SDK is not installed.
    echo.
    echo Install .NET 8 SDK, then double-click this file again:
    echo   https://dotnet.microsoft.com/download/dotnet/8.0
    echo.
    start https://dotnet.microsoft.com/download/dotnet/8.0
    pause
    exit /b 1
)

echo [OK] .NET found:
dotnet --version
echo.

:: ---- Get source code ----
if exist "%PROJECT%" (
    echo [OK] Jarvis project found at:
    echo      %JARVIS_DIR%
    echo.
    goto :run
)

echo Jarvis is not on this PC yet. Downloading...
echo.

:: Try git clone first
where git >nul 2>&1
if not errorlevel 1 (
    echo Cloning repository with git...
    if not exist "%USERPROFILE%\Documents" mkdir "%USERPROFILE%\Documents"
    git clone "%REPO_URL%" "%REPO_DIR%"
    if exist "%PROJECT%" goto :run
    echo.
    echo Git clone failed. Trying ZIP download instead...
    echo.
)

:: Fallback: PowerShell ZIP download
echo Downloading ZIP from GitHub...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$zip=Join-Path $env:TEMP 'X-MAN-Ascension.zip';" ^
  "$dest='%REPO_DIR%';" ^
  "$url='https://github.com/ttvmarss/X-MAN-Ascension/archive/refs/heads/claude/evaluate-code-quality-ZHj0S.zip';" ^
  "Invoke-WebRequest -Uri $url -OutFile $zip;" ^
  "if (Test-Path $dest) { Remove-Item $dest -Recurse -Force };" ^
  "Expand-Archive -Path $zip -DestinationPath (Split-Path $dest);" ^
  "$extracted=Join-Path (Split-Path $dest) 'X-MAN-Ascension-claude-evaluate-code-quality-ZHj0S';" ^
  "Move-Item $extracted $dest;" ^
  "Remove-Item $zip -Force;" ^
  "Write-Host 'Download complete.'"

if not exist "%PROJECT%" (
    echo.
    echo [ERROR] Could not download Jarvis automatically.
    echo Download manually from:
    echo   https://github.com/ttvmarss/X-MAN-Ascension
    echo.
    pause
    exit /b 1
)

:run
cd /d "%JARVIS_DIR%"
echo.
echo Restoring packages...
dotnet restore "%PROJECT%"
if errorlevel 1 goto :fail

echo.
echo Building Jarvis...
dotnet build "%PROJECT%" -c Release
if errorlevel 1 goto :fail

echo.
echo Starting Jarvis...
echo.
dotnet run --project "%PROJECT%" -c Release
if errorlevel 1 goto :fail

echo.
echo Jarvis closed.
pause
exit /b 0

:fail
echo.
echo [ERROR] Something went wrong.
echo.
echo Send this info for help:
echo   Folder: %JARVIS_DIR%
echo   Project exists: 
if exist "%PROJECT%" (echo   True) else (echo   False)
dotnet --version
echo.
pause
exit /b 1
