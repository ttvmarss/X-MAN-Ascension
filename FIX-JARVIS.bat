@echo off
title Jarvis Quick Fix
echo.
echo Updating your existing X-MAN-Ascension folder with Jarvis files...
echo.

set "REPO_DIR=%USERPROFILE%\Documents\X-MAN-Ascension"
set "PROJECT=%REPO_DIR%\Jarvis\src\Jarvis\Jarvis.csproj"

if not exist "%REPO_DIR%\.git" (
    echo [ERROR] Git folder not found at:
    echo   %REPO_DIR%
    echo.
    echo Use START-JARVIS.bat instead.
    pause
    exit /b 1
)

pushd "%REPO_DIR%"
git pull origin claude/evaluate-code-quality-ZHj0S
popd

if not exist "%PROJECT%" (
    echo.
    echo [ERROR] Jarvis still missing after update.
    echo Download fresh copy:
    echo   https://github.com/ttvmarss/X-MAN-Ascension/archive/refs/heads/claude/evaluate-code-quality-ZHj0S.zip
    pause
    exit /b 1
)

echo.
echo [OK] Jarvis found. Launching...
echo.
cd /d "%REPO_DIR%\Jarvis"
dotnet restore "%PROJECT%"
dotnet build "%PROJECT%" -c Release
dotnet run --project "%PROJECT%" -c Release
pause
