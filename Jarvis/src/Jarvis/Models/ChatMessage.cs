namespace Jarvis.Models;

public enum MessageRole
{
    User,
    Assistant,
    System
}

public sealed class ChatMessage
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    public MessageRole Role { get; set; }

    public string Content { get; set; } = string.Empty;

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    public bool IsStreaming { get; set; }
}
