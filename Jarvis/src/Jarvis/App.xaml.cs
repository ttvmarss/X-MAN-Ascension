using System.Windows;
using Jarvis.ViewModels;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Jarvis;

public partial class App : Application
{
    private IServiceProvider? _serviceProvider;

    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        _serviceProvider = ConfigureServices();
        Resources.Add("ServiceProvider", _serviceProvider);

        var logService = GetRequiredService<Services.Logging.ILogService>();
        logService.Info("Jarvis starting.");

        try
        {
            await GetRequiredService<Services.Settings.ISettingsService>().LoadAsync().ConfigureAwait(true);
            await GetRequiredService<Services.Memory.IMemoryService>().InitializeAsync().ConfigureAwait(true);

            var mainWindow = new MainWindow
            {
                DataContext = GetRequiredService<MainViewModel>()
            };

            mainWindow.Show();
        }
        catch (Exception ex)
        {
            logService.Error("Startup failed.", ex);
            MessageBox.Show(
                "Jarvis failed to start. Check the log files for details.",
                "Jarvis",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
            Shutdown(-1);
        }
    }

    public static T GetRequiredService<T>() where T : notnull
    {
        if (Current is not App app || app._serviceProvider is null)
        {
            throw new InvalidOperationException("Application services are not initialized.");
        }

        return app._serviceProvider.GetRequiredService<T>();
    }

    private static IServiceProvider ConfigureServices()
    {
        var services = new ServiceCollection();

        services.AddSingleton<Services.Logging.ILogService, Services.Logging.FileLogService>();
        services.AddSingleton<Services.Navigation.INavigationService, Services.Navigation.NavigationService>();
        services.AddSingleton<Services.Settings.ISettingsService, Services.Settings.SettingsService>();
        services.AddSingleton<Services.Memory.MemoryStore>();
        services.AddSingleton<Services.Memory.IMemoryService, Services.Memory.MemoryService>();

        services.AddSingleton<ChatViewModel>();
        services.AddSingleton<SettingsViewModel>();
        services.AddSingleton<MainViewModel>();

        services.AddLogging(builder => builder.AddDebug());

        return services.BuildServiceProvider();
    }
}
