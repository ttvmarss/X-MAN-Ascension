<#
.SYNOPSIS
    Actually installs driver updates - through the OFFICIAL Windows Update
    driver channel only - and hunts down missing/hidden devices.
.DESCRIPTION
    What it does, in order:
      1. Restore point (drivers are the one thing you really want that for).
      2. Rescans hardware (pnputil /scan-devices) so Windows re-detects
         anything missing or misdetected.
      3. Lists problem devices (broken drivers) and hidden "ghost" devices.
      4. Searches Windows Update for driver-class updates via the documented
         Windows Update Agent API, shows you the list, and installs the ones
         you approve. This is the same channel Device Manager's "Search
         automatically" uses - Microsoft-signed drivers only.
    What it refuses: third-party "driver updater" tools and driver mirror
    sites. For the newest NVIDIA driver specifically, use menu option 3 -
    nvidia.com is usually ahead of Windows Update.
    Rollback: the restore point, plus Device Manager > device > Driver >
    Roll Back Driver.
#>
[CmdletBinding()]
param([switch]$NoPause, [switch]$Pause)
. "$PSScriptRoot\Common.ps1"

Write-Banner 'Driver updates (official Windows Update channel)'
if (-not (Assert-Admin 'Driver installation')) {
    if ($Pause -and -not $NoPause) { Read-Host 'Press Enter to close' | Out-Null }
    return
}
New-SafetyRestorePoint 'before driver updates'

Write-Banner 'Step 1: hardware rescan (re-detects missing devices)'
try {
    & pnputil.exe /scan-devices 2>&1 | ForEach-Object { Write-Log $_ 'INFO' }
} catch { Write-Log "pnputil scan failed: $_" 'WARN' }

Write-Banner 'Step 2: problem and hidden devices'
try {
    $problem = @(Get-PnpDevice -Status Error -ErrorAction SilentlyContinue)
    if ($problem.Count) {
        foreach ($p in $problem) { Write-Log "PROBLEM: $($p.FriendlyName) [$($p.InstanceId)]" 'WARN' }
        Write-Log 'These usually mean a missing driver - step 3 often fixes them.' 'INFO'
    } else { Write-Log 'No devices with driver errors.' 'OK' }
    # Ghost devices: hardware Windows remembers but which is not connected now.
    $ghosts = @(Get-PnpDevice -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Unknown' })
    if ($ghosts.Count) {
        Write-Log "$($ghosts.Count) hidden/ghost device entries (old unplugged hardware). Harmless clutter;" 'INFO'
        Write-Log 'shown in Device Manager via View > Show hidden devices. Not auto-removed (zero performance cost).' 'INFO'
    } else { Write-Log 'No hidden ghost devices.' 'OK' }
} catch { Write-Log "Device query failed: $_" 'WARN' }

Write-Banner 'Step 3: searching Windows Update for driver updates (can take a minute)'
$updates = $null
try {
    $session  = New-Object -ComObject Microsoft.Update.Session
    $searcher = $session.CreateUpdateSearcher()
    $result   = $searcher.Search("IsInstalled=0 and Type='Driver'")
    $updates  = $result.Updates
} catch { Write-Log "Windows Update search failed: $($_.Exception.Message)" 'CRIT' }

if (-not $updates -or $updates.Count -eq 0) {
    Write-Log 'Windows Update offers no driver updates right now - your drivers are current on this channel.' 'OK'
    Write-Log 'GPU exception: nvidia.com is usually ahead of Windows Update - use menu option 3.' 'INFO'
} else {
    Write-Banner "Found $($updates.Count) driver update(s)"
    for ($i = 0; $i -lt $updates.Count; $i++) {
        $u = $updates.Item($i)
        $ver = ''
        try { if ($u.DriverVerDate) { $ver = " ($(Get-Date $u.DriverVerDate -Format 'yyyy-MM-dd'))" } } catch {}
        Write-Log "[$($i + 1)] $($u.Title)$ver" 'ASK'
    }
    $answer = Read-Host "`nInstall ALL of the above? These are Microsoft-signed drivers from Windows Update. [y/N]"
    if ($answer -match '^[Yy]') {
        try {
            $coll = New-Object -ComObject Microsoft.Update.UpdateColl
            for ($i = 0; $i -lt $updates.Count; $i++) {
                $u = $updates.Item($i)
                if (-not $u.EulaAccepted) { $u.AcceptEula() }
                [void]$coll.Add($u)
            }
            Write-Log 'Downloading...' 'INFO'
            $downloader = $session.CreateUpdateDownloader(); $downloader.Updates = $coll
            [void]$downloader.Download()
            Write-Log 'Installing...' 'INFO'
            $installer = $session.CreateUpdateInstaller(); $installer.Updates = $coll
            $instResult = $installer.Install()
            for ($i = 0; $i -lt $coll.Count; $i++) {
                $rc = $instResult.GetUpdateResult($i).ResultCode   # 2 = succeeded
                $title = $coll.Item($i).Title
                if ($rc -eq 2) {
                    Write-Log "Installed: $title" 'OK'
                    Add-JournalEntry @{ Type = 'DriverInstall'; Description = "Installed driver: $title"; OldValue = 'previous driver (rollback via Device Manager)'; NewValue = $title }
                } else { Write-Log "Result code $rc for: $title" 'WARN' }
            }
            if ($instResult.RebootRequired) { Write-Log 'REBOOT REQUIRED to finish driver installation.' 'WARN' }
        } catch { Write-Log "Driver installation failed: $($_.Exception.Message)" 'CRIT' }
    } else { Write-Log 'Skipped - nothing installed.' 'INFO' }
}

Write-Banner 'Rollback options for drivers'
Write-Log "1) System Restore point created at the start of this run." 'INFO'
Write-Log '2) Device Manager > (device) > Properties > Driver > Roll Back Driver.' 'INFO'
Write-Log "3) Driver inventory CSVs in $DrvBackDir record what you had before." 'INFO'

if ($Pause -and -not $NoPause) { Read-Host "`nDone. Press Enter to close" | Out-Null }
