<#
.SYNOPSIS
    NVIDIA detection, health check, and guided optimization.
.DESCRIPTION
    Detects the NVIDIA GPU and driver, checks NVIDIA services, recommends
    Game Ready vs Studio driver, and walks through the NVIDIA Control Panel
    settings that actually matter for latency and frame stability - with an
    explanation for every one.

    Honesty note: NVIDIA Control Panel 3D settings live in NVIDIA's own
    protected settings store (DRS), not in plain registry keys. Editing that
    store blind is exactly the kind of risky hack this suite refuses, so
    this script applies what is safe to script and gives you an exact,
    explained checklist for the two-minute Control Panel part. No
    overclocking, no fan/voltage changes, ever.
#>
[CmdletBinding()]
param([switch]$NoPause, [switch]$Pause)
. "$PSScriptRoot\Common.ps1"

Write-Banner 'NVIDIA GPU detection'
$gpu = $null
try {
    $gpu = Get-CimInstance Win32_VideoController | Where-Object { $_.Name -match 'NVIDIA|GeForce|RTX|GTX|Quadro' } | Select-Object -First 1
} catch {}
if (-not $gpu) {
    Write-Log 'No NVIDIA GPU detected on this system - nothing to do here.' 'WARN'
    Write-Log 'If you DO have an NVIDIA card, it may be disabled or missing its driver: run option 2 (Driver scan).' 'INFO'
    if ($Pause -and -not $NoPause) { Read-Host 'Press Enter to close' | Out-Null }
    return
}
Write-Log "GPU: $($gpu.Name)" 'OK'
Write-Log "Windows driver version: $($gpu.DriverVersion), date: $(if ($gpu.DriverDate) { $gpu.DriverDate.ToString('yyyy-MM-dd') })" 'OK'

$smi = Get-Command nvidia-smi -ErrorAction SilentlyContinue
if ($smi) {
    $ver = (& nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>$null | Select-Object -First 1)
    if ($ver) { Write-Log "NVIDIA driver (marketing version): $ver" 'OK' }
} else {
    Write-Log 'nvidia-smi not found - fine, but suggests a very old or partial driver install.' 'WARN'
}
if ($gpu.DriverDate -and ((Get-Date) - $gpu.DriverDate).TotalDays -gt 120) {
    Write-Log "Driver is over 4 months old. For gaming, install the latest GAME READY driver:" 'WARN'
    Write-Log '  https://www.nvidia.com/Download/index.aspx  (Game Ready = gaming; Studio = only if you mainly do creative apps)' 'INFO'
} else {
    Write-Log 'Driver is reasonably current. Recommendation: Game Ready branch for a gaming PC.' 'OK'
}

Write-Banner 'NVIDIA services check'
try {
    $svcs = @(Get-Service | Where-Object { $_.Name -match 'NVDisplay|NvContainer|NVIDIA' })
    if ($svcs.Count -eq 0) { Write-Log 'No NVIDIA services found - unusual; reinstalling the driver would fix this.' 'WARN' }
    foreach ($s in $svcs) {
        $lvl = 'OK'; if ($s.Name -match 'NVDisplay' -and $s.Status -ne 'Running') { $lvl = 'WARN' }
        Write-Log "$($s.DisplayName) [$($s.Name)]: $($s.Status)" $lvl
    }
    Write-Log 'NVDisplay.Container must run (it IS the driver stack). Telemetry/FrameView services are optional.' 'INFO'
} catch { Write-Log "Service query failed: $_" 'WARN' }

Write-Banner 'Hardware-accelerated GPU scheduling (HAGS)'
$hags = Get-RegValue 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'HwSchMode'
if ($hags -eq 2) { Write-Log 'HAGS is ON - good default for recent NVIDIA cards; required for DLSS Frame Generation.' 'OK' }
else {
    Write-Log 'HAGS is OFF. On Windows 10 with a recent NVIDIA driver it usually helps latency slightly.' 'INFO'
    Write-Log 'Not auto-enabled (a minority of setups stutter with it). To A/B test: Settings > System > Display' 'INFO'
    Write-Log '> Graphics settings > toggle Hardware-accelerated GPU scheduling, then reboot and compare.' 'INFO'
}

Write-Banner 'GeForce overlay check'
$overlay = Get-Process -Name 'NVIDIA Overlay', 'nvsphelper64' -ErrorAction SilentlyContinue
if ($overlay) { Write-Log 'GeForce in-game overlay is running. If you never use Shadowplay/filters, turning it off in the NVIDIA app saves a few % GPU.' 'INFO' }
else { Write-Log 'GeForce in-game overlay not running.' 'OK' }

Write-Banner 'NVIDIA Control Panel - explained checklist (2 minutes, apply in "Manage 3D settings > Global")'
$checklist = @(
    'Low Latency Mode = ON  ("Ultra" only for competitive shooters WITHOUT in-game NVIDIA Reflex - when a game has Reflex, use Reflex instead and leave this ON, not Ultra)'
    'Power management mode = Prefer maximum performance  (stops the GPU downclocking between frames; the main anti-stutter setting)'
    'Shader Cache Size = Default or 10 GB  (never disable - disabling causes stutter)'
    'Vertical sync = Off in this panel; cap FPS in-game or with Max Frame Rate ~3 below monitor refresh if you use G-SYNC'
    'Texture filtering - Quality = Quality  (leave it; "High performance" gains ~1% for visible shimmer)'
    'Threaded optimization = Auto  (leave it)'
    'Do NOT touch: anisotropic/antialiasing overrides, and never overclock from third-party tools "because a guide said so"'
)
foreach ($c in $checklist) { Write-Log $c 'ASK' }
Write-Log 'Each of these is stability-neutral; none disable safety features. No overclocking is ever applied.' 'INFO'

if ($Pause -and -not $NoPause) { Read-Host "`nDone. Press Enter to close" | Out-Null }
