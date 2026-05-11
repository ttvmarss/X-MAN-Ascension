@echo off
title JARVIS Launcher
color 0A
echo.
echo  ====================================
echo   J.A.R.V.I.S.  -  Starting Up...
echo  ====================================
echo.

:: Get local IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1"') do (
    set LOCAL_IP=%%a
    goto :got_ip
)
:got_ip
set LOCAL_IP=%LOCAL_IP: =%

echo  Your PC IP address: %LOCAL_IP%
echo.
echo  On your phone, open Chrome and go to:
echo.
echo    http://%LOCAL_IP%:5173
echo.
echo  Make sure your phone is on the same WiFi as this PC.
echo.
echo  ====================================
echo.

:: Start backend server in a new window
start "JARVIS Backend" cmd /k "cd /d %~dp0 && python server.py"

:: Wait for backend to start
timeout /t 2 /nobreak >nul

:: Start frontend in a new window
start "JARVIS Frontend" cmd /k "cd /d %~dp0\frontend && npm run dev"

echo  JARVIS is starting...
echo  Both windows will open automatically.
echo.
echo  Press any key to close this launcher.
pause >nul
