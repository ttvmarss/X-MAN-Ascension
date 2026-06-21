# Jarvis

Production-quality Windows desktop assistant built with **C#**, **.NET 8**, and **WPF**.

## Stage 1 (current)

- Modern futuristic dark theme
- Shell navigation between Chat and Settings
- ChatGPT-style chat interface with conversation sidebar
- Settings page (voice, memory, diagnostics)
- Local memory framework (JSON persistence)
- File-based error logging
- Modular MVVM architecture with dependency injection

## Requirements

- Windows 10/11
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)

## Get the code (first time only)

If you do not have the repo yet, clone it and open the Jarvis folder:

```powershell
cd $HOME\Documents
git clone https://github.com/ttvmarss/X-MAN-Ascension.git
cd X-MAN-Ascension\Jarvis
```

If you already cloned the repo, go to the `Jarvis` folder inside it (not `C:\Windows\System32`):

```powershell
cd C:\path\to\X-MAN-Ascension\Jarvis
```

Verify the project file exists:

```powershell
Test-Path .\src\Jarvis\Jarvis.csproj
```

This must print `True` before you build or run.

## Run (Windows — easiest)

From the `Jarvis` folder:

```powershell
.\run.ps1
```

If PowerShell blocks the script:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
.\run.ps1
```

## Build

From the `Jarvis` folder:

```powershell
.\build.ps1
```

Or manually:

```powershell
cd path\to\X-MAN-Ascension\Jarvis
dotnet restore .\src\Jarvis\Jarvis.csproj
dotnet build .\src\Jarvis\Jarvis.csproj -c Release
dotnet run --project .\src\Jarvis\Jarvis.csproj -c Release
```

**Important:** Run these commands in order, and only after `cd` into the `Jarvis` folder. Running from `C:\Windows\System32` will fail because the project is not there.

## Project structure

```
Jarvis/
├── Jarvis.sln
└── src/Jarvis/
    ├── App.xaml                 # Application resources & DI bootstrap
    ├── MainWindow.xaml          # Application shell
    ├── Converters/              # XAML value converters
    ├── Models/                  # Domain models
    ├── Services/
    │   ├── Logging/             # File log service
    │   ├── Memory/              # Local memory store
    │   ├── Navigation/          # View navigation
    │   └── Settings/            # Persistent app settings
    ├── Themes/                  # Dark theme resources
    ├── ViewModels/              # MVVM view models
    └── Views/                   # Chat & Settings views
```

## Data locations

Application data is stored under:

`%LOCALAPPDATA%\Jarvis\`

- `settings.json` — user preferences
- `memory.json` — local memory entries
- `Logs/` — daily log files

## Next stages

- Stage 2: Voice input/output services
- Stage 3: AI conversation backend integration
- Stage 4: Conversation history persistence & polish
