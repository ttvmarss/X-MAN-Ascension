@echo off
title JARVIS Launcher
color 0A
echo.
echo  ============================================
echo   J.A.R.V.I.S.  -  Starting Up...
echo  ============================================
echo.

:: -------------------------------------------------------
:: Load API keys from .env file
:: -------------------------------------------------------
set "ENV_FILE=%~dp0.env"
if exist "%ENV_FILE%" (
    for /f "usebackq tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
        set "line=%%A"
        if not "%%A"=="" if not "%%A:~0,1%"=="#" (
            set "%%A=%%B"
        )
    )
    echo  [OK] Loaded API keys from .env
) else (
    echo  [WARN] No .env file found. Create one with your API keys.
)

:: -------------------------------------------------------
:: Get local WiFi IP address (for same-network phone access)
:: -------------------------------------------------------
set LOCAL_IP=Not found
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr "192.168"') do (
    set LOCAL_IP=%%a
    goto :got_ip
)
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1"') do (
    set LOCAL_IP=%%a
    goto :got_ip
)
:got_ip
set LOCAL_IP=%LOCAL_IP: =%

:: -------------------------------------------------------
:: Check for ngrok (remote/anywhere access)
:: -------------------------------------------------------
set NGROK_URL=
where ngrok >nul 2>&1
if %errorlevel%==0 (
    echo  [OK] ngrok found - will start tunnel for remote access
    set NGROK_AVAILABLE=1
) else (
    set NGROK_AVAILABLE=0
)

echo.
echo  ============================================
echo   ACCESS JARVIS FROM:
echo  ============================================
echo.
echo  PC Browser (this computer):
echo    http://localhost:5173
echo.
echo  Phone on same WiFi:
echo    http://%LOCAL_IP%:5173
echo.

if "%NGROK_AVAILABLE%"=="1" (
    echo  Starting ngrok tunnel for remote access...
    echo  (Check the ngrok window for your public HTTPS URL)
    echo.
    start "JARVIS ngrok" cmd /k "ngrok http 5173"
    timeout /t 3 /nobreak >nul
    echo  Phone from ANYWHERE (use ngrok HTTPS link shown in ngrok window)
    echo.
) else (
    echo  For phone access from ANYWHERE (not just home WiFi):
    echo    1. Download ngrok: https://ngrok.com/download
    echo    2. Sign up free at ngrok.com and get your auth token
    echo    3. Run: ngrok config add-authtoken YOUR_TOKEN
    echo    4. Run: ngrok http 5173
    echo    5. Use the https://xxxx.ngrok.io link on your phone
    echo.
)

echo  ============================================
echo.
echo  IMPORTANT: On your phone, use the HTTPS ngrok
echo  link (not the IP) so the microphone works.
echo.
echo  ============================================
echo.

:: -------------------------------------------------------
:: Start backend server
:: -------------------------------------------------------
start "JARVIS Backend - DO NOT CLOSE" cmd /k "cd /d "%~dp0" && python server.py"

:: Wait for backend to start
timeout /t 3 /nobreak >nul

:: -------------------------------------------------------
:: Start frontend
:: -------------------------------------------------------
start "JARVIS Frontend - DO NOT CLOSE" cmd /k "cd /d "%~dp0\frontend" && npm run dev"

echo  JARVIS is starting...
echo  Both windows opened. Do not close them.
echo.
echo  Press any key to close this launcher window.
pause >nul
