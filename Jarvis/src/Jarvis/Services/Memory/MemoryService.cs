using System.IO;
using System.Text.Json;
using Jarvis.Models;
using Jarvis.Services.Logging;
using Jarvis.Services.Settings;

namespace Jarvis.Services.Memory;

public sealed class MemoryService : IMemoryService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly ILogService _logService;
    private readonly ISettingsService _settingsService;
    private readonly MemoryStore _store;
    private readonly string _memoryPath;
    private readonly SemaphoreSlim _gate = new(1, 1);

    public MemoryService(ILogService logService, ISettingsService settingsService, MemoryStore store)
    {
        _logService = logService;
        _settingsService = settingsService;
        _store = store;

        var appData = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Jarvis");

        Directory.CreateDirectory(appData);
        _memoryPath = Path.Combine(appData, "memory.json");
    }

    public IReadOnlyList<MemoryEntry> Entries => _store.Entries;

    public event EventHandler? MemoryChanged;

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (!File.Exists(_memoryPath))
            {
                await PersistAsync(cancellationToken).ConfigureAwait(false);
                return;
            }

            await using var stream = File.OpenRead(_memoryPath);
            var entries = await JsonSerializer.DeserializeAsync<List<MemoryEntry>>(stream, JsonOptions, cancellationToken)
                .ConfigureAwait(false);

            _store.Entries.Clear();
            foreach (var entry in entries ?? [])
            {
                _store.Entries.Add(entry);
            }

            _logService.Info($"Memory loaded with {_store.Entries.Count} entries.");
        }
        catch (Exception ex)
        {
            _logService.Error("Failed to initialize memory store.", ex);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<MemoryEntry?> GetByKeyAsync(string key, CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var entry = _store.Entries.FirstOrDefault(e =>
                string.Equals(e.Key, key, StringComparison.OrdinalIgnoreCase));

            if (entry is not null)
            {
                entry.AccessCount++;
                entry.UpdatedAt = DateTime.UtcNow;
                await PersistAsync(cancellationToken).ConfigureAwait(false);
            }

            return entry;
        }
        finally
        {
            _gate.Release();
        }
    }

    public Task<IReadOnlyList<MemoryEntry>> SearchAsync(string query, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (string.IsNullOrWhiteSpace(query))
        {
            return Task.FromResult<IReadOnlyList<MemoryEntry>>(_store.Entries.ToList());
        }

        var results = _store.Entries
            .Where(entry =>
                entry.Key.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                entry.Value.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                entry.Category.Contains(query, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(entry => entry.UpdatedAt)
            .ToList();

        return Task.FromResult<IReadOnlyList<MemoryEntry>>(results);
    }

    public async Task<MemoryEntry> RememberAsync(
        string key,
        string value,
        string category = "general",
        CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var existing = _store.Entries.FirstOrDefault(e =>
                string.Equals(e.Key, key, StringComparison.OrdinalIgnoreCase));

            if (existing is not null)
            {
                existing.Value = value;
                existing.Category = category;
                existing.UpdatedAt = DateTime.UtcNow;
                existing.AccessCount++;
            }
            else
            {
                existing = new MemoryEntry
                {
                    Key = key,
                    Value = value,
                    Category = category
                };

                _store.Entries.Add(existing);
                TrimIfNeeded();
            }

            await PersistAsync(cancellationToken).ConfigureAwait(false);
            MemoryChanged?.Invoke(this, EventArgs.Empty);
            _logService.Info($"Memory stored: {key}");
            return existing;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<bool> ForgetAsync(string key, CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var entry = _store.Entries.FirstOrDefault(e =>
                string.Equals(e.Key, key, StringComparison.OrdinalIgnoreCase));

            if (entry is null)
            {
                return false;
            }

            _store.Entries.Remove(entry);
            await PersistAsync(cancellationToken).ConfigureAwait(false);
            MemoryChanged?.Invoke(this, EventArgs.Empty);
            _logService.Info($"Memory removed: {key}");
            return true;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task ClearAsync(CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            _store.Entries.Clear();
            await PersistAsync(cancellationToken).ConfigureAwait(false);
            MemoryChanged?.Invoke(this, EventArgs.Empty);
            _logService.Warning("Memory store cleared.");
        }
        finally
        {
            _gate.Release();
        }
    }

    private void TrimIfNeeded()
    {
        var maxEntries = Math.Max(1, _settingsService.Current.MaxMemoryEntries);
        while (_store.Entries.Count > maxEntries)
        {
            var oldest = _store.Entries
                .OrderBy(entry => entry.UpdatedAt)
                .ThenBy(entry => entry.AccessCount)
                .First();

            _store.Entries.Remove(oldest);
        }
    }

    private async Task PersistAsync(CancellationToken cancellationToken)
    {
        var snapshot = _store.Entries.ToList();
        await using var stream = File.Create(_memoryPath);
        await JsonSerializer.SerializeAsync(stream, snapshot, JsonOptions, cancellationToken)
            .ConfigureAwait(false);
    }
}
