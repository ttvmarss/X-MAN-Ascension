<#
.SYNOPSIS
    Driver inventory and update recommendations - OFFICIAL SOURCES ONLY.
.DESCRIPTION
    Identifies motherboard, chipset family, GPU, Ethernet, Wi-Fi, Bluetooth
    and audio drivers with current versions and dates, flags stale ones, and
    prints the exact official download page for each. It never downloads or
    installs anything itself, and never recommends third-party driver tools.
    Exports a full driver list to DriverBackups as a pre-update record.
#>
[CmdletBinding()]
param([switch]$NoPause, [switch]$Pause)
. "$PSScriptRoot\Common.ps1"

Write-Banner 'Driver scan (read-only - nothing is installed)'

# ------------------------------------------------ motherboard and chipset --
$board = $null
try {
    $bb = Get-CimInstance Win32_BaseBoard
    $board = "$($bb.Manufacturer) $($bb.Product)".Trim()
    Write-Log "Motherboard: $board" 'OK'
    $vendorUrl = switch -Regex ($bb.Manufacturer) {
        'ASUS'     { 'https://www.asus.com/support/download-center/' }
        'MSI|Micro-Star' { 'https://www.msi.com/support' }
        'Gigabyte' { 'https://www.gigabyte.com/Support' }
        'ASRock'   { 'https://www.asrock.com/support/' }
        default    { $null }
    }
    if ($vendorUrl) { Write-Log "Official board support page (search for '$($bb.Product)'): $vendorUrl" 'INFO' }
} catch { Write-Log "Motherboard query failed: $_" 'WARN' }

try {
    $cpu = (Get-CimInstance Win32_Processor | Select-Object -First 1).Name
    if ($cpu -match 'AMD')   { Write-Log "Chipset family: AMD ($cpu). Official chipset drivers: https://www.amd.com/en/support" 'INFO' }
    elseif ($cpu -match 'Intel') { Write-Log "Chipset family: Intel ($cpu). Official tool: https://www.intel.com/content/www/us/en/support/detect.html" 'INFO' }
} catch {}

# --------------------------------------------------------- driver inventory -
$drivers = @()
try {
    $drivers = @(Get-CimInstance Win32_PnPSignedDriver -ErrorAction Stop |
        Where-Object { $_.DeviceClass -in @('DISPLAY', 'NET', 'MEDIA', 'SYSTEM', 'BLUETOOTH', 'HDC') -and $_.DeviceName })
} catch { Write-Log "Driver inventory failed: $_" 'WARN' }

function Show-DriverGroup([string]$Title, $Items, [string]$OfficialSource) {
    Write-Banner $Title
    if (-not $Items -or @($Items).Count -eq 0) { Write-Log 'None detected.' 'INFO'; return }
    foreach ($d in $Items) {
        $age = ''
        if ($d.DriverDate) {
            $days = [int]((Get-Date) - [datetime]$d.DriverDate).TotalDays
            $age = " ($([datetime]$d.DriverDate | Get-Date -Format 'yyyy-MM-dd'), $days days old)"
            if ($days -gt 365) { Write-Log "$($d.DeviceName): v$($d.DriverVersion)$age - STALE, check for update" 'WARN'; continue }
        }
        Write-Log "$($d.DeviceName): v$($d.DriverVersion)$age [$($d.DriverProviderName)]" 'OK'
    }
    if ($OfficialSource) { Write-Log "Official source: $OfficialSource" 'INFO' }
}

$display = @($drivers | Where-Object DeviceClass -eq 'DISPLAY')
$nvidiaSrc = 'https://www.nvidia.com/Download/index.aspx (pick Game Ready for gaming) - or Windows Update'
Show-DriverGroup 'GPU / Display drivers' $display $nvidiaSrc

$net = @($drivers | Where-Object DeviceClass -eq 'NET' | Where-Object { $_.DeviceName -notmatch 'Virtual|VPN|TAP|Loopback|Bluetooth' })
Show-DriverGroup 'Network drivers (Ethernet + Wi-Fi)' $net 'Motherboard vendor support page (Ethernet), or Intel/Realtek/MediaTek official pages. Windows Update is fine too.'

$bt = @($drivers | Where-Object { $_.DeviceClass -eq 'BLUETOOTH' -or $_.DeviceName -match 'Bluetooth' } | Select-Object -First 4)
Show-DriverGroup 'Bluetooth' $bt 'Usually bundled with the Wi-Fi driver from the same vendor.'

$audio = @($drivers | Where-Object { $_.DeviceClass -eq 'MEDIA' } | Select-Object -First 6)
Show-DriverGroup 'Audio drivers' $audio 'Motherboard vendor support page (Realtek audio), or Windows Update.'

$chipset = @($drivers | Where-Object { $_.DeviceClass -eq 'SYSTEM' -and $_.DeviceName -match 'SMBus|chipset|PCI Express Root' } | Select-Object -First 5)
Show-DriverGroup 'Chipset' $chipset 'AMD: amd.com/en/support | Intel: intel.com Driver & Support Assistant | or board vendor page.'

# ---------------------------------------------------------- backup record --
try {
    $exportPath = Join-Path $DrvBackDir "driver-inventory-$Stamp.csv"
    $drivers | Select-Object DeviceName, DeviceClass, DriverVersion, DriverDate, DriverProviderName, InfName |
        Export-Csv $exportPath -NoTypeInformation -Encoding UTF8
    Write-Log "Full driver inventory exported: $exportPath" 'OK'
    Write-Log "Tip: before any driver update, this CSV + a restore point is your rollback record." 'INFO'
} catch { Write-Log "Driver export failed: $_" 'WARN' }

# ---------------------------------------------------------------- policy ---
Write-Banner 'Driver policy'
Write-Log 'This tool never auto-downloads drivers (large downloads need your say-so) and never' 'INFO'
Write-Log 'uses third-party "driver updater" software - those cause more problems than they solve.' 'INFO'
Write-Log 'Update order that matters for gaming: 1) NVIDIA GPU  2) chipset  3) network. Audio only if broken.' 'INFO'
Write-Log 'Create a restore point before each driver install (Full optimize already made one today).' 'INFO'

if ($Pause -and -not $NoPause) { Read-Host "`nDone. Press Enter to close" | Out-Null }
