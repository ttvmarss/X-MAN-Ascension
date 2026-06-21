namespace Jarvis.Services.Logging;

public interface ILogService
{
    void Debug(string message, Exception? exception = null);

    void Info(string message, Exception? exception = null);

    void Warning(string message, Exception? exception = null);

    void Error(string message, Exception? exception = null);

    string LogDirectory { get; }
}
