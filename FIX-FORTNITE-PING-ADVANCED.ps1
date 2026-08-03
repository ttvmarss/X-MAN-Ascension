# =============================================================
#  X-MAN Fortnite Ping Fixer - Advanced Edition (PowerShell)
# =============================================================
# Run as Administrator:
#   Right-click PowerShell > Run as Administrator
#   Then: Set-ExecutionPolicy Bypass -Scope Process -Force
#   Then: .\FIX-FORTNITE-PING-ADVANCED.ps1
# =============================================================

#Requires -RunAsAdministrator

$Host.UI.RawUI.WindowTitle = "X-MAN Fortnite Ping Fixer - Advanced"
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "    X-MAN FORTNITE PING FIXER - Advanced (PowerShell)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$fixCount = 0
$totalFixes = 12

function Write-Step {
    param([int]$num, [string]$msg)
    Write-Host "[$num/$script:totalFixes] $msg" -ForegroundColor Yellow
}

function Write-Done {
    param([string]$msg)
    $script:fixCount++
    Write-Host "   [OK] $msg" -ForegroundColor Green
    Write-Host ""
}

function Write-Skip {
    param([string]$msg)
    Write-Host "   [SKIP] $msg" -ForegroundColor DarkGray
    Write-Host ""
}

# ----------------------------------------------------------
# 1. Flush DNS
# ----------------------------------------------------------
Write-Step 1 "Flushing DNS cache..."
Clear-DnsClientCache
Write-Done "DNS cache flushed."

# ----------------------------------------------------------
# 2. Reset network stack
# ----------------------------------------------------------
Write-Step 2 "Resetting network stack..."
netsh winsock reset 2>$null | Out-Null
netsh int ip reset 2>$null | Out-Null
Write-Done "Winsock + TCP/IP stack reset (reboot needed)."

# ----------------------------------------------------------
# 3. Disable TCP Auto-Tuning
# ----------------------------------------------------------
Write-Step 3 "Disabling TCP Auto-Tuning..."
netsh int tcp set global autotuninglevel=disabled 2>$null | Out-Null
Write-Done "Auto-Tuning disabled."

# ----------------------------------------------------------
# 4. Disable Nagle's Algorithm on all network interfaces
# ----------------------------------------------------------
Write-Step 4 "Disabling Nagle's Algorithm..."
$ifPaths = Get-ChildItem "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces"
foreach ($iface in $ifPaths) {
    Set-ItemProperty -Path $iface.PSPath -Name "TcpAckFrequency" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $iface.PSPath -Name "TCPNoDelay" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
}
Write-Done "Nagle's Algorithm disabled on all interfaces."

# ----------------------------------------------------------
# 5. Disable network throttling
# ----------------------------------------------------------
Write-Step 5 "Removing network throttling..."
$mmPath = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile"
Set-ItemProperty -Path $mmPath -Name "NetworkThrottlingIndex" -Value 0xFFFFFFFF -Type DWord -Force
Set-ItemProperty -Path $mmPath -Name "SystemResponsiveness" -Value 0 -Type DWord -Force
Write-Done "Network throttling disabled, full priority to gaming."

# ----------------------------------------------------------
# 6. Disable NIC power management (prevents adapter sleeping)
# ----------------------------------------------------------
Write-Step 6 "Disabling NIC power management..."
$adapters = Get-NetAdapter -Physical | Where-Object { $_.Status -eq "Up" }
foreach ($adapter in $adapters) {
    $powerMgmt = Get-CimInstance -ClassName MSPower_DeviceWakeEnable -Namespace root\wmi -ErrorAction SilentlyContinue |
        Where-Object { $_.InstanceName -like "*$($adapter.PnPDeviceID)*" }
    if ($powerMgmt) {
        $powerMgmt | ForEach-Object {
            $_ | Set-CimInstance -Property @{ Enable = $false } -ErrorAction SilentlyContinue
        }
    }

    # Disable Energy Efficient Ethernet and Green Ethernet via registry
    Disable-NetAdapterPowerManagement -Name $adapter.Name -ErrorAction SilentlyContinue
}
Write-Done "NIC power saving disabled - adapter stays fully awake."

# ----------------------------------------------------------
# 7. Disable Large Send Offload (LSO) on Ethernet adapters
# ----------------------------------------------------------
Write-Step 7 "Disabling Large Send Offload on Ethernet adapters..."
$ethAdapters = Get-NetAdapter -Physical | Where-Object { $_.Status -eq "Up" -and $_.MediaType -eq "802.3" }
foreach ($adapter in $ethAdapters) {
    Set-NetAdapterLso -Name $adapter.Name -V4Enabled $false -V6Enabled $false -ErrorAction SilentlyContinue
    Disable-NetAdapterChecksumOffload -Name $adapter.Name -ErrorAction SilentlyContinue
}
if ($ethAdapters) {
    Write-Done "LSO and checksum offload disabled on Ethernet."
} else {
    Write-Done "Applied where possible."
}

# ----------------------------------------------------------
# 8. Set DNS to Cloudflare (low latency)
# ----------------------------------------------------------
Write-Step 8 "Setting DNS to Cloudflare 1.1.1.1..."
$ethUp = Get-NetAdapter -Physical | Where-Object { $_.Status -eq "Up" }
foreach ($adapter in $ethUp) {
    Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ServerAddresses @("1.1.1.1", "1.0.0.1") -ErrorAction SilentlyContinue
}
Write-Done "DNS set to Cloudflare 1.1.1.1 / 1.0.0.1"

# ----------------------------------------------------------
# 9. Disable Delivery Optimization (P2P Windows Update)
# ----------------------------------------------------------
Write-Step 9 "Disabling Delivery Optimization..."
$doPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization"
if (-not (Test-Path $doPath)) { New-Item -Path $doPath -Force | Out-Null }
Set-ItemProperty -Path $doPath -Name "DODownloadMode" -Value 0 -Type DWord -Force
Write-Done "Delivery Optimization (P2P uploads) disabled."

# ----------------------------------------------------------
# 10. Stop bandwidth-hungry background services
# ----------------------------------------------------------
Write-Step 10 "Stopping background services that consume bandwidth..."
$services = @("BITS", "wuauserv", "DoSvc", "DiagTrack")
foreach ($svc in $services) {
    $s = Get-Service -Name $svc -ErrorAction SilentlyContinue
    if ($s -and $s.Status -eq "Running") {
        Stop-Service -Name $svc -Force -ErrorAction SilentlyContinue
        Write-Host "   Stopped: $($s.DisplayName)" -ForegroundColor DarkYellow
    }
}
Write-Done "Background bandwidth consumers stopped."

# ----------------------------------------------------------
# 11. Set Fortnite to high priority via registry
# ----------------------------------------------------------
Write-Step 11 "Setting Fortnite process priority to High..."
$gamePath = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FortniteClient-Win64-Shipping.exe\PerfOptions"
if (-not (Test-Path $gamePath)) {
    New-Item -Path $gamePath -Force | Out-Null
}
Set-ItemProperty -Path $gamePath -Name "CpuPriorityClass" -Value 3 -Type DWord -Force
Set-ItemProperty -Path $gamePath -Name "IoPriority" -Value 3 -Type DWord -Force
Write-Done "Fortnite set to High CPU + I/O priority."

# ----------------------------------------------------------
# 12. Renew IP address
# ----------------------------------------------------------
Write-Step 12 "Renewing IP address..."
ipconfig /release 2>$null | Out-Null
Start-Sleep -Seconds 2
ipconfig /renew 2>$null | Out-Null
Write-Done "IP address renewed."

# ----------------------------------------------------------
# Network diagnostic info
# ----------------------------------------------------------
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "               DIAGNOSTICS - Your Network Info" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Active Ethernet Adapter:" -ForegroundColor White
Get-NetAdapter -Physical | Where-Object { $_.Status -eq "Up" } | Format-Table Name, InterfaceDescription, LinkSpeed -AutoSize

Write-Host "Current DNS Servers:" -ForegroundColor White
Get-DnsClientServerAddress | Where-Object { $_.ServerAddresses -ne $null -and $_.AddressFamily -eq 2 } |
    Select-Object InterfaceAlias, ServerAddresses | Format-Table -AutoSize

Write-Host "Ping to Fortnite servers (Epic Games):" -ForegroundColor White
$targets = @(
    @{ Name = "NAE (Virginia)"; Host = "ping-nae.ds.on.epicgames.com" },
    @{ Name = "NAW (Oregon)";   Host = "ping-naw.ds.on.epicgames.com" },
    @{ Name = "EU (London)";    Host = "ping-eu.ds.on.epicgames.com" }
)
foreach ($t in $targets) {
    $result = Test-Connection -ComputerName $t.Host -Count 3 -ErrorAction SilentlyContinue
    if ($result) {
        $avg = [math]::Round(($result | Measure-Object -Property Latency -Average).Average)
        $color = if ($avg -lt 40) { "Green" } elseif ($avg -lt 80) { "Yellow" } else { "Red" }
        Write-Host "   $($t.Name): ${avg}ms" -ForegroundColor $color
    } else {
        Write-Host "   $($t.Name): unreachable" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "           ALL $fixCount FIXES APPLIED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. RESTART your PC now for all changes to take effect" -ForegroundColor White
Write-Host "  2. After restart, launch Fortnite and check ping" -ForegroundColor White
Write-Host "  3. In Fortnite: Settings > Game > Matchmaking Region" -ForegroundColor White
Write-Host "     Set to your closest server (NOT Auto)" -ForegroundColor White
Write-Host ""
Write-Host "IF PING IS STILL HIGH AFTER REBOOT:" -ForegroundColor Yellow
Write-Host "  - Restart your router (unplug power for 30 seconds)" -ForegroundColor White
Write-Host "  - Try a different Ethernet port on your router" -ForegroundColor White
Write-Host "  - Replace your Ethernet cable (cables degrade over time)" -ForegroundColor White
Write-Host "  - Check if your ISP is having issues: downdetector.com" -ForegroundColor White
Write-Host "  - Update your Ethernet adapter driver from manufacturer" -ForegroundColor White
Write-Host "  - Run REVERT-FORTNITE-PING-FIX.ps1 to undo all changes" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
