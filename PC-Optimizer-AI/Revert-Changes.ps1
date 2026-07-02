<#
.SYNOPSIS
    Undo every change PC-Optimizer-AI has made, newest first.
.DESCRIPTION
    Replays Logs\changes.json in reverse:
      Registry     -> restores the recorded old value (or deletes the value
                      if it did not exist before)
      PowerScheme  -> reactivates the previous power plan
      Fsutil       -> restores the previous TRIM setting
      Appx         -> attempts to re-register the removed Store app; if the
                      package is no longer staged, prints the exact Microsoft
                      Store reinstall so nothing is ever lost for good
    Afterwards the journal is archived (not deleted) and the .reg backups in
    RegistryBackups remain as a second, independent undo path. System Restore
    points named 'PC-Optimizer-AI ...' are the third.
#>
[CmdletBinding()]
param([switch]$NoPause, [switch]$Pause)
. "$PSScriptRoot\Common.ps1"

Write-Banner 'Revert all recorded changes'
$journal = @(Get-Journal)
if ($journal.Count -eq 0) {
    Write-Log 'Change journal is empty - nothing to revert.' 'OK'
    if ($Pause -and -not $NoPause) { Read-Host 'Press Enter to close' | Out-Null }
    return
}
if (-not (Assert-Admin 'Revert')) {
    if ($Pause -and -not $NoPause) { Read-Host 'Press Enter to close' | Out-Null }
    return
}
Write-Log "$($journal.Count) change(s) on record - undoing newest first." 'INFO'
[array]::Reverse($journal)

foreach ($e in $journal) {
    try {
        switch ($e.Type) {
            'Registry' {
                if ($null -eq $e.OldValue) {
                    Remove-ItemProperty -Path $e.Path -Name $e.Name -ErrorAction SilentlyContinue
                    Write-Log "Removed $($e.Path)\$($e.Name) (did not exist before)." 'OK'
                } else {
                    if (-not (Test-Path $e.Path)) { New-Item -Path $e.Path -Force | Out-Null }
                    New-ItemProperty -Path $e.Path -Name $e.Name -Value $e.OldValue -PropertyType $e.ValueType -Force | Out-Null
                    Write-Log "Restored $($e.Path)\$($e.Name) = $($e.OldValue)" 'OK'
                }
            }
            'PowerScheme' {
                & powercfg.exe /setactive $e.OldValue
                Write-Log "Restored previous power plan ($($e.OldValue))." 'OK'
            }
            'Fsutil' {
                & fsutil.exe behavior set disabledeletenotify $e.OldValue | Out-Null
                Write-Log "Restored TRIM setting (disabledeletenotify = $($e.OldValue))." 'OK'
            }
            'Appx' {
                $restored = $false
                $staged = Get-AppxPackage -AllUsers -Name $e.Name -ErrorAction SilentlyContinue | Select-Object -First 1
                if ($staged -and $staged.InstallLocation) {
                    $manifest = Join-Path $staged.InstallLocation 'AppxManifest.xml'
                    if (Test-Path $manifest) {
                        Add-AppxPackage -Register $manifest -DisableDevelopmentMode -ErrorAction Stop
                        Write-Log "Re-registered $($e.Name) from staged package." 'OK'
                        $restored = $true
                    }
                }
                if (-not $restored) {
                    Write-Log "$($e.Name): package no longer staged - reinstall free from Microsoft Store (search '$($e.Name -replace 'Microsoft\.','')')." 'WARN'
                }
            }
            'DisplayMode' {
                & "$PSScriptRoot\Display-MaxRefresh.ps1" -RestoreDevice $e.Device -RestoreHz $e.OldValue -NoPause
            }
            'DriverInstall' {
                Write-Log "Driver installs can't be auto-reverted safely: $($e.Description)" 'WARN'
                Write-Log '  Use Device Manager > device > Driver > Roll Back Driver, or the System Restore point.' 'INFO'
            }
            default { Write-Log "Unknown journal entry type '$($e.Type)' - skipped." 'WARN' }
        }
    } catch {
        Write-Log "Failed to revert '$($e.Description)': $($_.Exception.Message)" 'CRIT'
        Write-Log "  Fallback: double-click the matching .reg file in $RegBackDir" 'INFO'
    }
}

$archive = Join-Path $LogDir "changes-reverted-$Stamp.json"
Move-Item $JournalFile $archive -Force
Write-Log "Journal archived to $archive. Registry backups kept in $RegBackDir." 'OK'
Write-Log "Deeper rollback if ever needed: System Restore point named 'PC-Optimizer-AI ...'." 'INFO'

if ($Pause -and -not $NoPause) { Read-Host "`nDone. Press Enter to close" | Out-Null }
