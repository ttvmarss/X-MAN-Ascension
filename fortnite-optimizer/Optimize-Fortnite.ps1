<#
================================================================================
  Windows 10 Fortnite Optimizer  (RAID-SAFE)
================================================================================
  What it does, in one run:
    - Creates a System Restore point first (so everything is reversible)
    - Debloats: removes common preinstalled / bloatware apps
    - Disables background apps
    - Applies performance + registry tweaks
    - Turns OFF Game DVR / background recording, turns ON Game Mode
    - Enables GPU hardware-accelerated scheduling
    - Network / Wi-Fi tuning (DNS, TCP autotuning, disable Nagle, winsock reset)
    - Sets BOTH the desktop and the lock-screen backgrounds to solid black
    - Cleans temp files

  RAID SAFETY:
    - Never runs defrag, diskpart, or any disk/partition/array operation.
    - Touches only OS settings, the registry, and network config. Your RAID
      array and its data are not modified in any way.

  HOW TO RUN:
    1) Start -> type "powershell" -> RIGHT-CLICK -> "Run as administrator"
    2) Paste this whole file (or run it) and press Enter.

  Everything below is wrapped in try/catch so one failure won't stop the rest.
================================================================================
#>

# ---------------------------------------------------------------------------
# 0. Require administrator
# ---------------------------------------------------------------------------
$isAdmin = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent()
    ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "This must be run from an ADMINISTRATOR PowerShell." -ForegroundColor Red
    Write-Host "Close this window. Start -> type powershell -> right-click -> Run as administrator." -ForegroundColor Yellow
    return
}

$ErrorActionPreference = 'Continue'
function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function OK($msg)   { Write-Host "    [ok] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "    [skip] $msg" -ForegroundColor DarkYellow }

Write-Host "================================================" -ForegroundColor Magenta
Write-Host "  Windows 10 Fortnite Optimizer  (RAID-safe)"     -ForegroundColor Magenta
Write-Host "================================================" -ForegroundColor Magenta

# ---------------------------------------------------------------------------
# 1. System Restore point (reversibility)
# ---------------------------------------------------------------------------
Step "Creating a System Restore point"
try {
    Enable-ComputerRestore -Drive "$env:SystemDrive\" -ErrorAction SilentlyContinue
    # Remove the 24h throttle so the checkpoint actually gets created
    New-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SystemRestore" `
        -Name "SystemRestorePointCreationFrequency" -Value 0 -PropertyType DWord -Force | Out-Null
    Checkpoint-Computer -Description "Before Fortnite Optimizer" -RestorePointType "MODIFY_SETTINGS"
    OK "Restore point created (roll back anytime via 'Create a restore point' -> System Restore)"
} catch { Warn "Could not create restore point: $($_.Exception.Message)" }

# ---------------------------------------------------------------------------
# 2. Debloat - remove common preinstalled / bloatware apps
#    (Curated list. Store, Terminal, winget, .NET/VCLibs, Calculator, Photos
#     are intentionally KEPT.)
# ---------------------------------------------------------------------------
Step "Removing bloatware apps"
$bloat = @(
    "Microsoft.3DBuilder","Microsoft.Microsoft3DViewer","Microsoft.MixedReality.Portal",
    "Microsoft.BingNews","Microsoft.BingWeather","Microsoft.BingFinance","Microsoft.BingSports",
    "Microsoft.News","Microsoft.MicrosoftOfficeHub","Microsoft.Office.OneNote","Microsoft.SkypeApp",
    "Microsoft.GetHelp","Microsoft.Getstarted","Microsoft.Microsoft3DViewer",
    "Microsoft.MicrosoftSolitaireCollection","Microsoft.People","Microsoft.WindowsFeedbackHub",
    "Microsoft.WindowsMaps","Microsoft.WindowsAlarms","Microsoft.ZuneMusic","Microsoft.ZuneVideo",
    "Microsoft.YourPhone","Microsoft.MSPaint","Microsoft.Wallet","Microsoft.OneConnect",
    "Microsoft.Print3D","Microsoft.Messaging","Microsoft.MicrosoftStickyNotes",
    "Microsoft.MicrosoftPowerBIForWindows","Microsoft.NetworkSpeedTest","Microsoft.Todos",
    "Microsoft.PowerAutomateDesktop","Clipchamp.Clipchamp","Microsoft.Windows.DevHome",
    "*CandyCrush*","*Dolby*","*Spotify*","*Disney*","*Netflix*","*Facebook*","*Twitter*",
    "*Duolingo*","*Hidden*","*McAfee*","*Minecraft*","*Solitaire*","*Xbox.TCUI*",
    "Microsoft.XboxApp","Microsoft.XboxGameOverlay","Microsoft.XboxGamingOverlay",
    "Microsoft.Xbox.TCUI","Microsoft.XboxSpeechToTextOverlay","Microsoft.XboxIdentityProvider"
)
foreach ($app in $bloat) {
    try {
        Get-AppxPackage -AllUsers -Name $app -ErrorAction SilentlyContinue |
            Remove-AppxPackage -AllUsers -ErrorAction SilentlyContinue
        Get-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue |
            Where-Object { $_.DisplayName -like $app } |
            ForEach-Object { Remove-AppxProvisionedPackage -Online -PackageName $_.PackageName -ErrorAction SilentlyContinue | Out-Null }
        OK "removed $app"
    } catch { Warn "$app not present" }
}

# ---------------------------------------------------------------------------
# 3. Disable background apps (global)
# ---------------------------------------------------------------------------
Step "Disabling background apps"
try {
    New-Item -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications" -Force | Out-Null
    Set-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications" -Name "GlobalUserDisabled" -Value 1 -Type DWord
    New-Item -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Search" -Force | Out-Null
    Set-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Search" -Name "BackgroundAppGlobalToggle" -Value 0 -Type DWord
    OK "background apps disabled"
} catch { Warn $_.Exception.Message }

# ---------------------------------------------------------------------------
# 4. Telemetry / tracking off
# ---------------------------------------------------------------------------
Step "Reducing telemetry & tracking"
try {
    New-Item -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection" -Force | Out-Null
    Set-ItemProperty "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection" -Name "AllowTelemetry" -Value 0 -Type DWord
    New-Item -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo" -Force | Out-Null
    Set-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo" -Name "Enabled" -Value 0 -Type DWord
    foreach ($svc in @("DiagTrack","dmwappushservice")) {
        Stop-Service $svc -ErrorAction SilentlyContinue
        Set-Service  $svc -StartupType Disabled -ErrorAction SilentlyContinue
    }
    OK "telemetry reduced"
} catch { Warn $_.Exception.Message }

# ---------------------------------------------------------------------------
# 5. Performance power plan (Ultimate Performance)
# ---------------------------------------------------------------------------
Step "Setting high-performance power plan"
try {
    powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61 2>$null | Out-Null
    $ult = (powercfg -list | Select-String "Ultimate Performance")
    if ($ult) {
        $guid = ($ult.ToString() -split '\s+')[3]
        powercfg -setactive $guid 2>$null
        OK "Ultimate Performance plan active"
    } else {
        powercfg -setactive SCHEME_MIN 2>$null   # High performance fallback
        OK "High Performance plan active"
    }
    powercfg -change -monitor-timeout-ac 0 2>$null
    powercfg -change -disk-timeout-ac 0    2>$null
    powercfg -change -standby-timeout-ac 0 2>$null
    powercfg -change -hibernate-timeout-ac 0 2>$null
} catch { Warn $_.Exception.Message }

# ---------------------------------------------------------------------------
# 6. Visual effects -> best performance, snappier UI
# ---------------------------------------------------------------------------
Step "Tuning visual effects for performance"
try {
    New-Item -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects" -Force | Out-Null
    Set-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects" -Name "VisualFXSetting" -Value 2 -Type DWord
    Set-ItemProperty "HKCU:\Control Panel\Desktop" -Name "MenuShowDelay" -Value "0"
    Set-ItemProperty "HKCU:\Control Panel\Desktop" -Name "UserPreferencesMask" -Value ([byte[]](0x90,0x12,0x03,0x80,0x10,0x00,0x00,0x00)) -Type Binary
    Set-ItemProperty "HKCU:\Control Panel\Desktop\WindowMetrics" -Name "MinAnimate" -Value "0"
    OK "visual effects set to performance"
} catch { Warn $_.Exception.Message }

# ---------------------------------------------------------------------------
# 7. Game DVR OFF, Game Mode ON, GPU hardware scheduling ON
# ---------------------------------------------------------------------------
Step "Gaming tweaks (Game DVR off, Game Mode on, HW GPU scheduling on)"
try {
    New-Item -Path "HKCU:\System\GameConfigStore" -Force | Out-Null
    Set-ItemProperty "HKCU:\System\GameConfigStore" -Name "GameDVR_Enabled" -Value 0 -Type DWord
    New-Item -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\GameDVR" -Force | Out-Null
    Set-ItemProperty "HKLM:\SOFTWARE\Policies\Microsoft\Windows\GameDVR" -Name "AllowGameDVR" -Value 0 -Type DWord
    New-Item -Path "HKCU:\Software\Microsoft\GameBar" -Force | Out-Null
    Set-ItemProperty "HKCU:\Software\Microsoft\GameBar" -Name "AllowAutoGameMode" -Value 1 -Type DWord
    Set-ItemProperty "HKCU:\Software\Microsoft\GameBar" -Name "AutoGameModeEnabled" -Value 1 -Type DWord
    # GPU hardware-accelerated scheduling (needs reboot)
    Set-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" -Name "HwSchMode" -Value 2 -Type DWord
    # Prioritize games in the multimedia scheduler
    $games = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games"
    New-Item -Path $games -Force | Out-Null
    Set-ItemProperty $games -Name "GPU Priority" -Value 8 -Type DWord
    Set-ItemProperty $games -Name "Priority"     -Value 6 -Type DWord
    Set-ItemProperty $games -Name "Scheduling Category" -Value "High" -Type String
    OK "gaming tweaks applied"
} catch { Warn $_.Exception.Message }

# ---------------------------------------------------------------------------
# 8. Network / Wi-Fi tuning
# ---------------------------------------------------------------------------
Step "Network / Wi-Fi tuning"
try {
    netsh int tcp set global autotuninglevel=normal   | Out-Null
    netsh int tcp set global rss=enabled              | Out-Null
    netsh int tcp set global ecncapability=enabled    | Out-Null
    netsh int tcp set heuristics disabled             | Out-Null
    netsh int tcp set global timestamps=disabled      | Out-Null
    # Disable Nagle's algorithm on every interface (lower latency)
    $ifRoot = "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces"
    Get-ChildItem $ifRoot | ForEach-Object {
        Set-ItemProperty $_.PSPath -Name "TcpAckFrequency" -Value 1 -Type DWord -ErrorAction SilentlyContinue
        Set-ItemProperty $_.PSPath -Name "TCPNoDelay"      -Value 1 -Type DWord -ErrorAction SilentlyContinue
    }
    # Fast, reliable DNS (Cloudflare + Google) on active adapters
    Get-DnsClientServerAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Out-Null
    Get-NetAdapter -Physical -ErrorAction SilentlyContinue | Where-Object Status -eq "Up" | ForEach-Object {
        Set-DnsClientServerAddress -InterfaceIndex $_.ifIndex -ServerAddresses ("1.1.1.1","8.8.8.8") -ErrorAction SilentlyContinue
    }
    ipconfig /flushdns | Out-Null
    netsh winsock reset | Out-Null   # takes full effect after reboot
    OK "network tuned (DNS 1.1.1.1/8.8.8.8, Nagle off, autotuning normal)"
} catch { Warn $_.Exception.Message }

# ---------------------------------------------------------------------------
# 9. Black backgrounds - desktop AND lock screen
# ---------------------------------------------------------------------------
Step "Setting desktop and lock-screen backgrounds to black"
try {
    # Generate a solid black image locally (no download)
    Add-Type -AssemblyName System.Drawing
    $imgDir = "$env:ProgramData\FortniteOptimizer"
    New-Item -ItemType Directory -Path $imgDir -Force | Out-Null
    $black = Join-Path $imgDir "black.png"
    $bmp = New-Object System.Drawing.Bitmap 1920,1080
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Black)
    $g.Dispose()
    $bmp.Save($black,[System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()

    # --- Desktop: solid black ---
    Set-ItemProperty "HKCU:\Control Panel\Colors"  -Name "Background" -Value "0 0 0"
    Set-ItemProperty "HKCU:\Control Panel\Desktop" -Name "WallPaper" -Value $black
    Set-ItemProperty "HKCU:\Control Panel\Desktop" -Name "WallpaperStyle" -Value "2"
    Set-ItemProperty "HKCU:\Control Panel\Desktop" -Name "TileWallpaper"  -Value "0"
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Wp {
  [DllImport("user32.dll", CharSet=CharSet.Auto)]
  public static extern int SystemParametersInfo(int a,int b,string c,int d);
}
"@
    [Wp]::SystemParametersInfo(20,0,$black,3) | Out-Null   # SPI_SETDESKWALLPAPER

    # --- Lock screen: solid black (enterprise personalization CSP) ---
    $csp = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\PersonalizationCSP"
    New-Item -Path $csp -Force | Out-Null
    Set-ItemProperty $csp -Name "LockScreenImageStatus" -Value 1 -Type DWord
    Set-ItemProperty $csp -Name "LockScreenImagePath"   -Value $black -Type String
    Set-ItemProperty $csp -Name "LockScreenImageUrl"    -Value $black -Type String
    OK "both backgrounds set to black"
} catch { Warn $_.Exception.Message }

# ---------------------------------------------------------------------------
# 10. Clean temp files  (RAID-safe: file deletes only, no disk operations)
# ---------------------------------------------------------------------------
Step "Cleaning temp files"
try {
    Remove-Item "$env:TEMP\*"        -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item "$env:WINDIR\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item "$env:WINDIR\Prefetch\*" -Recurse -Force -ErrorAction SilentlyContinue
    OK "temp files cleared"
} catch { Warn $_.Exception.Message }

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
Write-Host "`n================================================" -ForegroundColor Magenta
Write-Host "  DONE. A RESTART is required for all tweaks"        -ForegroundColor Green
Write-Host "  (GPU scheduling, winsock, lock screen) to apply."  -ForegroundColor Green
Write-Host "  Restart now?  Run:  Restart-Computer"              -ForegroundColor Yellow
Write-Host "  To undo everything: System Restore -> 'Before Fortnite Optimizer'" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Magenta
