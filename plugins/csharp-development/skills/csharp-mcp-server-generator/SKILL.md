---
name: csharp-mcp-server-generator
description: 'Generate a complete MCP server project in C# with tools, prompts, resources, stdio transport, and proper logging configuration.'
allowed-tools: editFiles codebase runCommands
---

Generate a complete Model Context Protocol (MCP) server in C#.

## What this skill does
Creates a C# console application that implements an MCP server using `ModelContextProtocol` (prerelease) with `Microsoft.Extensions.Hosting`, exposes tools and prompts, and uses stdio transport.

## Steps
1. Ask: project name, tools to expose (names, descriptions, input schemas), prompts to include
2. Create project:
   ```bash
   dotnet new console -n <ProjectName>
   cd <ProjectName>
   dotnet add package ModelContextProtocol --prerelease
   dotnet add package Microsoft.Extensions.Hosting
   ```
3. Configure `Program.cs`:
   ```csharp
   var builder = Host.CreateApplicationBuilder(args);
   builder.Logging.AddConsole(o => o.LogToStandardErrorThreshold = LogLevel.Trace);
   builder.Services.AddMcpServer()
       .WithStdioServerTransport()
       .WithTools<MyTools>()
       .WithPrompts<MyPrompts>();
   await builder.Build().RunAsync();
   ```
4. Create tool classes with `[McpServerToolType]` and `[McpServerTool]` attributes
5. Create prompt classes with `[McpServerPromptType]` and `[McpServerPrompt]` attributes
6. Add `appsettings.json` with `Logging` config routing all logs to stderr
7. Build and verify: `dotnet build`

## Constraints
- All logs must go to stderr — never stdout (stdio transport uses stdout for MCP protocol)
- Tool methods should be `async Task<string>` or `async Task<CallToolResponse>`
