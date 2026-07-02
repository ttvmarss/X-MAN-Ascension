<#
.SYNOPSIS
    Safe, documented, reversible registry optimizations - each one explained,
    backed up to a .reg file, and journaled for Revert-Changes.ps1.
.DESCRIPTION
    Policy enforced here (not just promised):
      - Only Microsoft-documented settings with a real, explainable effect.
      - Old value recorded before every change; key exported to
        RegistryBackups first; every change lands in the revert journal.
      - Explicitly REFUSED (the popular fakes): TcpAckFrequency/Nagle hacks,
        timer-resolution hacks, SvcHostSplitThreshold, Win32PrioritySeparation
        "gaming values", disabling mitigations, disabling services, and every
        other "secret FPS" tweak. They are unmeasurable or actively harmful,
        so this script will not apply them even if asked nicely by the
        internet.
#>
[CmdletBinding()]
param([switch]$NoPause, [switch]$Pause)
. "$PSScriptRoot\Common.ps1"

Write-Banner 'Safe registry optimization'
if (-not (Assert-Admin 'Registry optimization')) {
    if ($Pause -and -not $NoPause) { Read-Host 'Press Enter to close' | Out-Null }
    return
}
New-SafetyRestorePoint 'before registry tweaks'

# Each call explains What + Why, backs up, journals, applies. Idempotent.
Set-TrackedRegValue -Path 'HKCU:\Software\Microsoft\GameBar' -Name 'AutoGameModeEnabled' -Value 1 `
    -What 'Enable Game Mode' `
    -Why 'documented: prioritizes the foreground game, defers Windows Update scans while playing' | Out-Null

Set-TrackedRegValue -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_Enabled' -Value 0 `
    -What 'Disable Game DVR background recording' `
    -Why 'always-on capture costs CPU/GPU time in every game; you can still record manually' | Out-Null

Set-TrackedRegValue -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR' -Name 'AppCaptureEnabled' -Value 0 `
    -What 'Disable automatic app capture' `
    -Why 'companion to GameDVR; stops the capture pipeline loading behind games' | Out-Null

Set-TrackedRegValue -Path 'HKCU:\Software\Microsoft\GameBar' -Name 'ShowStartupPanel' -Value 0 `
    -What 'Stop Game Bar startup panel' `
    -Why 'cosmetic-but-real: Game Bar stops popping its panel when a game starts' | Out-Null

Set-TrackedRegValue -Path 'HKCU:\Control Panel\Desktop' -Name 'MenuShowDelay' -Value '200' -Type 'String' `
    -What 'Menu show delay 400ms -> 200ms' `
    -Why 'documented desktop responsiveness setting; menus open faster, zero risk (0 makes menus twitchy, 200 is the sane value)' | Out-Null

Write-Banner 'Refused tweaks (so you know they were considered, not forgotten)'
Write-Log 'TcpAckFrequency / TCPNoDelay (Nagle): no measurable game benefit on modern Windows; can hurt throughput.' 'INFO'
Write-Log 'Timer resolution hacks (bcdedit useplatformclock etc): placebo-to-harmful on Win10 1809+.' 'INFO'
Write-Log 'Win32PrioritySeparation "gaming" values: undocumented interactions, stutter reports; default is correct.' 'INFO'
Write-Log 'SvcHostSplitThreshold: breaks service isolation for zero FPS.' 'INFO'
Write-Log 'Disabling mitigations/Spectre patches: real security damage for ~1-2% in synthetic tests. Never.' 'INFO'
Write-Log 'Disabling SysMain/Prefetch/pagefile: hurts load times and stability on modern hardware. Never.' 'INFO'

Write-Log "All changes journaled. Undo: option 7 (Revert) or the .reg files in $RegBackDir" 'OK'
if ($Pause -and -not $NoPause) { Read-Host "`nDone. Press Enter to close" | Out-Null }
