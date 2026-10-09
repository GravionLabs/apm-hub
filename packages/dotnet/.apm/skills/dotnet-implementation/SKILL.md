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
- Solution: `src/` and `test/<Project>.Tests` directories, Central Package Management via `Directory.Packages.props`
- Library code: `ConfigureAwait(false)` on every `await`; app code: optional
- I/O methods accept `CancellationToken cancellationToken = default` and pass it through
- Logging: `ILogger<T>` with structured templates (`"User {UserId} created"`), never `Console.WriteLine`
- XML docs on public API (`GenerateDocumentationFile` is on); `<summary>` is one sentence starting with a third-person verb
- Upgrades: bump `TargetFramework` and package versions centrally in `Directory.Build.props` / `Directory.Packages.props` (`dotnet outdated` lists candidates); no prerelease versions unless explicitly requested; build and test after each step

## EF Core

- Fluent API in `IEntityTypeConfiguration<T>`, not data annotations
- Always configure string max length
- Never edit a generated migration; add a new one

## Tests

Structure, naming and mocking live in `dotnet-test` (NUnit + NSubstitute + Shouldly, `Should_<expected>_when_<condition>`).

## Review rules

- No `.Result`, `.Wait()`, or `async void` (except event handlers)
- `CancellationToken` propagated through async call chains
- Nullable reference types respected; no swallowed exceptions
- `record` for DTOs; dependencies injected via interfaces
- Tests named `Should_<expected>_when_<condition>`, AAA structure
- No shared mutable state between tests; assertions are specific (not just `ShouldNotBeNull`)

## Minimal APIs

House convention: endpoints are organized with Carter modules, not scattered `app.MapGet` calls in `Program.cs`:

```csharp
public class <Feature>Module : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/<feature>").WithTags("<Feature>");
        group.MapGet("/", Handle).WithName("<Name>").WithOpenApi();
    }
}
```

- Register with `builder.Services.AddCarter()` and `app.MapCarter()`
- Typed request/response records; OpenAPI metadata (`.WithSummary()`, `.Produces<T>()`, `.ProducesProblem()`)
- Return `TypedResults`, not `Results.Ok(...)`; validate input (FluentValidation or Data Annotations)
