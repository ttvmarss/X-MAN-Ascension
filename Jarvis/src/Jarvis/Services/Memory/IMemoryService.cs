using Jarvis.Models;

namespace Jarvis.Services.Memory;

public interface IMemoryService
{
    IReadOnlyList<MemoryEntry> Entries { get; }

    event EventHandler? MemoryChanged;

    Task InitializeAsync(CancellationToken cancellationToken = default);

    Task<MemoryEntry?> GetByKeyAsync(string key, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<MemoryEntry>> SearchAsync(string query, CancellationToken cancellationToken = default);

    Task<MemoryEntry> RememberAsync(string key, string value, string category = "general", CancellationToken cancellationToken = default);

    Task<bool> ForgetAsync(string key, CancellationToken cancellationToken = default);

    Task ClearAsync(CancellationToken cancellationToken = default);
}
