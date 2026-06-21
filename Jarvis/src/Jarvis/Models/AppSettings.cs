namespace Jarvis.Models;

public sealed class AppSettings
{
    public string Theme { get; set; } = "Dark";

    public bool VoiceInputEnabled { get; set; } = true;

    public bool VoiceOutputEnabled { get; set; } = true;

    public string VoiceName { get; set; } = "Default";

    public double SpeechRate { get; set; } = 1.0;

    public bool SaveConversationHistory { get; set; } = true;

    public int MaxMemoryEntries { get; set; } = 500;

    public string LogLevel { get; set; } = "Information";
}
