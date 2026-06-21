namespace Jarvis.Services.Navigation;

public sealed class NavigationService : INavigationService
{
    public NavigationTarget CurrentTarget { get; private set; } = NavigationTarget.Chat;

    public event EventHandler<NavigationTarget>? NavigationChanged;

    public void NavigateTo(NavigationTarget target)
    {
        if (CurrentTarget == target)
        {
            return;
        }

        CurrentTarget = target;
        NavigationChanged?.Invoke(this, target);
    }
}
