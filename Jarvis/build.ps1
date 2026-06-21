# Build Jarvis from the Jarvis project folder.
# Usage:
#   cd path\to\your\repo\Jarvis
#   .\build.ps1

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$project = Join-Path $ScriptDir "src\Jarvis\Jarvis.csproj"
if (-not (Test-Path $project)) {
    Write-Error "Project not found: $project"
}

dotnet restore $project
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

dotnet build $project -c Release
