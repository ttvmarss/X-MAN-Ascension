using CommunityToolkit.Mvvm.ComponentModel;
using Jarvis.Services.Navigation;
using Jarvis.ViewModels;

namespace Jarvis.ViewModels;

public sealed partial class MainViewModel : ViewModelBase
{
    private readonly INavigationService _navigationService;

    [ObservableProperty]
    private ViewModelBase _currentViewModel;

    [ObservableProperty]
    private NavigationTarget _currentTarget;

    public MainViewModel(
        INavigationService navigationService,
        ChatViewModel chatViewModel,
        SettingsViewModel settingsViewModel)
    {
        _navigationService = navigationService;
        _currentViewModel = chatViewModel;
        _currentTarget = NavigationTarget.Chat;

        _navigationService.NavigationChanged += OnNavigationChanged;
    }

    private void OnNavigationChanged(object? sender, NavigationTarget target)
    {
        CurrentTarget = target;
        CurrentViewModel = target switch
        {
            NavigationTarget.Settings => App.GetRequiredService<SettingsViewModel>(),
            _ => App.GetRequiredService<ChatViewModel>()
        };
    }
}
