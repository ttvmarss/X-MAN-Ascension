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
set "BRANCH=cursor/jarvis-stage1-ui-aa3b"
set "ZIP_URL=https://github.com/ttvmarss/X-MAN-Ascension/archive/refs/heads/cursor/jarvis-stage1-ui-aa3b.zip"
set "ZIP_FOLDER=X-MAN-Ascension-cursor-jarvis-stage1-ui-aa3b"

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

echo Jarvis source not found. Setting up...
echo      Expected: %PROJECT%
echo.

:: ---- Existing git repo: update to Jarvis branch ----
if exist "%REPO_DIR%\.git" (
    echo Updating existing repository...
    pushd "%REPO_DIR%"
    git fetch origin "%BRANCH%"
    if errorlevel 1 goto :popd_and_zip
    git checkout "%BRANCH%"
    if errorlevel 1 goto :popd_and_zip
    git pull origin "%BRANCH%"
    popd
    if exist "%PROJECT%" goto :run
    echo.
    echo Git update finished but Jarvis project still missing.
    echo.
    goto :zip_download
)

:: ---- Folder exists but is not a git repo ----
if exist "%REPO_DIR%" (
    echo Old folder found without a working copy. Renaming it...
    pushd "%USERPROFILE%\Documents"
    if exist "X-MAN-Ascension.old" rmdir /s /q "X-MAN-Ascension.old"
    ren "X-MAN-Ascension" "X-MAN-Ascension.old"
    popd
    if exist "%REPO_DIR%" (
        echo Could not rename old folder. Will try ZIP download instead...
        goto :zip_download
    )
    echo Renamed old folder to X-MAN-Ascension.old
    echo.
)

:: ---- Fresh git clone ----
where git >nul 2>&1
if not errorlevel 1 (
    echo Cloning Jarvis branch with git...
    if not exist "%USERPROFILE%\Documents" mkdir "%USERPROFILE%\Documents"
    git clone --branch "%BRANCH%" --single-branch "%REPO_URL%" "%REPO_DIR%"
    if exist "%PROJECT%" goto :run
    echo.
    echo Git clone did not produce the Jarvis project.
    echo.
)

:zip_download
echo Downloading Jarvis ZIP from GitHub...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$zip=Join-Path $env:TEMP 'X-MAN-Ascension-Jarvis.zip';" ^
  "$parent=Split-Path '%REPO_DIR%';" ^
  "$dest='%REPO_DIR%';" ^
  "$url='%ZIP_URL%';" ^
  "$folderName='%ZIP_FOLDER%';" ^
  "Write-Host 'Downloading...';" ^
  "Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing;" ^
  "$tempExtract=Join-Path $env:TEMP ('jarvis-extract-' + [guid]::NewGuid().ToString());" ^
  "New-Item -ItemType Directory -Path $tempExtract | Out-Null;" ^
  "Expand-Archive -Path $zip -DestinationPath $tempExtract -Force;" ^
  "$extracted=Join-Path $tempExtract $folderName;" ^
  "if (-not (Test-Path $extracted)) { throw ('Extracted folder not found: ' + $extracted) };" ^
  "if (Test-Path $dest) { Remove-Item $dest -Recurse -Force };" ^
  "Move-Item $extracted $dest;" ^
  "Remove-Item $zip -Force -ErrorAction SilentlyContinue;" ^
  "Remove-Item $tempExtract -Recurse -Force -ErrorAction SilentlyContinue;" ^
  "Write-Host 'Download complete.'"

if exist "%PROJECT%" goto :run

echo.
echo [ERROR] Could not set up Jarvis automatically.
echo.
echo Try this in PowerShell:
echo   Remove-Item -Recurse -Force "%REPO_DIR%"
echo Then double-click START-JARVIS.bat again.
echo.
echo Or download manually:
echo   %ZIP_URL%
echo.
pause
exit /b 1

:popd_and_zip
popd 2>nul
goto :zip_download

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
if exist "%PROJECT%" (echo   Project file: Found) else (echo   Project file: MISSING)
dotnet --version
echo.
pause
exit /b 1
