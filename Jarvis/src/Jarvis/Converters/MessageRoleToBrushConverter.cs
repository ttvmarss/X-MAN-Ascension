using System.Globalization;
using System.Windows;
using System.Windows.Data;
using Jarvis.Models;

namespace Jarvis.Converters;

public sealed class MessageRoleToBrushConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is not MessageRole role)
        {
            return Application.Current.FindResource("BrushSurface");
        }

        return role switch
        {
            MessageRole.User => Application.Current.FindResource("BrushUserBubble"),
            MessageRole.Assistant => Application.Current.FindResource("BrushAssistantBubble"),
            _ => Application.Current.FindResource("BrushSystemBubble")
        };
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}
