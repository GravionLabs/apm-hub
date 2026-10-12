---
name: dotnet-implementation
description: 'C#/.NET implementation and test rules extending `implementation`. Loaded when `implementation` dispatches to dotnet-implementation.'
---

The official `dotnet` plugin skills (dependency `dotnet/skills`) cover general C#/.NET style. Only project conventions follow.

## Conventions

- Test stack: NUnit, NSubstitute, Shouldly; `dotnet build` with Central Package Management; nullable enabled
- Naming: `_camelCase` fields; files `{ClassName}.cs`, tests `{ClassName}Tests.cs`
- File-scoped namespaces; global usings for `System.*` in one file
- DI: constructor injection only, prefer primary constructors
- `record` types for DTOs, `init` setters for models
- Solution: `src/` and `test/<Project>.Tests`, versions in `Directory.Packages.props`
- Library code: `ConfigureAwait(false)` on every `await`; app code: optional
- I/O methods accept `CancellationToken cancellationToken = default` and pass it through
- Logging: `ILogger<T>` with structured templates, never `Console.WriteLine`
- XML docs on public API; `<summary>` is one sentence starting with a third-person verb
- Upgrades: bump versions centrally in `Directory.Build.props` / `Directory.Packages.props`; no prerelease unless requested; build and test after each step

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
