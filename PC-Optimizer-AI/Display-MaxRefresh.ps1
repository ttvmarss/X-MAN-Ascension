<#
.SYNOPSIS
    Sets every connected monitor to its highest supported refresh rate at
    the current resolution - safely, with test-before-apply and full revert.
.DESCRIPTION
    Uses the documented Win32 display API (EnumDisplaySettings /
    ChangeDisplaySettingsEx):
      - Only changes REFRESH RATE, never resolution or color depth.
      - Every mode is validated with CDS_TEST before being applied, so an
        unsupported combination is rejected by Windows instead of applied.
      - The old refresh rate is journaled; Revert-Changes.ps1 restores it.
      - If the screen goes black on a bad cable: Windows itself reverts
        after 15 seconds when the new mode fails to display.
    Why this matters: Windows regularly leaves 144/165/240 Hz monitors
    running at 60 Hz after driver updates or when a cable was re-plugged.
.PARAMETER RestoreDevice
    Internal (used by Revert-Changes.ps1): restore this display...
.PARAMETER RestoreHz
    ...to this refresh rate, instead of maximizing.
#>
[CmdletBinding()]
param(
    [switch]$NoPause, [switch]$Pause,
    [string]$RestoreDevice, [int]$RestoreHz
)
. "$PSScriptRoot\Common.ps1"

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class PcOptDisplay {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public struct DEVMODE {
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmDeviceName;
        public short dmSpecVersion, dmDriverVersion, dmSize, dmDriverExtra;
        public int dmFields;
        public int dmPositionX, dmPositionY, dmDisplayOrientation, dmDisplayFixedOutput;
        public short dmColor, dmDuplex, dmYResolution, dmTTOption, dmCollate;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmFormName;
        public short dmLogPixels;
        public int dmBitsPerPel, dmPelsWidth, dmPelsHeight, dmDisplayFlags, dmDisplayFrequency;
        public int dmICMMethod, dmICMIntent, dmMediaType, dmDitherType, dmReserved1, dmReserved2, dmPanningWidth, dmPanningHeight;
    }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public struct DISPLAY_DEVICE {
        public int cb;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string DeviceName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceString;
        public int StateFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceID;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceKey;
    }
    [DllImport("user32.dll", CharSet = CharSet.Ansi)]
    public static extern bool EnumDisplayDevices(string lpDevice, uint iDevNum, ref DISPLAY_DEVICE lpDisplayDevice, uint dwFlags);
    [DllImport("user32.dll", CharSet = CharSet.Ansi)]
    public static extern bool EnumDisplaySettings(string deviceName, int modeNum, ref DEVMODE devMode);
    [DllImport("user32.dll", CharSet = CharSet.Ansi)]
    public static extern int ChangeDisplaySettingsEx(string lpszDeviceName, ref DEVMODE lpDevMode, IntPtr hwnd, uint dwflags, IntPtr lParam);
    public const int ENUM_CURRENT_SETTINGS = -1;
    public const uint CDS_TEST = 0x2;
    public const uint CDS_UPDATEREGISTRY = 0x1;
    public const int DM_BITSPERPEL = 0x40000, DM_PELSWIDTH = 0x80000, DM_PELSHEIGHT = 0x100000, DM_DISPLAYFREQUENCY = 0x400000;
    public const int ATTACHED_TO_DESKTOP = 0x1;
}
'@ -ErrorAction Stop

function Get-AttachedDisplays {
    $list = @(); $i = 0
    while ($true) {
        $dd = New-Object PcOptDisplay+DISPLAY_DEVICE
        $dd.cb = [Runtime.InteropServices.Marshal]::SizeOf($dd)
        if (-not [PcOptDisplay]::EnumDisplayDevices($null, $i, [ref]$dd, 0)) { break }
        if ($dd.StateFlags -band [PcOptDisplay]::ATTACHED_TO_DESKTOP) { $list += $dd }
        $i++
    }
    return $list
}
function Get-CurrentMode([string]$Device) {
    $dm = New-Object PcOptDisplay+DEVMODE
    $dm.dmSize = [Runtime.InteropServices.Marshal]::SizeOf($dm)
    if ([PcOptDisplay]::EnumDisplaySettings($Device, [PcOptDisplay]::ENUM_CURRENT_SETTINGS, [ref]$dm)) { return $dm }
    return $null
}
function Set-RefreshRate([string]$Device, $CurrentMode, [int]$TargetHz) {
    # Change ONLY the frequency; test first so Windows rejects bad modes.
    $dm = $CurrentMode
    $dm.dmDisplayFrequency = $TargetHz
    $dm.dmFields = [PcOptDisplay]::DM_PELSWIDTH -bor [PcOptDisplay]::DM_PELSHEIGHT -bor [PcOptDisplay]::DM_BITSPERPEL -bor [PcOptDisplay]::DM_DISPLAYFREQUENCY
    $test = [PcOptDisplay]::ChangeDisplaySettingsEx($Device, [ref]$dm, [IntPtr]::Zero, [PcOptDisplay]::CDS_TEST, [IntPtr]::Zero)
    if ($test -ne 0) { Write-Log "  $Device : Windows rejected $TargetHz Hz in test mode (code $test) - not applied." 'WARN'; return $false }
    $res = [PcOptDisplay]::ChangeDisplaySettingsEx($Device, [ref]$dm, [IntPtr]::Zero, [PcOptDisplay]::CDS_UPDATEREGISTRY, [IntPtr]::Zero)
    if ($res -ne 0) { Write-Log "  $Device : apply failed (code $res)." 'WARN'; return $false }
    return $true
}

# ------------------------------------------------------------ restore path -
if ($RestoreDevice -and $RestoreHz) {
    Write-Banner "Restoring $RestoreDevice to $RestoreHz Hz"
    $cur = Get-CurrentMode $RestoreDevice
    if ($cur -and (Set-RefreshRate $RestoreDevice $cur $RestoreHz)) { Write-Log "Restored $RestoreDevice to $RestoreHz Hz." 'OK' }
    return
}

# --------------------------------------------------------------- main path -
Write-Banner 'Monitor refresh rate maximizer'
$displays = @(Get-AttachedDisplays)
if ($displays.Count -eq 0) { Write-Log 'No attached displays found.' 'WARN' }
foreach ($d in $displays) {
    $cur = Get-CurrentMode $d.DeviceName
    if (-not $cur) { Write-Log "$($d.DeviceName): could not read current mode." 'WARN'; continue }
    Write-Log "$($d.DeviceString) [$($d.DeviceName)]: currently $($cur.dmPelsWidth)x$($cur.dmPelsHeight) @ $($cur.dmDisplayFrequency) Hz" 'INFO'

    # Enumerate every mode this monitor+GPU combination supports at the
    # CURRENT resolution and color depth, and find the highest refresh rate.
    $maxHz = $cur.dmDisplayFrequency; $i = 0
    while ($true) {
        $m = New-Object PcOptDisplay+DEVMODE
        $m.dmSize = [Runtime.InteropServices.Marshal]::SizeOf($m)
        if (-not [PcOptDisplay]::EnumDisplaySettings($d.DeviceName, $i, [ref]$m)) { break }
        if ($m.dmPelsWidth -eq $cur.dmPelsWidth -and $m.dmPelsHeight -eq $cur.dmPelsHeight -and
            $m.dmBitsPerPel -eq $cur.dmBitsPerPel -and $m.dmDisplayFrequency -gt $maxHz) {
            $maxHz = $m.dmDisplayFrequency
        }
        $i++
    }
    if ($maxHz -le $cur.dmDisplayFrequency) {
        Write-Log "  Already at the highest supported rate ($($cur.dmDisplayFrequency) Hz) for this resolution." 'OK'
        continue
    }
    Write-Log "  Highest supported at this resolution: $maxHz Hz - applying (test first)..." 'INFO'
    $oldHz = $cur.dmDisplayFrequency
    if (Set-RefreshRate $d.DeviceName $cur $maxHz) {
        $verify = Get-CurrentMode $d.DeviceName
        if ($verify -and $verify.dmDisplayFrequency -eq $maxHz) {
            Write-Log "  $($d.DeviceString): $oldHz Hz -> $maxHz Hz - verified." 'OK'
            Add-JournalEntry @{
                Type = 'DisplayMode'; Device = $d.DeviceName
                OldValue = $oldHz; NewValue = $maxHz
                Description = "Refresh rate $($d.DeviceString) ($($d.DeviceName)) $oldHz -> $maxHz Hz"
            }
        } else { Write-Log '  Applied but verification read a different value - check Settings > Display > Advanced.' 'WARN' }
    }
}
Write-Log 'Note: if a screen ever goes black from a marginal cable, Windows auto-reverts after 15 seconds.' 'INFO'
Write-Log 'Tip: 144+ Hz over HDMI sometimes needs a DisplayPort cable instead - if a rate was rejected, that is why.' 'INFO'

if ($Pause -and -not $NoPause) { Read-Host "`nDone. Press Enter to close" | Out-Null }
