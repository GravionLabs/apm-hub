---
name: dotnet-implementation
description: >
  C#/.NET-specific implementation and test rules. Extends the parent
  `implementation` skill with .NET conventions. Auto-loaded when
  `implementation` skill dispatches to `dotnet-implementation`.
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
- Library code: `ConfigureAwait(false)` on every `await`; app code: optional
- I/O methods accept `CancellationToken cancellationToken = default` and pass it through
- Logging: `ILogger<T>` with structured templates (`"User {UserId} created"`), never `Console.WriteLine`
- XML docs on public API (`GenerateDocumentationFile` is on); `<summary>` is one sentence starting with a third-person verb

## EF Core

- Fluent API in `IEntityTypeConfiguration<T>`, not data annotations
- Always configure string max length
- Never edit a generated migration; add a new one

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
