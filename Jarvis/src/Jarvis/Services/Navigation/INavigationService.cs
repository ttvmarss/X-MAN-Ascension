namespace Jarvis.Services.Navigation;

public enum NavigationTarget
{
    Chat,
    Settings
}

public interface INavigationService
{
    NavigationTarget CurrentTarget { get; }

    event EventHandler<NavigationTarget>? NavigationChanged;

    void NavigateTo(NavigationTarget target);
}
