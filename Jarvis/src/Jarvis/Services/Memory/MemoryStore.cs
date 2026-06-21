using System.Collections.ObjectModel;

namespace Jarvis.Services.Memory;

public sealed class MemoryStore
{
    public ObservableCollection<Models.MemoryEntry> Entries { get; } = [];
}
