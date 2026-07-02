<#
.SYNOPSIS
    WinPerf - Windows performance inspection and safe optimization toolkit.

.DESCRIPTION
    Inspects the actual hardware and software configuration of this PC,
    generates an engineering report with bottleneck analysis, and applies
    only documented, measurable, reversible optimizations.

    Every change is:
      - preceded by a System Restore point (unless -SkipRestorePoint),
      - backed up (registry keys exported to .reg files),
      - recorded in a change journal (changes.json),
      - reversible via  WinPerf.ps1 -Mode Revert

    Modes:
      Inspect   Read-only. Gathers full inventory, writes a Markdown report.
      Optimize  Applies safe optimizations (requires Administrator).
      Revert    Undoes every change recorded in the journal.
      Full      Inspect, then Optimize, then re-verify.

.NOTES
    Data directory: %LOCALAPPDATA%\WinPerf
      reports\   generated reports (Markdown + JSON)
      backups\   .reg exports taken before each registry change
      changes.json  the change journal used by -Mode Revert

    Requires Windows PowerShell 5.1+ (ships with Windows 10/11).
#>
[CmdletBinding()]
param(
    [ValidateSet('Inspect', 'Optimize', 'Revert', 'Full')]
    [string]$Mode = 'Inspect',

    [switch]$SkipRestorePoint,

    # Keep the console open at the end (used by the .bat launcher).
    [switch]$Pause
)

Set-StrictMode -Off
$ErrorActionPreference = 'Continue'

# ---------------------------------------------------------------- paths ----
$DataDir   = Join-Path $env:LOCALAPPDATA 'WinPerf'
$ReportDir = Join-Path $DataDir 'reports'
$BackupDir = Join-Path $DataDir 'backups'
$JournalFile = Join-Path $DataDir 'changes.json'
foreach ($d in @($DataDir, $ReportDir, $BackupDir)) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

# -------------------------------------------------------------- console ----
function Write-Section([string]$Text) { Write-Host "`n=== $Text ===" -ForegroundColor Cyan }
function Write-Ok  ([string]$Text)    { Write-Host "  [OK]   $Text" -ForegroundColor Green }
function Write-Info([string]$Text)    { Write-Host "  [INFO] $Text" -ForegroundColor Gray }
function Write-Warn2([string]$Text)   { Write-Host "  [WARN] $Text" -ForegroundColor Yellow }
function Write-Bad ([string]$Text)    { Write-Host "  [!!]   $Text" -ForegroundColor Red }

function Test-Admin {
    try {
        $id = [Security.Principal.WindowsIdentity]::GetCurrent()
        (New-Object Security.Principal.WindowsPrincipal $id).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    } catch { $false }
}

# -------------------------------------------------------------- journal ----
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

# ------------------------------------------------------------- registry ----
function Get-RegValue([string]$Path, [string]$Name) {
    try { (Get-ItemProperty -Path $Path -Name $Name -ErrorAction Stop).$Name } catch { $null }
}

function Backup-RegistryKey([string]$Path) {
    $hive = $Path -replace '^HKCU:\\', 'HKEY_CURRENT_USER\' -replace '^HKLM:\\', 'HKEY_LOCAL_MACHINE\'
    $safe = ($hive -replace '[\\:]', '_')
    $file = Join-Path $BackupDir ("$safe-$Stamp.reg")
    if (-not (Test-Path $file)) {
        & reg.exe export $hive $file /y 2>$null | Out-Null
    }
    if (Test-Path $file) { return $file }
    return $null   # key did not exist yet; nothing to back up
}

function Set-TrackedRegValue {
    param(
        [string]$Path,
        [string]$Name,
        $Value,
        [string]$Type = 'DWord',
        [string]$Description
    )
    $old = Get-RegValue $Path $Name
    if ($old -eq $Value) {
        Write-Ok "$Description - already configured"
        return $false
    }
    $backup = Backup-RegistryKey $Path
    if (-not (Test-Path $Path)) { New-Item -Path $Path -Force | Out-Null }
    New-ItemProperty -Path $Path -Name $Name -Value $Value -PropertyType $Type -Force | Out-Null
    Add-JournalEntry @{
        Type        = 'Registry'
        Path        = $Path
        Name        = $Name
        OldValue    = $old
        NewValue    = $Value
        ValueType   = $Type
        Backup      = $backup
        Description = $Description
    }
    Write-Ok "$Description  ($Name : $old -> $Value)"
    return $true
}

# =========================================================== INSPECTION ====
function Invoke-Inspection {
    Write-Section 'System inspection (read-only)'
    $inv = [ordered]@{}

    # --- OS ---
    try {
        $os = Get-CimInstance Win32_OperatingSystem
        $cs = Get-CimInstance Win32_ComputerSystem
        $inv.OS = [ordered]@{
            Caption      = $os.Caption
            Version      = $os.Version
            Build        = $os.BuildNumber
            InstallDate  = $os.InstallDate
            LastBoot     = $os.LastBootUpTime
            UptimeHours  = [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalHours, 1)
            Manufacturer = $cs.Manufacturer
            Model        = $cs.Model
            IsLaptop     = [bool](Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue)
        }
        Write-Info "$($os.Caption) build $($os.BuildNumber), uptime $($inv.OS.UptimeHours) h"
    } catch { Write-Warn2 "OS query failed: $_" }

    # --- CPU ---
    try {
        $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
        $inv.CPU = [ordered]@{
            Name          = $cpu.Name.Trim()
            Cores         = $cpu.NumberOfCores
            Threads       = $cpu.NumberOfLogicalProcessors
            BaseClockMHz  = $cpu.MaxClockSpeed
            LoadPercent   = $cpu.LoadPercentage
        }
        Write-Info "$($inv.CPU.Name) - $($cpu.NumberOfCores)C/$($cpu.NumberOfLogicalProcessors)T @ $($cpu.MaxClockSpeed) MHz"
    } catch { Write-Warn2 "CPU query failed: $_" }

    # --- GPU ---
    try {
        $inv.GPU = @(Get-CimInstance Win32_VideoController | ForEach-Object {
            [ordered]@{
                Name          = $_.Name
                DriverVersion = $_.DriverVersion
                DriverDate    = $_.DriverDate
                VRAM_MB       = if ($_.AdapterRAM) { [math]::Round($_.AdapterRAM / 1MB) } else { $null }
                Resolution    = "$($_.CurrentHorizontalResolution)x$($_.CurrentVerticalResolution) @ $($_.CurrentRefreshRate) Hz"
            }
        })
        foreach ($g in $inv.GPU) { Write-Info "$($g.Name) - driver $($g.DriverVersion) ($(if ($g.DriverDate) { $g.DriverDate.ToString('yyyy-MM-dd') }))" }
    } catch { Write-Warn2 "GPU query failed: $_" }

    # --- RAM ---
    try {
        $dimms = @(Get-CimInstance Win32_PhysicalMemory)
        $inv.RAM = [ordered]@{
            TotalGB   = [math]::Round(($dimms | Measure-Object Capacity -Sum).Sum / 1GB, 1)
            Sticks    = $dimms.Count
            SpeedMHz  = ($dimms | Select-Object -First 1).ConfiguredClockSpeed
            Modules   = @($dimms | ForEach-Object { "$([math]::Round($_.Capacity/1GB)) GB @ $($_.ConfiguredClockSpeed) MHz ($($_.Manufacturer), slot $($_.DeviceLocator))" })
        }
        $osFree = Get-CimInstance Win32_OperatingSystem
        $inv.RAM.InUsePercent = [math]::Round(100 - ($osFree.FreePhysicalMemory / $osFree.TotalVisibleMemorySize * 100), 1)
        Write-Info "$($inv.RAM.TotalGB) GB in $($dimms.Count) module(s) @ $($inv.RAM.SpeedMHz) MHz, $($inv.RAM.InUsePercent)% in use"
    } catch { Write-Warn2 "RAM query failed: $_" }

    # --- Motherboard / BIOS ---
    try {
        $bb   = Get-CimInstance Win32_BaseBoard
        $bios = Get-CimInstance Win32_BIOS
        $inv.Board = [ordered]@{
            Motherboard = "$($bb.Manufacturer) $($bb.Product)"
            BIOSVersion = $bios.SMBIOSBIOSVersion
            BIOSDate    = $bios.ReleaseDate
        }
        Write-Info "$($inv.Board.Motherboard), BIOS $($bios.SMBIOSBIOSVersion) ($(if ($bios.ReleaseDate) { $bios.ReleaseDate.ToString('yyyy-MM-dd') }))"
    } catch { Write-Warn2 "Board/BIOS query failed: $_" }

    # --- Storage ---
    try {
        $inv.Disks = @(Get-PhysicalDisk | ForEach-Object {
            $rel = $null
            try { $rel = $_ | Get-StorageReliabilityCounter -ErrorAction Stop } catch {}
            [ordered]@{
                Name         = $_.FriendlyName
                MediaType    = "$($_.MediaType)"
                BusType      = "$($_.BusType)"
                SizeGB       = [math]::Round($_.Size / 1GB)
                Health       = "$($_.HealthStatus)"
                WearPercent  = if ($rel) { $rel.Wear } else { $null }
                TempC        = if ($rel) { $rel.Temperature } else { $null }
            }
        })
        foreach ($d in $inv.Disks) {
            Write-Info "$($d.Name): $($d.SizeGB) GB $($d.MediaType) ($($d.BusType)) - health $($d.Health)$(if ($d.WearPercent -ne $null) { ", wear $($d.WearPercent)%" })"
        }
        $inv.Volumes = @(Get-Volume | Where-Object DriveLetter | ForEach-Object {
            [ordered]@{
                Drive       = $_.DriveLetter
                FileSystem  = $_.FileSystem
                SizeGB      = [math]::Round($_.Size / 1GB)
                FreeGB      = [math]::Round($_.SizeRemaining / 1GB)
                FreePercent = if ($_.Size) { [math]::Round($_.SizeRemaining / $_.Size * 100, 1) } else { $null }
            }
        })
    } catch { Write-Warn2 "Storage query failed: $_" }

    # --- TRIM ---
    try {
        $trimOut = & fsutil.exe behavior query disabledeletenotify 2>$null
        $inv.TrimEnabled = [bool]($trimOut | Select-String 'NTFS DisableDeleteNotify = 0')
        Write-Info "TRIM enabled: $($inv.TrimEnabled)"
    } catch { Write-Warn2 "TRIM query failed: $_" }

    # --- Power ---
    try {
        $active = (& powercfg.exe /getactivescheme) -join ' '
        $inv.Power = [ordered]@{
            ActiveScheme = $active.Trim()
            ActiveGuid   = if ($active -match '([0-9a-f\-]{36})') { $Matches[1] } else { $null }
        }
        Write-Info "Power plan: $($inv.Power.ActiveScheme)"
    } catch { Write-Warn2 "Power query failed: $_" }

    # --- Gaming settings ---
    try {
        $inv.Gaming = [ordered]@{
            GameModeEnabled       = Get-RegValue 'HKCU:\Software\Microsoft\GameBar' 'AutoGameModeEnabled'
            GameDVR_Enabled       = Get-RegValue 'HKCU:\System\GameConfigStore' 'GameDVR_Enabled'
            AppCaptureEnabled     = Get-RegValue 'HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR' 'AppCaptureEnabled'
            HardwareGpuScheduling = Get-RegValue 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'HwSchMode'  # 2 = on, 1 = off
        }
        Write-Info "Game Mode: $($inv.Gaming.GameModeEnabled); GameDVR: $($inv.Gaming.GameDVR_Enabled); Background capture: $($inv.Gaming.AppCaptureEnabled); HAGS mode: $($inv.Gaming.HardwareGpuScheduling)"
    } catch { Write-Warn2 "Gaming settings query failed: $_" }

    # --- Security ---
    try {
        $sec = [ordered]@{}
        try { $mp = Get-MpComputerStatus -ErrorAction Stop
              $sec.DefenderRealtime = $mp.RealTimeProtectionEnabled
              $sec.DefenderUpToDate = ((Get-Date) - $mp.AntivirusSignatureLastUpdated).TotalDays -lt 7
        } catch { $sec.DefenderRealtime = 'unknown' }
        try { $sec.SecureBoot = Confirm-SecureBootUEFI -ErrorAction Stop } catch { $sec.SecureBoot = 'unavailable (legacy BIOS or no admin)' }
        try { $sec.Firewall = @(Get-NetFirewallProfile | ForEach-Object { "$($_.Name)=$($_.Enabled)" }) -join ', ' } catch {}
        $inv.Security = $sec
        Write-Info "Defender realtime: $($sec.DefenderRealtime); Secure Boot: $($sec.SecureBoot); Firewall: $($sec.Firewall)"
    } catch { Write-Warn2 "Security query failed: $_" }

    # --- Startup applications ---
    try {
        $startup = @()
        $startup += @(Get-CimInstance Win32_StartupCommand | ForEach-Object { [ordered]@{ Name = $_.Name; Command = $_.Command; Location = $_.Location } })
        $inv.Startup = $startup
        Write-Info "$($startup.Count) startup entries found"
    } catch { Write-Warn2 "Startup query failed: $_" }

    # --- Top processes ---
    try {
        $inv.TopProcessesByMemory = @(Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 10 | ForEach-Object {
            [ordered]@{ Name = $_.ProcessName; MemoryMB = [math]::Round($_.WorkingSet64 / 1MB); CPUSeconds = if ($_.CPU) { [math]::Round($_.CPU) } else { $null } }
        })
    } catch { Write-Warn2 "Process query failed: $_" }

    # --- Non-Microsoft running services ---
    try {
        $inv.ThirdPartyServices = @(Get-CimInstance Win32_Service |
            Where-Object { $_.State -eq 'Running' -and $_.PathName -and $_.PathName -notmatch 'Windows\\(System32|SysWOW64|WinSxS)' } |
            ForEach-Object { [ordered]@{ Name = $_.Name; DisplayName = $_.DisplayName; StartMode = $_.StartMode } })
        Write-Info "$($inv.ThirdPartyServices.Count) third-party services running"
    } catch { Write-Warn2 "Service query failed: $_" }

    # --- Event log health (last 7 days) ---
    try {
        $since = (Get-Date).AddDays(-7)
        $events = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; Level = 1, 2; StartTime = $since } -MaxEvents 300 -ErrorAction SilentlyContinue)
        $inv.EventLogSummary = @($events | Group-Object ProviderName, Id | Sort-Object Count -Descending | Select-Object -First 15 | ForEach-Object {
            [ordered]@{ Source = $_.Name; Count = $_.Count; Sample = ($_.Group[0].Message -split "`n")[0] }
        })
        $inv.WheaErrors    = @($events | Where-Object ProviderName -like '*WHEA*').Count
        $inv.DiskErrors    = @($events | Where-Object { $_.ProviderName -eq 'disk' -or $_.Id -eq 153 }).Count
        $inv.KernelPower41 = @($events | Where-Object { $_.ProviderName -eq 'Microsoft-Windows-Kernel-Power' -and $_.Id -eq 41 }).Count
        Write-Info "System log, last 7 days: $($events.Count) errors/critical (WHEA: $($inv.WheaErrors), disk: $($inv.DiskErrors), unexpected shutdowns: $($inv.KernelPower41))"
    } catch { Write-Warn2 "Event log query failed: $_" }

    # --- Network ---
    try {
        $inv.Network = @(Get-NetAdapter | Where-Object Status -eq 'Up' | ForEach-Object {
            [ordered]@{ Name = $_.Name; Description = $_.InterfaceDescription; LinkSpeed = $_.LinkSpeed }
        })
        foreach ($n in $inv.Network) { Write-Info "NIC: $($n.Description) - $($n.LinkSpeed)" }
    } catch { Write-Warn2 "Network query failed: $_" }

    return $inv
}

# ==================================================== BOTTLENECK ANALYSIS ===
function Get-Findings($inv) {
    function Add-Finding([string]$Severity, [string]$Text) {
        $script:findings += New-Object psobject -Property @{ Severity = $Severity; Text = $Text }
    }
    $script:findings = @()

    if ($inv.RAM) {
        if ($inv.RAM.TotalGB -lt 16)  { Add-Finding 'WARN' "Only $($inv.RAM.TotalGB) GB RAM. 16 GB is the practical minimum for modern gaming; consider an upgrade." }
        if ($inv.RAM.Sticks -eq 1)    { Add-Finding 'WARN' 'A single RAM module means single-channel memory. Adding a matched second stick can improve FPS noticeably, especially on integrated graphics.' }
        if ($inv.RAM.InUsePercent -gt 85) { Add-Finding 'WARN' "Memory is $($inv.RAM.InUsePercent)% used at idle-ish load. Check TopProcessesByMemory in the report." }
    }
    if ($inv.Disks) {
        $sysDisk = $inv.Disks | Select-Object -First 1
        foreach ($d in $inv.Disks) {
            if ($d.MediaType -eq 'HDD') { Add-Finding 'WARN' "$($d.Name) is a mechanical HDD. Games and the OS should live on an SSD/NVMe drive." }
            if ($d.Health -ne 'Healthy') { Add-Finding 'CRIT' "$($d.Name) reports health '$($d.Health)'. Back up data and investigate immediately." }
            if ($d.WearPercent -ne $null -and $d.WearPercent -gt 80) { Add-Finding 'WARN' "$($d.Name) SSD wear is at $($d.WearPercent)%. Plan a replacement." }
        }
    }
    if ($inv.Volumes) {
        foreach ($v in $inv.Volumes) {
            if ($v.FreePercent -ne $null -and $v.FreePercent -lt 10) { Add-Finding 'WARN' "Drive $($v.Drive): only $($v.FreeGB) GB ($($v.FreePercent)%) free. SSDs slow down and Windows misbehaves under 10% free." }
        }
    }
    if ($inv.Contains('TrimEnabled') -and -not $inv.TrimEnabled) {
        Add-Finding 'WARN' 'TRIM is disabled. This degrades SSD performance and lifespan over time (Optimize mode fixes this).'
    }
    if ($inv.GPU) {
        foreach ($g in $inv.GPU) {
            if ($g.DriverDate -and ((Get-Date) - [datetime]$g.DriverDate).TotalDays -gt 180) {
                Add-Finding 'WARN' "GPU driver for $($g.Name) is from $(([datetime]$g.DriverDate).ToString('yyyy-MM-dd')) (>6 months old). Update from the GPU vendor (NVIDIA/AMD/Intel), not Windows Update."
            }
        }
    }
    if ($inv.WheaErrors -gt 0)    { Add-Finding 'CRIT' "$($inv.WheaErrors) WHEA hardware error(s) in the last 7 days - possible unstable overclock/XMP, PSU or hardware fault." }
    if ($inv.DiskErrors -gt 0)    { Add-Finding 'CRIT' "$($inv.DiskErrors) disk I/O error(s) in the last 7 days - check cables and drive health." }
    if ($inv.KernelPower41 -gt 0) { Add-Finding 'WARN' "$($inv.KernelPower41) unexpected shutdown(s) (Kernel-Power 41) in the last 7 days." }
    if ($inv.Security -and $inv.Security.DefenderRealtime -eq $false) {
        Add-Finding 'CRIT' 'Defender real-time protection is OFF and no substitute was detected. This toolkit will never disable protection; re-enable it.'
    }
    if ($inv.Startup -and $inv.Startup.Count -gt 10) {
        Add-Finding 'INFO' "$($inv.Startup.Count) startup entries. Review the Startup section of the report and disable what you do not need via Task Manager > Startup apps (deliberately not automated - only you know which apps you want)."
    }
    if ($inv.Gaming -and $inv.Gaming.HardwareGpuScheduling -ne 2) {
        Add-Finding 'INFO' 'Hardware-accelerated GPU scheduling (HAGS) is off. Results vary by game and GPU; try it via Settings > System > Display > Graphics > Default graphics settings. Deliberately not auto-enabled.'
    }
    if ($inv.OS -and -not $inv.OS.IsLaptop -and $inv.Power -and $inv.Power.ActiveScheme -match 'Balanced') {
        Add-Finding 'INFO' 'Desktop PC on the Balanced power plan. Optimize mode switches to High performance (reversible).'
    }
    return $script:findings
}

# =============================================================== REPORT ====
function New-Report($inv, $findings, [string]$Suffix = '') {
    $mdPath   = Join-Path $ReportDir "WinPerf-Report-$Stamp$Suffix.md"
    $jsonPath = Join-Path $ReportDir "WinPerf-Inventory-$Stamp$Suffix.json"
    ConvertTo-Json $inv -Depth 6 | Set-Content $jsonPath -Encoding UTF8

    $md = New-Object System.Text.StringBuilder
    [void]$md.AppendLine("# WinPerf Engineering Report")
    [void]$md.AppendLine("")
    [void]$md.AppendLine("Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm') | Mode: $Mode | Admin: $(Test-Admin)")
    [void]$md.AppendLine("")
    [void]$md.AppendLine("## Findings")
    [void]$md.AppendLine("")
    if ($findings.Count -eq 0) {
        [void]$md.AppendLine("No issues detected. The system looks well configured.")
    } else {
        foreach ($f in ($findings | Sort-Object { switch ($_.Severity) { 'CRIT' {0} 'WARN' {1} default {2} } })) {
            [void]$md.AppendLine("- **[$($f.Severity)]** $($f.Text)")
        }
    }
    [void]$md.AppendLine("")
    [void]$md.AppendLine("## Inventory")
    [void]$md.AppendLine("")
    foreach ($key in $inv.Keys) {
        [void]$md.AppendLine("### $key")
        [void]$md.AppendLine('```json')
        [void]$md.AppendLine((ConvertTo-Json $inv[$key] -Depth 5))
        [void]$md.AppendLine('```')
        [void]$md.AppendLine("")
    }
    [void]$md.AppendLine("## Change journal")
    [void]$md.AppendLine("")
    $journal = @(Get-Journal)
    if ($journal.Count -eq 0) {
        [void]$md.AppendLine("No changes have been applied by WinPerf.")
    } else {
        foreach ($j in $journal) {
            [void]$md.AppendLine("- $($j.Timestamp): $($j.Description) [$($j.Type)] old=$($j.OldValue) new=$($j.NewValue)")
        }
        [void]$md.AppendLine("")
        [void]$md.AppendLine("Run ``WinPerf.ps1 -Mode Revert`` to undo all of the above.")
    }
    $md.ToString() | Set-Content $mdPath -Encoding UTF8

    # Convenience copy on the Desktop
    try {
        $desktop = [Environment]::GetFolderPath('Desktop')
        Copy-Item $mdPath (Join-Path $desktop "WinPerf-Report-$Stamp$Suffix.md") -Force
    } catch {}

    Write-Section 'Report written'
    Write-Ok $mdPath
    Write-Ok $jsonPath
    return $mdPath
}

# ========================================================= OPTIMIZATION ====
function Invoke-Optimization($inv) {
    if (-not (Test-Admin)) {
        Write-Bad 'Optimize mode requires Administrator. Re-run via START-WINPERF.bat (it self-elevates).'
        return
    }

    Write-Section 'Safety: System Restore point'
    if ($SkipRestorePoint) {
        Write-Warn2 'Skipped by request (-SkipRestorePoint).'
    } else {
        try {
            Enable-ComputerRestore -Drive "$env:SystemDrive\" -ErrorAction SilentlyContinue
            Checkpoint-Computer -Description "WinPerf before optimization $Stamp" -RestorePointType MODIFY_SETTINGS -ErrorAction Stop
            Write-Ok 'Restore point created.'
        } catch {
            # Windows throttles restore points to one per 24h by default; that existing point still protects us.
            Write-Warn2 "Could not create a restore point: $($_.Exception.Message). If one was created in the last 24 h, Windows throttles new ones - that existing point still applies."
        }
    }

    Write-Section 'Gaming: stop background game recording (GameDVR)'
    # Documented Xbox Game DVR settings. Background recording costs CPU/GPU time in every game.
    # This does NOT remove Game Bar or manual clipping - it only stops always-on background capture.
    Set-TrackedRegValue -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_Enabled' -Value 0 `
        -Description 'Disable Game DVR background recording' | Out-Null
    Set-TrackedRegValue -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR' -Name 'AppCaptureEnabled' -Value 0 `
        -Description 'Disable automatic app capture' | Out-Null

    Write-Section 'Gaming: ensure Game Mode is on'
    # Game Mode prioritizes the foreground game for CPU/GPU and defers Windows Update activity.
    Set-TrackedRegValue -Path 'HKCU:\Software\Microsoft\GameBar' -Name 'AutoGameModeEnabled' -Value 1 `
        -Description 'Enable Windows Game Mode' | Out-Null

    Write-Section 'Storage: TRIM'
    if ($inv.Contains('TrimEnabled') -and -not $inv.TrimEnabled) {
        $before = 1
        & fsutil.exe behavior set disabledeletenotify 0 | Out-Null
        Add-JournalEntry @{ Type = 'Fsutil'; Name = 'disabledeletenotify'; OldValue = $before; NewValue = 0; Description = 'Enable SSD TRIM' }
        Write-Ok 'TRIM enabled.'
    } else {
        Write-Ok 'TRIM already enabled.'
    }

    Write-Section 'Power plan'
    if ($inv.OS -and $inv.OS.IsLaptop) {
        Write-Warn2 'Laptop detected - keeping the current power plan (High performance on battery hurts more than it helps). Change manually if always plugged in.'
    } elseif ($inv.Power -and $inv.Power.ActiveGuid -and
              $inv.Power.ActiveGuid -notin @('8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c',   # High performance
                                             'e9a42b02-d5df-448d-aa66-1f0ff8de23ce')) { # Ultimate performance
        $highPerf = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
        $schemes = (& powercfg.exe /list) -join "`n"
        if ($schemes -match $highPerf) {
            & powercfg.exe /setactive $highPerf
            Add-JournalEntry @{ Type = 'PowerScheme'; OldValue = $inv.Power.ActiveGuid; NewValue = $highPerf; Description = 'Switch to High performance power plan' }
            Write-Ok "Switched to High performance (was $($inv.Power.ActiveScheme))."
        } else {
            Write-Warn2 'High performance plan not present on this edition; leaving power plan unchanged.'
        }
    } else {
        Write-Ok 'Power plan already performance-oriented.'
    }

    Write-Section 'Cleanup: temporary files (safe, >48h old only)'
    $freed = 0
    foreach ($tmp in @($env:TEMP, "$env:SystemRoot\Temp")) {
        if (-not (Test-Path $tmp)) { continue }
        Get-ChildItem $tmp -Recurse -Force -File -ErrorAction SilentlyContinue |
            Where-Object { $_.LastWriteTime -lt (Get-Date).AddHours(-48) } |
            ForEach-Object {
                try { $size = $_.Length; Remove-Item $_.FullName -Force -ErrorAction Stop; $freed += $size } catch {}
            }
    }
    Write-Ok ("Freed {0:N0} MB of stale temp files." -f ($freed / 1MB))

    Write-Section 'Deliberately NOT changed'
    Write-Info 'Windows Defender, firewall, mitigations, telemetry services - security stays on.'
    Write-Info 'SysMain/prefetch, pagefile size, visual effects - Windows defaults are correct on modern hardware.'
    Write-Info 'HAGS, Nagle/TcpAckFrequency, timer resolution, "debloat" scripts - unmeasurable or riskier than their benefit. See README.'
    Write-Info 'Startup apps and third-party services - listed in the report for YOUR decision; never auto-disabled.'
}

# ================================================================ REVERT ====
function Invoke-Revert {
    Write-Section 'Reverting all recorded changes'
    $journal = @(Get-Journal)
    if ($journal.Count -eq 0) { Write-Ok 'Journal is empty - nothing to revert.'; return }
    if (-not (Test-Admin)) { Write-Bad 'Revert requires Administrator (use START-WINPERF.bat).'; return }

    [array]::Reverse($journal)
    foreach ($entry in $journal) {
        try {
            switch ($entry.Type) {
                'Registry' {
                    if ($null -eq $entry.OldValue) {
                        Remove-ItemProperty -Path $entry.Path -Name $entry.Name -ErrorAction SilentlyContinue
                        Write-Ok "Removed $($entry.Path)\$($entry.Name) (did not exist before)."
                    } else {
                        if (-not (Test-Path $entry.Path)) { New-Item -Path $entry.Path -Force | Out-Null }
                        New-ItemProperty -Path $entry.Path -Name $entry.Name -Value $entry.OldValue -PropertyType $entry.ValueType -Force | Out-Null
                        Write-Ok "Restored $($entry.Path)\$($entry.Name) = $($entry.OldValue)."
                    }
                }
                'PowerScheme' {
                    & powercfg.exe /setactive $entry.OldValue
                    Write-Ok "Restored previous power plan ($($entry.OldValue))."
                }
                'Fsutil' {
                    & fsutil.exe behavior set disabledeletenotify $entry.OldValue | Out-Null
                    Write-Ok "Restored fsutil disabledeletenotify = $($entry.OldValue)."
                }
                default { Write-Warn2 "Unknown journal entry type '$($entry.Type)' - skipped." }
            }
        } catch {
            Write-Bad "Failed to revert '$($entry.Description)': $_  (a .reg backup may exist in $BackupDir)"
        }
    }
    Move-Item $JournalFile (Join-Path $DataDir "changes-reverted-$Stamp.json") -Force
    Write-Ok "Journal archived. Registry .reg backups kept in $BackupDir."
}

# ================================================================== MAIN ====
Write-Host ''
Write-Host '  WinPerf - Windows performance toolkit' -ForegroundColor White
Write-Host "  Mode: $Mode | Data: $DataDir" -ForegroundColor DarkGray

switch ($Mode) {
    'Inspect' {
        $inv = Invoke-Inspection
        $findings = Get-Findings $inv
        New-Report $inv $findings | Out-Null
    }
    'Optimize' {
        $inv = Invoke-Inspection
        $findings = Get-Findings $inv
        Invoke-Optimization $inv
        New-Report $inv $findings | Out-Null
    }
    'Revert' {
        Invoke-Revert
    }
    'Full' {
        $inv = Invoke-Inspection
        $findings = Get-Findings $inv
        Invoke-Optimization $inv
        Write-Section 'Verification: re-inspecting changed settings'
        $inv2 = Invoke-Inspection
        $findings2 = Get-Findings $inv2
        New-Report $inv2 $findings2 -Suffix '-after' | Out-Null
    }
}

Write-Host ''
if ($Pause) { Read-Host 'Done. Press Enter to close' | Out-Null }
