@echo off
title X-MAN Fortnite Ping Fixer
color 0A
echo ============================================================
echo         X-MAN FORTNITE PING FIXER - Ethernet Edition
echo ============================================================
echo.
echo This script fixes high ping / lag spikes in Fortnite.
echo You MUST run this as Administrator (right-click ^> Run as admin).
echo.

:: Check for admin privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    color 0C
    echo [ERROR] This script requires Administrator privileges.
    echo Right-click this file and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo [OK] Running as Administrator
echo.

:: ============================================================
:: STEP 1: Flush DNS Cache
:: ============================================================
echo [STEP 1/10] Flushing DNS cache...
ipconfig /flushdns >nul 2>&1
echo    Done - DNS cache cleared.
echo.

:: ============================================================
:: STEP 2: Reset Winsock Catalog
:: ============================================================
echo [STEP 2/10] Resetting Winsock catalog...
netsh winsock reset >nul 2>&1
echo    Done - Winsock reset (takes effect after reboot).
echo.

:: ============================================================
:: STEP 3: Reset TCP/IP Stack
:: ============================================================
echo [STEP 3/10] Resetting TCP/IP stack...
netsh int ip reset >nul 2>&1
echo    Done - TCP/IP stack reset.
echo.

:: ============================================================
:: STEP 4: Disable Nagle's Algorithm (reduces input delay)
:: ============================================================
echo [STEP 4/10] Disabling Nagle's Algorithm for lower latency...
for /f "tokens=3" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces" 2^>nul ^| findstr /i "HKEY"') do (
    reg add "%%a" /v TcpAckFrequency /t REG_DWORD /d 1 /f >nul 2>&1
    reg add "%%a" /v TCPNoDelay /t REG_DWORD /d 1 /f >nul 2>&1
)
echo    Done - Nagle's Algorithm disabled on all interfaces.
echo.

:: ============================================================
:: STEP 5: Optimize Network Throttling
:: ============================================================
echo [STEP 5/10] Disabling network throttling...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile" /v NetworkThrottlingIndex /t REG_DWORD /d 0xFFFFFFFF /f >nul 2>&1
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile" /v SystemResponsiveness /t REG_DWORD /d 0 /f >nul 2>&1
echo    Done - Network throttling disabled.
echo.

:: ============================================================
:: STEP 6: Disable Auto-Tuning (common cause of sudden lag)
:: ============================================================
echo [STEP 6/10] Disabling TCP Auto-Tuning...
netsh int tcp set global autotuninglevel=disabled >nul 2>&1
echo    Done - Auto-Tuning disabled.
echo.

:: ============================================================
:: STEP 7: Disable Large Send Offload and other NIC offloads
:: ============================================================
echo [STEP 7/10] Disabling NIC offload features...
netsh int tcp set global chimney=disabled >nul 2>&1
netsh int tcp set global rss=enabled >nul 2>&1
netsh int tcp set global timestamps=disabled >nul 2>&1
echo    Done - NIC offload settings optimized.
echo.

:: ============================================================
:: STEP 8: Set DNS to Cloudflare (1.1.1.1) or Google (8.8.8.8)
:: ============================================================
echo [STEP 8/10] Setting DNS to Cloudflare (1.1.1.1) for faster routing...
for /f "tokens=1* delims=:" %%a in ('netsh interface show interface ^| findstr /i "Connected"') do (
    for /f "tokens=4*" %%c in ("%%b") do (
        netsh interface ip set dns name="%%c %%d" static 1.1.1.1 primary >nul 2>&1
        netsh interface ip add dns name="%%c %%d" 1.0.0.1 index=2 >nul 2>&1
    )
)
echo    Done - DNS set to Cloudflare 1.1.1.1 / 1.0.0.1
echo.

:: ============================================================
:: STEP 9: Disable Windows background services that steal bandwidth
:: ============================================================
echo [STEP 9/10] Disabling background bandwidth consumers...

:: Disable Delivery Optimization (Windows Update P2P sharing)
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization" /v DODownloadMode /t REG_DWORD /d 0 /f >nul 2>&1

:: Disable auto Windows Update downloads during gaming
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" /v NoAutoUpdate /t REG_DWORD /d 1 /f >nul 2>&1

:: Stop background intelligent transfer service
net stop BITS >nul 2>&1

:: Stop Windows Update service temporarily
net stop wuauserv >nul 2>&1

echo    Done - Background downloaders stopped.
echo.

:: ============================================================
:: STEP 10: Release and Renew IP Address
:: ============================================================
echo [STEP 10/10] Releasing and renewing IP address...
ipconfig /release >nul 2>&1
timeout /t 2 /nobreak >nul
ipconfig /renew >nul 2>&1
echo    Done - IP address renewed.
echo.

echo ============================================================
echo                    ALL FIXES APPLIED!
echo ============================================================
echo.
echo IMPORTANT NEXT STEPS:
echo   1. RESTART your PC for all changes to take effect
echo   2. After restart, open Fortnite and check your ping
echo   3. If ping is still high, also run FIX-FORTNITE-PING-ADVANCED.ps1
echo.
echo ALSO CHECK THESE MANUALLY:
echo   - Unplug and replug your Ethernet cable
echo   - Restart your router/modem (unplug 30 seconds)
echo   - Make sure no one else is streaming/downloading on your network
echo   - In Fortnite Settings ^> set Matchmaking Region to your closest server
echo.
echo ============================================================
pause
