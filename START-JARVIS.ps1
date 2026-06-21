# One-click Jarvis launcher

$ErrorActionPreference = "Stop"

$RepoDir   = Join-Path $env:USERPROFILE "Documents\X-MAN-Ascension"
$JarvisDir = Join-Path $RepoDir "Jarvis"
$Project   = Join-Path $JarvisDir "src\Jarvis\Jarvis.csproj"
$RepoUrl   = "https://github.com/ttvmarss/X-MAN-Ascension.git"
$Branch    = "cursor/jarvis-stage1-ui-aa3b"
$ZipUrl    = "https://github.com/ttvmarss/X-MAN-Ascension/archive/refs/heads/cursor/jarvis-stage1-ui-aa3b.zip"
$ZipFolder = "X-MAN-Ascension-cursor-jarvis-stage1-ui-aa3b"

Write-Host ""
Write-Host "  JARVIS - Automatic Setup and Launch" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Install .NET SDK first:" -ForegroundColor Red
    Start-Process "https://dotnet.microsoft.com/download/dotnet/8.0"
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[OK] .NET $(dotnet --version)" -ForegroundColor Green

function Download-Zip {
    $zip = Join-Path $env:TEMP "X-MAN-Ascension-Jarvis.zip"
    $tempExtract = Join-Path $env:TEMP ("jarvis-extract-" + [guid]::NewGuid())

    Write-Host "Downloading ZIP..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $ZipUrl -OutFile $zip -UseBasicParsing
    New-Item -ItemType Directory -Path $tempExtract -Force | Out-Null
    Expand-Archive -Path $zip -DestinationPath $tempExtract -Force

    $extracted = Join-Path $tempExtract $ZipFolder
    if (-not (Test-Path $extracted)) {
        throw "Extracted folder not found: $extracted"
    }

    if (Test-Path $RepoDir) {
        Remove-Item $RepoDir -Recurse -Force
    }

    Move-Item $extracted $RepoDir
    Remove-Item $zip -Force -ErrorAction SilentlyContinue
    Remove-Item $tempExtract -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Download complete." -ForegroundColor Green
}

if (-not (Test-Path $Project)) {
    Write-Host "Jarvis source not found. Setting up..." -ForegroundColor Yellow

    if (Test-Path (Join-Path $RepoDir ".git")) {
        Write-Host "Updating existing git repository..." -ForegroundColor Yellow
        Push-Location $RepoDir
        try {
            git fetch origin $Branch
            git checkout $Branch
            git pull origin $Branch
        } finally {
            Pop-Location
        }
    }
    elseif (Test-Path $RepoDir) {
        Write-Host "Removing incomplete folder..." -ForegroundColor Yellow
        Remove-Item $RepoDir -Recurse -Force
    }

    if (-not (Test-Path $Project) -and (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Host "Cloning Jarvis branch..." -ForegroundColor Yellow
        New-Item -ItemType Directory -Force -Path (Split-Path $RepoDir) | Out-Null
        git clone --branch $Branch --single-branch $RepoUrl $RepoDir
    }

    if (-not (Test-Path $Project)) {
        Download-Zip
    }
}

if (-not (Test-Path $Project)) {
    Write-Host "[ERROR] Jarvis project still missing at: $Project" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Set-Location $JarvisDir
dotnet restore $Project
dotnet build $Project -c Release
dotnet run --project $Project -c Release

Read-Host "Press Enter to exit"
