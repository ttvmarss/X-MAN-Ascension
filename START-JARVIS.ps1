# One-click Jarvis launcher (double-click START-JARVIS.bat instead if you prefer)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  JARVIS - Automatic Setup and Launch" -ForegroundColor Cyan
Write-Host ""

$RepoDir   = Join-Path $env:USERPROFILE "Documents\X-MAN-Ascension"
$JarvisDir = Join-Path $RepoDir "Jarvis"
$Project   = Join-Path $JarvisDir "src\Jarvis\Jarvis.csproj"
$RepoUrl   = "https://github.com/ttvmarss/X-MAN-Ascension.git"
$ZipUrl    = "https://github.com/ttvmarss/X-MAN-Ascension/archive/refs/heads/claude/evaluate-code-quality-ZHj0S.zip"

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Install .NET 8 SDK first:" -ForegroundColor Red
    Write-Host "  https://dotnet.microsoft.com/download/dotnet/8.0"
    Start-Process "https://dotnet.microsoft.com/download/dotnet/8.0"
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[OK] .NET $(dotnet --version)" -ForegroundColor Green

if (-not (Test-Path $Project)) {
    Write-Host "Downloading Jarvis..." -ForegroundColor Yellow

    if (Get-Command git -ErrorAction SilentlyContinue) {
        New-Item -ItemType Directory -Force -Path (Split-Path $RepoDir) | Out-Null
        git clone $RepoUrl $RepoDir
    }

    if (-not (Test-Path $Project)) {
        $zip = Join-Path $env:TEMP "X-MAN-Ascension.zip"
        Invoke-WebRequest -Uri $ZipUrl -OutFile $zip
        if (Test-Path $RepoDir) { Remove-Item $RepoDir -Recurse -Force }
        Expand-Archive -Path $zip -DestinationPath (Split-Path $RepoDir)
        $extracted = Join-Path (Split-Path $RepoDir) "X-MAN-Ascension-claude-evaluate-code-quality-ZHj0S"
        Move-Item $extracted $RepoDir
        Remove-Item $zip -Force
    }
}

Set-Location $JarvisDir
dotnet restore $Project
dotnet build $Project -c Release
dotnet run --project $Project -c Release

Read-Host "Press Enter to exit"
