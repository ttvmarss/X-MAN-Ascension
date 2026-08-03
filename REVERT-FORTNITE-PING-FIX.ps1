# =============================================================
#  X-MAN Fortnite Ping Fix - REVERT Script
# =============================================================
# Undoes all changes made by FIX-FORTNITE-PING-ADVANCED.ps1
# Run as Administrator if you want to restore defaults.
# =============================================================

#Requires -RunAsAdministrator

Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "    REVERTING Fortnite Ping Fixes to Windows Defaults" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host ""

# Re-enable TCP Auto-Tuning
Write-Host "[1] Re-enabling TCP Auto-Tuning..." -ForegroundColor Cyan
netsh int tcp set global autotuninglevel=normal 2>$null | Out-Null
Write-Host "   Done." -ForegroundColor Green

# Remove Nagle's Algorithm overrides
Write-Host "[2] Removing Nagle's Algorithm overrides..." -ForegroundColor Cyan
$ifPaths = Get-ChildItem "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces"
foreach ($iface in $ifPaths) {
    Remove-ItemProperty -Path $iface.PSPath -Name "TcpAckFrequency" -Force -ErrorAction SilentlyContinue
    Remove-ItemProperty -Path $iface.PSPath -Name "TCPNoDelay" -Force -ErrorAction SilentlyContinue
}
Write-Host "   Done." -ForegroundColor Green

# Restore network throttling defaults
Write-Host "[3] Restoring network throttling defaults..." -ForegroundColor Cyan
$mmPath = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile"
Set-ItemProperty -Path $mmPath -Name "NetworkThrottlingIndex" -Value 10 -Type DWord -Force
Set-ItemProperty -Path $mmPath -Name "SystemResponsiveness" -Value 20 -Type DWord -Force
Write-Host "   Done." -ForegroundColor Green

# Re-enable NIC power management
Write-Host "[4] Re-enabling NIC power management..." -ForegroundColor Cyan
$adapters = Get-NetAdapter -Physical | Where-Object { $_.Status -eq "Up" }
foreach ($adapter in $adapters) {
    Enable-NetAdapterPowerManagement -Name $adapter.Name -ErrorAction SilentlyContinue
}
Write-Host "   Done." -ForegroundColor Green

# Re-enable LSO
Write-Host "[5] Re-enabling Large Send Offload..." -ForegroundColor Cyan
$ethAdapters = Get-NetAdapter -Physical | Where-Object { $_.Status -eq "Up" -and $_.MediaType -eq "802.3" }
foreach ($adapter in $ethAdapters) {
    Set-NetAdapterLso -Name $adapter.Name -V4Enabled $true -V6Enabled $true -ErrorAction SilentlyContinue
    Enable-NetAdapterChecksumOffload -Name $adapter.Name -ErrorAction SilentlyContinue
}
Write-Host "   Done." -ForegroundColor Green

# Reset DNS to automatic (DHCP)
Write-Host "[6] Resetting DNS to automatic (DHCP)..." -ForegroundColor Cyan
$ethUp = Get-NetAdapter -Physical | Where-Object { $_.Status -eq "Up" }
foreach ($adapter in $ethUp) {
    Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ResetServerAddresses -ErrorAction SilentlyContinue
}
Write-Host "   Done." -ForegroundColor Green

# Re-enable Delivery Optimization
Write-Host "[7] Re-enabling Delivery Optimization..." -ForegroundColor Cyan
Remove-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization" -Name "DODownloadMode" -Force -ErrorAction SilentlyContinue
Write-Host "   Done." -ForegroundColor Green

# Restart stopped services
Write-Host "[8] Restarting background services..." -ForegroundColor Cyan
$services = @("BITS", "wuauserv", "DoSvc", "DiagTrack")
foreach ($svc in $services) {
    Start-Service -Name $svc -ErrorAction SilentlyContinue
}
Write-Host "   Done." -ForegroundColor Green

# Remove Fortnite priority override
Write-Host "[9] Removing Fortnite priority override..." -ForegroundColor Cyan
$gamePath = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FortniteClient-Win64-Shipping.exe"
if (Test-Path $gamePath) {
    Remove-Item -Path $gamePath -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host "   Done." -ForegroundColor Green

# Remove Windows Update policy
Write-Host "[10] Removing Windows Update policy override..." -ForegroundColor Cyan
Remove-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" -Name "NoAutoUpdate" -Force -ErrorAction SilentlyContinue
Write-Host "   Done." -ForegroundColor Green

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "    ALL CHANGES REVERTED - Restart PC to take effect" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
