# Run Jarvis on Windows

## Easiest way (2 steps total)

**I cannot control your PC remotely.** I run in the cloud, not on your machine.  
But you can get very close to "zero effort" with this:

### Step 1 — Install .NET 8 (one time only)

Download and install: https://dotnet.microsoft.com/download/dotnet/8.0  
(Click the **SDK x64** installer for Windows.)

### Step 2 — Double-click one file

1. Download this file to your Desktop:  
   [START-JARVIS.bat](https://raw.githubusercontent.com/ttvmarss/X-MAN-Ascension/claude/evaluate-code-quality-ZHj0S/START-JARVIS.bat)
2. **Double-click `START-JARVIS.bat`**

That script will automatically:
- Download the Jarvis source code (if missing)
- Restore packages
- Build the app
- Launch Jarvis

You do not need to open PowerShell or type commands.

---

## Why I can't click things on your PC

| What I can do | What I cannot do |
|---|---|
| Write and test code in the cloud | Log into your Windows PC |
| Build the project remotely | Run PowerShell on your machine |
| Create one-click scripts for you | Install .NET for you |
| Fix bugs and push updates to GitHub | Double-click files on your desktop |

Cursor Cloud Agents run on a remote server. There is no way to hand over full control of your computer through this chat.

---

## Manual setup (if you prefer PowerShell)

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
