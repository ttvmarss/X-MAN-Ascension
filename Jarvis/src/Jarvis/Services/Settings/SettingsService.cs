using System.IO;
using System.Text.Json;
using Jarvis.Models;
using Jarvis.Services.Logging;

namespace Jarvis.Services.Settings;

public sealed class SettingsService : ISettingsService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly ILogService _logService;
    private readonly string _settingsPath;

    public SettingsService(ILogService logService)
    {
        _logService = logService;
        var appData = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Jarvis");

        Directory.CreateDirectory(appData);
        _settingsPath = Path.Combine(appData, "settings.json");
        Current = new AppSettings();
    }

    public AppSettings Current { get; private set; }

    public async Task LoadAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            if (!File.Exists(_settingsPath))
            {
                await SaveAsync(cancellationToken).ConfigureAwait(false);
                return;
            }

            await using var stream = File.OpenRead(_settingsPath);
            var settings = await JsonSerializer.DeserializeAsync<AppSettings>(stream, JsonOptions, cancellationToken)
                .ConfigureAwait(false);

            Current = settings ?? new AppSettings();
            _logService.Info("Settings loaded.");
        }
        catch (Exception ex)
        {
            _logService.Error("Failed to load settings.", ex);
            Current = new AppSettings();
        }
    }

    public async Task SaveAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            await using var stream = File.Create(_settingsPath);
            await JsonSerializer.SerializeAsync(stream, Current, JsonOptions, cancellationToken)
                .ConfigureAwait(false);

            _logService.Info("Settings saved.");
        }
        catch (Exception ex)
        {
            _logService.Error("Failed to save settings.", ex);
            throw;
        }
    }
}
