# Common.ps1 - shared plumbing for PC-Optimizer-AI.
# Dot-sourced by every other script:  . "$PSScriptRoot\Common.ps1"
# Provides: paths, logging, admin check, restore points, tracked registry
# changes with .reg backups, and the change journal used by Revert-Changes.ps1.

Set-StrictMode -Off
$ErrorActionPreference = 'Continue'

# ------------------------------------------------------------------ paths --
# PCOPT_HOME override exists so the suite can be tested outside C:\.
$Script:OptHome = if ($env:PCOPT_HOME) { $env:PCOPT_HOME } else { 'C:\PC-Optimizer-AI' }
$Script:ReportDir  = Join-Path $OptHome 'Reports'
$Script:LogDir     = Join-Path $OptHome 'Logs'
$Script:RegBackDir = Join-Path $OptHome 'RegistryBackups'
$Script:DrvBackDir = Join-Path $OptHome 'DriverBackups'
foreach ($d in @($OptHome, $ReportDir, $LogDir, $RegBackDir, $DrvBackDir)) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}
$Script:Stamp       = Get-Date -Format 'yyyyMMdd-HHmmss'
$Script:JournalFile = Join-Path $LogDir 'changes.json'
$Script:LogFile     = Join-Path $LogDir "run-$Stamp.log"

# ---------------------------------------------------------------- logging --
function Write-Log {
    param([string]$Message, [ValidateSet('INFO','OK','WARN','CRIT','ASK')] [string]$Level = 'INFO')
    $line = "[{0}] [{1,-4}] {2}" -f (Get-Date -Format 'HH:mm:ss'), $Level, $Message
    $color = switch ($Level) { 'OK' {'Green'} 'WARN' {'Yellow'} 'CRIT' {'Red'} 'ASK' {'Magenta'} default {'Gray'} }
    Write-Host $line -ForegroundColor $color
    Add-Content -Path $LogFile -Value $line -ErrorAction SilentlyContinue
}
function Write-Banner([string]$Text) {
    Write-Host ""
    Write-Host "=== $Text ===" -ForegroundColor Cyan
    Add-Content -Path $LogFile -Value "=== $Text ===" -ErrorAction SilentlyContinue
}

# ------------------------------------------------------------------ admin --
function Test-Admin {
    if ($env:PCOPT_ASSUME_ADMIN -eq '1') { return $true }   # dev/test override only
    try {
        $id = [Security.Principal.WindowsIdentity]::GetCurrent()
        (New-Object Security.Principal.WindowsPrincipal $id).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    } catch { $false }
}
function Assert-Admin([string]$Why) {
    if (-not (Test-Admin)) {
        Write-Log "$Why requires Administrator. Re-run via START-PC-OPTIMIZER.bat (it self-elevates)." 'CRIT'
        return $false
    }
    return $true
}

# ---------------------------------------------------------- restore point --
function New-SafetyRestorePoint([string]$Label) {
    try {
        Enable-ComputerRestore -Drive "$env:SystemDrive\" -ErrorAction SilentlyContinue
        Checkpoint-Computer -Description "PC-Optimizer-AI $Label $Stamp" -RestorePointType MODIFY_SETTINGS -ErrorAction Stop
        Write-Log "System Restore point created: 'PC-Optimizer-AI $Label $Stamp'" 'OK'
    } catch {
        # Windows throttles restore points to one per 24h; an existing recent point still protects us.
        Write-Log "Restore point not created: $($_.Exception.Message) (a point made in the last 24h still applies)" 'WARN'
    }
}

# ---------------------------------------------------------------- journal --
function Get-Journal {
    if (Test-Path $JournalFile) {
        $j = Get-Content $JournalFile -Raw | ConvertFrom-Json
        if ($null -ne $j) { return @($j) }
    }
    return @()
}
function Add-JournalEntry([hashtable]$Entry) {
    $Entry['Timestamp'] = (Get-Date).ToString('o')
    $journal = @(Get-Journal)
    $journal += New-Object psobject -Property $Entry
    ConvertTo-Json @($journal) -Depth 5 | Set-Content -Path $JournalFile -Encoding UTF8
}

# --------------------------------------------------------------- registry --
function Get-RegValue([string]$Path, [string]$Name) {
    try { (Get-ItemProperty -Path $Path -Name $Name -ErrorAction Stop).$Name } catch { $null }
}
function Backup-RegKey([string]$Path) {
    $hive = $Path -replace '^HKCU:\\', 'HKEY_CURRENT_USER\' -replace '^HKLM:\\', 'HKEY_LOCAL_MACHINE\'
    $file = Join-Path $RegBackDir (($hive -replace '[\\: ]', '_') + "-$Stamp.reg")
    if (-not (Test-Path $file)) { & reg.exe export $hive $file /y 2>$null | Out-Null }
    if (Test-Path $file) { return $file }
    return $null   # key did not exist yet
}
function Set-TrackedRegValue {
    # Explains the change, backs up the key, records old+new value in the
    # journal, then applies. Returns $true if a change was made.
    param(
        [string]$Path, [string]$Name, $Value,
        [string]$Type = 'DWord',
        [string]$What,      # one-line description
        [string]$Why        # one-line rationale shown to the user
    )
    $old = Get-RegValue $Path $Name
    Write-Log "$What - $Why" 'INFO'
    if ($old -eq $Value) { Write-Log "  already set ($Name = $Value), nothing to do" 'OK'; return $false }
    $backup = Backup-RegKey $Path
    if (-not (Test-Path $Path)) { New-Item -Path $Path -Force | Out-Null }
    New-ItemProperty -Path $Path -Name $Name -Value $Value -PropertyType $Type -Force | Out-Null
    Add-JournalEntry @{
        Type = 'Registry'; Path = $Path; Name = $Name
        OldValue = $old; NewValue = $Value; ValueType = $Type
        Backup = $backup; Description = $What
    }
    Write-Log "  applied: $Name  $old -> $Value  (backup: $(Split-Path -Leaf ($backup + '')))" 'OK'
    return $true
}

# ---------------------------------------------------------------- reports --
function Get-LatestReport {
    Get-ChildItem $ReportDir -Filter '*.md' -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
}
