using ModelContextProtocol.Server;
using ModelContextProtocol.Protocol;
using System.ComponentModel;

[McpServerPromptType]
public class MyPrompts
{
    [McpServerPrompt, Description("Generates a code review prompt for the given code snippet.")]
    public static PromptMessage ReviewCode(
        [Description("The code snippet to review.")] string code,
        [Description("Programming language of the snippet.")] string language = "C#")
        => new()
        {
            Role = Role.User,
            Content = new TextContent
            {
                Text = $"Please review the following {language} code and suggest improvements:\n\n```{language.ToLower()}\n{code}\n```"
            }
        };
}
