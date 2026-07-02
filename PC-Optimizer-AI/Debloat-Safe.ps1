<#
.SYNOPSIS
    Safe, reversible debloat - removes only harmless preinstalled Store apps,
    and only after showing you the list and asking.
.DESCRIPTION
    Hard rules baked in:
      - NEVER touches: Microsoft Store, Windows Update, Defender/Security,
        networking, audio, Bluetooth, drivers, or any system component.
      - Xbox apps are QUESTIONABLE (needed for Game Pass / some game sign-ins):
        listed for your explicit approval, never removed silently.
      - Apps are removed for the CURRENT USER ONLY via Remove-AppxPackage, so
        every one of them can be reinstalled free from the Microsoft Store.
      - Every removal is journaled; Revert-Changes.ps1 attempts re-register
        and otherwise tells you the exact Store reinstall.
#>
[CmdletBinding()]
param([switch]$NoPause, [switch]$Pause)
. "$PSScriptRoot\Common.ps1"

# Genuinely-safe list: ad/consumer fluff with zero system function.
$SafeList = @(
    'Microsoft.3DBuilder', 'Microsoft.BingNews', 'Microsoft.BingWeather',
    'Microsoft.GetHelp', 'Microsoft.Getstarted', 'Microsoft.Microsoft3DViewer',
    'Microsoft.MicrosoftOfficeHub', 'Microsoft.MicrosoftSolitaireCollection',
    'Microsoft.MixedReality.Portal', 'Microsoft.People', 'Microsoft.SkypeApp',
    'Microsoft.WindowsFeedbackHub', 'Microsoft.ZuneVideo', 'Microsoft.WindowsMaps'
)
# Questionable: useful to many people - approval required per app, never bulk.
$QuestionableList = @(
    @{ Name = 'Microsoft.XboxApp';            Note = 'Xbox app - needed for Game Pass and some game sign-ins' },
    @{ Name = 'Microsoft.YourPhone';          Note = 'Phone Link - phone-to-PC integration' },
    @{ Name = 'Microsoft.ZuneMusic';          Note = 'Media Player / Groove' },
    @{ Name = 'Microsoft.MicrosoftStickyNotes'; Note = 'Sticky Notes' },
    @{ Name = 'Microsoft.WindowsSoundRecorder'; Note = 'Voice Recorder' }
)
# Never-touch list, enforced in code, not just promised.
$Protected = 'WindowsStore|Microsoft\.Windows\.|Microsoft\.NET|Microsoft\.UI|Microsoft\.VCLibs|SecHealthUI|Defender|Microsoft\.GamingServices|Microsoft\.XboxGameOverlay|Microsoft\.XboxGamingOverlay|Microsoft\.XboxIdentityProvider|Microsoft\.XboxSpeechToTextOverlay|Microsoft\.DesktopAppInstaller|Microsoft\.StorePurchaseApp|Microsoft\.WebMediaExtensions|Microsoft\.HEIFImageExtension|Microsoft\.VP9VideoExtensions'

function Remove-BloatApp([string]$Name, [string]$Reason) {
    if ($Name -match $Protected) { Write-Log "$Name is protected - refusing to remove." 'WARN'; return }
    $pkg = Get-AppxPackage -Name $Name -ErrorAction SilentlyContinue
    if (-not $pkg) { Write-Log "$Name - not installed, skipping." 'INFO'; return }
    try {
        Remove-AppxPackage -Package $pkg.PackageFullName -ErrorAction Stop
        Add-JournalEntry @{
            Type = 'Appx'; Name = $pkg.Name; PackageFullName = $pkg.PackageFullName
            PackageFamilyName = $pkg.PackageFamilyName; InstallLocation = $pkg.InstallLocation
            Description = "Removed Store app $($pkg.Name) ($Reason)"
        }
        Write-Log "Removed $($pkg.Name) (current user only; reinstallable from Microsoft Store)." 'OK'
    } catch { Write-Log "Could not remove $($pkg.Name): $($_.Exception.Message)" 'WARN' }
}

Write-Banner 'Safe debloat'
Write-Log 'Rules: Store/Update/Defender/networking/audio/Bluetooth are protected in code.' 'INFO'
Write-Log 'Removals are per-user and reversible via the Microsoft Store.' 'INFO'

$installedSafe = @($SafeList | Where-Object { Get-AppxPackage -Name $_ -ErrorAction SilentlyContinue })
if ($installedSafe.Count -eq 0) {
    Write-Log 'None of the safe-list bloat apps are installed - already clean.' 'OK'
} else {
    Write-Banner "Safe list - present on this PC ($($installedSafe.Count) apps)"
    foreach ($a in $installedSafe) { Write-Log $a 'ASK' }
    $answer = Read-Host "`nRemove ALL of the above? They are consumer fluff with no system function. [y/N]"
    if ($answer -match '^[Yy]') {
        foreach ($a in $installedSafe) { Remove-BloatApp $a 'safe list, user approved' }
    } else { Write-Log 'Skipped - nothing removed.' 'INFO' }
}

Write-Banner 'Questionable apps - individual approval'
foreach ($q in $QuestionableList) {
    if (-not (Get-AppxPackage -Name $q.Name -ErrorAction SilentlyContinue)) { continue }
    $answer = Read-Host "Remove $($q.Name)? ($($q.Note)) [y/N]"
    if ($answer -match '^[Yy]') { Remove-BloatApp $q.Name 'questionable list, user approved' }
    else { Write-Log "Kept $($q.Name)." 'INFO' }
}

Write-Banner 'Deep scan - every other removable app on this PC'
$deep = Read-Host 'List EVERY remaining removable app (including hidden preinstalls) for pick-and-choose removal? [y/N]'
if ($deep -match '^[Yy]') {
    $known = @($SafeList) + @($QuestionableList | ForEach-Object { $_.Name })
    $rest = @(Get-AppxPackage | Where-Object {
        $_.Name -notmatch $Protected -and $_.Name -notin $known -and
        -not $_.IsFramework -and $_.SignatureKind -ne 'System' -and (-not $_.NonRemovable)
    } | Sort-Object Name)
    if ($rest.Count -eq 0) { Write-Log 'Nothing else removable found.' 'OK' }
    else {
        for ($i = 0; $i -lt $rest.Count; $i++) { Write-Log "[$($i + 1)] $($rest[$i].Name)" 'ASK' }
        $pick = Read-Host "`nEnter numbers to remove (e.g. 1,4,7) or press Enter to skip"
        if ($pick.Trim()) {
            foreach ($n in ($pick -split '[,; ]+')) {
                $idx = 0
                if ([int]::TryParse($n.Trim(), [ref]$idx) -and $idx -ge 1 -and $idx -le $rest.Count) {
                    Remove-BloatApp $rest[$idx - 1].Name 'deep scan, user picked'
                }
            }
        } else { Write-Log 'Deep scan: nothing removed.' 'INFO' }
    }
}

Write-Banner 'Stop bloat from reinstalling itself'
# Documented Content Delivery Manager settings: Windows silently reinstalls
# "suggested" apps after updates unless these are off. Reversible, journaled.
Set-TrackedRegValue -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager' -Name 'SilentInstalledAppsEnabled' -Value 0 `
    -What 'Stop silent auto-install of suggested apps' -Why 'this is how removed bloat keeps coming back after updates' | Out-Null
Set-TrackedRegValue -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager' -Name 'PreInstalledAppsEnabled' -Value 0 `
    -What 'Disable OEM/carrier preinstalled app delivery' -Why 'stops partner bloat from being delivered to this profile' | Out-Null
Set-TrackedRegValue -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager' -Name 'SubscribedContent-338388Enabled' -Value 0 `
    -What 'Disable Start menu app suggestions' -Why 'removes the ad slots in the Start menu' | Out-Null

Write-Banner 'What was NOT touched'
Write-Log 'Microsoft Store, Windows Update, Defender, Xbox gaming services/overlays (Game Pass needs them),' 'INFO'
Write-Log 'networking, audio, Bluetooth, codecs/extensions, and every Microsoft.Windows.* system app.' 'INFO'

if ($Pause -and -not $NoPause) { Read-Host "`nDone. Press Enter to close" | Out-Null }
