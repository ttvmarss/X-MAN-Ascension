# Run Jarvis from the Jarvis project folder.
# Usage:
#   cd path\to\your\repo\Jarvis
#   .\run.ps1

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "Jarvis — restore, build, run" -ForegroundColor Cyan
Write-Host "Working directory: $ScriptDir" -ForegroundColor DarkGray

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    Write-Error @"
.NET SDK not found. Install .NET 8 SDK from:
  https://dotnet.microsoft.com/download/dotnet/8.0
Then reopen PowerShell and run this script again.
"@
}

$project = Join-Path $ScriptDir "src\Jarvis\Jarvis.csproj"
if (-not (Test-Path $project)) {
    Write-Error "Project not found: $project`nMake sure you cloned the repo and are inside the Jarvis folder."
}

dotnet restore $project
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

dotnet build $project -c Release
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

dotnet run --project $project -c Release
