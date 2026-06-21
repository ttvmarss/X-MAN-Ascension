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

## Build

```bash
cd Jarvis
dotnet restore
dotnet build src/Jarvis/Jarvis.csproj -c Release
```

## Run (Windows)

```bash
dotnet run --project src/Jarvis/Jarvis.csproj
```

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
