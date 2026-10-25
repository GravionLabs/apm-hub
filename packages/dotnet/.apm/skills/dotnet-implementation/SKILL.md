---
name: dotnet-implementation
description: 'C#/.NET implementation and test rules extending `implementation`. Loaded when `implementation` dispatches to dotnet-implementation.'
---

The official `dotnet` plugin skills (dependency `dotnet/skills`) cover general C#/.NET style. Only project conventions follow.

## Conventions

- `dotnet build` with Central Package Management; nullable enabled
- Naming: `_camelCase` fields; files `{ClassName}.cs`
- File-scoped namespaces; global usings for `System.*` in one file
- DI: constructor injection only, prefer primary constructors
- `record` types for DTOs, `init` setters for models
- Solution: code in `src/`, versions in `Directory.Packages.props`
- Library code: `ConfigureAwait(false)` on every `await`; app code: optional
- I/O methods accept `CancellationToken cancellationToken = default` and pass it through
- Logging: `ILogger<T>` with structured templates, never `Console.WriteLine`
- XML docs on public API; `<summary>` is one sentence starting with a third-person verb
- Upgrades: bump versions centrally in `Directory.Build.props` / `Directory.Packages.props`; no prerelease unless requested; build and test after each step

## Format

- Extensions: `.cs`
- Format: `dotnet format --include {files}`
- Check (read-only): `dotnet format --verify-no-changes --include {files}`
- Not configured: `dotnet format` unavailable — the `-Requires` probe fails, the script prints `skipped: dotnet not configured`; note it in the report
- Run each format command after green tests, before the commit: `pwsh <implementation dir>/scripts/Format-Changed.ps1 -Language dotnet -Extensions .cs -Requires 'dotnet format --version' -Command 'dotnet format --include {files}'` (`-Check` for the check commands; see `implementation` `references/format.md`)
- Override: `.agents/format.json` with an entry for `dotnet` replaces these commands; then run the script once per mode with `-Language dotnet` only (it supplies extensions and commands); a missing configured tool is an error (`docs/usage/format-override.md`)
- JetBrains: `jb cleanupcode` / `jb inspectcode` as override example, see `docs/usage/format-override.md`

## EF Core

- Fluent API in `IEntityTypeConfiguration<T>`, not data annotations
- Always configure string max length
- Never edit a generated migration; add a new one

## Tests

Runner, layout, naming, structure and mocking live in `dotnet-test`.

## Review rules

- No `.Result`, `.Wait()`, or `async void` (except event handlers)
- `CancellationToken` propagated through async call chains
- Nullable reference types respected; no swallowed exceptions
- `record` for DTOs; dependencies injected via interfaces
- Tests follow `dotnet-test` conventions

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
