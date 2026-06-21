using System.IO;
using System.Text;

namespace Jarvis.Services.Logging;

public sealed class FileLogService : ILogService
{
    private readonly object _lock = new();
    private readonly string _logFilePath;

    public FileLogService()
    {
        LogDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Jarvis",
            "Logs");

        Directory.CreateDirectory(LogDirectory);
        _logFilePath = Path.Combine(LogDirectory, $"jarvis-{DateTime.UtcNow:yyyy-MM-dd}.log");
    }

    public string LogDirectory { get; }

    public void Debug(string message, Exception? exception = null) =>
        Write("DEBUG", message, exception);

    public void Info(string message, Exception? exception = null) =>
        Write("INFO", message, exception);

    public void Warning(string message, Exception? exception = null) =>
        Write("WARN", message, exception);

    public void Error(string message, Exception? exception = null) =>
        Write("ERROR", message, exception);

    private void Write(string level, string message, Exception? exception)
    {
        var builder = new StringBuilder()
            .Append('[').Append(DateTime.UtcNow.ToString("O")).Append("] ")
            .Append('[').Append(level).Append("] ")
            .Append(message);

        if (exception is not null)
        {
            builder.AppendLine()
                .Append(exception);
        }

        lock (_lock)
        {
            File.AppendAllText(_logFilePath, builder.AppendLine().ToString());
        }
    }
}
