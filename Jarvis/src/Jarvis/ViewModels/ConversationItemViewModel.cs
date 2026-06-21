using CommunityToolkit.Mvvm.ComponentModel;

namespace Jarvis.ViewModels;

public sealed partial class ConversationItemViewModel : ViewModelBase
{
    [ObservableProperty]
    private string _id = string.Empty;

    [ObservableProperty]
    private string _title = string.Empty;

    [ObservableProperty]
    private DateTime _updatedAt;

    [ObservableProperty]
    private bool _isSelected;
}
