using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Jarvis.Models;
using Jarvis.Services.Logging;
using Jarvis.Services.Memory;
using Jarvis.Services.Navigation;
using Jarvis.Services.Settings;

namespace Jarvis.ViewModels;

public sealed partial class SettingsViewModel : ViewModelBase
{
    private readonly ILogService _logService;
    private readonly ISettingsService _settingsService;
    private readonly IMemoryService _memoryService;
    private readonly INavigationService _navigationService;

    [ObservableProperty]
    private bool _voiceInputEnabled;

    [ObservableProperty]
    private bool _voiceOutputEnabled;

    [ObservableProperty]
    private bool _saveConversationHistory;

    [ObservableProperty]
    private double _speechRate;

    [ObservableProperty]
    private int _maxMemoryEntries;

    [ObservableProperty]
    private string _selectedVoice = "Default";

    [ObservableProperty]
    private string _statusMessage = string.Empty;

    public ObservableCollection<string> AvailableVoices { get; } =
    [
        "Default",
        "Microsoft David",
        "Microsoft Zira",
        "Microsoft Mark"
    ];

    public string LogDirectory => _logService.LogDirectory;

    public SettingsViewModel(
        ILogService logService,
        ISettingsService settingsService,
        IMemoryService memoryService,
        INavigationService navigationService)
    {
        _logService = logService;
        _settingsService = settingsService;
        _memoryService = memoryService;
        _navigationService = navigationService;

        LoadFromSettings();
    }

    [RelayCommand]
    private void BackToChat() => _navigationService.NavigateTo(NavigationTarget.Chat);

    [RelayCommand]
    private async Task SaveSettingsAsync()
    {
        try
        {
            var settings = _settingsService.Current;
            settings.VoiceInputEnabled = VoiceInputEnabled;
            settings.VoiceOutputEnabled = VoiceOutputEnabled;
            settings.SaveConversationHistory = SaveConversationHistory;
            settings.SpeechRate = SpeechRate;
            settings.MaxMemoryEntries = MaxMemoryEntries;
            settings.VoiceName = SelectedVoice;

            await _settingsService.SaveAsync().ConfigureAwait(true);
            StatusMessage = "Settings saved.";
            _logService.Info("Settings updated from settings page.");
        }
        catch (Exception ex)
        {
            StatusMessage = "Failed to save settings.";
            _logService.Error("Settings save failed.", ex);
        }
    }

    [RelayCommand]
    private async Task ClearMemoryAsync()
    {
        await _memoryService.ClearAsync().ConfigureAwait(true);
        StatusMessage = "Local memory cleared.";
    }

    private void LoadFromSettings()
    {
        var settings = _settingsService.Current;
        VoiceInputEnabled = settings.VoiceInputEnabled;
        VoiceOutputEnabled = settings.VoiceOutputEnabled;
        SaveConversationHistory = settings.SaveConversationHistory;
        SpeechRate = settings.SpeechRate;
        MaxMemoryEntries = settings.MaxMemoryEntries;
        SelectedVoice = settings.VoiceName;
    }
}
