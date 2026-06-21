using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Jarvis.Models;
using Jarvis.Services.Logging;
using Jarvis.Services.Memory;
using Jarvis.Services.Navigation;

namespace Jarvis.ViewModels;

public sealed partial class ChatViewModel : ViewModelBase
{
    private readonly ILogService _logService;
    private readonly IMemoryService _memoryService;
    private readonly INavigationService _navigationService;

    [ObservableProperty]
    private string _inputText = string.Empty;

    [ObservableProperty]
    private bool _isListening;

    [ObservableProperty]
    private bool _isBusy;

    [ObservableProperty]
    private ConversationItemViewModel? _selectedConversation;

    public ObservableCollection<ConversationItemViewModel> Conversations { get; } = [];

    public ObservableCollection<ChatMessage> Messages { get; } = [];

    public ChatViewModel(
        ILogService logService,
        IMemoryService memoryService,
        INavigationService navigationService)
    {
        _logService = logService;
        _memoryService = memoryService;
        _navigationService = navigationService;

        CreateNewConversation();
    }

    [RelayCommand]
    private void NewConversation()
    {
        CreateNewConversation();
        _logService.Info("Started a new conversation.");
    }

    [RelayCommand]
    private void SelectConversation(ConversationItemViewModel? conversation)
    {
        if (conversation is null)
        {
            return;
        }

        foreach (var item in Conversations)
        {
            item.IsSelected = item.Id == conversation.Id;
        }

        SelectedConversation = conversation;
        LoadConversationPlaceholder(conversation);
    }

    [RelayCommand(CanExecute = nameof(CanSendMessage))]
    private async Task SendMessageAsync()
    {
        if (SelectedConversation is null || string.IsNullOrWhiteSpace(InputText))
        {
            return;
        }

        try
        {
            IsBusy = true;
            var userText = InputText.Trim();
            InputText = string.Empty;

            Messages.Add(new ChatMessage
            {
                Role = MessageRole.User,
                Content = userText
            });

            UpdateConversationTitle(userText);

            // Stage 1 placeholder — AI integration arrives in a later stage.
            await Task.Delay(350).ConfigureAwait(true);

            Messages.Add(new ChatMessage
            {
                Role = MessageRole.Assistant,
                Content = "Voice and AI services will be connected in the next stage. Your message was received."
            });

            SelectedConversation.UpdatedAt = DateTime.UtcNow;
        }
        catch (Exception ex)
        {
            _logService.Error("Failed to send message.", ex);
            Messages.Add(new ChatMessage
            {
                Role = MessageRole.System,
                Content = "Something went wrong while sending your message."
            });
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private void ToggleVoiceInput()
    {
        IsListening = !IsListening;
        _logService.Info(IsListening ? "Voice input activated (placeholder)." : "Voice input deactivated.");
    }

    [RelayCommand]
    private void OpenSettings() => _navigationService.NavigateTo(NavigationTarget.Settings);

    private bool CanSendMessage() => !IsBusy && !string.IsNullOrWhiteSpace(InputText);

    partial void OnInputTextChanged(string value) => SendMessageCommand.NotifyCanExecuteChanged();

    partial void OnIsBusyChanged(bool value) => SendMessageCommand.NotifyCanExecuteChanged();

    private void CreateNewConversation()
    {
        var conversation = new ConversationItemViewModel
        {
            Id = Guid.NewGuid().ToString("N"),
            Title = "New conversation",
            UpdatedAt = DateTime.UtcNow,
            IsSelected = true
        };

        foreach (var item in Conversations)
        {
            item.IsSelected = false;
        }

        Conversations.Insert(0, conversation);
        SelectedConversation = conversation;
        Messages.Clear();

        Messages.Add(new ChatMessage
        {
            Role = MessageRole.Assistant,
            Content = "Good day. I am Jarvis. Ask me anything — voice features arrive in the next build stage."
        });
    }

    private void LoadConversationPlaceholder(ConversationItemViewModel conversation)
    {
        Messages.Clear();
        Messages.Add(new ChatMessage
        {
            Role = MessageRole.Assistant,
            Content = $"Loaded \"{conversation.Title}\". Full history persistence arrives in a later stage."
        });
    }

    private void UpdateConversationTitle(string userText)
    {
        if (SelectedConversation is null)
        {
            return;
        }

        if (SelectedConversation.Title == "New conversation")
        {
            SelectedConversation.Title = userText.Length <= 42
                ? userText
                : string.Concat(userText.AsSpan(0, 39), "...");
        }
    }
}
