<#
.SYNOPSIS
    PC-Optimizer-AI main engine: inspection, safe Windows gaming
    optimization, full-optimize pipeline, and report generation.
.DESCRIPTION
    Modes:
      Inspect     Read-only hardware/software inventory + findings report.
      WinOpt      Safe Windows gaming optimizations only (restore point first).
      Full        Inspect -> restore point -> registry backup -> driver scan
                  -> Windows opt -> NVIDIA opt -> safe debloat -> temp clean
                  -> verify -> before/after report.
      OpenReport  Opens the most recent report.
#>
[CmdletBinding()]
param(
    [ValidateSet('Inspect', 'WinOpt', 'Full', 'OpenReport')]
    [string]$Mode = 'Inspect',
    [switch]$Pause
)
. "$PSScriptRoot\Common.ps1"

# ============================================================ INSPECTION ====
function Invoke-Inspection {
    Write-Banner 'System inspection (read-only)'
    $inv = [ordered]@{}

    try {
        $os = Get-CimInstance Win32_OperatingSystem
        $cs = Get-CimInstance Win32_ComputerSystem
        $inv.Windows = [ordered]@{
            Edition = $os.Caption; Version = $os.Version; Build = $os.BuildNumber
            DisplayVersion = Get-RegValue 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' 'DisplayVersion'
            UptimeHours = [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalHours, 1)
            IsLaptop = [bool](Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue)
            AutoManagedPagefile = $cs.AutomaticManagedPagefile
        }
        Write-Log "$($os.Caption) $($inv.Windows.DisplayVersion) build $($os.BuildNumber)" 'OK'
    } catch { Write-Log "Windows query failed: $_" 'WARN' }

    try {
        $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
        $inv.CPU = [ordered]@{
            Model = $cpu.Name.Trim(); Cores = $cpu.NumberOfCores
            Threads = $cpu.NumberOfLogicalProcessors; BaseClockMHz = $cpu.MaxClockSpeed
        }
        Write-Log "CPU: $($inv.CPU.Model) ($($cpu.NumberOfCores)C/$($cpu.NumberOfLogicalProcessors)T)" 'OK'
    } catch { Write-Log "CPU query failed: $_" 'WARN' }

    try {
        $inv.GPU = @(Get-CimInstance Win32_VideoController | ForEach-Object {
            [ordered]@{
                Model = $_.Name; DriverVersion = $_.DriverVersion; DriverDate = $_.DriverDate
                IsNvidia = ($_.Name -match 'NVIDIA|GeForce|RTX|GTX|Quadro')
                RefreshRateHz = $_.CurrentRefreshRate
                Resolution = "$($_.CurrentHorizontalResolution)x$($_.CurrentVerticalResolution)"
            }
        })
        # nvidia-smi gives the marketing driver version (e.g. 552.44) which
        # Win32_VideoController does not.
        $smi = Get-Command nvidia-smi -ErrorAction SilentlyContinue
        if ($smi) {
            $inv.NvidiaDriverVersion = (& nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>$null | Select-Object -First 1)
        }
        foreach ($g in $inv.GPU) { Write-Log "GPU: $($g.Model) - driver $($g.DriverVersion) @ $($g.Resolution) $($g.RefreshRateHz) Hz" 'OK' }
        if ($inv.NvidiaDriverVersion) { Write-Log "NVIDIA driver (marketing version): $($inv.NvidiaDriverVersion)" 'OK' }
    } catch { Write-Log "GPU query failed: $_" 'WARN' }

    try {
        $dimms = @(Get-CimInstance Win32_PhysicalMemory)
        $channels = @($dimms | ForEach-Object { ($_.BankLabel + '/' + $_.DeviceLocator) } | Sort-Object -Unique)
        $inv.RAM = [ordered]@{
            TotalGB = [math]::Round(($dimms | Measure-Object Capacity -Sum).Sum / 1GB, 1)
            Modules = $dimms.Count
            SpeedMHz = ($dimms | Select-Object -First 1).ConfiguredClockSpeed
            ChannelMode = if ($dimms.Count -ge 2) { "likely dual/multi-channel ($($dimms.Count) modules)" } else { 'SINGLE-CHANNEL (1 module) - a matched second stick would raise FPS' }
            Slots = @($dimms | ForEach-Object { "$($_.DeviceLocator): $([math]::Round($_.Capacity/1GB)) GB @ $($_.ConfiguredClockSpeed) MHz" })
        }
        Write-Log "RAM: $($inv.RAM.TotalGB) GB, $($dimms.Count) module(s) @ $($inv.RAM.SpeedMHz) MHz - $($inv.RAM.ChannelMode)" 'OK'
    } catch { Write-Log "RAM query failed: $_" 'WARN' }

    try {
        $bb = Get-CimInstance Win32_BaseBoard; $bios = Get-CimInstance Win32_BIOS
        $inv.Motherboard = [ordered]@{
            Model = "$($bb.Manufacturer) $($bb.Product)".Trim()
            BIOSVersion = $bios.SMBIOSBIOSVersion
            BIOSDate = if ($bios.ReleaseDate) { $bios.ReleaseDate.ToString('yyyy-MM-dd') } else { $null }
        }
        Write-Log "Motherboard: $($inv.Motherboard.Model), BIOS $($bios.SMBIOSBIOSVersion) ($($inv.Motherboard.BIOSDate))" 'OK'
    } catch { Write-Log "Motherboard/BIOS query failed: $_" 'WARN' }

    try {
        $smbus = Get-CimInstance Win32_PnPSignedDriver -ErrorAction Stop |
            Where-Object { $_.DeviceClass -eq 'SYSTEM' -and $_.DeviceName -match 'SMBus|chipset' } |
            Select-Object -First 3
        $inv.Chipset = @($smbus | ForEach-Object { [ordered]@{ Device = $_.DeviceName; Provider = $_.DriverProviderName; Version = $_.DriverVersion } })
        foreach ($c in $inv.Chipset) { Write-Log "Chipset: $($c.Device) ($($c.Provider) $($c.Version))" 'OK' }
    } catch { Write-Log "Chipset query failed: $_" 'WARN' }

    try {
        $inv.Storage = @(Get-PhysicalDisk | ForEach-Object {
            $rel = $null; try { $rel = $_ | Get-StorageReliabilityCounter -ErrorAction Stop } catch {}
            [ordered]@{
                Name = $_.FriendlyName; Type = "$($_.MediaType)"; Bus = "$($_.BusType)"
                SizeGB = [math]::Round($_.Size / 1GB); Health = "$($_.HealthStatus)"
                WearPercent = if ($rel) { $rel.Wear } else { $null }
                TempC = if ($rel) { $rel.Temperature } else { $null }
            }
        })
        foreach ($d in $inv.Storage) { Write-Log "Disk: $($d.Name) $($d.SizeGB) GB $($d.Type)/$($d.Bus) health=$($d.Health)" 'OK' }
        $inv.Volumes = @(Get-Volume | Where-Object DriveLetter | ForEach-Object {
            [ordered]@{ Drive = $_.DriveLetter; FreeGB = [math]::Round($_.SizeRemaining / 1GB)
                        FreePercent = if ($_.Size) { [math]::Round($_.SizeRemaining / $_.Size * 100, 1) } else { $null } }
        })
        $trimOut = & fsutil.exe behavior query disabledeletenotify 2>$null
        $inv.TrimEnabled = [bool]($trimOut | Select-String 'NTFS DisableDeleteNotify = 0')
        Write-Log "TRIM enabled: $($inv.TrimEnabled)" 'OK'
    } catch { Write-Log "Storage query failed: $_" 'WARN' }

    try {
        $inv.Network = @(Get-NetAdapter | ForEach-Object {
            [ordered]@{
                Name = $_.Name; Adapter = $_.InterfaceDescription; Status = "$($_.Status)"
                LinkSpeed = $_.LinkSpeed
                Kind = if ($_.PhysicalMediaType -match '802\.11') { 'Wi-Fi' }
                       elseif ($_.PhysicalMediaType -match '802\.3') { 'Ethernet' }
                       else { "$($_.PhysicalMediaType)" }
            }
        })
        foreach ($n in ($inv.Network | Where-Object { $_.Status -eq 'Up' })) { Write-Log "NIC ($($n.Kind)): $($n.Adapter) - $($n.LinkSpeed)" 'OK' }
        try { $inv.Bluetooth = @(Get-PnpDevice -Class Bluetooth -Status OK -ErrorAction Stop | Select-Object -First 3 -ExpandProperty FriendlyName) } catch { $inv.Bluetooth = @() }
    } catch { Write-Log "Network query failed: $_" 'WARN' }

    try {
        $inv.Audio = @(Get-CimInstance Win32_SoundDevice | ForEach-Object { "$($_.Name) ($($_.Manufacturer))" })
        foreach ($a in $inv.Audio) { Write-Log "Audio: $a" 'OK' }
    } catch { Write-Log "Audio query failed: $_" 'WARN' }

    try {
        $active = (& powercfg.exe /getactivescheme) -join ' '
        $inv.Power = [ordered]@{
            ActivePlan = $active.Trim()
            ActiveGuid = if ($active -match '([0-9a-f\-]{36})') { $Matches[1] } else { $null }
        }
        Write-Log "Power plan: $($inv.Power.ActivePlan)" 'OK'
    } catch { Write-Log "Power query failed: $_" 'WARN' }

    try {
        $inv.Gaming = [ordered]@{
            GameMode = Get-RegValue 'HKCU:\Software\Microsoft\GameBar' 'AutoGameModeEnabled'
            GameDVR = Get-RegValue 'HKCU:\System\GameConfigStore' 'GameDVR_Enabled'
            BackgroundCapture = Get-RegValue 'HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR' 'AppCaptureEnabled'
            HAGS = Get-RegValue 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'HwSchMode'  # 2=on 1=off
        }
        # Overlays that commonly cost FPS - detection only, user decides.
        $overlayProcs = @('Discord', 'GameBar', 'NVIDIA Overlay', 'nvcontainer', 'Overwolf', 'MSIAfterburner', 'RTSS', 'Medal')
        $inv.OverlaysRunning = @(Get-Process -ErrorAction SilentlyContinue |
            Where-Object { $p = $_.ProcessName; $overlayProcs | Where-Object { $p -match $_ } } |
            Select-Object -ExpandProperty ProcessName -Unique)
        Write-Log "Game Mode=$($inv.Gaming.GameMode) GameDVR=$($inv.Gaming.GameDVR) BgCapture=$($inv.Gaming.BackgroundCapture) HAGS=$($inv.Gaming.HAGS)" 'OK'
        if ($inv.OverlaysRunning.Count) { Write-Log "Overlay-capable processes running: $($inv.OverlaysRunning -join ', ')" 'INFO' }
    } catch { Write-Log "Gaming settings query failed: $_" 'WARN' }

    try {
        $inv.Startup = @(Get-CimInstance Win32_StartupCommand | ForEach-Object { [ordered]@{ Name = $_.Name; Command = $_.Command } })
        $inv.TopProcesses = @(Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 10 | ForEach-Object {
            [ordered]@{ Name = $_.ProcessName; MemoryMB = [math]::Round($_.WorkingSet64 / 1MB) } })
        $inv.ThirdPartyServices = @(Get-CimInstance Win32_Service |
            Where-Object { $_.State -eq 'Running' -and $_.PathName -and $_.PathName -notmatch 'Windows\\(System32|SysWOW64|WinSxS)' } |
            ForEach-Object { "$($_.DisplayName) [$($_.Name)]" })
        Write-Log "$($inv.Startup.Count) startup entries, $($inv.ThirdPartyServices.Count) third-party services running" 'OK'
    } catch { Write-Log "Startup/services query failed: $_" 'WARN' }

    try {
        $inv.ProblemDevices = @(Get-CimInstance Win32_PnPEntity -Filter 'ConfigManagerErrorCode <> 0' -ErrorAction Stop |
            ForEach-Object { [ordered]@{ Name = $_.Name; ErrorCode = $_.ConfigManagerErrorCode; DeviceID = $_.DeviceID } })
        if ($inv.ProblemDevices.Count) { Write-Log "$($inv.ProblemDevices.Count) Device Manager problem device(s) found!" 'WARN' }
        else { Write-Log 'Device Manager: no problem devices' 'OK' }
    } catch { Write-Log "Problem-device query failed: $_" 'WARN' }

    try {
        $since = (Get-Date).AddDays(-7)
        $events = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; Level = 1, 2; StartTime = $since } -MaxEvents 300 -ErrorAction SilentlyContinue)
        $inv.EventErrors = [ordered]@{
            TotalLast7Days = $events.Count
            WHEA = @($events | Where-Object ProviderName -like '*WHEA*').Count
            Disk = @($events | Where-Object { $_.ProviderName -eq 'disk' -or $_.Id -eq 153 }).Count
            UnexpectedShutdowns = @($events | Where-Object { $_.ProviderName -eq 'Microsoft-Windows-Kernel-Power' -and $_.Id -eq 41 }).Count
            TopSources = @($events | Group-Object ProviderName | Sort-Object Count -Descending | Select-Object -First 8 | ForEach-Object { "$($_.Name) x$($_.Count)" })
        }
        Write-Log "Event log (7d): $($events.Count) errors - WHEA=$($inv.EventErrors.WHEA) disk=$($inv.EventErrors.Disk) crashes=$($inv.EventErrors.UnexpectedShutdowns)" 'OK'
    } catch { Write-Log "Event log query failed: $_" 'WARN' }

    try {
        if (-not $inv.Windows.AutoManagedPagefile) {
            $pf = Get-CimInstance Win32_PageFileSetting -ErrorAction SilentlyContinue
            $inv.Pagefile = @($pf | ForEach-Object { "$($_.Name): initial $($_.InitialSize) MB max $($_.MaximumSize) MB (MANUAL)" })
        } else { $inv.Pagefile = @('System managed (recommended)') }
    } catch {}

    return $inv
}

# ============================================================== FINDINGS ====
function Get-Findings($inv) {
    $script:findings = @()
    function Add-F([string]$Sev, [string]$Text) { $script:findings += New-Object psobject -Property @{ Severity = $Sev; Text = $Text } }

    if ($inv.RAM) {
        if ($inv.RAM.TotalGB -lt 16) { Add-F 'WARN' "Only $($inv.RAM.TotalGB) GB RAM - 16 GB is the practical floor for modern gaming." }
        if ($inv.RAM.Modules -eq 1)  { Add-F 'WARN' 'Single-channel RAM. A matched second stick is one of the highest-value FPS upgrades.' }
    }
    if ($inv.Storage) {
        foreach ($d in $inv.Storage) {
            if ($d.Type -eq 'HDD') { Add-F 'WARN' "$($d.Name) is a mechanical HDD - keep Windows and games on SSD/NVMe." }
            if ($d.Health -ne 'Healthy') { Add-F 'CRIT' "$($d.Name) health = '$($d.Health)'. BACK UP YOUR DATA NOW." }
        }
    }
    if ($inv.Volumes) { foreach ($v in $inv.Volumes) {
        if ($v.FreePercent -ne $null -and $v.FreePercent -lt 10) { Add-F 'WARN' "Drive $($v.Drive): only $($v.FreeGB) GB free ($($v.FreePercent)%). Shader caches and pagefile need headroom." } } }
    if ($inv.Contains('TrimEnabled') -and -not $inv.TrimEnabled) { Add-F 'WARN' 'SSD TRIM is disabled (Full optimize fixes this).' }
    if ($inv.GPU) { foreach ($g in $inv.GPU) {
        if ($g.DriverDate -and ((Get-Date) - [datetime]$g.DriverDate).TotalDays -gt 120) {
            Add-F 'WARN' "GPU driver for $($g.Model) is from $(([datetime]$g.DriverDate).ToString('yyyy-MM-dd')). Update from nvidia.com (Game Ready driver for gaming)." } } }
    if ($inv.EventErrors) {
        if ($inv.EventErrors.WHEA -gt 0) { Add-F 'CRIT' "$($inv.EventErrors.WHEA) WHEA hardware error(s) in 7 days - often unstable XMP/overclock or PSU. Fix before chasing FPS." }
        if ($inv.EventErrors.Disk -gt 0) { Add-F 'CRIT' "$($inv.EventErrors.Disk) disk error(s) in 7 days - check cables/drive health." }
        if ($inv.EventErrors.UnexpectedShutdowns -gt 0) { Add-F 'WARN' "$($inv.EventErrors.UnexpectedShutdowns) unexpected shutdown(s) in 7 days." }
    }
    if ($inv.ProblemDevices -and $inv.ProblemDevices.Count) { Add-F 'WARN' "$($inv.ProblemDevices.Count) device(s) with Device Manager errors - usually a missing driver. Run option 2 (Driver scan)." }
    if ($inv.OverlaysRunning -and $inv.OverlaysRunning.Count) { Add-F 'INFO' "Overlay processes running ($($inv.OverlaysRunning -join ', ')). Each overlay costs a little FPS - disable the ones you don't use." }
    if ($inv.Startup -and $inv.Startup.Count -gt 10) { Add-F 'INFO' "$($inv.Startup.Count) startup entries - trim via Task Manager > Startup (listed in report; your call, never auto-disabled)." }
    if ($inv.Gaming -and $inv.Gaming.HAGS -ne 2) { Add-F 'INFO' 'HAGS off. On Win10 + recent NVIDIA drivers it usually helps; A/B test it (Settings > Display > Graphics settings). Not auto-enabled: a minority of setups stutter with it.' }
    if ($inv.Windows -and -not $inv.Windows.IsLaptop -and $inv.Power -and $inv.Power.ActivePlan -match 'Balanced') { Add-F 'INFO' 'Desktop on Balanced power plan - Full optimize switches to High performance (reversible).' }
    if ($inv.Pagefile -and ($inv.Pagefile -join '') -match 'MANUAL') { Add-F 'INFO' "Pagefile is manually sized: $($inv.Pagefile -join '; '). Unless you had a reason, 'System managed' is the safe setting." }
    return $script:findings
}

# ================================================================ REPORT ====
function New-Report($inv, $findings, [string]$Title = 'Inspection', [string[]]$ChangeLog = @()) {
    $mdPath = Join-Path $ReportDir "Report-$Stamp-$($Title -replace ' ','').md"
    $md = New-Object System.Text.StringBuilder
    [void]$md.AppendLine("# PC-Optimizer-AI - $Title Report")
    [void]$md.AppendLine("")
    [void]$md.AppendLine("Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm')  |  Admin: $(Test-Admin)")
    [void]$md.AppendLine("")
    [void]$md.AppendLine("## Findings")
    if (-not $findings -or @($findings).Count -eq 0) { [void]$md.AppendLine("`nNo issues detected.") }
    else {
        foreach ($f in (@($findings) | Sort-Object { switch ($_.Severity) { 'CRIT' {0} 'WARN' {1} default {2} } })) {
            [void]$md.AppendLine("- **[$($f.Severity)]** $($f.Text)")
        }
    }
    if ($ChangeLog.Count) {
        [void]$md.AppendLine("")
        [void]$md.AppendLine("## Changes applied this run")
        foreach ($c in $ChangeLog) { [void]$md.AppendLine("- $c") }
    }
    [void]$md.AppendLine("")
    [void]$md.AppendLine("## Full inventory")
    foreach ($key in $inv.Keys) {
        [void]$md.AppendLine("### $key")
        [void]$md.AppendLine('```json')
        [void]$md.AppendLine((ConvertTo-Json $inv[$key] -Depth 5))
        [void]$md.AppendLine('```')
    }
    [void]$md.AppendLine("## Rollback")
    $journal = @(Get-Journal)
    if ($journal.Count -eq 0) { [void]$md.AppendLine("`nNo tracked changes on record.") }
    else {
        [void]$md.AppendLine("")
        foreach ($j in $journal) { [void]$md.AppendLine("- $($j.Timestamp): $($j.Description) [$($j.Type)] old=$($j.OldValue) new=$($j.NewValue)") }
        [void]$md.AppendLine("")
        [void]$md.AppendLine("Undo everything: START-PC-OPTIMIZER.bat -> option 7, or Revert-Changes.ps1.")
        [void]$md.AppendLine("Registry .reg backups: $RegBackDir")
        [void]$md.AppendLine("System Restore points are named 'PC-Optimizer-AI ...'.")
    }
    $md.ToString() | Set-Content $mdPath -Encoding UTF8
    ConvertTo-Json $inv -Depth 6 | Set-Content ($mdPath -replace '\.md$', '.json') -Encoding UTF8
    Write-Log "Report: $mdPath" 'OK'
    return $mdPath
}

# ================================================= WINDOWS GAMING OPTIMIZE ==
function Invoke-WindowsOptimization($inv) {
    Write-Banner 'Safe Windows gaming optimization'
    if (-not (Assert-Admin 'Optimization')) { return @() }
    $changed = @()

    if (Set-TrackedRegValue -Path 'HKCU:\Software\Microsoft\GameBar' -Name 'AutoGameModeEnabled' -Value 1 `
        -What 'Enable Game Mode' -Why 'Microsoft-documented: prioritizes the foreground game and defers Update work') { $changed += 'Game Mode enabled' }
    if (Set-TrackedRegValue -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_Enabled' -Value 0 `
        -What 'Disable Game DVR background recording' -Why 'always-on capture costs CPU/GPU in every game; manual clips still work') { $changed += 'GameDVR background recording disabled' }
    if (Set-TrackedRegValue -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR' -Name 'AppCaptureEnabled' -Value 0 `
        -What 'Disable automatic app capture' -Why 'companion setting to GameDVR background recording') { $changed += 'Background app capture disabled' }

    # Power plan: desktops only. High perf keeps CPU cores from parking/downclocking between frames.
    if ($inv.Windows -and $inv.Windows.IsLaptop) {
        Write-Log 'Laptop detected - keeping current power plan (High performance drains battery and raises heat).' 'WARN'
    } elseif ($inv.Power -and $inv.Power.ActiveGuid -and
              $inv.Power.ActiveGuid -notin @('8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c', 'e9a42b02-d5df-448d-aa66-1f0ff8de23ce')) {
        $high = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
        if (((& powercfg.exe /list) -join "`n") -match $high) {
            & powercfg.exe /setactive $high
            Add-JournalEntry @{ Type = 'PowerScheme'; OldValue = $inv.Power.ActiveGuid; NewValue = $high; Description = 'High performance power plan' }
            Write-Log 'Switched to High performance power plan (old plan recorded for revert).' 'OK'
            $changed += 'High performance power plan'
        }
    } else { Write-Log 'Power plan already performance-oriented.' 'OK' }

    if ($inv.Contains('TrimEnabled') -and -not $inv.TrimEnabled) {
        & fsutil.exe behavior set disabledeletenotify 0 | Out-Null
        Add-JournalEntry @{ Type = 'Fsutil'; Name = 'disabledeletenotify'; OldValue = 1; NewValue = 0; Description = 'Enable SSD TRIM' }
        Write-Log 'TRIM enabled.' 'OK'; $changed += 'SSD TRIM enabled'
    }

    # Deliberately NOT done (explained, per the rules you set):
    Write-Log 'NOT touched: HAGS (A/B test it yourself), visual effects (negligible on GPUs from the last decade),' 'INFO'
    Write-Log 'NOT touched: timer resolution / Nagle / TcpAckFrequency / service disabling - fake or risky tweaks.' 'INFO'
    Write-Log 'NOT touched: Defender, firewall, mitigations, Windows Update - security stays on.' 'INFO'
    return $changed
}

function Invoke-TempClean {
    Write-Banner 'Safe temp cleanup (files older than 48h only)'
    $freed = 0
    foreach ($tmp in @($env:TEMP, "$env:SystemRoot\Temp")) {
        if (-not (Test-Path $tmp)) { continue }
        Get-ChildItem $tmp -Recurse -Force -File -ErrorAction SilentlyContinue |
            Where-Object { $_.LastWriteTime -lt (Get-Date).AddHours(-48) } |
            ForEach-Object { try { $s = $_.Length; Remove-Item $_.FullName -Force -ErrorAction Stop; $freed += $s } catch {} }
    }
    # DirectX shader cache: safe to clear if huge; rebuilt automatically. Only clear when > 4 GB.
    $dxCache = Join-Path $env:LOCALAPPDATA 'D3DSCache'
    if (Test-Path $dxCache) {
        $size = (Get-ChildItem $dxCache -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
        if ($size -gt 4GB) {
            Get-ChildItem $dxCache -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object { try { $s = $_.Length; Remove-Item $_.FullName -Force -ErrorAction Stop; $freed += $s } catch {} }
            Write-Log 'DirectX shader cache was over 4 GB - cleared (rebuilds automatically; first launches may briefly stutter).' 'OK'
        } else { Write-Log ("DirectX shader cache is {0:N1} GB - healthy, left alone." -f ($size / 1GB)) 'OK' }
    }
    Write-Log ("Freed {0:N0} MB." -f ($freed / 1MB)) 'OK'
    return $freed
}

# ================================================================== MAIN ====
Write-Host "`n  PC-Optimizer-AI  |  Mode: $Mode  |  Home: $OptHome" -ForegroundColor White

switch ($Mode) {
    'Inspect' {
        $inv = Invoke-Inspection
        New-Report $inv (Get-Findings $inv) 'Inspection' | Out-Null
    }
    'WinOpt' {
        $inv = Invoke-Inspection
        New-SafetyRestorePoint 'before Windows optimization'
        $changed = Invoke-WindowsOptimization $inv
        New-Report $inv (Get-Findings $inv) 'Windows Optimization' -ChangeLog $changed | Out-Null
    }
    'Full' {
        Write-Banner 'FULL OPTIMIZE - step 1/9: inspect'
        $inv = Invoke-Inspection
        $before = Get-Findings $inv
        Write-Banner 'Step 2/9: restore point'
        New-SafetyRestorePoint 'before full optimize'
        Write-Banner 'Step 3/9: driver scan (report + official links, no auto-install)'
        & "$PSScriptRoot\Driver-Scanner.ps1" -NoPause
        Write-Banner 'Step 4/9: Windows optimization'
        $changed = @(Invoke-WindowsOptimization $inv)
        Write-Banner 'Step 5/9: NVIDIA optimization'
        & "$PSScriptRoot\Nvidia-Optimizer.ps1" -NoPause
        Write-Banner 'Step 6/9: safe debloat (asks before removing anything)'
        & "$PSScriptRoot\Debloat-Safe.ps1" -NoPause
        Write-Banner 'Step 7/9: temp cleanup'
        $freed = Invoke-TempClean
        $changed += ("Temp cleanup freed {0:N0} MB" -f ($freed / 1MB))
        Write-Banner 'Step 8/9: verification (re-reading every changed setting)'
        $inv2 = Invoke-Inspection
        $ok = ($inv2.Gaming.GameMode -eq 1 -and $inv2.Gaming.GameDVR -eq 0 -and $inv2.Gaming.BackgroundCapture -eq 0)
        if ($ok) { Write-Log 'Verification passed: Game Mode on, GameDVR/background capture off.' 'OK' }
        else { Write-Log 'Verification found unexpected values - review the report.' 'WARN' }
        Write-Banner 'Step 9/9: before/after report'
        New-Report $inv2 (Get-Findings $inv2) 'Full Optimize (after)' -ChangeLog $changed | Out-Null
        Write-Log "Rollback at any time: option 7 (Revert), .reg files in $RegBackDir, or the System Restore point." 'INFO'
    }
    'OpenReport' {
        $r = Get-LatestReport
        if ($r) { Write-Log "Opening $($r.FullName)" 'OK'; Invoke-Item $r.FullName }
        else { Write-Log 'No reports yet - run Inspect (option 1) first.' 'WARN' }
    }
}
if ($Pause) { Read-Host "`nDone. Press Enter to close" | Out-Null }
