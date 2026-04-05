---
description: 'C# coding standards for .NET projects: naming conventions, structure, async/await, LINQ, error handling, and SOLID principles'
applyTo: '**/*.cs'
---

# C# Development

## C# Instructions
- Always use the latest version C#, currently C# 14 features.
- Write clear and concise comments for each function.

## C# 13 / .NET 9 Features (prefer these)

- **`params` collections** — use `params ReadOnlySpan<T>` instead of `params T[]` for better performance; also works with `IEnumerable<T>`, `List<T>`
  ```csharp
  static void Log(params ReadOnlySpan<string> messages) { ... }
  ```
- **`System.Threading.Lock`** — use `Lock` type instead of `lock(object)` for improved performance and diagnostics
  ```csharp
  private readonly Lock _lock = new();
  using (_lock.EnterScope()) { ... }
  ```
- **LINQ additions** — prefer `CountBy`, `AggregateBy`, and `Index` over manual loops
  ```csharp
  var counts = items.CountBy(x => x.Category);
  var indexed = items.Index(); // (int Index, T Item) tuples
  ```
- **`\e` escape sequence** — use `\e` instead of `\x1b` or `\u001b` for ANSI escape codes

## C# 14 / .NET 10 Features (prefer these)

- **`field` keyword in auto-properties** — access the compiler-generated backing field directly:
  ```csharp
  public string Name
  {
      get;
      set => field = value?.Trim() ?? throw new ArgumentNullException(nameof(value));
  }
  ```
- **Implicit span conversions** — `string[]` and `T[]` convert implicitly to `ReadOnlySpan<T>` in method calls
- **`allows ref struct`** — use in generic constraints when accepting `ref struct` types like `Span<T>`:
  ```csharp
  static T Process<T>(T value) where T : allows ref struct { ... }
  ```

## General Instructions
- Make only high confidence suggestions when reviewing code changes.
- Write code with good maintainability practices, including comments on why certain design decisions were made.
- Handle edge cases and write clear exception handling.
- For libraries or external dependencies, mention their usage and purpose in comments.

## Naming Conventions

- Follow PascalCase for component names, method names, constants and public members.
- Use `_camelCase` for private fields.
- Use camelCase for local variables.
- Prefix interface names with "I" (e.g., IUserService).
- Suffix async methods with "Async".

## Formatting

- Apply code-formatting style defined in `.editorconfig`.
- Max line length is 120 characters.
- Prefer file-scoped namespace declarations.
- Place `using` directives outside the namespace; sort System namespaces first.
- Do not qualify members with `this.` unless necessary.
- Braces:
  - Use Allman style (new line before opening brace) for all blocks.
  - Braces are required for multi-line control statements; optional for single-line but prefer them when multiline.
- Ensure that the final return statement of a method is on its own line.
- Use `var` for built-in types, when the type is apparent from context, and elsewhere when it improves readability.
- Prefer expression-bodied members for constructors, methods, properties, accessors, and indexers when the body is a single expression.
- Use pattern matching, switch expressions, and primary constructors wherever possible.
- Use `nameof` instead of string literals when referring to member names.
- Ensure that XML doc comments are created for any public APIs. When applicable, include `<example>` and `<code>` documentation in the comments.

## Project Setup and Structure

Use the following layout for all .NET projects:

```
/
├── Directory.Build.props        # Shared build settings for all projects
├── Directory.Packages.props     # Central Package Management — all package versions defined here
├── .editorconfig                # Code style and formatting rules
├── <Solution>.slnx              # Solution file
├── src/
│   ├── Directory.Build.props    # Imports root props; sets OutputPath to $(SolutionDir)bin\$(Configuration)
│   └── <ProjectName>/
│       └── <ProjectName>.csproj
└── test/
    ├── Directory.Build.props    # Imports root props; adds IsPackable=false and test package references
    └── <ProjectName>.Tests/
        └── <ProjectName>.Tests.csproj
```

**Root `Directory.Build.props`** — applies to all projects:
```xml
<Project>
  <PropertyGroup>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <LangVersion>Latest</LangVersion>
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
    <DebugType>pdbonly</DebugType>
  </PropertyGroup>
</Project>
```

**`Directory.Packages.props`** — Central Package Management:
```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <PackageVersion Include="NUnit" Version="4.x.x"/>
    <PackageVersion Include="NSubstitute" Version="5.x.x"/>
    <PackageVersion Include="Shouldly" Version="4.x.x"/>
    <!-- all package versions declared here; never inline in .csproj -->
  </ItemGroup>
</Project>
```

**`test/Directory.Build.props`** — test-specific settings:
```xml
<Project>
  <Import Project="../Directory.Build.props"/>
  <PropertyGroup>
    <IsPackable>false</IsPackable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="coverlet.collector"/>
    <PackageReference Include="Microsoft.NET.Test.Sdk"/>
    <PackageReference Include="NUnit"/>
    <PackageReference Update="NUnit.Analyzers">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
    <PackageReference Include="NUnit3TestAdapter"/>
    <PackageReference Include="NSubstitute"/>
    <PackageReference Include="Shouldly"/>
  </ItemGroup>
  <ItemGroup>
    <Using Include="NUnit.Framework"/>
  </ItemGroup>
</Project>
```

- Test `.csproj` files contain only a `<ProjectReference>` to the corresponding `src/` project — no package references (inherited from `test/Directory.Build.props`).
- Source `.csproj` files contain only project-specific metadata (PackageId, Authors, Description, etc.) — no version numbers on `<PackageReference>` elements.
- Never specify package versions inline in `.csproj`; always use `Directory.Packages.props`.

## Nullable Reference Types

- Declare variables non-nullable, and check for `null` at entry points.
- Always use `is null` or `is not null` instead of `== null` or `!= null`.
- Trust the C# null annotations and don't add null checks when the type system says a value cannot be null.

## Data Access Patterns

- Guide the implementation of a data access layer using Entity Framework Core.
- Explain different options (SQL Server, SQLite, In-Memory) for development and production.
- Demonstrate repository pattern implementation and when it's beneficial.
- Show how to implement database migrations and data seeding.
- Explain efficient query patterns to avoid common performance issues.

## Performance Optimization

- Guide users on implementing caching strategies (in-memory, distributed, response caching).
- Explain asynchronous programming patterns and why they matter for API performance.
- Demonstrate pagination, filtering, and sorting for large data sets.
- Show how to implement compression and other performance optimizations.
- Explain how to measure and benchmark API performance.

## Deployment and DevOps

- Guide users through containerizing their API using .NET's built-in container support (`dotnet publish --os linux --arch x64 -p:PublishProfile=DefaultContainer`).
- Explain the differences between manual Dockerfile creation and .NET's container publishing features.
- Explain CI/CD pipelines for NET applications.
- Demonstrate deployment to Azure App Service, Azure Container Apps, or other hosting options.
- Show how to implement health checks and readiness probes.
- Explain environment-specific configurations for different deployment stages.
