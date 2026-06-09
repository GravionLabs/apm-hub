---
name: dotnet-implementation
description: >
  C#/.NET-specific implementation and test rules. Extends the parent
  `implementation` skill with .NET conventions. Auto-loaded when
  `implementation` skill dispatches to `dotnet-implementation`.
allowed-tools: execute shell runCommands read write edit editFiles search codebase
compatibility: opencode, github-copilot
model: gpt-4.1
---

## Framework

- **Test runner**: NUnit
- **Mocking**: NSubstitute
- **Assertions**: Shouldly
- **Build**: `dotnet build` with Central Package Management
- **Nullable**: enabled (`<Nullable>enable</Nullable>`)

## Imports

- System namespaces first, then NuGet packages, then project namespaces
- Global usings in `Usings.cs` or `.csproj` `<Using>` items
- Prefer file-scoped namespaces: `namespace MyApp.Services;`

## Conventions

- Naming: `PascalCase` for types, methods, properties; `_camelCase` for fields
- Async: `async Task` / `async Task<T>`, never `async void`
- DI: constructor injection only, prefer primary constructors
- Nullable: enable, annotate with `?` where null is valid
- Immutability: `record` types for DTOs, `init` setters for models
- File naming: `{ClassName}.cs`, test files: `{ClassName}Tests.cs`
- Solution: `src/` and `tests/` directories, Central Package Management via `Directory.Packages.props`

## Test Examples

### Service test

```csharp
using NUnit.Framework;
using NSubstitute;
using Shouldly;

[TestFixture]
public class MyServiceTests
{
    private IMyService _service;
    private IDependency _dependency;

    [SetUp]
    public void SetUp()
    {
        _dependency = Substitute.For<IDependency>();
        _service = new MyService(_dependency);
    }

    [Test]
    public void ProcessData_ValidInput_ReturnsResult()
    {
        _dependency.Get().Returns(new[] { "a", "b" });

        var result = _service.ProcessData();

        result.ShouldNotBeNull();
        result.Count.ShouldBe(2);
    }
}
```

## Related Skills

- **Test**: Load `dotnet-test` for NUnit, NSubstitute, and Shouldly details
- **EF Core**: Load `dotnet-ef-core` for database access patterns
