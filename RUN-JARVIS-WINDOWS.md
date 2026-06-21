# Run Jarvis on Windows

You must **leave `C:\Windows\System32`** and **clone the repository** before running anything.

Copy and paste this entire block into PowerShell **one line at a time**, or paste the whole block at once:

```powershell
cd $HOME\Documents
git clone https://github.com/ttvmarss/X-MAN-Ascension.git
cd X-MAN-Ascension\Jarvis
Test-Path .\src\Jarvis\Jarvis.csproj
.\run.ps1
```

## What each step does

1. `cd $HOME\Documents` — go to your Documents folder (not System32)
2. `git clone ...` — download the project (skip if you already cloned)
3. `cd X-MAN-Ascension\Jarvis` — enter the Jarvis app folder
4. `Test-Path ...` — must print `True`
5. `.\run.ps1` — restore, build, and run

## If you already cloned the repo

Find where you put it, then:

```powershell
cd C:\Users\YourName\Documents\X-MAN-Ascension\Jarvis
git pull
.\run.ps1
```

## If `git` is not installed

1. Install Git: https://git-scm.com/download/win
2. Or download the repo as ZIP: https://github.com/ttvmarss/X-MAN-Ascension/archive/refs/heads/claude/evaluate-code-quality-ZHj0S.zip
3. Extract it, then:

```powershell
cd $HOME\Downloads\X-MAN-Ascension-claude-evaluate-code-quality-ZHj0S\Jarvis
.\run.ps1
```

## If `.NET` is not installed

Install .NET 8 SDK: https://dotnet.microsoft.com/download/dotnet/8.0

Then run:

```powershell
dotnet --version
```

You should see `8.x.x`.

## Common mistakes

| Mistake | Result |
|---------|--------|
| Running commands in `C:\Windows\System32` | `run.ps1` not found |
| Running `.\run.ps1` before `cd` into Jarvis | Script not found |
| Running `git pull` outside a cloned repo | `not a git repository` |
| Pasting commands in reverse order | Same errors |

## Manual run (no script)

```powershell
cd $HOME\Documents\X-MAN-Ascension\Jarvis
dotnet restore .\src\Jarvis\Jarvis.csproj
dotnet run --project .\src\Jarvis\Jarvis.csproj -c Release
```
