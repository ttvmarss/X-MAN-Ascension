using System.Globalization;
using System.Windows;
using System.Windows.Data;
using Jarvis.Models;

namespace Jarvis.Converters;

public sealed class MessageRoleToAlignmentConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is MessageRole.User)
        {
            return HorizontalAlignment.Right;
        }

        return HorizontalAlignment.Left;
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}
