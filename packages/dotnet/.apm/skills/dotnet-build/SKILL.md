---
name: dotnet-build
description: >
  .NET / C# build and restore rules. Covers dotnet restore, build, and
  code analysis. Use this skill during the build/verify phase of a .NET
  project.
allowed-tools: execute shell runCommands read search codebase
compatibility: opencode, github-copilot
---

## Prerequisites

- .NET SDK (matching `global.json` or latest)
- Project root with `.sln` or `.csproj`

## Restore

```powershell
dotnet restore
```

- Restores NuGet packages from `Directory.Packages.props` (Central Package Management)

## Build

```powershell
dotnet build --no-restore
```

- Builds all projects in the solution
- Strict: warnings treated as errors (`TreatWarningsAsErrors` in `.csproj`)

## Full rebuild

```powershell
dotnet build
```

- Combines restore + build in one step (slower but safer in CI)

## Code Analysis

```powershell
dotnet format --verify-no-changes
```

- Checks formatting (`.editorconfig`-driven)

## Gotchas

- Solution uses Central Package Management via `Directory.Packages.props`
- Multi-target builds for NuGet libraries (`net6.0;net8.0`)
- `dotnet build --no-restore` is faster when packages are already restored
