namespace Jarvis.Models;

public sealed class MemoryEntry
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    public string Key { get; set; } = string.Empty;

    public string Value { get; set; } = string.Empty;

    public string Category { get; set; } = "general";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public int AccessCount { get; set; }
}
